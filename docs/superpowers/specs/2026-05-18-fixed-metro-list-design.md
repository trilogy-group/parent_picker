# Fixed Metro List Redesign — Design Spec

**Date:** 2026-05-18
**Branch:** `feature/parent-feedback-redesign` (current)
**Status:** Draft — pending user review

## Goal

Replace the data-driven left-panel city cards with a small, hand-curated list of "active" metros. Use that same list to drive the nationwide map bubbles and to pick a smart initial view based on the visitor's profile or browser location.

The redesign is a simplification, not a feature expansion. We are removing data-derived behavior in favor of editorial control of which metros parents see when they land on the site.

## Decisions (from brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | Metro list source | Curated hardcoded list (~14–17 metros, seeded from active data, hand-editable thereafter) |
| 2 | Initial default view | Profile address → browser geolocation → nationwide |
| 3 | Pan behavior when leaving a fixed metro | Header clears, cards reappear |
| 4 | Card content | Name only (no count, no stats) |
| 5 | Per-metro zoom level | Each entry declares its own zoom |
| 6 | Off-list locations | Still render on the map; no card for them |
| 7 | Map at nationwide zoom | Show active-metro bubbles without counts; cleaner navigation |

## Seed Metro List

Hand-curated starting set (user will edit `src/lib/active-metros.ts` directly):

| Metro | Display name | State | Lat | Lng | Default zoom | Radius (mi) |
|---|---|---|---:|---:|---:|---:|
| austin | Austin | TX | 30.2672 | -97.7431 | 10 | 40 |
| dfw | Dallas–Fort Worth | TX | 32.8205 | -96.8716 | 9 | 50 |
| la | Los Angeles | CA | 34.0522 | -118.2437 | 9 | 50 |
| oc | Orange County | CA | 33.7175 | -117.8311 | 10 | 35 |
| sf | San Francisco Bay | CA | 37.7749 | -122.4194 | 9 | 50 |
| miami | Miami | FL | 25.7617 | -80.1918 | 10 | 40 |
| palm-beach | Palm Beach | FL | 26.65 | -80.08 | 10 | 30 |
| tampa | Tampa | FL | 27.9506 | -82.4572 | 10 | 35 |
| nyc | New York | NY | 40.7128 | -74.0060 | 10 | 40 |
| greenwich | Greenwich | CT | 41.0262 | -73.6282 | 11 | 25 |
| boston | Boston | MA | 42.3601 | -71.0589 | 10 | 35 |
| dc | Washington DC | DC | 38.9072 | -77.0369 | 10 | 40 |
| chicago | Chicago | IL | 41.8781 | -87.6298 | 10 | 40 |
| oklahoma | Oklahoma | OK | 35.6 | -97.0 | 9 | 60 |
| raleigh | Raleigh–Durham | NC | 35.8801 | -78.7880 | 10 | 30 |
| denver | Denver | CO | 39.7392 | -104.9903 | 10 | 40 |
| nashville | Nashville | TN | 36.1627 | -86.7816 | 10 | 30 |

The list is the source of truth — order in the file is order on the page. To drop or add a metro post-launch, edit one file.

## Architecture

### New module — `src/lib/active-metros.ts`

```ts
export interface ActiveMetro {
  slug: string;          // url-safe, e.g. "dfw"
  displayName: string;   // e.g. "Dallas–Fort Worth"
  state: string;         // e.g. "TX"
  lat: number;
  lng: number;
  defaultZoom: number;
  radiusMiles: number;   // for "is this point inside this metro?"
}

export const ACTIVE_METROS: ActiveMetro[] = [ ... ];

export function findActiveMetro(lat: number, lng: number): ActiveMetro | null;
export function getActiveMetroBySlug(slug: string): ActiveMetro | null;
export function getActiveMetroByDisplayName(name: string): ActiveMetro | null;
```

`findActiveMetro` returns the nearest active metro within that metro's own `radiusMiles`. Returns null if no metro is in range.

### Left-panel cards — `AltPanel.tsx`

- Replace the `citySummaries`-based card list with `ACTIVE_METROS.map(...)`.
- Card click → `setFlyToTarget({ lat, lng, zoom: defaultZoom })`.
- Card content: display name in caps, no count, no chart.
- Drop the existing sort-by-count logic. Order = `ACTIVE_METROS` order.
- `metroName` derivation uses `findActiveMetro(mapCenter)` instead of `findNearestMetro`.
- `showCityCards` extends from `zoomLevel < 9` to `zoomLevel < 9 || !metroName`. Panning out of a fixed metro at zoom 10 brings the cards back.

### Map bubble layer — `MapView.tsx`

- Replace the `citySummaries`-derived `cityFeatures` source with one derived from `ACTIVE_METROS`. Each metro = one bubble at its `(lat, lng)`.
- Bubble styling: keep current visual style but remove the count label inside the circle. A subtle dot or small ring is fine.
- Bubble click → fly to that metro at its `defaultZoom`.
- The bubble layer is hidden when `zoomLevel >= 9` (same threshold as cards).

### Initial view selection — `MapView.tsx` (`initial-view` effect)

Today the effect reads from `citySummaries` to find a populated city to default to. New logic, runs once per session after both `geoResolved` and `mapReady`:

1. If a `?location=<id>` deep-link is present, defer to existing behavior.
2. Else if `userLocation` (profile or geo) is set: call `findActiveMetro(userLocation)`.
   - Hit → `setFlyToTarget({ lat, lng, zoom: defaultZoom })` for that metro.
   - Miss → leave at nationwide view.
3. Else: leave at nationwide.

Critical: the auto-fly fires exactly **once** per session. Track this with a `useRef` guard so a late-arriving geo callback doesn't yank an already-zoomed-in user back to a metro.

### Initial-view dependency on `userLocationSource`

Profile address wins over geolocation. The store already exposes `userLocationSource: "profile" | "geo"`. We wait until either (a) profile load completes with a location, or (b) `geoResolved` is true with no profile. The existing `geoResolved` flag handles (b); the auth/profile loader sets `userLocationSource = "profile"` on hit. Initial-view effect deps include both — fire when either path settles.

### Off-list locations

- Locations outside every active metro still load and render on the map (no filter).
- They show up only when the user pans far enough that their bounding box intersects.
- No card for the metro they live in. This is intentional — cards are curated nav, not a data readout.

### Server-side `findNearestMetro` usage

`src/app/api/admin/metro/[metro]/candidates/route.ts` uses the old 85-metro list to bucket candidates by nearest metro. This endpoint takes a `metro` URL param keyed to the *old* metro names (which match `METRO_DISPLAY` values). After the redesign, admin candidate lookups should accept the new active-metro slugs.

We will keep both helpers temporarily:
- `findNearestMetro` (85-metro): used only by admin candidates route. Marked `@deprecated` with a comment pointing to the migration target.
- `findActiveMetro` (curated): used by all parent-facing code.

A separate cleanup commit (out of scope for this spec) migrates the admin route to the curated list once we confirm admin tools don't depend on metros that aren't in the active set.

### Cleanup

These get **deleted** when the redesign lands:

- `src/lib/metros.ts` → `consolidateToMetros` function (no consumers after the swap).
- `src/lib/votes.ts` → `citySummaries` state field, `loadCitySummaries` action, `CitySummary` import where unused.
- `src/components/HomeContent.tsx` → the `loadCitySummaries` effect on filter changes.
- `src/lib/locations.ts` → `getCitySummaries` and the `citySummaries` arg to `findInitialView` (or `findInitialView` itself if unused).
- `src/types/index.ts` → `CitySummary` interface if no other consumer remains (grep first).

`findNearestMetro` and `US_METROS` stay (deprecated) until the admin route migrates.

## Out of Scope

- No changes to vote/champion/problem/PoR flows.
- No changes to map markers for individual locations.
- No changes to admin tabs or candidate routes (separate cleanup).
- No changes to the metro display-name aliasing (`METRO_DISPLAY` in AltPanel) — the new list's `displayName` field replaces it directly.
- No mobile-specific layout work beyond what already exists.
- No SEO/URL routing changes (cards still flyTo client-side, no `/metro/<slug>` route).

## File-by-File Changes

| File | Change |
|---|---|
| `src/lib/active-metros.ts` | **New.** Export `ACTIVE_METROS`, `ActiveMetro`, `findActiveMetro`, `getActiveMetroBySlug`, `getActiveMetroByDisplayName`. |
| `src/lib/metros.ts` | Mark `findNearestMetro` deprecated; remove `consolidateToMetros`. |
| `src/lib/votes.ts` | Remove `citySummaries` state, `loadCitySummaries` action, related imports. |
| `src/lib/locations.ts` | Remove `getCitySummaries` + `findInitialView`'s citySummaries arg (or remove `findInitialView` entirely if unused after MapView changes). |
| `src/types/index.ts` | Remove `CitySummary` interface if no remaining consumers. |
| `src/components/AltPanel.tsx` | Cards from `ACTIVE_METROS`. `metroName` from `findActiveMetro`. `showCityCards` = `zoomLevel < 9 \|\| !metroName`. Remove `METRO_DISPLAY` alias map. |
| `src/components/MapView.tsx` | Bubble layer source = `ACTIVE_METROS` (no counts). Initial-view effect uses profile/geo → `findActiveMetro` flow with one-shot ref guard. |
| `src/components/HomeContent.tsx` | Remove `loadCitySummaries` effect. |
| `src/lib/sites/__snapshots__/` etc. | Update any snapshot tests that touch citySummaries. |
| `tests/requirements.test.py` | Add Playwright assertions for new behavior (see Test Plan). |

## Test Plan

Per project TDD discipline, requirements + tests are added before code.

### Unit tests (Vitest) — `src/lib/__tests__/active-metros.test.ts`

1. `findActiveMetro` returns the correct metro for a point inside its radius.
2. `findActiveMetro` returns null for a point outside any radius (e.g., middle of Wyoming).
3. When two metros' radii overlap, returns the nearer one.
4. `getActiveMetroBySlug` returns the matching metro or null.
5. `getActiveMetroByDisplayName` returns the matching metro or null.
6. `ACTIVE_METROS` slugs are unique.
7. `ACTIVE_METROS` display names are unique.

### Playwright (`tests/requirements.test.py`)

1. **Cold load, no profile, no geo permission** → nationwide view with curated cards visible.
2. **Cold load with mocked geo inside Austin radius** → map zoomed to Austin, cards hidden.
3. **Cold load with profile.home_lat/lng inside NYC radius** → map zoomed to NYC even when geo would resolve elsewhere.
4. **Click a metro card** → map flies to that metro at its `defaultZoom`, cards hide.
5. **From a metro view, drag map north until outside all radii** → header clears, cards reappear.
6. **Off-list location (e.g., Memphis dot) still renders on the map** when panned into view.

### Requirements doc

Add a new section `## 16. Fixed Active Metros` to `requirements.md` with the 6 behaviors above as testable requirements before implementation begins.

## Build sequence

1. Write `requirements.md` section + Playwright skeletons (red).
2. Write `src/lib/active-metros.ts` + Vitest tests (red → green).
3. Wire `AltPanel` to `ACTIVE_METROS` (cards). Verify in browser.
4. Wire `MapView` bubbles. Verify in browser.
5. Wire initial-view effect (profile > geo > nationwide). Verify with mocked locations.
6. Remove `loadCitySummaries`, `consolidateToMetros`, `citySummaries` state. Tsc + lint clean.
7. Run Playwright suite. Fix until green.
8. Build, deploy preview, manual smoke.

## Risks

- **Hidden consumer of `citySummaries`**: a quick grep confirmed AltPanel + MapView + HomeContent are the only callers, but a `useMemo` deep in another component could surface during cleanup. Grep again before removing the store field.
- **Admin candidates route divergence**: the admin "Add candidate to metro X" route still uses `findNearestMetro`. If admin and parent views show different metro buckets, that's confusing. Acceptable for one release cycle; address in a follow-up.
- **Initial-view ref guard**: easy to introduce a regression where the auto-fly fires twice (geo arrives late) or zero times (race between profile load + mapReady). Cover with one of the Playwright tests.
- **Per-metro radius tuning**: 25–60 mile radii are guesses. May need adjustment after deploy if metros overlap weirdly (e.g., LA + OC). Easy to tune in one file.

## Open Questions

None blocking. User should review the seed list and edit before implementation if any metros are wrong/missing.
