# Card & Ownership Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add capacity / REBL score / opening-date facts to engaged-and-committed cards, collapse voting to detail-only, gate the "Own this" CTA on a new `parent_ownable` flag, and pull regulatory issues from a new `rebl3_status[system='regulatory']` row into `pp_site_problems`.

**Architecture:** Extend the existing `pp_locations_with_votes` view and the two location RPCs (`get_locations_in_bounds`, `get_nearby_locations`) to surface `overall_score`, DD `fast_open.capacity`, and DD `fast_open.proj_open_date`. Capacity already flows through; we add the score and DD fields. Vote actions strip from cards; detail-view voting unchanged. New columns on `pp_site_problems` (`parent_ownable`, `category`, `severity`, `source_ref`, `admin_edited_at`). A new sync utility + cron route reads `rebl3_status[system='regulatory']` per site and idempotently upserts `pp_site_problems` rows keyed on `(site_id, source_ref->>'name')`. Admin curation wins via `admin_edited_at` guard.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres + RLS), Vitest unit tests, Vercel cron, TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-08-card-and-ownership-refinements-design.md`

---

## File structure overview

| File | Role | Action |
|---|---|---|
| `sql/2026-05-08-card-and-ownership-refinements.sql` | DDL: new columns, view + RPC updates | Create |
| `src/types/index.ts` | `LocationDerived` and `SiteProblem` extensions | Modify |
| `src/lib/locations.ts` | `mapRowToScores`, `applyDerived` parse new columns | Modify |
| `src/components/AltPanel.tsx` | Inline engaged/committed card facts row + remove vote actions + severity-driven problem chip | Modify |
| `src/components/AltLocationCard.tsx` | Strip vote actions; keep avatars + progress | Modify |
| `src/components/ProblemCard.tsx` | Render category + severity chips; gate claim on `parent_ownable` | Modify |
| `src/components/ProblemList.tsx` | Sort H-severity parent-ownable to the top | Modify |
| `src/app/admin/page.tsx` | Problems tab form: parent_ownable, category, severity, source_ref display | Modify |
| `src/app/api/admin/problems/route.ts` and `[id]/route.ts` | Accept new fields; set `admin_edited_at` on PATCH | Modify |
| `src/app/api/sites/[id]/problems/route.ts` and `src/app/api/problems/route.ts` | Return new fields | Modify |
| `src/lib/sync/regulatory.ts` | Pure idempotent upsert logic; unit-tested | Create |
| `src/lib/sync/regulatory.test.ts` | Vitest unit tests | Create |
| `src/app/api/cron/sync-regulatory/route.ts` | Cron route invoking the sync utility | Create |
| `vercel.json` | Cron schedule (project has no Vercel config today) | Create |

---

## Phase A — Schema & types

### Task 1: SQL migration — pp_site_problems columns + view/RPC field additions

**Files:**
- Create: `sql/2026-05-08-card-and-ownership-refinements.sql`

- [ ] **Step 1: Write the migration**

Create `sql/2026-05-08-card-and-ownership-refinements.sql`:

```sql
-- 2026-05-08 Card & Ownership Refinements
-- Spec: docs/superpowers/specs/2026-05-08-card-and-ownership-refinements-design.md

-- 1. New columns on pp_site_problems
ALTER TABLE pp_site_problems
  ADD COLUMN IF NOT EXISTS parent_ownable  boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category        text         NOT NULL DEFAULT 'other'
    CHECK (category IN ('zoning','licensing','other')),
  ADD COLUMN IF NOT EXISTS severity        text         NOT NULL DEFAULT 'M'
    CHECK (severity IN ('H','M','L')),
  ADD COLUMN IF NOT EXISTS source_ref      jsonb,
  ADD COLUMN IF NOT EXISTS admin_edited_at timestamptz;

-- Lookup index for the regulatory-sync upsert key.
-- source_ref shape for regulatory-synced rows:
--   {"system":"regulatory","site_id":"<rebl3 site_id>","name":"<issue name>"}
CREATE INDEX IF NOT EXISTS idx_pp_site_problems_source_ref_name
  ON pp_site_problems ((source_ref->>'name'))
  WHERE source_ref IS NOT NULL;

-- Help the card chip query that filters parent-ownable + open per site.
CREATE INDEX IF NOT EXISTS idx_pp_site_problems_site_ownable
  ON pp_site_problems(site_id, severity)
  WHERE parent_ownable = true AND status IN ('open','in_progress');

-- 2. pp_locations_with_votes — add capacity, overall_score, dd_fast_open_*
CREATE OR REPLACE VIEW public.pp_locations_with_votes AS
SELECT l.id,
    COALESCE(l.name, r.address) AS name,
    COALESCE(r.address, l.address) AS address,
    COALESCE(r.city, l.city) AS city,
    COALESCE(r.state, l.state) AS state,
    COALESCE(r.zip, l.zip) AS zip,
    COALESCE(r.lat, l.lat::double precision) AS lat,
    COALESCE(r.lng, l.lng::double precision) AS lng,
    l.status,
    l.source,
    l.notes,
    l.suggested_by,
    l.created_at,
    l.updated_at,
    l.vote_count AS votes,
    l.not_here_count,
    pp_judgment_color(r.overall) AS overall_color,
    r.overall_score AS overall_score,
    CASE WHEN r.site_id IS NOT NULL THEN 'https://rebl3.vercel.app/site/' || r.site_id ELSE NULL END AS overall_details_url,
    pp_judgment_color(r.dim_cost) AS price_color,
    pp_judgment_color(r.dim_zoning) AS zoning_color,
    pp_judgment_color(r.dim_neighborhood) AS neighborhood_color,
    pp_judgment_color(r.dim_building) AS building_color,
    r.school_size_category AS size_classification,
    r.capacity AS capacity,
    l.proposed,
    l.rebl3_site_id AS property_source_key,
    l.is_bridge,
    l.feedback_deadline,
    leasing.status AS leasing_status,
    leasing.details AS leasing_details,
    loi.status AS loi_status,
    dd.fast_open_capacity AS dd_fast_open_capacity,
    dd.fast_open_proj_open_date AS dd_fast_open_proj_open_date
FROM pp_locations l
LEFT JOIN rebl3_sites r ON r.site_id = l.rebl3_site_id
LEFT JOIN LATERAL (
  SELECT s.status, s.details FROM rebl3_status s
  WHERE s.site_id = l.rebl3_site_id AND s.system = 'leasing'
  ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
) leasing ON true
LEFT JOIN LATERAL (
  SELECT s.status FROM rebl3_status s
  WHERE s.site_id = l.rebl3_site_id AND s.system = 'loi'
  ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
) loi ON true
LEFT JOIN LATERAL (
  SELECT
    NULLIF(s.details->'fast_open'->>'capacity','')::int        AS fast_open_capacity,
    NULLIF(s.details->'fast_open'->>'proj_open_date','')::date AS fast_open_proj_open_date
  FROM rebl3_status s
  WHERE s.site_id = l.rebl3_site_id AND s.system = 'due-diligence'
  ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
) dd ON true
WHERE l.status = 'active';

-- 3. get_locations_in_bounds — add overall_score + dd fast_open fields
DROP FUNCTION IF EXISTS public.get_locations_in_bounds(double precision, double precision, double precision, double precision, boolean);
CREATE OR REPLACE FUNCTION public.get_locations_in_bounds(
  min_lat double precision, max_lat double precision,
  min_lng double precision, max_lng double precision,
  released_only boolean DEFAULT false
)
RETURNS TABLE(
  id uuid, name text, address text, city text, state text, zip text,
  lat double precision, lng double precision,
  vote_count integer, not_here_count integer,
  source text, released boolean,
  overall_color text, overall_score integer, overall_details_url text,
  price_color text, zoning_color text, neighborhood_color text, play_area_color text, building_color text,
  school_size_category text, capacity integer,
  proposed boolean, property_source_key text, feedback_deadline timestamp with time zone,
  is_bridge boolean, leasing_status text, leasing_details jsonb, loi_status text,
  dd_fast_open_capacity integer, dd_fast_open_proj_open_date date
)
LANGUAGE plpgsql AS $function$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    COALESCE(l.name, r.address)::text,
    COALESCE(r.address, l.address)::text,
    COALESCE(r.city, l.city)::text,
    COALESCE(r.state, l.state)::text,
    COALESCE(r.zip, l.zip)::text,
    COALESCE(r.lat, l.lat::double precision),
    COALESCE(r.lng, l.lng::double precision),
    l.vote_count, l.not_here_count,
    l.source, l.released,
    pp_judgment_color(r.overall),
    r.overall_score,
    CASE WHEN r.site_id IS NOT NULL THEN 'https://rebl3.vercel.app/site/' || r.site_id ELSE NULL END,
    pp_judgment_color(r.dim_cost),
    pp_judgment_color(r.dim_zoning),
    pp_judgment_color(r.dim_neighborhood),
    pp_judgment_color(r.sub_play),
    pp_judgment_color(r.dim_building),
    r.school_size_category,
    r.capacity,
    l.proposed,
    l.rebl3_site_id,
    l.feedback_deadline,
    l.is_bridge,
    leasing.status::text,
    leasing.details,
    loi.status::text,
    dd.fast_open_capacity,
    dd.fast_open_proj_open_date
  FROM pp_locations l
  LEFT JOIN rebl3_sites r ON r.site_id = l.rebl3_site_id
  LEFT JOIN LATERAL (
    SELECT s.status, s.details FROM rebl3_status s
    WHERE s.site_id = l.rebl3_site_id AND s.system = 'leasing'
    ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
  ) leasing ON true
  LEFT JOIN LATERAL (
    SELECT s.status FROM rebl3_status s
    WHERE s.site_id = l.rebl3_site_id AND s.system = 'loi'
    ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
  ) loi ON true
  LEFT JOIN LATERAL (
    SELECT
      NULLIF(s.details->'fast_open'->>'capacity','')::int        AS fast_open_capacity,
      NULLIF(s.details->'fast_open'->>'proj_open_date','')::date AS fast_open_proj_open_date
    FROM rebl3_status s
    WHERE s.site_id = l.rebl3_site_id AND s.system = 'due-diligence'
    ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
  ) dd ON true
  WHERE l.status = 'active'
    AND (NOT released_only OR l.released = true OR l.proposed = true)
    AND COALESCE(r.lat, l.lat::double precision) BETWEEN min_lat AND max_lat
    AND COALESCE(r.lng, l.lng::double precision) BETWEEN min_lng AND max_lng;
END;
$function$;

-- 4. get_nearby_locations — same field additions
DROP FUNCTION IF EXISTS public.get_nearby_locations(double precision, double precision, integer, boolean);
CREATE OR REPLACE FUNCTION public.get_nearby_locations(
  center_lat double precision, center_lng double precision,
  max_results integer DEFAULT 50,
  released_only boolean DEFAULT false
)
RETURNS TABLE(
  id uuid, name text, address text, city text, state text, zip text,
  lat double precision, lng double precision,
  vote_count integer, not_here_count integer,
  source text, released boolean,
  overall_color text, overall_score integer, overall_details_url text,
  price_color text, zoning_color text, neighborhood_color text, play_area_color text, building_color text,
  school_size_category text, capacity integer,
  property_source_key text, feedback_deadline timestamp with time zone,
  is_bridge boolean, leasing_status text, leasing_details jsonb, loi_status text,
  dd_fast_open_capacity integer, dd_fast_open_proj_open_date date
)
LANGUAGE plpgsql AS $function$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    COALESCE(l.name, r.address)::text,
    COALESCE(r.address, l.address)::text,
    COALESCE(r.city, l.city)::text,
    COALESCE(r.state, l.state)::text,
    COALESCE(r.zip, l.zip)::text,
    COALESCE(r.lat, l.lat::double precision),
    COALESCE(r.lng, l.lng::double precision),
    l.vote_count, l.not_here_count,
    l.source, l.released,
    pp_judgment_color(r.overall),
    r.overall_score,
    CASE WHEN r.site_id IS NOT NULL THEN 'https://rebl3.vercel.app/site/' || r.site_id ELSE NULL END,
    pp_judgment_color(r.dim_cost),
    pp_judgment_color(r.dim_zoning),
    pp_judgment_color(r.dim_neighborhood),
    pp_judgment_color(r.sub_play),
    pp_judgment_color(r.dim_building),
    r.school_size_category,
    r.capacity,
    l.rebl3_site_id,
    l.feedback_deadline,
    l.is_bridge,
    leasing.status::text,
    leasing.details,
    loi.status::text,
    dd.fast_open_capacity,
    dd.fast_open_proj_open_date
  FROM pp_locations l
  LEFT JOIN rebl3_sites r ON r.site_id = l.rebl3_site_id
  LEFT JOIN LATERAL (
    SELECT s.status, s.details FROM rebl3_status s
    WHERE s.site_id = l.rebl3_site_id AND s.system = 'leasing'
    ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
  ) leasing ON true
  LEFT JOIN LATERAL (
    SELECT s.status FROM rebl3_status s
    WHERE s.site_id = l.rebl3_site_id AND s.system = 'loi'
    ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
  ) loi ON true
  LEFT JOIN LATERAL (
    SELECT
      NULLIF(s.details->'fast_open'->>'capacity','')::int        AS fast_open_capacity,
      NULLIF(s.details->'fast_open'->>'proj_open_date','')::date AS fast_open_proj_open_date
    FROM rebl3_status s
    WHERE s.site_id = l.rebl3_site_id AND s.system = 'due-diligence'
    ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
  ) dd ON true
  WHERE l.status = 'active'
    AND (NOT released_only OR l.released = true)
  ORDER BY (COALESCE(r.lat, l.lat::double precision) - center_lat)^2
         + (COALESCE(r.lng, l.lng::double precision) - center_lng)^2
  LIMIT max_results;
END;
$function$;
```

- [ ] **Step 2: Apply the migration to the dev DB**

Run via Supabase MCP (`mcp__supabase__apply_migration`) or via the Supabase SQL editor. Apply the file contents in one transaction.

Expected: success, no errors. Verify with:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pp_site_problems'
  AND column_name IN ('parent_ownable','category','severity','source_ref','admin_edited_at');
```

Should return five rows.

```sql
SELECT id, capacity, overall_score, dd_fast_open_capacity, dd_fast_open_proj_open_date
FROM pp_locations_with_votes
WHERE id = (SELECT id FROM pp_locations WHERE rebl3_site_id = '775-columbus-ave-new-york-ny');
```

Should return capacity=70, overall_score non-null, dd_fast_open_capacity=70, dd_fast_open_proj_open_date='2026-08-01'.

- [ ] **Step 3: Commit**

```bash
git add sql/2026-05-08-card-and-ownership-refinements.sql
git commit -m "feat(sql): add parent_ownable + regulatory + DD fast_open columns"
```

---

### Task 2: TypeScript types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Extend `LocationDerived` and `SiteProblem`**

Edit `src/types/index.ts`. In the `LocationDerived` interface (currently around line 185), add three optional fields:

```ts
// Extend Location with derived fields (set client-side, not stored)
export interface LocationDerived {
  stage: SiteStage;
  category: SiteCategory;
  committedSubStage?: CommittedSubStage;
  movedOnReason?: string;
  // Raw REBL pipeline state, surfaced for display (e.g. "LOI sent to landlord")
  leasingStatus?: string | null;
  loiStatus?: string | null;
  // New: numeric REBL score and DD fast-open targets
  reblScore?: number | null;
  fastOpenCapacity?: number | null;
  fastOpenDate?: string | null;
}
```

In the `SiteProblem` interface (currently around line 131), add four fields:

```ts
export interface SiteProblem {
  id: string;
  siteId: string | null;
  metro: string;
  title: string;
  description: string | null;
  deadline: string | null;
  pivotTrigger: boolean;
  status: ProblemStatus;
  outcomeText: string | null;
  createdAt: string;
  closedAt: string | null;
  // New
  parentOwnable: boolean;
  category: 'zoning' | 'licensing' | 'other';
  severity: 'H' | 'M' | 'L';
  sourceRef: { system: string; site_id: string; name: string } | null;
  // Derived
  owner?: ProblemOwner | null;
  updates?: ProblemUpdate[];
}
```

- [ ] **Step 2: Verify type-checking**

Run: `npx tsc --noEmit`

Expected: errors appear at every site that constructs a `SiteProblem` (because the new fields are required). That's the next task's surface area; for now, leave the errors. We'll resolve them in Tasks 7 and 11. **Confirm the only errors are about the new SiteProblem fields** — no unrelated regressions.

- [ ] **Step 3: Commit (errors expected; subsequent tasks fix them)**

```bash
git add src/types/index.ts
git commit -m "feat(types): add reblScore/fastOpen + problem ownership fields"
```

---

## Phase B — Topic 1: card facts row

### Task 3: Wire new columns through `mapRowToScores` + `applyDerived`

**Files:**
- Modify: `src/lib/locations.ts`

- [ ] **Step 1: Add a parser for the new columns**

In `src/lib/locations.ts`, update `mapRowToScores` (currently lines 33–45) to keep its current behaviour (capacity already flows through). Then update `applyDerived` (currently lines 231–252) to read the three new columns:

```ts
function applyDerived(location: Location, row: Record<string, unknown>): Location {
  const leasing = (row.leasing_status as string) ?? null;
  const loi = (row.loi_status as string) ?? null;
  const strategy = (row.strategy_status as string) ?? null;
  const leasingDetails = (row.leasing_details as { process_exception?: boolean }) ?? undefined;
  const stage = getStage({ leasing, loi, strategy, leasingDetails });
  const category = getCategory({ isBridge: location.isBridge, champions: location.champions ?? [] });

  let committedSubStage: CommittedSubStage | undefined;
  if (stage === "engaged" || stage === "committed") {
    committedSubStage = parseCommittedSubStage({ leasing, loi });
  }

  const reblScore = row.overall_score != null ? Number(row.overall_score) : null;
  const fastOpenCapacity = row.dd_fast_open_capacity != null ? Number(row.dd_fast_open_capacity) : null;
  const fastOpenDateRaw = row.dd_fast_open_proj_open_date;
  const fastOpenDate = fastOpenDateRaw == null ? null : String(fastOpenDateRaw);

  location.derived = {
    stage,
    category,
    committedSubStage,
    leasingStatus: leasing,
    loiStatus: loi,
    reblScore,
    fastOpenCapacity,
    fastOpenDate,
  };
  return location;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: no errors from `locations.ts`. (Errors about `SiteProblem` from Task 2 still appear; those are downstream tasks.)

- [ ] **Step 3: Manual smoke (DB-backed)**

Boot dev server: `npm run dev`. Navigate to any metro with a committed site. Open the React DevTools or hit `/api/locations/...` and confirm the response includes `derived.reblScore` (number) and (for the few sites with DD rows) `derived.fastOpenCapacity` and `derived.fastOpenDate`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/locations.ts
git commit -m "feat(locations): hydrate reblScore + fastOpen fields on derived"
```

---

### Task 4: Render the facts row on the engaged/committed inline card

**Files:**
- Modify: `src/components/AltPanel.tsx`

- [ ] **Step 1: Add a helper for the opening-date label**

At the top of `AltPanel.tsx`, near other helpers, add:

```ts
function formatOpeningDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
```

- [ ] **Step 2: Insert the facts row in the inline engaged/committed card**

In `AltPanel.tsx`, locate the JSX block that renders the inline engaged/committed card (currently lines ~327–446 inside the `EngagedCommittedCard`-style closure that returns the `<div onClick={navigateToDetail}>`). Immediately after the `pipelineStatus` paragraph (currently ~line 372–373: `{pipelineStatus && (<p className="text-xs text-stone-600 mt-0.5">{pipelineStatus}</p>)}`) and **before** the `{showTimeline && ...}` mini-timeline block, insert:

```tsx
          {/* Facts row — capacity / REBL score / opening date (committed only) */}
          {(() => {
            const derived = loc.derived;
            const capacity = derived?.fastOpenCapacity ?? loc.scores?.capacity ?? null;
            const score = derived?.reblScore ?? null;
            const opening = stage === "committed" ? formatOpeningDate(derived?.fastOpenDate) : null;
            const colorClass =
              loc.scores?.overallColor === "GREEN" ? "bg-emerald-500" :
              loc.scores?.overallColor === "YELLOW" ? "bg-yellow-500" :
              loc.scores?.overallColor === "AMBER" ? "bg-amber-500" :
              loc.scores?.overallColor === "RED" ? "bg-rose-500" : "bg-stone-300";
            const facts: React.ReactNode[] = [];
            if (capacity != null) facts.push(<span key="cap">~{capacity} students</span>);
            if (score != null) facts.push(
              <span key="score" className="inline-flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full ${colorClass}`} />
                {score}
              </span>
            );
            if (opening) facts.push(<span key="open">Opens {opening}</span>);
            if (facts.length === 0) return null;
            return (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-600">
                {facts.map((f, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span aria-hidden="true">·</span>}
                    {f}
                  </React.Fragment>
                ))}
              </div>
            );
          })()}
```

If `React` isn't already imported as a default in this file, change the existing `import { useState, useMemo, useEffect } from "react";` to also include `React`:

```ts
import React, { useState, useMemo, useEffect } from "react";
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: no new errors from this file.

- [ ] **Step 4: Manual smoke**

Boot dev server. Pick a metro with a committed site that has DD data (e.g. New York / 775 Columbus Ave or Bethesda / 7514 Wisconsin Ave) and confirm the card shows three facts: `~70 students · ●78 · Opens Aug 2026`. Pick Nashville (1704 Dorothy Pl, no DD row yet) and confirm it shows whatever `rebl3_sites.capacity` returns (and no opening date).

- [ ] **Step 5: Commit**

```bash
git add src/components/AltPanel.tsx
git commit -m "feat(card): facts row with capacity, REBL score, opening date"
```

---

## Phase C — Topic 2: voting detail-only

### Task 5: Strip vote actions from `AltLocationCard`

**Files:**
- Modify: `src/components/AltLocationCard.tsx`

- [ ] **Step 1: Remove vote action JSX, keep avatars + progress + concerns**

In `src/components/AltLocationCard.tsx`, replace the entire block from the `{/* Vote buttons */}` comment through the closing `</div>` immediately before the `<Dialog>` block (currently lines 156–246) with **nothing**. Also remove the `Dialog`/`DialogContent`/`SignInPrompt` block (currently lines 249–256) — sign-in for voting now lives on the detail view.

After deletion, the card body (currently the outer `<div onClick={onSelect}>`) should end after the progress-bar/concerns block at line ~153.

- [ ] **Step 2: Trim the prop type and unused state**

Replace the props interface (currently lines 18–32) with:

```ts
interface AltLocationCardProps {
  location: Location;
  voters: VoterInfo[];
  isSelected: boolean;
  isProposed?: boolean;
  distanceMi?: number | null;
  onSelect: () => void;
}
```

Update the function signature accordingly:

```ts
export function AltLocationCard({
  location, voters,
  isSelected, isProposed, distanceMi, onSelect,
}: AltLocationCardProps) {
```

Delete the now-unused state and handlers near the top of the function:
- `const [showSignIn, setShowSignIn] = useState(false);`
- `const [voteComment, setVoteComment] = useState("");`
- `const [voteCommentSaved, setVoteCommentSaved] = useState(false);`
- `handleVoteIn`, `handleVoteNotHere`, `handleSaveComment`

Remove the imports that become unused: `Check` from `lucide-react`, `Dialog`, `DialogContent`, `SignInPrompt`, and `useState` (if unused after this).

- [ ] **Step 3: Update call sites**

In `src/components/AltPanel.tsx`, find every `<AltLocationCard ... />` invocation (search `AltLocationCard`). Remove the now-removed props (`hasVotedIn`, `hasVotedNotHere`, `isAuthenticated`, `onVoteIn`, `onVoteNotHere`, `onRemoveVote`, `onUpdateVoteComment`).

If you find call sites in other files (`grep -rn AltLocationCard src/`), apply the same trim.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`

Expected: no errors related to `AltLocationCard`. (`SiteProblem` errors from Task 2 still pending.)

- [ ] **Step 5: Manual smoke**

Boot dev server. Open a metro with scored candidates. Cards should render without vote buttons. Clicking a card opens detail view; voting on detail view still works (no code changed there).

- [ ] **Step 6: Commit**

```bash
git add src/components/AltLocationCard.tsx src/components/AltPanel.tsx
git commit -m "feat(card): remove vote actions from scored candidate cards"
```

---

### Task 6: Strip vote actions from inline engaged/committed card

**Files:**
- Modify: `src/components/AltPanel.tsx`

- [ ] **Step 1: Remove the vote action row inside the inline card**

In `AltPanel.tsx`, locate the `{/* Vote action row */}` JSX inside the inline engaged/committed card closure (currently lines ~404–445). Delete the entire `<div className="flex gap-2 mt-3"> ... </div>` block.

Also delete the sibling `<Dialog open={showSignIn} onOpenChange={setShowSignIn}>...</Dialog>` block (currently lines ~448–455) and the `[showSignIn, setShowSignIn]` state declaration inside the inline card (currently around line 282), and the `handleVoteIn`/`handleVoteNotHere` handlers (currently ~314–325). Vote stats (`<AvatarRow ... /> <span>... families in</span>`) at lines ~390–402 stay.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: no errors from this file.

- [ ] **Step 3: Manual smoke**

Boot dev server. Open a metro with engaged/committed sites. Cards show stage badges, facts row, timeline, vote stats (avatars + "N families in") — but **no** vote buttons. Clicking the card opens detail view; voting on detail view still works.

- [ ] **Step 4: Commit**

```bash
git add src/components/AltPanel.tsx
git commit -m "feat(card): remove vote actions from engaged/committed cards"
```

---

## Phase D — Topic 3: parent_ownable problems UI

### Task 7: Update `SiteProblem` mappers + API responses

**Files:**
- Modify: `src/app/api/sites/[id]/problems/route.ts`
- Modify: `src/app/api/problems/route.ts`
- Modify: `src/app/api/admin/problems/route.ts` and `src/app/api/admin/problems/[id]/route.ts`

- [ ] **Step 1: Map new columns in every problem-returning endpoint**

In each of the four files above, find the place where Postgres rows are converted to `SiteProblem` objects (look for `.from("pp_site_problems").select(...)` followed by a row→object map). Add the new fields to both the `select(...)` list and the mapper. Example diff (apply the same shape everywhere):

```ts
// SELECT additions:
.select(`
  id, site_id, metro, title, description, deadline, pivot_trigger,
  status, outcome_text, created_at, closed_at,
  parent_ownable, category, severity, source_ref, admin_edited_at
`)

// Mapper additions inside the row → SiteProblem function:
parentOwnable: row.parent_ownable === true,
category: (row.category as 'zoning' | 'licensing' | 'other'),
severity: (row.severity as 'H' | 'M' | 'L'),
sourceRef: row.source_ref ?? null,
```

- [ ] **Step 2: Accept new fields on admin POST/PATCH**

In `src/app/api/admin/problems/route.ts` (POST handler), accept three optional inputs in the request body and pass them through to the insert:

```ts
const { siteId, metro, title, description, deadline, pivotTrigger,
        parentOwnable, category, severity } = body;

// in the insert:
.insert({
  site_id: siteId,
  metro,
  title,
  description,
  deadline,
  pivot_trigger: pivotTrigger === true,
  parent_ownable: parentOwnable === true,
  category: (['zoning','licensing','other'] as const).includes(category) ? category : 'other',
  severity: (['H','M','L'] as const).includes(severity) ? severity : 'M',
})
```

In `src/app/api/admin/problems/[id]/route.ts` (PATCH handler), accept the same fields and **set `admin_edited_at = now()`** whenever the request body includes any of `title`, `description`, `parentOwnable`, `category`, `severity`:

```ts
const updates: Record<string, unknown> = {};
let adminEdited = false;

if (typeof body.title === "string")        { updates.title = body.title;             adminEdited = true; }
if (typeof body.description === "string" || body.description === null) {
                                              updates.description = body.description; adminEdited = true; }
if (typeof body.parentOwnable === "boolean") { updates.parent_ownable = body.parentOwnable; adminEdited = true; }
if (body.category && ['zoning','licensing','other'].includes(body.category)) {
                                              updates.category = body.category;       adminEdited = true; }
if (body.severity && ['H','M','L'].includes(body.severity)) {
                                              updates.severity = body.severity;       adminEdited = true; }
if (typeof body.status === "string")        updates.status = body.status;
if (typeof body.outcomeText === "string")   updates.outcome_text = body.outcomeText;

if (adminEdited) updates.admin_edited_at = new Date().toISOString();

// then .update(updates).eq("id", id)
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: `SiteProblem` errors from Task 2 are now resolved at the route layer. Errors may remain in components that consume `SiteProblem` (Tasks 8–9 fix those).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/sites src/app/api/problems src/app/api/admin/problems
git commit -m "feat(api): surface parent_ownable+category+severity on problems"
```

---

### Task 8: `ProblemCard` — chips and gated CTA

**Files:**
- Modify: `src/components/ProblemCard.tsx`

- [ ] **Step 1: Render category + severity chips, gate claim button**

Open `src/components/ProblemCard.tsx`. Near the top of the card body (above the title), insert a chip row. Replace whatever is currently the title-and-status header with:

```tsx
{/* Chip row */}
<div className="flex items-center gap-2 mb-1">
  <span className={
    problem.severity === "H" ? "text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-200 text-orange-900"
    : problem.severity === "M" ? "text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-200 text-stone-800"
    : "text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600"
  }>
    {problem.severity === "H" ? "★ " : ""}{problem.category.toUpperCase()}
  </span>
  {problem.parentOwnable && !problem.owner && (
    <span className="text-[10px] font-medium text-orange-700">Needs an owner</span>
  )}
</div>

<h4 className="text-sm font-semibold text-stone-900 leading-tight">{problem.title}</h4>
{problem.description && (
  <p className="text-xs text-stone-600 mt-1">{problem.description}</p>
)}
```

Find the existing claim button (likely "Own this" / "Claim"). Wrap it in a guard so it only renders when `parent_ownable=true` AND there's no active owner:

```tsx
{problem.parentOwnable && !problem.owner && (
  <button onClick={handleClaim} className="...existing classes...">
    Own this
  </button>
)}
{!problem.parentOwnable && (
  <p className="text-[11px] text-stone-500 mt-2 italic">Tracked by Alpha team</p>
)}
{problem.owner && (
  /* existing "Claimed by X" UI */
)}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: no errors here.

- [ ] **Step 3: Manual smoke**

Boot dev server. Use the admin Problems tab to create a problem with `parent_ownable=true severity=H category=zoning` (the form work lands in Task 10; for now, run a temporary SQL update via the SQL editor on an existing problem row to flip these fields). Refresh detail view: chip is orange `★ ZONING`, "Own this" button is visible, "Tracked by Alpha team" is hidden. Flip `parent_ownable=false` in SQL: chip turns gray, button hides, "Tracked by Alpha team" shows.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProblemCard.tsx
git commit -m "feat(problems): chips + parent_ownable-gated claim CTA"
```

---

### Task 9: `ProblemList` — surface H-severity parent-ownable first

**Files:**
- Modify: `src/components/ProblemList.tsx`

- [ ] **Step 1: Sort the problem array**

In `ProblemList.tsx`, find where the fetched problems are mapped to `<ProblemCard ...>`. Add a sort step before the map:

```ts
const SEVERITY_RANK = { H: 0, M: 1, L: 2 } as const;

const sorted = [...problems].sort((a, b) => {
  // Parent-ownable + open + needs-owner first
  const aNeeds = a.parentOwnable && !a.owner && (a.status === "open" || a.status === "in_progress") ? 0 : 1;
  const bNeeds = b.parentOwnable && !b.owner && (b.status === "open" || b.status === "in_progress") ? 0 : 1;
  if (aNeeds !== bNeeds) return aNeeds - bNeeds;
  // Then by severity
  const aSev = SEVERITY_RANK[a.severity];
  const bSev = SEVERITY_RANK[b.severity];
  if (aSev !== bSev) return aSev - bSev;
  // Then by createdAt desc
  return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
});

// then sorted.map(...) instead of problems.map(...)
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProblemList.tsx
git commit -m "feat(problems): sort needs-owner H-severity first"
```

---

### Task 10: Admin form fields

**Files:**
- Modify: `src/app/admin/page.tsx` (Problems tab)

- [ ] **Step 1: Locate the problem-creation form in the Problems tab**

Search for the existing `<form>` that POSTs to `/api/admin/problems`. It currently collects (at minimum) site_id, metro, title, description, deadline, pivot_trigger.

- [ ] **Step 2: Add three controls + provenance line**

Inside the form, after the existing fields and before the submit button, add:

```tsx
<label className="block">
  <span className="text-xs font-semibold text-stone-700">Category</span>
  <select
    value={category}
    onChange={(e) => setCategory(e.target.value as 'zoning' | 'licensing' | 'other')}
    className="mt-1 block w-full rounded border border-stone-300 px-2 py-1 text-sm"
  >
    <option value="zoning">Zoning</option>
    <option value="licensing">Licensing</option>
    <option value="other">Other</option>
  </select>
</label>

<label className="block">
  <span className="text-xs font-semibold text-stone-700">Severity</span>
  <select
    value={severity}
    onChange={(e) => setSeverity(e.target.value as 'H' | 'M' | 'L')}
    className="mt-1 block w-full rounded border border-stone-300 px-2 py-1 text-sm"
  >
    <option value="H">High</option>
    <option value="M">Medium</option>
    <option value="L">Low</option>
  </select>
</label>

<label className="flex items-center gap-2">
  <input
    type="checkbox"
    checked={parentOwnable}
    onChange={(e) => setParentOwnable(e.target.checked)}
  />
  <span className="text-sm text-stone-700">Parent-ownable</span>
</label>
```

Initialize the new state at the top of the form component:

```ts
const [category, setCategory] = useState<'zoning' | 'licensing' | 'other'>('other');
const [severity, setSeverity] = useState<'H' | 'M' | 'L'>('M');
const [parentOwnable, setParentOwnable] = useState(false);
```

Update the POST body to include `category`, `severity`, `parentOwnable`.

In the **edit-existing-problem** UI (if present in the same file — likely a row-level "edit" modal in the Problems tab), add the same three controls and PATCH them. The route already handles `admin_edited_at` from Task 7.

If the edit UI shows a `source_ref`, render it read-only above the form:

```tsx
{problem.sourceRef && (
  <p className="text-xs text-stone-500 italic">
    Synced from REBL · {problem.sourceRef.system} · {problem.sourceRef.name}
  </p>
)}
```

- [ ] **Step 2 (rename — confirm wiring)**: Type-check

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Manual smoke**

Boot dev server. Go to `/admin`. Switch to Problems tab. Create a new problem with the new fields filled in. Refresh and confirm the row shows correct values via the SQL editor or the API:

```sql
SELECT title, parent_ownable, category, severity FROM pp_site_problems ORDER BY created_at DESC LIMIT 1;
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(admin): parent_ownable + category + severity in problems form"
```

---

### Task 11: Card-level problem chip uses severity

**Files:**
- Modify: `src/components/AltPanel.tsx` (inline engaged/committed card)

- [ ] **Step 1: Replace the existing problem chip with a severity-aware variant**

In `AltPanel.tsx`, find the existing problem chip (currently lines ~345–354):

```tsx
{problemCount > 0 && (
  <span
    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
      hasPivot ? "bg-orange-200 text-orange-900" : "bg-stone-100 text-stone-700"
    }`}
    title={openProblems.map(p => p.title).join(" · ")}
  >
    {hasPivot ? "★ " : ""}{problemCount} {problemCount === 1 ? "PROBLEM" : "PROBLEMS"}
  </span>
)}
```

Replace it with logic that surfaces the most-prominent parent-ownable problem first, severity-ranked:

```tsx
{(() => {
  if (problemCount === 0) return null;
  // Highest-severity parent-ownable + needing-owner problem wins
  const SEVERITY_RANK: Record<'H'|'M'|'L', number> = { H: 0, M: 1, L: 2 };
  const ranked = [...openProblems].sort((a, b) => {
    const aNeeds = a.parentOwnable && !a.owner ? 0 : 1;
    const bNeeds = b.parentOwnable && !b.owner ? 0 : 1;
    if (aNeeds !== bNeeds) return aNeeds - bNeeds;
    return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  });
  const top = ranked[0];
  const isOrange = (top.parentOwnable && !top.owner) || top.severity === "H" || hasPivot;
  const label = top.parentOwnable && !top.owner
    ? `${top.category.toUpperCase()} · Needs an owner`
    : `${problemCount} ${problemCount === 1 ? "PROBLEM" : "PROBLEMS"}`;
  return (
    <span
      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
        isOrange ? "bg-orange-200 text-orange-900" : "bg-stone-100 text-stone-700"
      }`}
      title={openProblems.map(p => p.title).join(" · ")}
    >
      {isOrange ? "★ " : ""}{label}
    </span>
  );
})()}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Manual smoke**

Boot dev server. With the test problem from Task 10 attached to a committed site, view its card. Chip should read `★ ZONING · Needs an owner` in orange. Mark `parent_ownable=false` in SQL: chip becomes `1 PROBLEM` in gray.

- [ ] **Step 4: Commit**

```bash
git add src/components/AltPanel.tsx
git commit -m "feat(card): severity-aware problem chip with needs-an-owner label"
```

---

## Phase E — Topic 4: regulatory sync

### Task 12: Pure sync utility (TDD)

**Files:**
- Create: `src/lib/sync/regulatory.ts`
- Create: `src/lib/sync/regulatory.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/sync/regulatory.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeRegulatorySyncOps, RegulatoryIssue, ExistingProblem } from "./regulatory";

describe("computeRegulatorySyncOps", () => {
  const SITE = "site-uuid-1";
  const METRO = "Nashville";

  const issueA: RegulatoryIssue = {
    name: "Need school-use variance from Metro Council",
    type: "zoning",
    severity: "H",
  };

  it("inserts new issues with parent_ownable=false and source_ref set", () => {
    const ops = computeRegulatorySyncOps({
      siteId: SITE,
      metro: METRO,
      rebl3SiteId: "rebl3-slug",
      issues: [issueA],
      existing: [],
    });
    expect(ops.insert).toHaveLength(1);
    expect(ops.insert[0]).toMatchObject({
      site_id: SITE,
      metro: METRO,
      title: issueA.name,
      category: "zoning",
      severity: "H",
      parent_ownable: false,
      source_ref: { system: "regulatory", site_id: "rebl3-slug", name: issueA.name },
      status: "open",
    });
    expect(ops.update).toHaveLength(0);
    expect(ops.skip).toHaveLength(0);
  });

  it("is idempotent — same payload twice produces zero ops the second time", () => {
    const inserted: ExistingProblem = {
      id: "p1",
      title: issueA.name,
      category: "zoning",
      severity: "H",
      adminEditedAt: null,
      sourceRef: { system: "regulatory", site_id: "rebl3-slug", name: issueA.name },
    };
    const ops = computeRegulatorySyncOps({
      siteId: SITE,
      metro: METRO,
      rebl3SiteId: "rebl3-slug",
      issues: [issueA],
      existing: [inserted],
    });
    expect(ops.insert).toHaveLength(0);
    expect(ops.update).toHaveLength(0);
    expect(ops.skip).toHaveLength(1);
  });

  it("updates title/category/severity when row is not admin-edited", () => {
    const stale: ExistingProblem = {
      id: "p1",
      title: "old name",
      category: "other",
      severity: "L",
      adminEditedAt: null,
      sourceRef: { system: "regulatory", site_id: "rebl3-slug", name: issueA.name },
    };
    const ops = computeRegulatorySyncOps({
      siteId: SITE,
      metro: METRO,
      rebl3SiteId: "rebl3-slug",
      issues: [issueA],
      existing: [stale],
    });
    expect(ops.update).toHaveLength(1);
    expect(ops.update[0]).toMatchObject({
      id: "p1",
      patch: { title: issueA.name, category: "zoning", severity: "H" },
    });
  });

  it("does NOT overwrite admin-edited rows", () => {
    const edited: ExistingProblem = {
      id: "p1",
      title: "Get a play-area variance from Nashville Metro Council",  // admin rewrote
      category: "zoning",
      severity: "H",
      adminEditedAt: "2026-05-08T10:00:00Z",
      sourceRef: { system: "regulatory", site_id: "rebl3-slug", name: issueA.name },
    };
    const ops = computeRegulatorySyncOps({
      siteId: SITE,
      metro: METRO,
      rebl3SiteId: "rebl3-slug",
      issues: [{ ...issueA, name: issueA.name, severity: "M" }],  // REBL bumped down
      existing: [edited],
    });
    expect(ops.insert).toHaveLength(0);
    expect(ops.update).toHaveLength(0);
    expect(ops.skip).toHaveLength(1);
  });

  it("never sets parent_ownable from REBL on update", () => {
    // Even if REBL ever ships a parent_ownable hint, our updater should ignore it.
    const stale: ExistingProblem = {
      id: "p1",
      title: issueA.name,
      category: "other",
      severity: "L",
      adminEditedAt: null,
      sourceRef: { system: "regulatory", site_id: "rebl3-slug", name: issueA.name },
    };
    const ops = computeRegulatorySyncOps({
      siteId: SITE,
      metro: METRO,
      rebl3SiteId: "rebl3-slug",
      issues: [issueA],
      existing: [stale],
    });
    expect(ops.update[0].patch).not.toHaveProperty("parent_ownable");
  });

  it("leaves orphan rows alone when REBL drops them from payload", () => {
    const orphan: ExistingProblem = {
      id: "p1",
      title: "Old issue REBL no longer reports",
      category: "zoning",
      severity: "M",
      adminEditedAt: null,
      sourceRef: { system: "regulatory", site_id: "rebl3-slug", name: "Old issue REBL no longer reports" },
    };
    const ops = computeRegulatorySyncOps({
      siteId: SITE,
      metro: METRO,
      rebl3SiteId: "rebl3-slug",
      issues: [issueA],
      existing: [orphan],
    });
    // orphan is not in REBL, but we don't close/delete — it's skipped
    expect(ops.skip).toContainEqual({ reason: "orphan", id: "p1" });
    expect(ops.insert).toHaveLength(1); // issueA still gets inserted
  });

  it("rejects unknown type by clamping to 'other'", () => {
    const ops = computeRegulatorySyncOps({
      siteId: SITE,
      metro: METRO,
      rebl3SiteId: "rebl3-slug",
      issues: [{ name: "weird", type: "frobnicate" as unknown as "zoning", severity: "M" }],
      existing: [],
    });
    expect(ops.insert[0].category).toBe("other");
  });

  it("clamps unknown severity to 'M'", () => {
    const ops = computeRegulatorySyncOps({
      siteId: SITE,
      metro: METRO,
      rebl3SiteId: "rebl3-slug",
      issues: [{ name: "weird", type: "zoning", severity: "X" as unknown as "H" }],
      existing: [],
    });
    expect(ops.insert[0].severity).toBe("M");
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail (module missing)**

Run: `npx vitest run src/lib/sync/regulatory.test.ts`

Expected: FAIL with "Cannot find module './regulatory'".

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/sync/regulatory.ts`:

```ts
export interface RegulatoryIssue {
  name: string;
  type: 'zoning' | 'licensing' | string;
  severity: 'H' | 'M' | 'L' | string;
}

export interface ExistingProblem {
  id: string;
  title: string;
  category: 'zoning' | 'licensing' | 'other';
  severity: 'H' | 'M' | 'L';
  adminEditedAt: string | null;
  sourceRef: { system: string; site_id: string; name: string } | null;
}

export interface SyncInput {
  siteId: string;          // pp_locations.id (uuid)
  metro: string;
  rebl3SiteId: string;     // rebl3_sites.site_id (slug)
  issues: RegulatoryIssue[];
  existing: ExistingProblem[];
}

export interface InsertOp {
  site_id: string;
  metro: string;
  title: string;
  category: 'zoning' | 'licensing' | 'other';
  severity: 'H' | 'M' | 'L';
  parent_ownable: false;   // sync NEVER sets this
  status: 'open';
  source_ref: { system: 'regulatory'; site_id: string; name: string };
}

export interface UpdateOp {
  id: string;
  patch: Partial<{ title: string; category: 'zoning' | 'licensing' | 'other'; severity: 'H' | 'M' | 'L' }>;
}

export interface SkipReason {
  reason: 'no-change' | 'admin-edited' | 'orphan';
  id: string;
}

export interface SyncOps {
  insert: InsertOp[];
  update: UpdateOp[];
  skip: SkipReason[];
}

const VALID_CATEGORY = new Set(['zoning', 'licensing', 'other'] as const);
const VALID_SEVERITY = new Set(['H', 'M', 'L'] as const);

function clampCategory(t: string): 'zoning' | 'licensing' | 'other' {
  return VALID_CATEGORY.has(t as 'zoning' | 'licensing' | 'other')
    ? (t as 'zoning' | 'licensing' | 'other')
    : 'other';
}

function clampSeverity(s: string): 'H' | 'M' | 'L' {
  return VALID_SEVERITY.has(s as 'H' | 'M' | 'L')
    ? (s as 'H' | 'M' | 'L')
    : 'M';
}

export function computeRegulatorySyncOps(input: SyncInput): SyncOps {
  const { siteId, metro, rebl3SiteId, issues, existing } = input;
  const insert: InsertOp[] = [];
  const update: UpdateOp[] = [];
  const skip: SkipReason[] = [];

  // Index existing rows by their regulatory-name key (only those with a sourceRef.name)
  const existingByName = new Map<string, ExistingProblem>();
  for (const e of existing) {
    if (e.sourceRef?.name) existingByName.set(e.sourceRef.name, e);
  }
  // Track names seen in the live REBL payload for orphan detection
  const seen = new Set<string>();

  for (const issue of issues) {
    seen.add(issue.name);
    const cat = clampCategory(issue.type);
    const sev = clampSeverity(issue.severity);
    const ex = existingByName.get(issue.name);

    if (!ex) {
      insert.push({
        site_id: siteId,
        metro,
        title: issue.name,
        category: cat,
        severity: sev,
        parent_ownable: false,
        status: 'open',
        source_ref: { system: 'regulatory', site_id: rebl3SiteId, name: issue.name },
      });
      continue;
    }

    if (ex.adminEditedAt) {
      skip.push({ reason: 'admin-edited', id: ex.id });
      continue;
    }

    const patch: Partial<{ title: string; category: 'zoning' | 'licensing' | 'other'; severity: 'H' | 'M' | 'L' }> = {};
    if (ex.title !== issue.name) patch.title = issue.name;
    if (ex.category !== cat) patch.category = cat;
    if (ex.severity !== sev) patch.severity = sev;

    if (Object.keys(patch).length === 0) {
      skip.push({ reason: 'no-change', id: ex.id });
    } else {
      update.push({ id: ex.id, patch });
    }
  }

  // Orphans: existing regulatory-sourced rows whose name no longer appears in the payload
  for (const e of existing) {
    if (e.sourceRef?.system === 'regulatory' && e.sourceRef.name && !seen.has(e.sourceRef.name)) {
      skip.push({ reason: 'orphan', id: e.id });
    }
  }

  return { insert, update, skip };
}
```

- [ ] **Step 4: Run the tests — confirm pass**

Run: `npx vitest run src/lib/sync/regulatory.test.ts`

Expected: 8 passed.

- [ ] **Step 5: Run the full unit suite to confirm no regressions**

Run: `npm run test:unit`

Expected: all tests pass (existing 21 + new 8 = 29).

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync/regulatory.ts src/lib/sync/regulatory.test.ts
git commit -m "feat(sync): pure regulatory→problems upsert ops + tests"
```

---

### Task 13: Cron route + Vercel schedule

**Files:**
- Create: `src/app/api/cron/sync-regulatory/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Write the cron route**

Create `src/app/api/cron/sync-regulatory/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  computeRegulatorySyncOps,
  RegulatoryIssue,
  ExistingProblem,
} from "@/lib/sync/regulatory";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // 1. Fetch every regulatory row
  const { data: rebl3Rows, error: rErr } = await supabase
    .from("rebl3_status")
    .select("site_id, details")
    .eq("system", "regulatory");
  if (rErr) {
    return NextResponse.json({ error: rErr.message }, { status: 500 });
  }

  // 2. Map rebl3 site_id -> pp_locations row
  const rebl3SiteIds = (rebl3Rows ?? []).map(r => r.site_id as string);
  const { data: locRows, error: lErr } = await supabase
    .from("pp_locations")
    .select("id, rebl3_site_id, region")
    .in("rebl3_site_id", rebl3SiteIds);
  if (lErr) {
    return NextResponse.json({ error: lErr.message }, { status: 500 });
  }
  const locByRebl3 = new Map<string, { id: string; metro: string }>();
  for (const l of locRows ?? []) {
    if (l.rebl3_site_id) {
      locByRebl3.set(l.rebl3_site_id as string, {
        id: l.id as string,
        metro: (l.region as string) ?? "",
      });
    }
  }

  // 3. Fetch existing regulatory-sourced problems for these sites.
  // We filter source_ref->>system in JS rather than in PostgREST to keep the
  // query simple (the dataset is small — at most a few rows per site).
  const siteIds = Array.from(locByRebl3.values()).map(v => v.id);
  let existingBySite = new Map<string, ExistingProblem[]>();
  if (siteIds.length > 0) {
    const { data: existing, error: eErr } = await supabase
      .from("pp_site_problems")
      .select("id, site_id, title, category, severity, admin_edited_at, source_ref")
      .in("site_id", siteIds)
      .not("source_ref", "is", null);
    if (eErr) {
      return NextResponse.json({ error: eErr.message }, { status: 500 });
    }
    for (const e of existing ?? []) {
      const sourceRef = e.source_ref as ExistingProblem["sourceRef"];
      if (sourceRef?.system !== "regulatory") continue;
      const sid = e.site_id as string;
      const arr = existingBySite.get(sid) ?? [];
      arr.push({
        id: e.id as string,
        title: e.title as string,
        category: e.category as 'zoning' | 'licensing' | 'other',
        severity: e.severity as 'H' | 'M' | 'L',
        adminEditedAt: (e.admin_edited_at as string) ?? null,
        sourceRef,
      });
      existingBySite.set(sid, arr);
    }
  }

  // 4. Compute ops per site, then dispatch
  let inserted = 0, updated = 0, skipped = 0;
  for (const row of rebl3Rows ?? []) {
    const rebl3SiteId = row.site_id as string;
    const loc = locByRebl3.get(rebl3SiteId);
    if (!loc) continue;
    const issues = (row.details as { issues?: RegulatoryIssue[] })?.issues ?? [];
    if (!Array.isArray(issues)) continue;
    const existing = existingBySite.get(loc.id) ?? [];
    const ops = computeRegulatorySyncOps({
      siteId: loc.id,
      metro: loc.metro,
      rebl3SiteId,
      issues,
      existing,
    });
    if (ops.insert.length > 0) {
      const { error } = await supabase.from("pp_site_problems").insert(ops.insert);
      if (error) console.error("regulatory sync insert error:", error);
      else inserted += ops.insert.length;
    }
    for (const u of ops.update) {
      const { error } = await supabase.from("pp_site_problems").update(u.patch).eq("id", u.id);
      if (error) console.error("regulatory sync update error:", error);
      else updated += 1;
    }
    skipped += ops.skip.length;
  }

  return NextResponse.json({ ok: true, inserted, updated, skipped });
}
```

- [ ] **Step 2: Configure Vercel cron**

Create `vercel.json` at repo root (project has none today):

```json
{
  "crons": [
    { "path": "/api/cron/sync-regulatory", "schedule": "*/5 * * * *" }
  ]
}
```

- [ ] **Step 3: Add `CRON_SECRET` to env**

In Vercel project settings (Environment Variables), add `CRON_SECRET` to Production + Preview + Development with a strong random value. For local dev, also add it to `.env.local`.

Verify locally: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync-regulatory` returns `{"ok":true,"inserted":0,"updated":0,"skipped":0}` (until REBL populates rows).

- [ ] **Step 4: Type-check and unit suite**

Run: `npx tsc --noEmit`
Run: `npm run test:unit`

Expected: no errors; all unit tests pass.

- [ ] **Step 5: Manual smoke (DB-side fixture)**

Insert a regulatory row via SQL editor for one committed site:

```sql
INSERT INTO rebl3_status (site_id, system, status, details)
VALUES (
  '1704-dorothy-pl-nashville-tn',
  'regulatory',
  'tracking',
  '{"issues":[{"name":"Designate or partner on across-street play space","type":"zoning","severity":"H"}]}'::jsonb
)
ON CONFLICT (site_id, system) DO UPDATE SET details = EXCLUDED.details;
```

Hit the cron route: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync-regulatory` → expect `inserted: 1`. Hit it again → expect `inserted: 0, skipped: 1`. Confirm a `pp_site_problems` row appeared with `source_ref` set.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/sync-regulatory/route.ts vercel.json
git commit -m "feat(cron): regulatory sync route + 5-minute schedule"
```

---

## Phase F — Final verification

### Task 14: End-to-end smoke + cleanup

- [ ] **Step 1: Run all automated suites**

```bash
npx tsc --noEmit
npm run lint
npm run test:unit
npm run build
```

Expected: tsc clean, lint 0 errors, unit pass, build succeeds.

- [ ] **Step 2: Cross-feature manual smoke**

Boot dev server. Walk this checklist on the deployed/local site:

- [ ] Open the New York metro (775 Columbus Ave) — committed card shows facts row with capacity, REBL score, opening date. No vote buttons. Vote stats still visible.
- [ ] Open Nashville (1704 Dorothy Pl) — committed card shows REBL-fallback capacity, no opening date (no DD row). After Step 5 of Task 13, the regulatory chip is orange `★ ZONING · Needs an owner`. Click into detail → "Own this" button visible.
- [ ] As a logged-in non-admin parent, click "Own this" on the Nashville zoning problem → claim succeeds; chip flips to gray (no longer "needs an owner") and detail shows "Claimed by you."
- [ ] Open `/admin` Problems tab. Edit the synced regulatory problem (change the title). Confirm `admin_edited_at` is now set:

```sql
SELECT id, title, admin_edited_at FROM pp_site_problems WHERE source_ref->>'system' = 'regulatory';
```

- [ ] Update the regulatory row to bump severity from H to M:

```sql
UPDATE rebl3_status SET details = jsonb_set(details, '{issues,0,severity}', '"M"')
WHERE site_id = '1704-dorothy-pl-nashville-tn' AND system = 'regulatory';
```

Hit the cron once more. The pp problem row's severity should remain H (admin-edited guard wins).

- [ ] Open a metro with scored candidates. Cards still show progress bar, avatars, distance. No vote buttons. Voting works on detail.

- [ ] **Step 3: Commit any cleanup**

If anything was missed (stray imports, unused state, etc.):

```bash
git add -A
git commit -m "chore: post-implementation cleanup"
```

---

## Spec coverage check

- ✅ Topic 1 — capacity / REBL score / opening date facts row → Tasks 1, 3, 4
- ✅ Topic 2 — voting detail-only → Tasks 5, 6
- ✅ Topic 3 — `parent_ownable` flag + gated CTA → Tasks 1, 2, 7, 8, 9, 10, 11
- ✅ Topic 4 — regulatory schema + sync → Tasks 1, 12, 13
- ✅ admin_edited_at guard → Tasks 1, 7, 12
- ✅ Sort regulars by needs-owner H first → Task 9
- ✅ Card-level severity-aware chip → Task 11
- ✅ Source_ref provenance line in admin → Task 10

## Out of scope (per spec)

- Tabular layout for the candidate list (separate spec).
- Auto-derivation from existing free-text `*_concern` fields.
- Severity-driven email notifications.
- Stale regulatory issue admin view.
