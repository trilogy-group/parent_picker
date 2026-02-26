# Proposed Locations Feature — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow 1-2 locations per metro to be flagged as "Proposed" (under LOI / late-stage), with two UI treatment options (A: Hero Section, B: Pinned Badge) built as a toggle so we can compare both live.

**Architecture:** Add a `proposed` boolean column to `pp_locations`. The view `pp_locations_with_votes` already exposes all `pp_locations` columns, so it will automatically include it. On the frontend, proposed locations are extracted from the filtered list and rendered differently depending on which approach (A or B) is active. An admin-only toggle switches between approaches for evaluation.

**Tech Stack:** Supabase (migration), Next.js, React, Zustand, Tailwind CSS

---

### Task 1: Database — Add `proposed` column

**Files:**
- Supabase migration (run via MCP)

**Step 1: Add column to pp_locations**

```sql
ALTER TABLE pp_locations ADD COLUMN proposed boolean NOT NULL DEFAULT false;
```

**Step 2: Recreate the view to include the new column**

The view `pp_locations_with_votes` must be recreated to expose `proposed`. Get current view definition and add `l.proposed`:

```sql
CREATE OR REPLACE VIEW pp_locations_with_votes AS
SELECT l.id, l.name, l.address, l.city, l.state, l.lat, l.lng,
       l.status, l.source, l.notes, l.suggested_by,
       l.created_at, l.updated_at, l.proposed,
       COALESCE(count(v.id), 0::bigint)::integer AS votes,
       s.overall_color, s.overall_details_url,
       s.price_color, s.zoning_color, s.neighborhood_color,
       s.building_color, s.size_classification
FROM pp_locations l
LEFT JOIN pp_votes v ON v.location_id = l.id
LEFT JOIN pp_location_scores s ON s.location_id = l.id
WHERE l.status = 'active'
GROUP BY l.id, s.id;
```

**Step 3: Flag a test location as proposed**

Pick `2 Pickwick Plz` in Greenwich (good subscores) for testing:

```sql
UPDATE pp_locations SET proposed = true WHERE name = '2 Pickwick Plz' AND city = 'Greenwich';
```

**Step 4: Verify**

```sql
SELECT name, city, proposed FROM pp_locations_with_votes WHERE proposed = true;
```

Expected: `2 Pickwick Plz | Greenwich | true`

**Step 5: Commit**

```bash
git commit --allow-empty -m "feat: add proposed column to pp_locations and update view"
```

---

### Task 2: Frontend Data Layer — Expose `proposed` on Location type

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/locations.ts` (mapRows function, ~line 226-240)

**Step 1: Add `proposed` to Location interface**

In `src/types/index.ts`, add to the `Location` interface:

```typescript
proposed?: boolean;
```

**Step 2: Map the column in `mapRows`**

In `src/lib/locations.ts` `mapRows` function (~line 226), add:

```typescript
proposed: row.proposed === true,
```

**Step 3: Verify the dev server loads without errors**

Run: `npm run dev` and check console for errors.

**Step 4: Commit**

```bash
git add src/types/index.ts src/lib/locations.ts
git commit -m "feat: expose proposed field on Location type"
```

---

### Task 3: Sort Layer — Proposed locations always sort first

**Files:**
- Modify: `src/lib/sort.ts`

**Step 1: Update both sort functions to pin proposed locations to top**

In `src/lib/sort.ts`, proposed locations should always come before non-proposed, regardless of sort mode:

```typescript
import { Location } from "@/types";

const COLOR_RANK: Record<string, number> = { GREEN: 0, YELLOW: 1, AMBER: 2, RED: 3 };

export function greenSubRank(loc: Location): number {
  const s = loc.scores;
  if (!s) return 0;
  return (s.price?.color === "GREEN" ? 1 : 0)
       + (s.building?.color === "GREEN" ? 2 : 0)
       + (s.neighborhood?.color === "GREEN" ? 4 : 0)
       + (s.zoning?.color === "GREEN" ? 8 : 0);
}

export function sortMostViable(a: Location, b: Location): number {
  // Proposed locations always first
  if (a.proposed && !b.proposed) return -1;
  if (!a.proposed && b.proposed) return 1;
  const aRank = COLOR_RANK[a.scores?.overallColor || ""] ?? 99;
  const bRank = COLOR_RANK[b.scores?.overallColor || ""] ?? 99;
  if (aRank !== bRank) return aRank - bRank;
  const subDiff = greenSubRank(b) - greenSubRank(a);
  if (subDiff !== 0) return subDiff;
  return b.votes - a.votes;
}

export function sortMostSupport(a: Location, b: Location): number {
  // Proposed locations always first
  if (a.proposed && !b.proposed) return -1;
  if (!a.proposed && b.proposed) return 1;
  if (b.votes !== a.votes) return b.votes - a.votes;
  return sortMostViable(a, b);
}
```

**Step 2: Commit**

```bash
git add src/lib/sort.ts
git commit -m "feat: proposed locations always sort to top"
```

---

### Task 4: Approach A — Hero Spotlight Section in AltPanel

**Files:**
- Modify: `src/components/AltPanel.tsx`

This approach renders proposed locations as a visually distinct hero section **above** the sort pills and regular list. Only shown when zoomed in (not city cards view).

**Step 1: Extract proposed locations from sorted list**

In `AltPanel.tsx`, after `sortedLocations` is computed (~line 115), add a memo that separates proposed from non-proposed:

```typescript
const proposedLocations = useMemo(() => {
  return sortedLocations.filter(loc => loc.proposed);
}, [sortedLocations]);

const regularLocations = useMemo(() => {
  return sortedLocations.filter(loc => !loc.proposed);
}, [sortedLocations]);
```

**Step 2: Add state for approach toggle**

At the top of the component, add:

```typescript
const [proposedStyle, setProposedStyle] = useState<"hero" | "pinned">("hero");
```

**Step 3: Add the Hero section JSX**

Inside the zoomed-in branch (after `<div className="px-5 pb-2 pt-1 sticky top-0 bg-white z-10">` block, before the sort pills div), add:

```tsx
{/* Proposed locations — Approach A: Hero */}
{proposedStyle === "hero" && proposedLocations.length > 0 && (
  <div className="px-5 pb-4">
    {proposedLocations.map((loc) => (
      <div
        key={loc.id}
        onClick={() => {
          setSelectedLocation(loc.id);
          if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            router.push(`/location/${loc.id}`);
          }
        }}
        className="border-2 border-indigo-300 bg-indigo-50/50 rounded-xl p-5 cursor-pointer hover:shadow-lg transition-all"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase">Proposed Location</span>
        </div>
        <h3 className="text-lg font-bold text-gray-900">
          {extractStreet(loc.address, loc.city)}
        </h3>
        <p className="text-sm text-gray-500 mt-0.5">
          {loc.city}, {loc.state}
          {(() => {
            const d = userLocation ? getDistanceMiles(userLocation.lat, userLocation.lng, loc.lat, loc.lng) : null;
            return d != null ? ` · ${d.toFixed(1)} mi` : '';
          })()}
        </p>
        <p className="text-[13px] text-gray-600 mt-3 leading-snug">
          We&rsquo;re in late-stage talks for this space. Enough family support helps us finalize.
        </p>
        {/* Progress bar */}
        {(() => {
          const LAUNCH_THRESHOLD = 30;
          const pct = Math.min(100, (loc.votes / LAUNCH_THRESHOLD) * 100);
          const remaining = Math.max(0, LAUNCH_THRESHOLD - loc.votes);
          const label = <>{loc.votes} in &middot; {remaining} to go</>;
          return (
            <div className="mt-3">
              <div className="w-full bg-indigo-100 rounded-full h-5 relative overflow-hidden">
                <div className="bg-indigo-600 h-5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-gray-700">{label}</span>
                <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
                  <span className="flex items-center justify-center text-[11px] font-medium text-white h-full whitespace-nowrap" style={{ width: pct > 0 ? `${10000 / pct}%` : '100%' }}>{label}</span>
                </div>
              </div>
            </div>
          );
        })()}
        {/* Vote buttons */}
        <div className="flex gap-2 mt-4">
          {votedLocationIds.has(loc.id) ? (
            <div className="flex items-center gap-1.5 text-sm text-gray-700 font-medium py-2">
              <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
              You&apos;re in
              <button onClick={(e) => { e.stopPropagation(); removeVote(loc.id); }} className="ml-2 text-xs text-gray-400 hover:text-gray-600 underline">undo</button>
            </div>
          ) : (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); if (!isAuthenticated) return; voteIn(loc.id); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                I&apos;d choose this location
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); if (!isAuthenticated) return; voteNotHere(loc.id); }}
                className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Not for me
              </button>
            </>
          )}
        </div>
      </div>
    ))}
    <div className="flex items-center gap-3 mt-4 mb-1">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400 font-medium">Also in this area</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  </div>
)}
```

**Step 4: Update visible locations to exclude proposed when in hero mode**

Update the `visibleLocations` computation to use `regularLocations` when hero mode is active:

```typescript
const listLocations = proposedStyle === "hero" ? regularLocations : sortedLocations;
const visibleLocations = showTopOnly
  ? listLocations.slice(0, TOP_N)
  : listLocations.slice(0, (extraPages + 1) * PAGE_SIZE);
```

**Step 5: Add admin A/B toggle**

After the admin Parent/Admin toggle in the header area, add (admin-only):

```tsx
{isAdmin && proposedLocations.length > 0 && (
  <div className="px-5 pb-2">
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-gray-400">Proposed style:</span>
      <button
        onClick={() => setProposedStyle("hero")}
        className={`px-2 py-0.5 rounded ${proposedStyle === "hero" ? "bg-indigo-100 text-indigo-700 font-medium" : "text-gray-500 hover:text-gray-700"}`}
      >
        A: Hero
      </button>
      <button
        onClick={() => setProposedStyle("pinned")}
        className={`px-2 py-0.5 rounded ${proposedStyle === "pinned" ? "bg-indigo-100 text-indigo-700 font-medium" : "text-gray-500 hover:text-gray-700"}`}
      >
        B: Pinned
      </button>
    </div>
  </div>
)}
```

**Step 6: Commit**

```bash
git add src/components/AltPanel.tsx
git commit -m "feat: approach A — hero spotlight section for proposed locations"
```

---

### Task 5: Approach B — Pinned Badge Card in AltPanel

**Files:**
- Modify: `src/components/AltPanel.tsx`
- Modify: `src/components/AltLocationCard.tsx`

In this approach, proposed locations render as regular AltLocationCards but with a visual "Proposed" badge and indigo accent border. They stay pinned to the top of the list (handled by sort in Task 3).

**Step 1: Add `proposed` styling to AltLocationCard**

In `AltLocationCard.tsx`, add an `isProposed` prop and conditional styling:

Add to props interface:
```typescript
isProposed?: boolean;
```

Update the outer div's className:
```typescript
className={cn(
  "border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md",
  isProposed
    ? "border-2 border-indigo-300 bg-indigo-50/30"
    : isSelected ? "border-gray-900 shadow-md" : "border-gray-200",
)}
```

Add a "Proposed" badge above the location name (before the `<h3>`):
```tsx
{isProposed && (
  <div className="flex items-center gap-2 mb-1.5">
    <span className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase">Proposed</span>
  </div>
)}
```

Add a one-liner below the status badge row:
```tsx
{isProposed && (
  <p className="text-[12px] text-gray-500 mt-1 leading-snug">
    We&rsquo;re pursuing this &mdash; your vote helps finalize
  </p>
)}
```

**Step 2: Pass `isProposed` from AltPanel**

In AltPanel's location card rendering, update:

```tsx
<AltLocationCard
  key={loc.id}
  location={loc}
  isProposed={loc.proposed === true}
  // ... rest of existing props
/>
```

This works in both modes — in "pinned" mode, proposed cards show the badge; in "hero" mode, they're excluded from the list entirely so the prop has no effect.

**Step 3: Commit**

```bash
git add src/components/AltLocationCard.tsx src/components/AltPanel.tsx
git commit -m "feat: approach B — pinned badge card for proposed locations"
```

---

### Task 6: Map Dot Styling for Proposed Locations

**Files:**
- Modify: `src/components/MapView.tsx`

Proposed locations should have a distinct dot color on the map (indigo instead of the normal color-coded dot).

**Step 1: Add proposed property to GeoJSON features**

In the `locationGeojson` memo, ensure `proposed` is included in feature properties:

```typescript
properties: {
  id: loc.id,
  // ... existing properties
  proposed: loc.proposed === true,
},
```

**Step 2: Add a map layer for proposed dots**

After the existing location dot layer, add a layer that renders proposed dots with a distinct style (larger, indigo, with a pulsing ring effect via a second circle layer):

```typescript
<Layer
  id="proposed-dots"
  type="circle"
  source="locations"
  filter={["==", ["get", "proposed"], true]}
  paint={{
    "circle-radius": 10,
    "circle-color": "#6366f1",  // indigo-500
    "circle-stroke-width": 3,
    "circle-stroke-color": "#c7d2fe",  // indigo-200
  }}
/>
```

**Step 3: Commit**

```bash
git add src/components/MapView.tsx
git commit -m "feat: indigo map dots for proposed locations"
```

---

### Task 7: Admin API — Set/Unset Proposed Flag

**Files:**
- Create: `src/app/api/admin/locations/[id]/proposed/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const proposed = body.proposed === true;

  const { error } = await supabaseAdmin
    .from("pp_locations")
    .update({ proposed })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, proposed });
}
```

**Step 2: Commit**

```bash
git add src/app/api/admin/locations/[id]/proposed/route.ts
git commit -m "feat: admin API to set/unset proposed flag"
```

---

### Task 8: Smoke Test — End-to-End Verification

**Step 1: Start dev server and navigate to Greenwich**

Run: `npm run dev` and open `http://localhost:3000`

Navigate to Greenwich metro, filter to Micro.

**Step 2: Verify Approach A (Hero)**

- "2 Pickwick Plz" should appear in a hero spotlight section above the sort pills
- Indigo border, "PROPOSED LOCATION" label, late-stage messaging
- "Also in this area" divider below, then regular list
- Map should show an indigo dot for the proposed location

**Step 3: Toggle to Approach B (Pinned)**

- Click admin toggle "B: Pinned"
- "2 Pickwick Plz" should appear as first card in the regular list
- Indigo border and "PROPOSED" badge on the card
- One-liner "We're pursuing this — your vote helps finalize"

**Step 4: Verify voting works on proposed cards**

- Click "I'd choose this location" on the proposed card
- Should show "You're in" state with undo
- Progress bar should update

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: smoke test adjustments for proposed locations"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | DB: `proposed` column + view | Supabase migration |
| 2 | Data layer: expose `proposed` | types/index.ts, lib/locations.ts |
| 3 | Sort: proposed always first | lib/sort.ts |
| 4 | Approach A: Hero section | AltPanel.tsx |
| 5 | Approach B: Pinned badge | AltLocationCard.tsx, AltPanel.tsx |
| 6 | Map: indigo dots | MapView.tsx |
| 7 | Admin API: set/unset flag | API route |
| 8 | Smoke test | Manual verification |
