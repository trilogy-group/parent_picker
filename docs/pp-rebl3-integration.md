# Parent Picker ↔ REBL3 Integration Spec

## Overview

Parent Picker (PP) uses REBL3 as its scoring engine. `rebl3_sites` is the master table — PP never writes to it. PP maintains `pp_locations` as a thin tracking layer for votes, status, and admin workflows. Scoring data flows from REBL3 to PP via SQL JOINs and the REBL3 external API.

**Base URL:** `https://rebl3.vercel.app`
**API spec:** `docs/rebl3-api-reference.md`

---

## Architecture

```
rebl3_sites (master, read-only from PP)
    ↕ JOIN on site_id = rebl3_site_id
pp_locations (tracking: votes, status, released, suggested_by)
    ↕ FK
pp_votes, pp_admin_actions, pp_help_requests
```

### Data ownership

| Table | Owner | PP access |
|-------|-------|-----------|
| `rebl3_sites` | REBL3 pipeline | Read-only (JOIN for scores, identity, geography) |
| `rebl3_feedback` | REBL3 | Write (fire-and-forget vote feedback) |
| `pp_locations` | PP | Read/write (tracking layer) |
| `pp_votes` | PP | Read/write |
| `pp_location_scores` | Deprecated | Not used — scores come from rebl3_sites |

### Key columns

**`pp_locations`** (PP tracking):
- `rebl3_site_id` (text) — FK to `rebl3_sites.site_id`
- `status` — `active` | `pending_scoring` | `pending_review` | `rejected`
- `source` — `rebl3_pipeline` | `parent_suggested` | `internal`
- `released` (boolean) — visible to parents when true
- `vote_count`, `not_here_count` — denormalized (trigger-maintained)
- `suggested_by` (uuid) — FK to auth.users for parent suggestions

**`rebl3_sites`** (master scoring):
- `site_id` (text) — deterministic slug from address
- `overall` (integer) — 1=GREEN, 2=YELLOW, 3=RED
- `dim_neighborhood`, `dim_zoning`, `dim_building`, `dim_cost` (integer) — dimension judgments
- `capacity` (integer), `school_size_category` (text) — sizing
- `agent_results` (jsonb) — full agent prose
- `region` (text) — geographic region slug

---

## SQL Layer

### pp_judgment_color() helper

Maps rebl3_sites integer judgments to PP color strings:

```sql
CREATE FUNCTION pp_judgment_color(val integer) RETURNS text AS $$
  SELECT CASE val WHEN 1 THEN 'GREEN' WHEN 2 THEN 'YELLOW' WHEN 3 THEN 'RED' ELSE NULL END;
$$;
```

### RPCs

All RPCs JOIN `pp_locations` to `rebl3_sites` and use `pp_judgment_color()` to convert integers to color strings. Identity columns (address, city, state, zip, lat, lng) use `COALESCE(rebl3_sites, pp_locations)` for fallback.

| RPC | Purpose | Key columns from rebl3_sites |
|-----|---------|------------------------------|
| `get_locations_in_bounds` | Map dot loading | overall, dimensions, capacity, school_size_category |
| `get_nearby_locations` | Nearby locations | Same |
| `get_location_cities` | City bubble aggregation | overall (for exclude_red/exclude_unscored filters) |

### pp_locations_with_votes view

Same JOIN pattern — replaces the old pp_location_scores join.

---

## pg_cron Jobs

Two cron jobs run every 30 seconds inside Postgres:

### 1. pp_sync_new_sites

Creates `pp_locations` rows for new `rebl3_sites` entries that don't have tracking rows yet.

```sql
INSERT INTO pp_locations (name, address, city, state, zip, lat, lng,
  status, source, released, rebl3_site_id, region, vote_count, not_here_count)
SELECT r.address, r.address, r.city, r.state, r.zip, r.lat, r.lng,
  'active', 'rebl3_pipeline', false, r.site_id, r.region, 0, 0
FROM rebl3_sites r
WHERE r.overall IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM pp_locations l WHERE l.rebl3_site_id = r.site_id);
```

New sites are `released = false` — invisible to parents until admin releases the region.

### 2. pp_check_scoring_complete

Detects when parent-suggested sites finish scoring in REBL3:

```sql
UPDATE pp_locations l
SET status = 'pending_review', updated_at = now()
FROM rebl3_sites r
WHERE l.rebl3_site_id = r.site_id
  AND l.status = 'pending_scoring'
  AND r.overall IS NOT NULL;
```

This triggers the existing `trg_pp_suggestion_scored` trigger on pp_locations, which fires the webhook to send the parent a notification email.

---

## Data Flows

### Flow 1: Pipeline sites (bulk)

```
REBL3 pipeline scores site → INSERT rebl3_sites
    ↓ (within 30s)
pg_cron pp_sync_new_sites → INSERT pp_locations (active, released=false)
    ↓ (when admin releases region)
pp_locations.released = true → visible to parents
```

### Flow 2: Parent suggestion

```
Parent submits address
    ↓
suggestLocation() → POST /api/submit {address, source: "pp", force: true}
    ↓ (immediate)
REBL3 returns site_id → INSERT pp_locations (pending_scoring, rebl3_site_id)
    ↓ (REBL3 scores in 5-60s)
rebl3_sites.overall set
    ↓ (within 30s)
pg_cron pp_check_scoring_complete → UPDATE status = 'pending_review'
    ↓ (trigger)
trg_pp_suggestion_scored → webhook → email parent "Your location has been evaluated"
    ↓ (admin)
Admin approves → status = 'active', released = true
```

### Flow 3: Detail page rendering

```
Parent opens location detail
    ↓
Client: fetchRebl3Site(rebl3SiteId) → GET /api/site/{id}/external
    ↓
REBL3 returns dimensions[] with judgment + prose
    ↓
Render DimensionCard per dimension (colored bg + prose text)
    ↓
Parent can vote per-dimension: "I agree with AI" / "I disagree with AI" / "I can help"
    ↓
postRebl3Feedback() → POST /api/site/{id}/feedback (fire-and-forget)
```

### Flow 4: Location-level voting

```
Parent votes "I'd choose this location" or "Not for me"
    ↓
[A] Local: UPSERT pp_votes (vote_type: 'in' | 'not_here')
[B] Remote: postRebl3FeedbackAllDimensions() → 4 POSTs to REBL3 feedback
    (all 4 dimensions: neighborhood, zoning, building, cost)
    (agree for 'in', disagree for 'not_here')
```

---

## Frontend Integration

### LocationDetailView (`src/components/LocationDetailView.tsx`)

Fetches REBL3 external API on mount. Three rendering states:

1. **Loading**: 4 skeleton bars with `animate-pulse`
2. **REBL3 data available**: `DimensionCard` per dimension — colored background (green/amber/red/gray), dimension name, prose, voting pills
3. **Fallback** (no rebl3SiteId or API failed): color dots per subscore from pp_location_scores data

### DimensionCard

Each card has three pill buttons:
- "I agree with AI" → green hover, posts `agree` for that dimension
- "I disagree with AI" → red hover, posts `disagree`
- "I can help" → blue hover, posts `help`

After clicking, pills replaced with confirmation badge ("Agreed — thanks!").

### Map popup (`src/components/MapView.tsx`)

When a location is selected, a Mapbox Popup shows:
- Street View Static API image (300x200, `source=outdoor`)
- Location name + city/state
- "View on Google Maps" link

### Size display

Capacity-first: uses `rebl3_sites.capacity` to show rounded range (e.g. 62 → "60-80 students"). Falls back to `school_size_category` labels (25-100, 100-200, 200-500, 500+) when capacity is null.

### Size filter

Filters by capacity ranges first, falls back to `school_size_category`:

| Filter | Capacity range | Category fallback |
|--------|---------------|-------------------|
| micro | 25-100 | `micro` |
| micro2 | 100-200 | `micro2` |
| growth | 200-500 | `growth` |
| full | 500+ | `flagship`, `full size` |

---

## API Routes

### Score lookups (all read from rebl3_sites)

| Route | What it does |
|-------|-------------|
| `GET /api/locations/[id]` | Fetches pp_locations + JOINs rebl3_sites for scores. Returns `pp_location_scores` key for backwards compat. |
| `GET /api/admin/locations` | Suggestions tab — enriches with rebl3_sites scores |
| `GET /api/admin/likes` | Likes tab — enriches with rebl3_sites scores |
| `GET /api/admin/history` | History tab — computes details URL from `rebl3_site_id` |
| `POST /api/admin/history/[id]/retry` | Retry failed emails — details URL from `rebl3_site_id` |
| `POST /api/webhooks/suggestion-scored` | Scored notification — details URL from `rebl3_site_id` |
| `POST /api/help-request` | Help request email — details URL from `rebl3_site_id` |

**Details URL formula:** `https://rebl3.vercel.app/site/${rebl3_site_id}`

### Judgment color mapping (used in API routes)

```typescript
function jc(val: number | null): string | null {
  if (val === 1) return "GREEN";
  if (val === 2) return "YELLOW";
  if (val === 3) return "RED";
  return null;
}
```

---

## Client Library (`src/lib/rebl3.ts`)

```typescript
// Fetch parent-safe site data (CORS-enabled)
fetchRebl3Site(siteId: string): Promise<Rebl3ExternalSite | null>

// Fire-and-forget feedback for one dimension
postRebl3Feedback(siteId, dimension, feedbackType, reviewer, comment?)

// Post same feedback to all 4 dimensions (used for location-level votes)
postRebl3FeedbackAllDimensions(siteId, feedbackType, reviewer, comment?)
```

Errors are swallowed — designed for client-side fire-and-forget. UI never blocks on REBL3 calls.

---

## Files

| File | Role |
|------|------|
| `src/lib/rebl3.ts` | REBL3 client (types, fetch, feedback) |
| `src/lib/locations.ts` | `submitToRebl3()`, `suggestLocation()`, data mappers |
| `src/lib/votes.ts` | REBL3 feedback in voteIn/voteNotHere, userEmail store |
| `src/lib/status.ts` | Color labels (Green/Yellow/Red), size labels (capacity-first) |
| `src/types/index.ts` | `Location.rebl3SiteId`, `LocationScores.capacity` |
| `src/components/LocationDetailView.tsx` | REBL3 dimension fetch + DimensionCard rendering |
| `src/components/MapView.tsx` | Selected location popup with street view |
| `src/app/api/locations/[id]/route.ts` | Single location API reading rebl3_sites |
| `src/app/api/admin/*.ts` | Admin routes reading rebl3_sites |
| `src/app/api/webhooks/suggestion-scored/route.ts` | Scored notification webhook |
| `sql/trigger_suggestion_scored.sql` | Trigger firing webhook on status change |
| `docs/rebl3-api-reference.md` | REBL3 API contract |
