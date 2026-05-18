# Parent Picker — Data Model (current + proposed)

Single source of truth for the `pp_*` schema as it actually exists on `schools_data` Supabase, plus the changes proposed to support the Community Site spec (`Real Estate Location` doc → tab "Community Site").

`schema-design.md` is the historical Phase 1 doc and is not maintained. Treat this file as authoritative.

---

## 1. Boundary

- We own everything under the `pp_*` prefix in `public`.
- We **read** `rebl3_sites` and `rebl3_status` (REBL3 upstream). Never write.
- We do not touch `real_estate_listings` or any other non-`pp_` table.

---

## 2. Current schema

### 2.1 `pp_locations` — one row per physical site
The map-visible entity. Many fields are duplicated from `rebl3_sites` for legacy mock-data reasons; the view (`pp_locations_with_votes`) prefers REBL values when present.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name`, `address`, `city`, `state`, `zip` | text | Mirror of REBL address; view prefers `rebl3_sites` values |
| `lat`, `lng` | numeric | Same — view prefers REBL coords |
| `region` | text | Metro grouping key (e.g. "Austin") |
| `status` | text | `active` / `pending_review` / `rejected` / `archived` |
| `source` | text | `moody` / `internal` / `parent_suggested` |
| `proposed` | bool | true ⇔ site is in the parent-vote window (set by `pp_watch_loi_status` cron) |
| `feedback_deadline` | timestamptz | Set by cron on promotion (NOW+14d) |
| `is_bridge` | bool | Short-term/bridge site (e.g. hotel space) |
| `released` | bool | Public-facing visibility flag for sites pre-promotion |
| `vote_count`, `not_here_count` | int | Denormalized counters maintained by triggers from `pp_votes` |
| `rebl3_site_id` | text | Join key to `rebl3_sites.site_id` |
| `brochure_url`, `notes`, `suggested_by` | | |
| `created_at`, `updated_at` | timestamptz | |

### 2.2 `pp_votes` — one row per parent vote
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `location_id` | uuid → pp_locations | |
| `user_id` | uuid → auth.users | |
| `vote_type` | text | `in` (default) / `not_here` |
| `comment` | text | "Not here" reason (free text) |
| `created_at` | timestamptz | |

Unique on `(location_id, user_id)`. Counts flow back to `pp_locations.vote_count` / `not_here_count` via triggers.

### 2.3 `pp_profiles` — extends auth.users
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK = auth.users.id | |
| `email` | text NOT NULL | denormalized for convenience |
| `display_name` | text | |
| `home_address`, `home_lat`, `home_lng` | | Saved address overrides browser geolocation |
| `drive_time_minutes` | int default 30 | Used by isochrone filter |
| `created_at` | timestamptz | |

### 2.4 `pp_location_scores` — RED dimensions snapshot (legacy)
Per-site colored scores (red/yellow/green) plus size classification. Mostly superseded by REBL3 reads via the view, but still used as a fallback / for proposed locations without REBL site IDs.

Columns: `overall_color`, `overall_details_url`, `price_color`, `zoning_color`, `neighborhood_color`, `building_color`, `play_area_color`, `size_classification`, `synced_at`.

### 2.5 `pp_location_photos`
Carousel images for proposed locations.
`id`, `location_id`, `url`, `sort_order`, `created_at`.

### 2.6 `pp_contributions`
Free-text positive contributions ("Who's in" comments) — `location_id`, `user_id`, `comment`, `created_at`.

### 2.7 `pp_help_requests`
Logged when a parent clicks "I want to help" (location-specific or generic).
`email`, `user_id?`, `location_id?`, `location_address`, `location_name`, `created_at`.

### 2.8 `pp_invites`
Inviter→invitee email log. `inviter_id`, `invitee_email`, `created_at`.

### 2.9 `pp_admin_actions` — append-only audit log
`location_id?`, `action`, `admin_email`, `recipient_emails[]`, `email_failed`, `created_at`.
Actions: `approve`, `reject`, `notify_voters`, `help_request_sent`, etc.

### 2.10 `pp_site_champions` — redesign tables
Lead + supporters for a site.
| Column | Notes |
|---|---|
| `site_id` | → pp_locations |
| `user_id` | → auth.users |
| `role` | `lead` / `supporter` |
| `claimed_at`, `released_at`, `passed_to_user_id` | Lifecycle |

Partial unique index: at most one **active** `lead` per site (where `released_at IS NULL`).

### 2.11 `pp_site_problems` — site + metro problem board
| Column | Notes |
|---|---|
| `site_id` | nullable (metro-level problems allowed) |
| `metro` | required |
| `title`, `description` | |
| `deadline` | date |
| `pivot_trigger` | bool — flags problems whose resolution would change Plan of Record |
| `parent_ownable` | bool — gates the claim CTA |
| `category` | text default `other` (current vocab: arbitrary; see proposal) |
| `severity` | `L` / `M` / `H` default `M` |
| `status` | `open` / `in_progress` / `resolved` / `unresolvable` |
| `outcome_text` | resolution note |
| `source_ref` | jsonb — provenance (e.g. regulatory sync) |
| `created_by`, `created_at`, `closed_at`, `admin_edited_at` | |

### 2.12 `pp_problem_owners`
One active owner per problem (enforced via partial unique).
`problem_id`, `user_id`, `claimed_at`, `released_at?`.

### 2.13 `pp_problem_updates`
Owner-only posts under a problem.
`problem_id`, `user_id`, `body`, `created_at`.

### 2.14 `pp_plan_of_record` — per-metro narrative
| Column | Notes |
|---|---|
| `metro` | PK |
| `narrative_template_inputs` | jsonb (auto-build inputs) |
| `narrative_override` | text (admin-edited override) |
| `pivot_conditions` | jsonb array of `{condition, then}` items |
| `last_curated_at`, `last_curated_by` | |

### 2.15 View: `pp_locations_with_votes`
The frontend reads through this. Adds the following on top of `pp_locations`:
- Address/coord fallback chain (`rebl3_sites` → `pp_locations`)
- `overall_color` / `price_color` / `zoning_color` / `neighborhood_color` / `building_color` (via `pp_judgment_color()` on the REBL3 dim_* fields)
- `overall_score` (REBL overall_score)
- `overall_details_url` → `rebl3.vercel.app/site/<id>`
- `size_classification`, `capacity`
- LATERAL joins to `rebl3_status` for `leasing_status` / `leasing_details` / `loi_status` / `strategy_status`
- DD shortcuts: `dd_fast_open_capacity`, `dd_fast_open_proj_open_date`

There are also RPC functions `get_locations_in_bounds` and `get_nearby_locations` that return the same shape.

---

## 3. Read-only upstream (REBL3)

We depend on these — see `docs/pp-rebl3-integration.md` and `docs/rebl3-api-reference.md` for the full reference.

- `rebl3_sites` — canonical site record (address, REBL3 dim_* scores, overall_score, capacity, school_size_category)
- `rebl3_status` — per-site rows keyed by `system` (`leasing`, `loi`, `strategy`, `due-diligence`, `regulatory`, `parents`, …). One row per `(site_id, system)`; `parents` is the one we write.

Key signals we currently consume:
- `leasing.status` ∈ `cut | done | turn_1..3 | ready | …`
- `loi.status` ∈ `cut | signed | loi-signed | done | completed`
- `strategy.status` ∈ `start | kill | …`
- `due-diligence.details.fast_open.{capacity, proj_open_date}`

---

## 4. Derived concepts (computed in app code, not in DB)

### 4.1 `getStage` — `src/lib/sites/stage.ts`
Returns `scored | engaged | committed | moved_on` from leasing/loi/strategy.
Rules (priority order):
1. `strategy = 'kill'` → moved_on
2. `leasing = 'cut'` or `loi = 'cut'` → moved_on
3. `leasing = 'done'` + `details.process_exception = true` → moved_on
4. `leasing = 'done'` → committed (lease executed)
5. any active `leasing` or `loi` → engaged
6. else → scored

### 4.2 `getCategory` — `src/lib/sites/category.ts`
Returns `parent | ai | short_term` from `is_bridge` + active champions.

### 4.3 `parseCommittedSubStage` / `parseMovedOnReason` — `src/lib/sites/parser.ts`
Substages within `committed`: LOI → Lease → Zoning → Permits → Buildout → CO.
Moved-on reason: free-text humanized label.

---

## 5. RLS summary
- `pp_locations`: anyone reads `status='active'`; authenticated insert with `source='parent_suggested'` + `status='pending_review'`; updates via service role
- `pp_votes`: users CRUD their own; counts read via view
- `pp_profiles`: anyone reads; users update their own
- `pp_site_champions`, `pp_site_problems`, `pp_problem_owners`, `pp_problem_updates`: public read; owners/admins write per route logic
- `pp_plan_of_record`: public read; admin write

---

# 6. Proposed changes — Community Site spec

The spec asks for **one uniform site card** with seven fields, plus an Ask rail and metro-level decision rights/cut criteria. Below is the minimal data-model delta to support it. UI/flow changes are intentionally out of scope here — this section is only about what the schema needs to look like.

## 6.1 Spec card fields → where each one comes from

| Spec field | Source | Action |
|---|---|---|
| **Stage** (Prospect / LOI / Lease / Permitting / Build-out / Ready / Open) | `getStage` + substage parser | **Extend taxonomy** — add Ready + Open, expose substages as first-class |
| **Plan of record** | `pp_plan_of_record` (per metro) | OK as-is at metro level. **Add per-site `plan_summary`** for the card's one-liner |
| **Target open date** | `view.dd_fast_open_proj_open_date` (REBL DD) | Already in view. Surface uniformly. No DB change. |
| **Next gate** | derived from open `pp_site_problems` for the site (top severity, soonest deadline) | No new column needed; need a deterministic picker function/view |
| **Pivot trigger** | `pp_plan_of_record.pivot_conditions` (metro) **and** `pp_site_problems.pivot_trigger` (site) | OK to mix — but **add `pp_locations.pivot_trigger_text`** for a card-level human summary |
| **Backup plan** | — | **NEW column** `pp_locations.backup_plan_text`, mandatory if `regulatory_risk` |
| **Ask rail** (Intros / Public actions / Data) | reuse `pp_site_problems` | **Constrain `category` to the 3-slot vocab** (`intros` / `public_actions` / `data` / `other`), or split into a sibling `pp_site_asks` table |

## 6.2 Proposed schema deltas

### A. Stage taxonomy: extend `getStage` (no DB column)
Add two terminal stages:
- `ready` — `leasing='done'` AND a new signal indicating CO issued. Likely needs REBL to add a `co.status='issued'` row (upstream change) OR we hand-flip `pp_locations.opened_at` IS NOT NULL after lease.
- `open` — school is operating. Driver: `pp_locations.opened_at IS NOT NULL` AND `opened_at <= now()`.

**New columns** on `pp_locations`:
```sql
ALTER TABLE pp_locations
  ADD COLUMN co_issued_at   timestamptz,  -- Certificate of Occupancy
  ADD COLUMN opened_at      timestamptz;  -- school first operating day
```
Then `getStage` becomes 7-valued: `scored | engaged | committed | ready | open | moved_on` (+ keep substages for committed via existing parser).

### B. Per-site card-level narrative fields
```sql
ALTER TABLE pp_locations
  ADD COLUMN plan_summary        text,  -- one-line PoR fragment for the card
  ADD COLUMN pivot_trigger_text  text,  -- "if CUP on Site B denied 5/31, pivot to Site C"
  ADD COLUMN backup_plan_text    text,  -- mandatory for regulatory-risk sites
  ADD COLUMN regulatory_risk     boolean NOT NULL DEFAULT false;
```

We could derive `plan_summary` from PoR, but the spec is explicit: every card shows it, plain language, no negotiation tactics. A free-text field admin-curates is the simplest path. Same logic for `pivot_trigger_text` and `backup_plan_text` — they're meant to be plain-English, not a JSON-driven render.

### C. Ask rail — preferred: tighten `pp_site_problems.category`
The Ask rail is just a categorized problem list. We already have ownership, claim, updates, severity, deadlines. Two changes:

```sql
-- Constrain category vocab. Migration: backfill 'other' → mapped value where possible
ALTER TABLE pp_site_problems
  ADD CONSTRAINT pp_site_problems_category_chk
  CHECK (category IN ('intros', 'public_actions', 'data', 'other'));

-- Surface the rail order on the card
ALTER TABLE pp_site_problems
  ADD COLUMN rail_priority int NOT NULL DEFAULT 0;
```

Alternative: separate `pp_site_asks` table. Rejected because it'd duplicate ownership/claim/updates/severity. Reuse what we have.

### D. Decision rights — metro-level static config
The spec wants Decision Rights published. This is mostly static across metros, but parents need to see it per-metro. Two options:

**Option 1 (simpler):** Hard-code in app — it's the same table for every metro per the spec.

**Option 2 (more flexible):** Add to PoR:
```sql
ALTER TABLE pp_plan_of_record
  ADD COLUMN decision_rights jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Shape: [{ topic, parent_role, alpha_role }, ...]
```

I lean **Option 1** unless we expect divergence between metros. Recommend revisiting if/when a metro asks for an exception.

### E. Cut criteria — metro-level static text
Same logic as decision rights: 99% the same per metro. Hard-code, OR:
```sql
ALTER TABLE pp_plan_of_record
  ADD COLUMN cut_criteria jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Shape: [{ name: 'Hard', rule: '...' }, ...]
```

When a site moves on, **classify** the reason into one of `hard | timeline | economics | strategic`:
```sql
ALTER TABLE pp_locations
  ADD COLUMN moved_on_class text  -- 'hard' | 'timeline' | 'economics' | 'strategic'
  CHECK (moved_on_class IN ('hard','timeline','economics','strategic'));
```
Populated when `getStage = moved_on` first observed; could be derived from REBL signal patterns + admin override.

### F. Tradeoff weighting vote (Day 7 spec mechanic) — bigger scope
The spec wants parents to vote on weights for `speed / outdoor / building / location / ops` per campus, every campaign. New table:

```sql
CREATE TABLE pp_tradeoff_weights (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metro         text NOT NULL,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  speed         smallint NOT NULL CHECK (speed BETWEEN 0 AND 100),
  outdoor       smallint NOT NULL CHECK (outdoor BETWEEN 0 AND 100),
  building      smallint NOT NULL CHECK (building BETWEEN 0 AND 100),
  location      smallint NOT NULL CHECK (location BETWEEN 0 AND 100),
  ops           smallint NOT NULL CHECK (ops BETWEEN 0 AND 100),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pp_tradeoff_weights_sum CHECK (speed + outdoor + building + location + ops = 100),
  CONSTRAINT pp_tradeoff_weights_one_per_user UNIQUE (metro, user_id)
);
```
Mean weights per metro then feed re-ranking in the app. Tracker for "Day 7" deadlines lives on `pp_plan_of_record` (see Time-box below).

### G. Time-box (Day 0 / 7 / 10) — metro-level campaign clock
Three deadlines per metro:
```sql
ALTER TABLE pp_plan_of_record
  ADD COLUMN campaign_started_at      timestamptz,
  ADD COLUMN tradeoff_vote_due_at     timestamptz,   -- "Day 7"
  ADD COLUMN loi_decision_due_at      timestamptz;   -- "Day 10"
```
App derives "what's due when" from these. Manual set by admin on campaign launch.

### H. PlayArea as 5th REBL dimension
Already partially present (`pp_location_scores.play_area_color`). Surface it in `pp_locations_with_votes`:
```sql
-- View change: add LEFT JOIN to pp_location_scores OR pull dim_play_area from rebl3_sites once REBL adds it
-- No new table.
```
If REBL3 plans to add `dim_play_area` upstream, we wait for that and just include the column in the view. If not, we keep using `pp_location_scores.play_area_color` as the source.

## 6.3 Summary — minimum-viable delta

To ship the spec's single-card schema (sections A–C only, deferring D/E/F/G/H):

```sql
-- 1. New per-site card fields
ALTER TABLE pp_locations
  ADD COLUMN co_issued_at        timestamptz,
  ADD COLUMN opened_at           timestamptz,
  ADD COLUMN plan_summary        text,
  ADD COLUMN pivot_trigger_text  text,
  ADD COLUMN backup_plan_text    text,
  ADD COLUMN regulatory_risk     boolean NOT NULL DEFAULT false;

-- 2. Ask-rail vocab
ALTER TABLE pp_site_problems
  ADD CONSTRAINT pp_site_problems_category_chk
  CHECK (category IN ('intros','public_actions','data','other'));

ALTER TABLE pp_site_problems
  ADD COLUMN rail_priority int NOT NULL DEFAULT 0;

-- 3. View update — expose new pp_locations columns
-- (re-create pp_locations_with_votes adding the six new columns)
```

App-code changes (out of scope for this doc but listed for completeness):
- `getStage` → 7-valued enum + `co_issued_at` / `opened_at` rules
- Card component → single uniform schema reading new fields
- Admin Problems form → category restricted to the 3-slot vocab
- Migration of existing `pp_site_problems` rows: map `other` → best guess; leave admin to clean up

## 6.4 Open questions

1. **Ready / Open signal source** — REBL upstream column, or hand-set timestamps on `pp_locations`? Spec doesn't say; I lean hand-set until REBL adds them.
2. **`plan_summary` curation** — admin types this, or auto-build from REBL DD + PoR? Spec says plain English, no negotiation tactics, so probably admin-curated.
3. **Per-site vs per-metro pivot trigger** — current `pp_plan_of_record.pivot_conditions` is metro-level. Spec phrases pivot as per-site ("if CUP on Site B"). The proposal adds a `pivot_trigger_text` on `pp_locations` so both can coexist, but we should agree on which one drives the card display.
4. **Decision rights / cut criteria** — hard-code vs jsonb. Default to hard-code unless metros need to diverge.
5. **PlayArea source** — wait for REBL or keep using `pp_location_scores`.
6. **Tradeoff vote rollup** — show mean weights to parents, or use them only server-side for ranking?

---

---

# 7. Concrete schema deltas — 4 S FL metros

This section supersedes Section 6 for the work we actually plan to ship next. Driven by the four spec metros (Miami, Miami Beach, Palm Beach Gardens, Boca Raton).

## 7.1 Site inventory (as of 2026-05-18)

| Spec line | pp_locations row | rebl3 stage today | Spec stage | Notes |
|---|---|---|---|---|
| Miami / 8000 SW 56th St — Open / Cap 159 | `8000-sw-56th-st-miami-fl` | scored (no rebl3_status) | Open | Need `opened_at` |
| Miami / 3301 Grand Ave — LOI / Cap 350 (Upgrade, Aug 2029) | `3301-grand-ave-miami-fl`, proposed=true | engaged | LOI | Upgrade target for 8000 SW 56th |
| Miami Beach / 1021 Biarritz — LOI / Cap 167 | `1021-biarritz-dr-miami-beach-fl`, proposed=true | engaged | LOI (In Diligence) | DD proj_open_date NULL ⇒ "In Diligence" |
| Miami Beach / 300 71st St — LOI / Cap 150 | `300-71st-miami-beach-fl`, proposed=true | engaged | LOI (In Diligence) | Duplicate row `300-71st-st-miami-beach-fl` to clean up |
| Palm Beach / 353 Hiatt Dr — Open / Cap 26 | `353-hiatt-dr-palm-beach-gardens-fl` (region `palm-beach-fl`) | engaged (stale REBL) | Open | Opened Aug 2025; REBL state needs cleanup upstream |
| Palm Beach / 10350 Riverside Dr — Build-out / Aug 2026 (Upgrade) | `10350-riverside-dr-palm-beach-gardens-fl` (region `palm-beach-fl`) | committed | Build-out | Upgrade target for 353 Hiatt |
| Boca / 2200 NW 5th Ave — Build-out / Cap 40 / Aug 2026 | `2200-nw-5th-ave-boca-raton-fl` | committed | Build-out | proj_open already 2026-08-12 |
| Boca / 1515 N Federal Hwy — LOI / Cap 86 | `1515-n-federal-hwy-boca-raton-fl`, proposed=true | engaged | LOI (In Diligence) | |
| Boca / 2100 N Dixie Hwy — AI Scored / Cap 92 | `2100-north-dixie-hwy-boca-raton-fl` | engaged (loi=claimed) | Scored | Stage conflict — spec is stale or REBL is wrong |
| Boca / 3060 N Federal Hwy — AI Scored / Cap 50 | `3060-north-federal-hwy-boca-raton-fl` | engaged (loi=claimed) | Scored | Same conflict |
| Boca / IBM ?? | (not yet matched) | — | Scored | Need to identify property |

## 7.2 Decisions

1. **Four metros via the curated `ACTIVE_METROS` list (`src/lib/active-metros.ts`).** Metros are now derived from lat/lng + radius, not from `pp_locations.region`. Display names: `Miami`, `Miami Beach`, `Palm Beach`, `Boca Raton`. Miami and Palm Beach already existed; this work adds Miami Beach (25.81, -80.14, r=12mi) and Boca Raton (26.37, -80.10, r=12mi). The nearest-center-within-radius algorithm in `findActiveMetro` correctly routes all 10 spec sites with these added entries.
2. **Card displays both capacity/date pairs when both present.** REBL DD details has two parallel blocks (`fast_open` and `max_cap`) — each with `capacity` and `proj_open_date`. Surface both. Where spec numbers don't match REBL, fix the REBL data upstream — no pp schema change for capacity.
3. **"In Diligence" is derived, not stored.** A site is "in diligence to confirm open date" when stage = engaged AND `loi_status = 'done'` AND `dd_fast_open_proj_open_date IS NULL`. Render as a sub-label on the LOI stage badge. No new column.
4. **Open stage signaled by `opened_at`.** A site is Open when `opened_at IS NOT NULL AND opened_at <= now()`. Future-dated `opened_at` reads as Ready.
5. **"Upgrade" is a per-site relationship**, not a label. `upgrade_for_location_id` points from the new candidate to the current open campus.
6. **Regulatory / Permits / Summer program** are static site-level flags. The actual work tracks via `pp_site_problems` (existing). The flags answer "does this site face this hurdle at all?" — the problems answer "is the hurdle resolved?"
7. **Backup plan is per metro**, free-text on `pp_plan_of_record.backup_plan`.
8. **Data cleanup parked as follow-up** — not blocking schema work:
   - Duplicate `300 71st St` rows (consolidate to the proposed one)
   - Stale `rebl3_status` on 353 Hiatt (it's Open, not LOI)
   - 2100 N Dixie / 3060 N Federal stage conflict
   - Mixed region values (`palm-beach-fl` / `palm-beach` / `broward-fl` for Boca rows)

## 7.3 SQL — minimum delta

```sql
-- A. Open-campus signal
ALTER TABLE pp_locations
  ADD COLUMN opened_at timestamptz;

-- B. Upgrade relationship (FK to the campus we plan to replace)
ALTER TABLE pp_locations
  ADD COLUMN upgrade_for_location_id uuid REFERENCES pp_locations(id);

CREATE INDEX idx_pp_locations_upgrade_for ON pp_locations(upgrade_for_location_id);

-- C. Static site-level hurdle flags (NULL = unknown / ?)
ALTER TABLE pp_locations
  ADD COLUMN regulatory_required boolean,
  ADD COLUMN permits_required    boolean,
  ADD COLUMN summer_program      boolean;

-- D. Metro backup plan (free text)
ALTER TABLE pp_plan_of_record
  ADD COLUMN backup_plan text;
```

## 7.4 View update

`pp_locations_with_votes` needs to expose the new columns + the `max_cap` block from REBL DD. Drop and re-create with these additions:

From `pp_locations` directly:
- `l.opened_at`
- `l.upgrade_for_location_id`
- `l.regulatory_required`
- `l.permits_required`
- `l.summer_program`

In the existing DD LATERAL (extend the SELECT to grab both blocks):
```sql
LEFT JOIN LATERAL (
  SELECT
    NULLIF((s.details->'fast_open'->>'capacity'), '')::integer       AS fast_open_capacity,
    NULLIF((s.details->'fast_open'->>'proj_open_date'), '')::date    AS fast_open_proj_open_date,
    NULLIF((s.details->'max_cap'->>'capacity'), '')::integer         AS max_cap_capacity,
    NULLIF((s.details->'max_cap'->>'proj_open_date'), '')::date      AS max_cap_proj_open_date
  FROM rebl3_status s
  WHERE s.site_id = l.rebl3_site_id AND s.system = 'due-diligence'
  ORDER BY s.updated_at DESC NULLS LAST
  LIMIT 1
) dd ON true
```

Project as `dd.max_cap_capacity AS dd_max_cap_capacity`, `dd.max_cap_proj_open_date AS dd_max_cap_proj_open_date`.

(The `get_locations_in_bounds` / `get_nearby_locations` RPCs return the same shape — they need the same additions.)

## 7.5 App-code changes (out of scope for the SQL, listed for follow-up)

- `getStage` adds two terminal cases: `ready` (`opened_at` > now) and `open` (`opened_at` ≤ now). Existing `scored | engaged | committed | moved_on` keep their meaning.
- Derive "In Diligence" sub-label per 7.2 rule 3.
- Card capacity/date display: show **two rows when both blocks are present** — "Phase 1: <fast_open_capacity> students, opens <fast_open_proj_open_date>" and "Full: <max_cap_capacity> students, opens <max_cap_proj_open_date>". Collapse to one row if only one block exists.
- Card surfaces (in order): Stage badge → capacity/date pair(s) → next gate (top open problem) → regulatory/permits/summer-program chips → upgrade-for hint → ask rail.
- Metro panel surfaces `pp_plan_of_record.backup_plan` once populated.

## 7.6 Backfill plan for the 11 spec sites

After columns land:

```sql
-- Open campuses (Alpha typically opens mid-August)
UPDATE pp_locations SET opened_at = '2024-08-12'::timestamptz
  WHERE rebl3_site_id = '8000-sw-56th-st-miami-fl';
UPDATE pp_locations SET opened_at = '2025-08-12'::timestamptz
  WHERE rebl3_site_id = '353-hiatt-dr-palm-beach-gardens-fl';

-- Upgrade pairs
UPDATE pp_locations SET upgrade_for_location_id =
  (SELECT id FROM pp_locations WHERE rebl3_site_id='8000-sw-56th-st-miami-fl')
  WHERE rebl3_site_id='3301-grand-ave-miami-fl';

UPDATE pp_locations SET upgrade_for_location_id =
  (SELECT id FROM pp_locations WHERE rebl3_site_id='353-hiatt-dr-palm-beach-gardens-fl')
  WHERE rebl3_site_id='10350-riverside-dr-palm-beach-gardens-fl';

-- Hurdle flags (true=yes, false=no, NULL=?)
UPDATE pp_locations SET regulatory_required = true,  permits_required = false WHERE rebl3_site_id='3301-grand-ave-miami-fl';
UPDATE pp_locations SET regulatory_required = true,  summer_program  = true  WHERE rebl3_site_id='10350-riverside-dr-palm-beach-gardens-fl';
UPDATE pp_locations SET regulatory_required = true                            WHERE rebl3_site_id='2200-nw-5th-ave-boca-raton-fl';
-- (1021 Biarritz, 300 71st, 1515 N Federal: leave flags NULL until specified)

-- Metro backup plans (keyed by display name to match ACTIVE_METROS + how
-- metroName flows through panel + PoR API). pp_locations.region is no longer
-- used for metro mapping (replaced by lat/lng + radius in active-metros.ts).
INSERT INTO pp_plan_of_record (metro, backup_plan) VALUES
  ('Miami Beach', 'Miami, Boca, or Palm Beach — or temporary homeschool in a licensed hotel space in Miami Beach.'),
  ('Boca Raton',  'Miami, Miami Beach, or Palm Beach — or temporary homeschool in a licensed hotel space in Boca.')
ON CONFLICT (metro) DO UPDATE SET backup_plan = EXCLUDED.backup_plan;
```

---

**File last regenerated from live schema**: 2026-05-18.
