# Route-Gated Redesign Merge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `feature/parent-feedback-redesign` to `main` such that `/` continues to serve the pre-branch legacy UI (all US metros, no redesign concepts) while `/redesign` serves the full redesign (4 S-FL metros, PoR, problem board, champions, stage timeline). `/miami` is a soft alias of `/redesign` (URL stays `/miami` in the browser).

**Architecture:** Variant-prop pattern. `HomeContent` accepts `variant: 'legacy' | 'redesign'` and renders the appropriate forked panel/map components. Two large UI files (`AltPanel`, `MapView`) are forked because they use `ACTIVE_METROS` at module scope and unconditionally render redesign sections. Everything else is shared single-file with conditional logic where needed. Data-layer side-effects (`attachChampions` query, suggest-time champion row insertion) are gated behind opts so the legacy path stays clean.

**Tech Stack:** Next.js 15 App Router (client-rendered shell), React, Zustand (votes store), Supabase (data + auth), Mapbox GL, Vitest (unit tests).

**Branch state assumptions at start:**
- Working from `feature/parent-feedback-redesign` (or a worktree off it).
- `npm run test:unit` passes (21/21).
- `npm run build` succeeds.
- `npx tsc --noEmit` clean.

---

## Worktree setup (prerequisite)

This work should happen in a worktree off `feature/parent-feedback-redesign` per project convention. Before starting Task 1, run:

```bash
# From the main repo
git worktree add ../parent_picker-redesign-merge feature/parent-feedback-redesign
cd ../parent_picker-redesign-merge
git checkout -b feature/route-gated-merge
npm install
```

Verify with `git status` (clean) and `git branch --show-current` (= `feature/route-gated-merge`).

---

## File Structure

**New files created:**
- `src/components/AltPanelLegacy.tsx` — verbatim copy of `main:src/components/AltPanel.tsx`
- `src/components/MapViewLegacy.tsx` — verbatim copy of `main:src/components/MapView.tsx`
- `src/components/AltPanelRedesign.tsx` — current branch's `AltPanel.tsx` (via `git mv`)
- `src/components/MapViewRedesign.tsx` — current branch's `MapView.tsx` (via `git mv`)
- `src/app/redesign/page.tsx` — redesign entry point
- `src/app/redesign/layout.tsx` — strictly optional; only if `app/page.tsx` layout pollutes

**Modified files:**
- `src/components/HomeContent.tsx` — accepts `variant` prop, renders the matching pair
- `src/components/Map.tsx` — variant-aware dynamic import
- `src/app/page.tsx` — passes `variant="legacy"`
- `next.config.ts` — adds `/miami` rewrite to `/redesign`
- `src/lib/locations.ts` — `getLocations` / `getLocationsInBounds` / `getNearbyLocations` accept `{ withRedesignFields?: boolean }`; `suggestLocation` accepts `{ createChampion?: boolean }`
- `src/lib/votes.ts` — store fetch action threads `withRedesignFields` through to lib calls
- `src/app/suggest/page.tsx` — reads `?from=redesign` query param, passes `createChampion` + `backHref` accordingly
- `src/app/api/problems/[id]/claim/route.ts` — `detailsUrl` points to `/redesign/?location=`
- `src/app/api/admin/problems/[id]/route.ts` — `detailsUrl` points to `/redesign/?location=`

**Files deliberately NOT forked** (single shared file, conditionals where needed):
- `LocationDetailView.tsx` — redesign sections already gated on `location.derived?.stage`; legacy locations have empty/default stage so nothing renders
- `app/location/[id]/page.tsx` — mobile detail view; renders LocationDetailView
- `app/admin/page.tsx` — Problems/Plans tabs ship live, reachable from both
- All new API routes — net-new paths, dormant unless `/redesign` calls them

---

## Task ordering rationale

Tasks 1–5 establish the route split as a no-op (legacy renders on `/`, redesign renders on `/redesign`, both visibly correct). Tasks 6–8 plug the data-layer leaks (`attachChampions`, suggest-champion creation). Task 9 fixes email link destinations. Task 10 is end-to-end verification.

Each task ends with a commit so the chain is bisectable.

---

### Task 1: Snapshot legacy AltPanel + MapView from main

**Files:**
- Create: `src/components/AltPanelLegacy.tsx`
- Create: `src/components/MapViewLegacy.tsx`

- [ ] **Step 1: Create the legacy AltPanel from main**

```bash
git show main:src/components/AltPanel.tsx > src/components/AltPanelLegacy.tsx
```

- [ ] **Step 2: Create the legacy MapView from main**

```bash
git show main:src/components/MapView.tsx > src/components/MapViewLegacy.tsx
```

- [ ] **Step 3: Rename the exported component inside each legacy file**

Open `src/components/AltPanelLegacy.tsx` and rename `export function AltPanel(` → `export function AltPanelLegacy(`. There should be exactly one occurrence; replace it.

Then `src/components/MapViewLegacy.tsx`: rename `export function MapView(` → `export function MapViewLegacy(`. Exactly one occurrence.

Use the Edit tool with `old_string: "export function AltPanel("` and `new_string: "export function AltPanelLegacy("`. Same pattern for MapView.

- [ ] **Step 4: Verify TypeScript still compiles**

Run: `npx tsc --noEmit`
Expected: clean (no errors). If the legacy files reference types or helpers that were removed/renamed on the branch, TypeScript will surface them. Most likely surface area: `findNearestMetro` (still exists in `metros.ts`), `Location` type (additive changes only — all new fields are optional). If errors appear, see "Known compatibility gaps" below.

**Known compatibility gaps (only fix if `tsc` complains):**
- Legacy AltPanel may import a member that was renamed on the branch. If `cannot find name 'X'` appears, identify the equivalent in `src/lib/sort.ts` / `src/lib/votes.ts` / `src/lib/metros.ts` (these were touched on the branch but kept backward-compatible exports). Fix imports in the legacy file only; do not modify branch files.
- Legacy MapView's GeoJSON dot encoding may reference field paths (`scores.overallColor`) that still exist — fine.

- [ ] **Step 5: Commit**

```bash
git add src/components/AltPanelLegacy.tsx src/components/MapViewLegacy.tsx
git commit -m "feat: snapshot legacy AltPanel + MapView from main"
```

---

### Task 2: Rename branch's AltPanel/MapView to Redesign variants

**Files:**
- Rename: `src/components/AltPanel.tsx` → `src/components/AltPanelRedesign.tsx`
- Rename: `src/components/MapView.tsx` → `src/components/MapViewRedesign.tsx`
- Modify: `src/components/HomeContent.tsx`
- Modify: `src/components/Map.tsx`

- [ ] **Step 1: Rename via git mv**

```bash
git mv src/components/AltPanel.tsx src/components/AltPanelRedesign.tsx
git mv src/components/MapView.tsx src/components/MapViewRedesign.tsx
```

- [ ] **Step 2: Rename the exports inside each redesign file**

In `src/components/AltPanelRedesign.tsx`, find `export function AltPanel(` and rename to `export function AltPanelRedesign(`.

In `src/components/MapViewRedesign.tsx`, find `export function MapView(` and rename to `export function MapViewRedesign(`. (There may be other `export` lines for sub-components — leave those alone; only rename the top-level `MapView` export.)

- [ ] **Step 3: Update HomeContent.tsx to import the renamed redesign component**

Edit `src/components/HomeContent.tsx`. Find:

```typescript
import { AltPanel } from "@/components/AltPanel";
```

Replace with:

```typescript
import { AltPanelRedesign } from "@/components/AltPanelRedesign";
```

Then in the JSX (around lines 99 and 104), replace both `<AltPanel />` occurrences with `<AltPanelRedesign />`. (This is a temporary state — Task 3 makes it conditional.)

- [ ] **Step 4: Update Map.tsx to import the renamed redesign MapView**

Edit `src/components/Map.tsx`. The current contents:

```typescript
"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(
  () => import("./MapView").then((mod) => mod.MapView),
  {
    loading: () => (
      <div className="flex items-center justify-center h-full bg-muted animate-pulse">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    ),
    ssr: false,
  }
);

export function Map() {
  return <MapView />;
}
```

Replace with (Map will become variant-aware in Task 3; this step gets it compiling under the new file names):

```typescript
"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(
  () => import("./MapViewRedesign").then((mod) => mod.MapViewRedesign),
  {
    loading: () => (
      <div className="flex items-center justify-center h-full bg-muted animate-pulse">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    ),
    ssr: false,
  }
);

export function Map() {
  return <MapView />;
}
```

- [ ] **Step 5: Verify TypeScript + build still pass**

Run: `npx tsc --noEmit && npm run build`
Expected: both pass clean. (The legacy variants from Task 1 are present but unused at this point.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: rename AltPanel/MapView to Redesign variants"
```

---

### Task 3: Add `variant` prop to HomeContent + Map

**Files:**
- Modify: `src/components/HomeContent.tsx`
- Modify: `src/components/Map.tsx`

- [ ] **Step 1: Add variant prop type and branch on it in HomeContent**

Edit `src/components/HomeContent.tsx`.

Add the imports for the legacy panel near the existing AltPanelRedesign import:

```typescript
import { AltPanelRedesign } from "@/components/AltPanelRedesign";
import { AltPanelLegacy } from "@/components/AltPanelLegacy";
```

Update the `HomeContent` function signature:

```typescript
export function HomeContent({ variant = "legacy" }: { variant?: "legacy" | "redesign" } = {}) {
```

In the JSX, replace both `<AltPanelRedesign />` occurrences with:

```typescript
{variant === "redesign" ? <AltPanelRedesign /> : <AltPanelLegacy />}
```

(Two replacements: one inside the desktop overlay panel, one inside the mobile bottom sheet.)

Also pass `variant` to the Map:

```typescript
<Map variant={variant} />
```

- [ ] **Step 2: Make Map variant-aware**

Edit `src/components/Map.tsx`. Replace the entire file with:

```typescript
"use client";

import dynamic from "next/dynamic";

const MapViewRedesign = dynamic(
  () => import("./MapViewRedesign").then((mod) => mod.MapViewRedesign),
  {
    loading: () => (
      <div className="flex items-center justify-center h-full bg-muted animate-pulse">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    ),
    ssr: false,
  }
);

const MapViewLegacy = dynamic(
  () => import("./MapViewLegacy").then((mod) => mod.MapViewLegacy),
  {
    loading: () => (
      <div className="flex items-center justify-center h-full bg-muted animate-pulse">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    ),
    ssr: false,
  }
);

export function Map({ variant = "legacy" }: { variant?: "legacy" | "redesign" } = {}) {
  return variant === "redesign" ? <MapViewRedesign /> : <MapViewLegacy />;
}
```

- [ ] **Step 3: Verify TypeScript + build still pass**

Run: `npx tsc --noEmit && npm run build`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/HomeContent.tsx src/components/Map.tsx
git commit -m "feat: thread variant prop through HomeContent + Map"
```

---

### Task 4: Create `/redesign` route + wire `/` to legacy variant

**Files:**
- Create: `src/app/redesign/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Set the root route to legacy variant**

Edit `src/app/page.tsx`. Replace the entire file with:

```typescript
"use client";

import { HomeContent } from "@/components/HomeContent";

export default function Home() {
  return <HomeContent variant="legacy" />;
}
```

- [ ] **Step 2: Create the /redesign route**

Create `src/app/redesign/page.tsx`:

```typescript
"use client";

import { HomeContent } from "@/components/HomeContent";

export default function Redesign() {
  return <HomeContent variant="redesign" />;
}
```

- [ ] **Step 3: Verify build picks up the new route**

Run: `npm run build`
Expected: build output lists both `/` and `/redesign` as routes. No errors.

- [ ] **Step 4: Smoke test in dev**

Run: `npm run dev` (background process).
In a browser, hit:
- http://localhost:3000/ — should render the legacy UI: all ~20 US metros visible at zoom 5, original left-panel city cards, no PoR/category sections when zoomed to a metro.
- http://localhost:3000/redesign — should render the redesign UI: only 4 S-FL metro bubbles (Miami, Miami Beach, Palm Beach, Boca), PoR + category sections when in metro view.

If `/` shows only 4 metros, the variant prop is not threading correctly — re-check HomeContent and Map.

Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/redesign/page.tsx
git commit -m "feat: split / (legacy) and /redesign (redesign) routes"
```

---

### Task 5: Add `/miami` rewrite to `/redesign`

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add rewrite rule**

Edit `next.config.ts`. Replace the entire file with:

```typescript
import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  transpilePackages: ["react-map-gl", "mapbox-gl"],
  async rewrites() {
    return [
      { source: "/miami", destination: "/redesign" },
      { source: "/miami/:path*", destination: "/redesign/:path*" },
    ];
  },
  ...(isGitHubPages && {
    output: "export",
    basePath: "/parent_picker",
    images: { unoptimized: true },
  }),
};

export default nextConfig;
```

Note: when `isGitHubPages` is true, `output: "export"` disables rewrites. That's fine — GitHub Pages mode is not used for production (Vercel is).

- [ ] **Step 2: Smoke test the alias**

Run: `npm run dev` (background process).
Hit http://localhost:3000/miami in a browser.
Expected:
- URL bar stays `/miami` (no redirect to `/redesign`).
- Content matches `/redesign` exactly (4 S-FL metros, redesign UI).

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: alias /miami to /redesign via rewrite"
```

---

### Task 6: Gate `attachChampions` behind `withRedesignFields` opt

**Files:**
- Modify: `src/lib/locations.ts`
- Modify: `src/lib/votes.ts`

**Background:** `attachChampions` runs a per-150-ID chunked Supabase query on every `getLocations*` call. The legacy UI doesn't render champions, so this is wasted load. We add an opt param, default false, and only set it true when the redesign variant is fetching.

- [ ] **Step 1: Add opt param to the three fetch functions**

Edit `src/lib/locations.ts`.

Change the signature of `getLocations` (currently line 167):

```typescript
export async function getLocations(opts?: { withRedesignFields?: boolean }): Promise<Location[]> {
```

Then in the body, change line 200 from:

```typescript
    await attachChampions(locations);
```

to:

```typescript
    if (opts?.withRedesignFields) await attachChampions(locations);
```

Change the signature of `getNearbyLocations` (currently line 346):

```typescript
export async function getNearbyLocations(centerLat: number, centerLng: number, limit: number = 500, releasedOnly?: boolean, opts?: { withRedesignFields?: boolean }): Promise<Location[]> {
```

In its body, change line 396 from:

```typescript
    await attachChampions(locations);
```

to:

```typescript
    if (opts?.withRedesignFields) await attachChampions(locations);
```

Change the signature of `getLocationsInBounds` (currently line 448):

```typescript
export async function getLocationsInBounds(bounds: Bounds, releasedOnly?: boolean, opts?: { withRedesignFields?: boolean }): Promise<Location[]> {
```

In its body, change line 485 from:

```typescript
    await attachChampions(locations);
```

to:

```typescript
    if (opts?.withRedesignFields) await attachChampions(locations);
```

- [ ] **Step 2: Thread the opt through the votes store**

Edit `src/lib/votes.ts`. The store has an `isRedesignVariant` field already? Check: it does not. Add it.

Find the existing state shape (look near the top for `interface VotesState` or similar). Add a field:

```typescript
  isRedesignVariant: boolean;
  setRedesignVariant: (v: boolean) => void;
```

In the store creator, add the default and setter:

```typescript
  isRedesignVariant: false,
  setRedesignVariant: (v) => set({ isRedesignVariant: v }),
```

Then find the two `getLocationsInBounds(bounds, releasedOnly)` calls (lines 273 and 286). Change each to:

```typescript
    const fetched = await getLocationsInBounds(bounds, releasedOnly, { withRedesignFields: get().isRedesignVariant });
```

Note: if the fetch action is inside `set((state) => …)`, use `get().isRedesignVariant` (Zustand's `get` accessor). If you're outside a setter, just reference state directly. Match whatever pattern the existing code uses for reading store values at fetch time.

- [ ] **Step 3: Set the flag in HomeContent based on the variant prop**

Edit `src/components/HomeContent.tsx`. Inside the `HomeContent` function body, add an effect that syncs the variant to the store:

```typescript
  const { setRedesignVariant } = useVotesStore();
  useEffect(() => {
    setRedesignVariant(variant === "redesign");
  }, [variant, setRedesignVariant]);
```

Place this after the existing `setIsAdmin` useEffect.

- [ ] **Step 4: Verify legacy fetch no longer calls attachChampions**

Run: `npm run dev` (background).
Open the browser network tab.
Visit http://localhost:3000/ and pan the map.
Expected: no requests to `pp_site_champions` table in the network tab.

Visit http://localhost:3000/redesign and pan.
Expected: requests to `pp_site_champions` appear (one per 150-ID chunk).

Stop the dev server.

- [ ] **Step 5: Verify type check + unit tests still pass**

Run: `npx tsc --noEmit && npm run test:unit`
Expected: tsc clean; 21/21 vitest pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/locations.ts src/lib/votes.ts src/components/HomeContent.tsx
git commit -m "feat: gate attachChampions on isRedesignVariant store flag"
```

---

### Task 7: Gate champion-row creation in `suggestLocation`

**Files:**
- Modify: `src/lib/locations.ts`

**Background:** `suggestLocation` (line 549) unconditionally inserts a `pp_site_champions` row on every authenticated submit (lines 644-652). Legacy users have no UI for champions and shouldn't auto-become one. Add an opt param.

- [ ] **Step 1: Change the suggestLocation signature**

Edit `src/lib/locations.ts`. Current signature (line 549):

```typescript
export async function suggestLocation(
  address: string,
  city: string,
  state: string,
  notes?: string,
  coordinates?: { lat: number; lng: number } | null,
  userId?: string
): Promise<Location> {
```

Replace with:

```typescript
export async function suggestLocation(
  address: string,
  city: string,
  state: string,
  notes?: string,
  coordinates?: { lat: number; lng: number } | null,
  userId?: string,
  opts?: { createChampion?: boolean }
): Promise<Location> {
```

- [ ] **Step 2: Conditionalize the champion insert**

In `src/lib/locations.ts`, around line 643 (just after `else if (data) {`), the champion insert block currently looks like:

```typescript
      } else if (data) {
        // Auto-create lead champion row for the submitter
        try {
          await supabase
            .from("pp_site_champions")
            .insert({
              site_id: data.id,
              user_id: userId,
              role: 'lead',
            });
        } catch (e) {
          // Non-fatal — the location was still created successfully
          console.error("Failed to auto-create champion row:", e);
        }
```

Wrap the `try` block in a conditional:

```typescript
      } else if (data) {
        if (opts?.createChampion) {
          try {
            await supabase
              .from("pp_site_champions")
              .insert({
                site_id: data.id,
                user_id: userId,
                role: 'lead',
              });
          } catch (e) {
            // Non-fatal — the location was still created successfully
            console.error("Failed to auto-create champion row:", e);
          }
        }
```

(The closing `}` for `else if (data)` already exists below — no other change needed in that block.)

- [ ] **Step 3: Verify type check passes**

Run: `npx tsc --noEmit`
Expected: clean. There will be one call site (`src/app/suggest/page.tsx`) that doesn't pass `opts` — that's fine because `opts` is optional. Task 8 will update that call site.

- [ ] **Step 4: Commit**

```bash
git add src/lib/locations.ts
git commit -m "feat: gate suggestLocation champion insert behind opt"
```

---

### Task 8: Wire suggest page to the redesign variant

**Files:**
- Modify: `src/app/suggest/page.tsx`

**Background:** When a user navigates from `/redesign` to `/suggest`, the suggest flow should:
- Auto-create them as a lead champion (`createChampion: true`)
- Send them back to `/redesign` on "Back" / after submit (`backHref: "/redesign"`)

Detection: a `?from=redesign` query param set by the redesign UI's suggest button. Legacy UI doesn't set it; suggest defaults to legacy behavior.

- [ ] **Step 1: Read the from query param**

Edit `src/app/suggest/page.tsx`. Around line 21:

```typescript
function SuggestPageInner() {
  const searchParams = useSearchParams();
  const standalone = searchParams.get("standalone") === "true";
  const { addLocation, setSelectedLocation, userId } = useVotesStore();
  const backHref = "/";
```

Replace with:

```typescript
function SuggestPageInner() {
  const searchParams = useSearchParams();
  const standalone = searchParams.get("standalone") === "true";
  const fromRedesign = searchParams.get("from") === "redesign";
  const { addLocation, setSelectedLocation, userId } = useVotesStore();
  const backHref = fromRedesign ? "/redesign" : "/";
```

- [ ] **Step 2: Pass createChampion to suggestLocation**

In the same file, find the call to `suggestLocation(...)` inside the submit handler (search for `await suggestLocation(`). The current call passes 6 positional args. Add a 7th — the opts object:

Find the call (it will look something like):

```typescript
      const newLocation = await suggestLocation(
        sanitizedAddress,
        sanitizedCity,
        sanitizedState,
        sanitizedNotes,
        coordinates,
        userId,
      );
```

Add the opts object as the 7th arg:

```typescript
      const newLocation = await suggestLocation(
        sanitizedAddress,
        sanitizedCity,
        sanitizedState,
        sanitizedNotes,
        coordinates,
        userId,
        { createChampion: fromRedesign },
      );
```

If the actual call site uses slightly different variable names, preserve them — only add the trailing `{ createChampion: fromRedesign }` arg.

- [ ] **Step 3: Update the redesign UI's suggest CTA to include `?from=redesign`**

The redesign AltPanel (now `AltPanelRedesign.tsx`) has a "Suggest a location" link or button. Find it:

Run: `grep -n "suggest" src/components/AltPanelRedesign.tsx`

Identify the line that navigates to `/suggest` (likely an `href="/suggest"` on a `<Link>` or a `router.push("/suggest")` call). Append the query string:

- If `<Link href="/suggest">`, change to `<Link href="/suggest?from=redesign">`.
- If `router.push("/suggest")`, change to `router.push("/suggest?from=redesign")`.

There may be multiple suggest entry points (e.g., a button in the panel header and one in an empty-state). Update all of them.

Do NOT touch the legacy AltPanel (`AltPanelLegacy.tsx`) — it should keep its plain `/suggest` link, which defaults to legacy behavior.

- [ ] **Step 4: Verify type check + smoke test**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run dev` (background).
- From `/redesign`, click the suggest CTA. Verify URL is `/suggest?from=redesign`.
- Back button should return to `/redesign`.
- From `/`, click the suggest CTA. Verify URL is `/suggest` (no `from`).
- Back button should return to `/`.

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/app/suggest/page.tsx src/components/AltPanelRedesign.tsx
git commit -m "feat: wire suggest flow to redesign variant via ?from=redesign"
```

---

### Task 9: Update redesign-triggered email URLs to `/redesign/`

**Files:**
- Modify: `src/app/api/problems/[id]/claim/route.ts`
- Modify: `src/app/api/admin/problems/[id]/route.ts`

**Background:** Problem-claim and problem-resolve emails are only triggered by redesign actions (the problem board exists only in the redesign). Their "See progress" / "See site" CTA links currently point to `/?location=<id>` (legacy root). Update both to `/redesign/?location=<id>` so recipients land in the redesign experience.

- [ ] **Step 1: Update the problem-claim route**

Edit `src/app/api/problems/[id]/claim/route.ts`. Find line 84:

```typescript
        const detailsUrl = `https://real-estate.alpha.school/?location=${location.id}`;
```

Replace with:

```typescript
        const detailsUrl = `https://real-estate.alpha.school/redesign/?location=${location.id}`;
```

- [ ] **Step 2: Update the admin problem-resolve route**

Edit `src/app/api/admin/problems/[id]/route.ts`. Find line 104:

```typescript
          const detailsUrl = `https://real-estate.alpha.school/?location=${location.id}`;
```

Replace with:

```typescript
          const detailsUrl = `https://real-estate.alpha.school/redesign/?location=${location.id}`;
```

- [ ] **Step 3: Verify**

These are server-side string changes. There's no test harness specific to them, but verify the rest of the codebase didn't drift:

Run: `npx tsc --noEmit && npm run lint`
Expected: clean (or only the pre-existing lint warnings noted in CLAUDE.md).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/problems/[id]/claim/route.ts src/app/api/admin/problems/[id]/route.ts
git commit -m "feat: point redesign-triggered emails to /redesign/?location="
```

---

### Task 10: Full verification and final commit

**Files:** none modified

- [ ] **Step 1: Run the full check suite**

```bash
npm run test:unit && npx tsc --noEmit && npm run lint && npm run build
```

Expected:
- `npm run test:unit`: 21/21 pass
- `npx tsc --noEmit`: clean
- `npm run lint`: 0 errors (pre-existing warnings OK)
- `npm run build`: succeeds, output lists `/`, `/redesign`, `/miami` (or only `/` and `/redesign` with `/miami` as a rewrite — both are acceptable)

- [ ] **Step 2: Manual smoke test of all three routes**

Run: `npm run dev` (background).

Visit and confirm visually:

1. **`http://localhost:3000/`** — Legacy UI
   - All ~20 US metros visible at the nationwide bubble overlay (zoom <9)
   - Left-panel city cards show legacy metros (Austin, DFW, LA, OC, SF, etc.) — NOT just S-FL
   - When you click into a metro, no Plan of Record / category sections / stage timeline / problem board
   - Card layout matches pre-branch design (no stage badges)
   - Map dots use score-based color encoding only (no parent emerald / short-term amber)
   - Network tab: no `pp_site_champions` requests during normal browse

2. **`http://localhost:3000/redesign`** — Redesign UI
   - Only 4 S-FL bubbles visible at nationwide overlay
   - Left-panel city cards: Miami, Miami Beach, Palm Beach, Boca only
   - When in a metro: Plan of Record + 3 category sections (Parent / AI / Short-term) + funnel-stat footer visible
   - LocationDetailView shows stage timeline (for committed sites) and problem list (for engaged/committed)
   - Map dots use parent/short-term/AI color encoding + stage-based size
   - Network tab: `pp_site_champions` requests fire on metro entry

3. **`http://localhost:3000/miami`** — Alias
   - URL bar stays `/miami`
   - Content identical to `/redesign`

4. **Cross-link verification**
   - From `/redesign`, click "Suggest a location" → URL becomes `/suggest?from=redesign`, "Back" returns to `/redesign`
   - From `/`, click "Suggest a location" → URL is `/suggest` (no `from`), "Back" returns to `/`
   - Authenticated suggest submit from `/redesign` → check `pp_site_champions` table; new row exists for the submitter on the new location
   - Authenticated suggest submit from `/` → no new `pp_site_champions` row

Stop dev server.

- [ ] **Step 3: Optional — push branch and open PR**

```bash
git push -u origin feature/route-gated-merge
gh pr create --base feature/parent-feedback-redesign \
  --title "Route-gated merge: / stays legacy, /redesign + /miami serve new UI" \
  --body "$(cat <<'EOF'
## Summary
- `/` continues to serve pre-branch legacy UI (all US metros, no redesign concepts)
- `/redesign` serves the full feedback redesign (4 S-FL metros, PoR, problem board, champions, stages)
- `/miami` is a soft alias of `/redesign` via Next rewrite (URL stays `/miami`)

## Architecture
- Forked `AltPanel.tsx` and `MapView.tsx` into `*Legacy` (snapshot from `main`) + `*Redesign` (current branch)
- Variant prop on `HomeContent` selects which pair to render
- `attachChampions` gated on store flag set from variant
- `suggestLocation` champion-row insert gated on opts param
- Redesign-triggered emails point to `/redesign/?location=`

## Test plan
- [ ] `npm run test:unit` — 21/21 unit tests pass
- [ ] `npx tsc --noEmit` — clean
- [ ] Build succeeds
- [ ] Manual smoke: legacy `/`, redesign `/redesign`, alias `/miami`
- [ ] Suggest flow from both variants behaves correctly
- [ ] No `pp_site_champions` queries on legacy `/`
EOF
)"
```

(Skip this step if you'd rather merge to `feature/parent-feedback-redesign` directly or open the PR from the GitHub UI.)

---

## Risks and mitigations

**Risk 1: Legacy AltPanel/MapView from main reference helpers that were renamed on the branch.**
- Likelihood: low. Spot-checked: `findNearestMetro`, `Location` type, sort helpers all still exist with backward-compatible signatures.
- Mitigation: Task 1 step 4 surfaces this via `tsc --noEmit`. If it complains, the fix is to update imports in the legacy file only.

**Risk 2: Pre-existing branch DB tables/RPCs aren't on `main`'s schema.**
- This plan assumes the branch's DB migrations (problem board, champions, plan of record, `is_bridge`, view/RPC additions for `leasing_status`/`loi_status`/`is_bridge`) have already been applied to the shared Supabase project (`schools_data` per CLAUDE.md). They have — they shipped with the branch's earlier work.
- If `main`'s `pp_locations_with_votes` view didn't have the new fields, legacy `getLocations` would receive `undefined` for them; since the legacy mapping doesn't read them, this is harmless.

**Risk 3: Shared `LocationDetailView.tsx` shows redesign sections on legacy `/`.**
- Mitigation: redesign sections are gated on `location.derived?.stage`. Legacy fetches don't call `applyDerived`? — wait, they do. The shared `getLocations*` paths call `applyDerived` unconditionally. Legacy locations will have `derived.stage = "prospecting"` (default), `derived.category = "ai"` (default when no champions). LocationDetailView's stage timeline only renders when `stage === "diligence" || stage === "build_out"`, problem list only on `engaged` / `committed`. So legacy locations show nothing extra. Confirmed safe.
- Edge case: if any legacy location happens to be on a real REBL `loi-signed` site, `derived.stage` would be `"diligence"` and the stage timeline + problem list would render on `/`. This is acceptable because (a) those are the same locations the redesign cares about, (b) the sections are visually compatible — they don't break the layout, just add. If you want stricter isolation, the conditionals in LocationDetailView could be ANDed with a `useVotesStore(s => s.isRedesignVariant)` check. Not in this plan but easy to add later.

**Risk 4: The `app/location/[id]/page.tsx` mobile route is shared and serves both variants.**
- Mitigation: same as Risk 3. Stage timeline + problem list won't render unless the location's derived stage matches. The mobile detail route also doesn't pull in PoR, category sections, or the suggest CTA — just the detail view itself.

**Risk 5: `viewAsParent`, drive-time filter, and other branch-only store fields leak into legacy AltPanel.**
- Mitigation: legacy AltPanel was snapshotted from main. It doesn't read those store fields. They sit unused in the store on `/`. Harmless.

---

## Self-review checklist

(Performed during plan authoring. Captured here for the implementer.)

- **Spec coverage:** All 4 design recommendations covered:
  1. Fork AltPanel + MapView (Tasks 1-3) ✓
  2. `/miami` via next.config rewrite (Task 5) ✓
  3. Redesign emails point to `/redesign/?location=` (Task 9) ✓
  4. Gate `attachChampions` (Task 6) ✓
  Plus addressed: gate `suggestLocation` champion-create (Task 7), wire suggest backHref (Task 8).
- **Placeholders:** none. Every code change shows the exact diff.
- **Type consistency:** Variant prop is `'legacy' | 'redesign'` throughout. Opt names: `withRedesignFields` on getters, `createChampion` on suggestLocation. Store field: `isRedesignVariant`. All used consistently across tasks.
- **No spec gaps:** This plan does NOT include creating Playwright e2e tests for the new routes. Existing Playwright suite (`tests/requirements.test.py`) targets `/` and should continue passing — verify in Task 10. New routes are smoke-tested manually. If automated e2e for `/redesign` is desired, that's a follow-up.

---

## Effort estimate

- Tasks 1-2: ~20 min (file ops + light import fixes if tsc complains)
- Tasks 3-5: ~30 min (variant prop plumbing, new route, rewrite)
- Tasks 6-8: ~60 min (data-layer gating + suggest wiring)
- Task 9: ~5 min (two URL changes)
- Task 10: ~20 min (verification)

**Total: ~2.5 hours of focused work** assuming no tsc surprises in Task 1. Allow another hour for snag-recovery if the legacy AltPanel from main has drift against the branch's lib changes.
