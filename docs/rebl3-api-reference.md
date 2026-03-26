# REBL3 API Reference

**Base URL:** `https://rebl3.vercel.app`

---

## 1. Submit a Site for Scoring

`POST /api/submit`

Submits an address for scoring. Returns a deterministic `site_id` immediately. Scoring happens asynchronously — the daemon picks up the input, hydrates data, runs the scoring pipeline, and writes results to `rebl3_sites`. Poll `GET /api/site/{site_id}` to check when scoring is complete.

### Request

```
POST /api/submit
Content-Type: application/json
```

```jsonc
{
  // Required
  "address": "17667 N 91st Ave, Peoria, AZ 85382",

  // Source tracking (recommended)
  "source": "colliers",              // who submitted this (default: "api")
  "source_ids": {                    // your system's IDs for cross-reference
    "your_id": "LS-1234"
  },

  // Optional structured address fields (skips geocoding if provided)
  "lat": 33.673,
  "lng": -111.917,
  "city": "Peoria",
  "state": "AZ",
  "street": "17667 N 91st Ave",
  "zip": "85382",

  // Optional building data (skips hydration lookup if provided)
  "size_sqft": 30604,
  "lease_price_sqft_year": 22.50,
  "zoning_code": "O-1",
  "building_class": "B",
  "num_floors": 1,
  "category": "school",
  "subcategory": null,
  "availability": "available",       // "available" | "possible" | "unknown" (default: "unknown")

  // Optional catch-all for extra data
  "source_data": {
    "buildings": 4,
    "lot_acres": 4.28,
    "broker": "Colliers"
  },

  // Flags
  "priority": 10,                    // 0 = batch, 10 = immediate (default: 10)
  "skip_hydration": false,           // true = trust all provided fields, don't look up ATTOM/Smarty
  "force": true                      // true = re-score even if site already exists (default: true)
}
```

### Response

**201 Created:**
```jsonc
{
  "ok": true,
  "site_id": "17667-n-91st-ave-peoria-az",
  "input_id": "dea92f19-8123-4f22-960f-d817f1e4821a",
  "url": "https://rebl3.vercel.app/site/17667-n-91st-ave-peoria-az"
}
```

**400 Bad Request:**
```jsonc
{ "error": "Missing or invalid 'address' field (minimum 5 characters)" }
```

### Notes

- `site_id` is deterministic — derived from the address slug. The same address always produces the same `site_id`.
- Scoring takes 5-60 seconds depending on data availability. Poll `GET /api/site/{site_id}` until data appears.
- If the site already exists in `rebl3_sites`, `force: true` (default) re-scores it. Set `force: false` to skip.
- `source_data` is stored but not read by the pipeline — use it to attach metadata (broker info, listing URLs, notes).

---

## 2. Get Site Details (Internal)

`GET /api/site/{site_id}`

Returns the full scored site record including all agent results, dimensions, sub-dimensions, and raw scoring data. This is the internal/operator view — contains everything.

### Request

```
GET /api/site/17667-n-91st-ave-peoria-az
```

Optional query params:
- `env=staging` — read from staging table instead of production

### Response

**200 OK:**
```jsonc
{
  // Identity
  "site_id": "17667-n-91st-ave-peoria-az",
  "address": "17667 N 91st Ave, Peoria, AZ 85382",
  "street": "17667 N 91st Ave",
  "city": "Peoria",
  "state": "AZ",
  "zip": "85382",
  "lat": 33.673,
  "lng": -111.917,
  "region": "maricopa-az",

  // Classification (text, normalized from v2 integers)
  "classification": "GREEN",         // "GREEN" | "YELLOW" | "RED" | null
  "classification_rank": 1,          // 1 (best) to 3 (cut), null if unscored
  "overall_score": 12,               // 0-15 bitmask (see scoring section)
  "status": "ACTIVE",                // "ACTIVE" | "CUT"

  // Dimensions (text: "GREAT" | "VIABLE" | "CUT" | "N/A")
  "dim_neighborhood": "GREAT",
  "dim_zoning": "GREAT",
  "dim_building": "VIABLE",
  "dim_playarea": "VIABLE",          // alias for sub_play
  "dim_price": "N/A",               // alias for dim_cost
  "dim_cost": "N/A",

  // Sub-dimensions (text, same values)
  "sub_demographer": "GREAT",
  "sub_safety": "GREAT",
  "sub_play": "VIABLE",
  "sub_bldg_general": "GREAT",
  "sub_flow": null,                  // not yet implemented

  // Property
  "size_sqft": 30604,
  "school_size_category": "growth",  // "micro" | "micro2" | "growth" | "flagship" | "unknown"
  "capacity": 306,
  "listing_status": "available",     // "available" | "possible" | "unknown"
  "lease_price_sqft_year": null,
  "zoning_code": "O-1",
  "property_type": null,
  "building_class": null,
  "tuition": 40000,

  // Cut tracking
  "cut_by": null,                    // e.g., ["zoner", "neighbor"]
  "cut_reason": null,

  // Source
  "source": "colliers",
  "source_tags": ["colliers"],

  // Agent results (full JSONB — contains all agent prose and enrichment data)
  "agent_results": {
    "demographer": { "judgment": 1, "available_20min": 12500, "prose": { "short": "..." } },
    "neighbor": { "judgment": 1, "safety_score": 85, "prose": { "short": "..." } },
    "zoner": { "judgment": 1, "k12Permitted": "by_right", "prose": { "short": "..." } },
    "budget": { "judgment": null, "prose": { "short": "..." } },
    "buildingGeneral": { "judgment": 1, "prose": { "short": "..." } },
    "buildingPlay": { "judgment": 2, "prose": { "short": "..." } },
    "region": { "name": "Phoenix", "slug": "maricopa-az", "state": "AZ", "tuition": 40000 }
  },

  // Timestamps
  "created_at": "2026-03-24T10:00:00Z",
  "updated_at": "2026-03-24T10:05:00Z",
  "prose_generating": false
}
```

**404 Not Found:**
```jsonc
{ "error": "Site not found" }
```

### Scoring Reference

**Classification:** Determined by worst dimension. If any dimension is CUT → RED. If any is VIABLE → YELLOW. All GREAT → GREEN.

**overall_score (0-15 bitmask):**

| Bit | +Value | Condition |
|-----|--------|-----------|
| 3 | +8 | Zoning = GREAT |
| 2 | +4 | Neighborhood = GREAT |
| 1 | +2 | Building = GREAT |
| 0 | +1 | Cost = GREAT |

Score 15 = all four GREAT. Score 0 = none GREAT. Sort: `classification_rank ASC, overall_score DESC`.

**Dimension hierarchy:**
```
dim_neighborhood = worst of (sub_demographer, sub_safety)
dim_zoning       = zoner agent (direct)
dim_building     = worst of (sub_play, sub_bldg_general, sub_flow)
dim_cost         = budget agent (direct)
classification   = worst of all four dimensions
```

---

## 3. Get Site Details (External / Parent-Facing)

`GET /api/site/{site_id}/external`

Returns a sanitized, parent-safe version of the site with pre-built prose. No raw agent results, no internal scoring details. CORS-enabled for cross-origin access.

### Response

**200 OK:**
```jsonc
{
  "site_id": "17667-n-91st-ave-peoria-az",
  "address": "17667 N 91st Ave, Peoria, AZ 85382",
  "city": "Peoria",
  "state": "AZ",
  "zip": "85382",
  "lat": 33.673,
  "lng": -111.917,
  "classification": "GREEN",
  "overall_score": 12,
  "dimensions": [
    {
      "key": "neighborhood",
      "name": "Neighborhood",
      "judgment": "GREAT",
      "prose": "Located in a strong family-oriented area with excellent demographics and safety."
    },
    {
      "key": "zoning",
      "name": "Zoning",
      "judgment": "GREAT",
      "prose": "K-12 school use is permitted by right under the current zoning classification."
    }
  ],
  "property": {
    "size_sqft": 30604,
    "school_size_category": "growth",
    "capacity": 306,
    "lease_price_sqft_year": null,
    "zoning_code": "O-1",
    "listing_status": "available",
    "region": "maricopa-az",
    "property_type": null,
    "building_class": null
  },
  "tuition": 40000,
  "cut_by": null,
  "cut_reason": null,
  "created_at": "2026-03-24T10:00:00Z",
  "updated_at": "2026-03-24T10:05:00Z"
}
```

### Differences from Internal API

| | Internal (`/api/site/{id}`) | External (`/api/site/{id}/external`) |
|---|---|---|
| `agent_results` | Full JSONB | Not included |
| `dimensions` | Flat columns (`dim_neighborhood`, etc.) | Array with pre-built prose |
| Sub-dimensions | Included (`sub_demographer`, etc.) | Not included |
| CORS | No | Yes (`Access-Control-Allow-Origin: *`) |
| Use case | Operator tools, pipeline debugging | Parent-facing UI, 3rd-party integrations |

---

## 4. Submit Parent Feedback

`POST /api/site/{site_id}/feedback`

Records parent feedback on a specific scoring dimension. Supports agree/disagree votes (one per reviewer per dimension, idempotent) and free-text help offers (always appended).

### Request

```
POST /api/site/17667-n-91st-ave-peoria-az/feedback
Content-Type: application/json
```

```jsonc
{
  "dimension": "neighborhood",       // required: "zoning" | "neighborhood" | "building" | "cost"
  "feedback_type": "agree",          // required: "agree" | "disagree" | "help"
  "reviewer": "jane@example.com",    // required: email or display name (identifies the voter)
  "comment": null,                   // required for "help", optional for agree/disagree
  "judgment": null                   // optional: the parent's suggested judgment (e.g., "GREAT")
}
```

### Response

**201 Created** (help) / **200 OK** (agree/disagree):
```jsonc
{ "ok": true, "id": "uuid" }
```

**400 Bad Request:**
```jsonc
{ "error": "Invalid dimension. Must be one of: zoning, neighborhood, building, cost" }
{ "error": "Invalid feedback_type. Must be one of: agree, disagree, help" }
{ "error": "reviewer is required" }
{ "error": "comment is required for 'help' feedback" }
```

### Behavior

| Type | Idempotency | What Happens |
|------|------------|--------------|
| `agree` | Replaces previous agree/disagree by same reviewer + dimension | Delete existing vote, insert new |
| `disagree` | Replaces previous agree/disagree by same reviewer + dimension | Delete existing vote, insert new |
| `help` | Always appends | Insert new row (multiple help offers per reviewer allowed) |

### Notes

- Stored in `rebl3_feedback` table in REBL3's Supabase
- Consumer systems should also store votes locally for their own UI state
- The `reviewer` field is the dedup key — use a stable identifier (email preferred)
- No authentication required (consumer is trusted to provide accurate reviewer identity)

---

## Common Patterns

### Check if a site has been scored

Submit, then poll:

```bash
# 1. Submit
curl -X POST https://rebl3.vercel.app/api/submit \
  -H "Content-Type: application/json" \
  -d '{"address": "17667 N 91st Ave, Peoria, AZ 85382", "source": "my-system"}'

# Response: { "ok": true, "site_id": "17667-n-91st-ave-peoria-az", ... }

# 2. Poll until scored (classification will be non-null)
curl https://rebl3.vercel.app/api/site/17667-n-91st-ave-peoria-az
```

### Idempotency

Submitting the same address twice is safe. The `site_id` is deterministic. With `force: true` (default), the site gets re-scored. With `force: false`, the existing score is kept.

### Staging vs Production

Add `?env=staging` to any GET endpoint to read from the staging table. The submit endpoint always writes to the production input queue.

---

## Parent Picker Integration

PP migrates to REBL3 APIs in two steps. Step A can be deployed independently.

### Step A: Display + Voting (no submission flow changes)

PP renders its own detail page using REBL3 data instead of linking to REBL3's UI.

```
Parent views location → PP fetches GET /api/site/{site_id}/external
                       → PP renders detail page with dimension prose
                       → Parent votes agree/disagree or offers help
                       → PP stores vote locally in pp_votes
                       → PP also posts to POST /api/site/{site_id}/feedback
```

PP needs the `site_id` (already stored in `pp_location_scores.overall_details_url` as the REBL3 slug). Extract it from the URL or store it directly.

### Step B: Submission + Status (structural change)

PP submits parent-suggested addresses via REBL3 API instead of relying on external scoring.

```
Parent suggests address → PP calls POST /api/submit {address, source: "pp", force: true}
                        → PP stores site_id in pp_locations.rebl3_site_id
                        → PP sets status = "pending_scoring"
                        → Supabase trigger on rebl3_sites INSERT/UPDATE
                          checks pp_locations for pending_scoring match
                        → Trigger calls PP webhook → PP flips to pending_review
                        → Admin reviews and approves/rejects
```

After Step B, PP can drop `pp_location_scores` (dimensions come from the external API) and use `rebl3_site_id` as the foreign key on `pp_locations`.
