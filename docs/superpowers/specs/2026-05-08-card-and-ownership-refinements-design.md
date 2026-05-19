# Card & Ownership Refinements — Design

**Date:** 2026-05-08
**Branch:** `feature/parent-feedback-redesign` (continuation)
**Predecessor spec:** `2026-05-04-parent-feedback-redesign-design.md`

## Context

The parent-feedback redesign shipped engaged/committed cards inside the PARENT/AI/SHORT-TERM category sections, plus a problem primitive (`pp_site_problems`) and champions. Walking through Nashville (1704 Dorothy Pl, COMMITTED) surfaced four refinements:

1. Cards lack the data parents most want (capacity, REBL score, opening date).
2. Voting is duplicated on cards and detail.
3. The "champion" affordance is generic — claiming a site doesn't tell the parent what they're owning.
4. Regulatory issues live as free-text in `rebl3_status` details and never surface as parent-actionable problems.

Goal: tighten the card content, collapse voting to one place, and make ownership concrete by surfacing regulatory issues as scoped, parent-ownable problems.

## Scope

In scope:
- Engaged + committed inline cards rendered inside `CategorySection` (defined in `AltPanel.tsx`).
- Scored candidate cards rendered via `AltLocationCard.tsx` (vote-removal only).
- `LocationDetailView.tsx` (vote becomes detail-only; problem CTAs).
- New `rebl3_status[system='regulatory']` consumer + sync into `pp_site_problems`.
- Schema additions to `pp_site_problems`.

Out of scope:
- Tabular layout for the candidate list (separate question; flagged as a future).
- Auto-deriving regulatory problems from existing free-text `*_concern` fields. REBL will populate the structured `regulatory` row directly.
- Severity/parent_ownable defaults driven by REBL — pp owns curation.
- Champion model changes. Champions stay exactly as today.

## Topic 1 — Card data on engaged/committed cards

Add three fields to the engaged/committed inline card. Cards stay cards (not tabular). The candidate list below remains as-is.

| Field | Source | Fallback | Display |
|---|---|---|---|
| Capacity | `rebl3_status[system='due-diligence'].details.fast_open.capacity` | `rebl3_sites.capacity` | `~70 students` |
| REBL score | `rebl3_sites.overall_score` | none — hide | `●78` (dot color = `pp_location_scores.overall_color`) |
| Opening date | `rebl3_status[system='due-diligence'].details.fast_open.proj_open_date` | none — hide (committed only) | `Opens Aug 2026` |

Engaged cards: capacity + REBL score only (no DD row exists pre-LOI).
Committed cards: all three. If `fast_open.proj_open_date` is missing, hide the field — never guess.

### Data plumbing

`pp_location_scores` only stores colors today; capacity and overall_score come from `rebl3_sites`. The current list-fetch returns `LocationScores.capacity = null` for every card. Two ways to fix this:

**Option A (recommended): bulk-fetch `rebl3_sites` columns inside `getLocations()` / `getLocationsInBounds()`.**
Add a single Postgres function or LATERAL join that pulls `capacity`, `overall_score`, and the relevant DD `fast_open.*` keys for engaged/committed sites only. Keep `pp_location_scores` schema unchanged.
- Pro: no schema migration; respects the `pp_*` data boundary contract via a read-only RPC over `rebl3_*` (we already do this for `is_bridge`, `leasing_status`, `loi_status`).
- Con: each list fetch joins `rebl3_sites` + `rebl3_status`. Acceptable; volume is small (engaged + committed combined ~10–20 per metro).

**Option B: extend `pp_location_scores` schema + sync.**
Add `capacity int`, `overall_score int`, `dd_fast_open_capacity int`, `dd_fast_open_proj_open_date date` columns. REBL writes them on score updates and on DD completion.
- Pro: cleaner read path.
- Con: requires REBL changes; risks staleness vs the source rows.

Pick Option A. Revisit if list latency suffers.

### Card layout (engaged/committed inline card)

Existing rows keep their order; new fields slot into a single new "facts row" between the title/pipeline-status block and the mini timeline:

```
[stage badge] [plan role] [problem chip] [champion line] [distance]
<TITLE — street address>
<pipeline status text>
~70 students  ·  ●78  ·  Opens Aug 2026          <- new facts row
[mini stage timeline]
[snapshot pill]
[avatars + "N families in"]   <- vote stats only (no buttons; see Topic 2)
```

If a fact is missing, skip it (no labels with em-dashes, no skeletons). The facts row only renders if at least one fact is present.

### Type changes

`Location.scores.capacity` already exists in `types/index.ts` but is null on the list path. Populate it from Option-A's bulk fetch. Add two new fields on `LocationDerived`:

```ts
export interface LocationDerived {
  // existing
  stage: SiteStage;
  category: SiteCategory;
  committedSubStage?: CommittedSubStage;
  movedOnReason?: string;
  leasingStatus?: string | null;
  loiStatus?: string | null;
  // new
  reblScore?: number | null;          // rebl3_sites.overall_score
  fastOpenCapacity?: number | null;   // due-diligence.details.fast_open.capacity
  fastOpenDate?: string | null;       // due-diligence.details.fast_open.proj_open_date (ISO date)
}
```

Capacity display logic: prefer `derived.fastOpenCapacity`, fall back to `scores.capacity` (which is `rebl3_sites.capacity`).

## Topic 2 — Voting in one place: detail-only

Remove vote action buttons from every card. Keep vote stats (avatars + "N families in" + concerns count) on cards as read-only. Voting moves to `LocationDetailView` only.

### What changes

- **`AltLocationCard.tsx`**: remove the vote button block (currently lines ~230–244 — the `<button>I'm good with this location</button>` and `<button>Not for me</button>` pair, plus the post-vote inline state at lines ~157–229). Keep avatars + progress bar.
- **Inline engaged/committed card in `AltPanel.tsx`**: remove the vote action row (currently lines ~404–445). Keep the avatar + count row above it.
- **`LocationDetailView.tsx`**: vote section already exists; ensure it's prominent and reachable from the card click. No code changes required, but verify the card → detail navigation lands the user near the vote CTA on mobile (scroll position).

### Removed support code

- `onVoteIn`, `onVoteNotHere`, `onRemoveVote`, `onUpdateVoteComment` props on `AltLocationCard` are no longer used. Remove them from the prop type and from call sites.
- The inline vote-comment textarea on cards (lines ~174–193 and ~209–228 in `AltLocationCard.tsx`) goes away. The comment field already exists on the detail-view vote flow; no functional loss.
- `SignInPrompt` dialog usage on cards — remove (sign-in is triggered from detail vote actions).

### Click target

Whole card stays clickable → opens detail. No change. The undo affordance on cards (`undo` link next to "You're in") moves to detail.

## Topic 3 — Ownership specificity

Champions stay exactly as today (lead/supporter on any site). The "Own this" affordance moves entirely to **specific problems**, gated on a new `parent_ownable` boolean.

### Schema changes — `pp_site_problems`

```sql
ALTER TABLE pp_site_problems
  ADD COLUMN parent_ownable boolean NOT NULL DEFAULT false,
  ADD COLUMN category       text    NOT NULL DEFAULT 'other'
    CHECK (category IN ('zoning', 'licensing', 'other')),
  ADD COLUMN severity       text    NOT NULL DEFAULT 'M'
    CHECK (severity IN ('H', 'M', 'L')),
  ADD COLUMN source_ref     jsonb;
-- source_ref shape: {"system":"regulatory","site_id":"<rebl3 site_id>","name":"<issue name>"}
-- nullable for admin-typed problems.
```

Backfill: existing rows get `parent_ownable=false`, `category='other'`, `severity='M'`, `source_ref=NULL`.

### UI rules

- **Card:** problem chip color/prominence is driven by **severity**.
  - `H` → orange chip with `★`, e.g. `★ ZONING · Needs an owner` (when parent_ownable + no owner) or `★ ZONING · 1 owner` (when claimed).
  - `M` → gray chip.
  - `L` → not shown on card; visible on detail only.
- **Detail problem card:** "Own this" CTA appears **only** when `parent_ownable=true` AND no active owner.
- **Title is the parent-facing affordance.** Admin must write action-form titles ("Get a play-area variance from Nashville Metro Council"), not status descriptions ("Play area concern"). The form should hint at this.

### Existing `ProblemCard.tsx` / `ProblemList.tsx` changes

- Render category + severity chips on each problem.
- Hide the claim button unless `parent_ownable=true`.
- For non-`parent_ownable` problems, show a passive "Tracked by Alpha team" line instead of the claim button.

### Admin form changes

- Add `parent_ownable` checkbox (default off).
- Add `category` select (`zoning | licensing | other`).
- Add `severity` select (`H | M | L`, default `M`).
- Show `source_ref` (read-only) when present, with a link/label like "Synced from REBL regulatory system."

## Topic 4 — Regulatory issues from REBL

A new system row `rebl3_status[system='regulatory']` is populated by REBL. pp consumes it via a sync into `pp_site_problems`.

### REBL schema

```json
{
  "issues": [
    { "name": "Need school-use variance from Nashville Metro Council", "type": "zoning",    "severity": "H" },
    { "name": "Day-care license required for Pre-K wing",              "type": "licensing", "severity": "M" }
  ]
}
```

Three fields per issue. `name` is the natural key per site (no separate id). REBL reports facts only — `parent_ownable` lives in pp.

Forward-compatible: pp ignores unknown keys. REBL can later add `description`, `deadline`, `source_msg_id`, `status`, etc., without breaking pp.

### Sync

A small sync routine (initially: cron every 5 minutes; switchable to webhook when REBL exposes one) reads each site's `regulatory.issues[]` and upserts `pp_site_problems` rows.

**Upsert key:** `(site_id, source_ref->>'name')`.

**On insert:**
- `title = issue.name`
- `category = issue.type`
- `severity = issue.severity`
- `parent_ownable = false` (admin must opt in)
- `status = 'open'`
- `source_ref = {"system":"regulatory","site_id":"<rebl3 site_id>","name":"<issue.name>"}`

**On update:**
- If `admin_edited_at IS NULL`, refresh `title`, `category`, and `severity` from REBL.
- If `admin_edited_at IS NOT NULL`, skip the row — admin's curation wins.
- `parent_ownable` is never overwritten by sync (admin-only field).

**On removal from REBL payload:** leave the pp row alone. Admin closes manually if it's truly resolved (preserves owner history). A future "stale regulatory issues" admin view can flag rows whose `source_ref.name` no longer appears in the live REBL row.

### New column for sync

```sql
ALTER TABLE pp_site_problems
  ADD COLUMN admin_edited_at timestamptz;
```

Set by `PATCH /api/admin/problems/[id]` and admin form saves; checked by sync.

### Walking through Nashville

- REBL writes `rebl3_status[system='regulatory']` for `1704-dorothy-pl-nashville-tn`:
  ```json
  { "issues": [
    { "name": "Designate or partner on across-street play space", "type": "zoning", "severity": "H" }
  ]}
  ```
- Sync creates `pp_site_problems` row: `title="Designate..."`, `category='zoning'`, `severity='H'`, `parent_ownable=false`, `source_ref={system:'regulatory',site_id:'1704-dorothy-pl-nashville-tn',name:'Designate or partner on across-street play space'}`.
- Admin reviews in the Problems tab, ticks `parent_ownable=true`, saves. (`admin_edited_at` is set.)
- Card shows orange `★ ZONING · Needs an owner` chip.
- Detail shows the problem with "Own this" button.
- Nashville parent with Metro Council contacts claims it. Status flips to `in_progress`. Existing problem-update flow takes over.

## File-level change summary

### New / modified

| File | Change |
|---|---|
| `sql/2026-05-08-card-and-ownership-refinements.sql` | New: `parent_ownable`, `category`, `severity`, `source_ref`, `admin_edited_at` columns on `pp_site_problems`. Backfill defaults. |
| `src/types/index.ts` | Add `reblScore`, `fastOpenCapacity`, `fastOpenDate` to `LocationDerived`. Add `parentOwnable`, `category`, `severity`, `sourceRef` to `SiteProblem`. |
| `src/lib/locations.ts` (or RPC) | Bulk-fetch `rebl3_sites.capacity`, `rebl3_sites.overall_score`, and `due-diligence.details.fast_open.*` for sites with `derived.stage IN ('engaged','committed')`. Wire into `LocationDerived`. |
| `src/components/AltPanel.tsx` | Inline engaged/committed card: add facts row (capacity / score / opening date). Remove vote action row. |
| `src/components/AltLocationCard.tsx` | Remove vote action buttons + comment textarea. Keep avatars + progress bar. |
| `src/components/LocationDetailView.tsx` | No structural change; verify mobile scroll lands near vote CTA after card → detail navigation. |
| `src/components/ProblemCard.tsx` | Render category + severity chips. Gate claim button on `parent_ownable`. Show "Tracked by Alpha team" otherwise. |
| `src/components/ProblemList.tsx` | Sort/filter to put H-severity parent-ownable problems first. |
| `src/app/admin/page.tsx` (Problems tab) | Add `parent_ownable`, `category`, `severity` form fields. Show `source_ref` provenance line. |
| `src/app/api/admin/problems/route.ts` and `[id]/route.ts` | Accept new fields; set `admin_edited_at` on PATCH. |
| `src/app/api/sites/[id]/problems/route.ts` and `src/app/api/problems/route.ts` | Return new fields. |
| `src/app/api/cron/sync-regulatory/route.ts` | New: cron route that reads `rebl3_status[system='regulatory']` and upserts `pp_site_problems`. Behind cron secret. |
| `vercel.json` (new file — project has none today) | Schedule the new cron every 5 minutes. `vercel.ts` is the newer alternative; either is fine. |

### Deleted / unused after this change

- Vote-related props on `AltLocationCard`: `onVoteIn`, `onVoteNotHere`, `onRemoveVote`, `onUpdateVoteComment`, `hasVotedIn`, `hasVotedNotHere`. Strip from prop type and call sites.

## Testing

- **Unit (Vitest):**
  - `getStage` / `getCategory` unchanged — re-run existing suite for regression.
  - New: capacity-resolver picks DD `fast_open.capacity` over `rebl3_sites.capacity`.
  - New: `parent_ownable=false` problem hides the claim CTA; `parent_ownable=true` shows it.
  - New: regulatory sync upsert is idempotent — same payload twice creates only one row; admin-edited rows are not overwritten.
- **Integration / API:**
  - Sync route end-to-end with a fixture rebl3_status payload.
- **Manual smoke:**
  - Nashville card shows facts row (capacity from REBL fallback, no opening date until DD lands, REBL score chip).
  - Vote button is gone from every card; voting works on detail; vote stats still appear on cards.
  - Admin creates a problem with `parent_ownable=true severity=H category=zoning` → card chip is orange `★ ZONING`.

## Open questions / followups (not blockers)

- Tabular layout for the **candidate list** (scored sites below the categories): user raised in passing. Defer to a separate spec — different scanning behavior, different column needs (sortable score / capacity / sqft).
- Stale regulatory issue detection (REBL drops an issue from the payload) — defer to admin view.
- Severity-driven email notifications (e.g., new H-severity regulatory issue → notify metro champions) — defer.

## Out of scope (explicit)

- Champion model changes.
- Auto-derivation of problems from existing free-text `*_concern` fields in `loi.details` etc. The structured `regulatory` system replaces that path.
- Admin auto-default heuristics for `parent_ownable`. Admin curates explicitly.
