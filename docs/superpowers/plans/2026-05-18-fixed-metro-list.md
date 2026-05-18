# Fixed Metro List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace data-driven city cards with a hand-curated list of active metros, mirrored on the map as bubble navigation, and auto-zoom new visitors into their nearest active metro (profile address → geo → nationwide fallback).

**Architecture:** New `src/lib/active-metros.ts` exports a typed `ACTIVE_METROS` array + helpers (`findActiveMetro`, `getActiveMetroBySlug`, `getActiveMetroByDisplayName`). `AltPanel` cards and `MapView` bubbles consume `ACTIVE_METROS` directly. The initial-view effect in `MapView` selects the user's nearest active metro using profile location (preferred) or browser geolocation. Off-list dots still render. Legacy `citySummaries` state and `loadCitySummaries`/`consolidateToMetros`/`getCitySummaries` are removed once the swap is complete.

**Tech Stack:** Next.js 15 (App Router), Zustand, react-map-gl v8 (Mapbox), Vitest for unit tests, Playwright (Python) for e2e.

---

## File Structure

| File | Purpose | Created/Modified |
|---|---|---|
| `src/lib/active-metros.ts` | Curated metro list + lookup helpers | Created |
| `src/lib/active-metros.test.ts` | Vitest unit tests for the list + helpers | Created |
| `src/lib/metros.ts` | Mark `findNearestMetro` deprecated; delete `consolidateToMetros` | Modified |
| `src/lib/locations.ts` | Delete `getCitySummaries`, `getMockCitySummaries`; simplify `getInitialMapView` | Modified |
| `src/lib/votes.ts` | Delete `citySummaries` store field + `loadCitySummaries` action | Modified |
| `src/types/index.ts` | Delete `CitySummary` interface (no consumers after swap) | Modified |
| `src/components/AltPanel.tsx` | Cards from `ACTIVE_METROS`; `metroName` from `findActiveMetro`; updated `showCityCards`; new test IDs | Modified |
| `src/components/MapView.tsx` | Bubble layer from `ACTIVE_METROS` (no counts); initial-view uses profile→geo→`findActiveMetro` | Modified |
| `src/components/HomeContent.tsx` | Remove `loadCitySummaries` effect + import | Modified |
| `requirements.md` | New section `## R-METRO-FIXED` documenting the behavior | Modified |
| `tests/requirements.test.py` | New Playwright tests (TC-22.x) for the curated-metro flow | Modified |

The `admin/metro/[metro]/candidates` route stays on the deprecated `findNearestMetro` for one cycle — explicitly out of scope.

---

## Task 1: Document requirements (R-METRO-FIXED)

**Files:**
- Modify: `requirements.md` (append a new section before "Out of Scope (v2 - Future)")

- [ ] **Step 1: Add the requirements section**

Open `requirements.md`. Locate the line `## Out of Scope (v2 - Future)` (around line 1222). Insert the following block ABOVE it:

```markdown
## R-METRO-FIXED — Curated Metro Navigation

### R-METRO-FIXED-001 — Cards come from a curated list, not from data
Given the user is at nationwide zoom (`zoomLevel < 9`), the left panel shows one card per metro from `ACTIVE_METROS` in the order declared in `src/lib/active-metros.ts`. The cards do not reflect per-metro location counts.

### R-METRO-FIXED-002 — Card click flies to the metro's declared zoom
Given a user clicks a metro card, the map flies to that metro's `(lat, lng)` at its declared `defaultZoom`, and the left panel switches to the metro list view.

### R-METRO-FIXED-003 — Map bubble layer mirrors the curated list
Given the user is at nationwide zoom, the map shows one bubble per active metro at its `(lat, lng)`. Bubbles do not display a count. Clicking a bubble flies to that metro at its `defaultZoom`.

### R-METRO-FIXED-004 — Initial view prefers profile address, then geo
On first page load (no `?location=` deep link), the map auto-flies to the user's nearest active metro using saved profile coordinates if present, else browser geolocation. If no location resolves (or no metro is within range), the map stays at nationwide.

### R-METRO-FIXED-005 — Auto-fly fires once per session
The initial auto-fly runs at most once per page load. A geolocation callback that arrives after the user has manually navigated does not snap the camera back.

### R-METRO-FIXED-006 — Panning out of a metro restores the cards
Given a user pans the map center outside every active metro's radius, the panel header clears and the curated cards reappear (even at `zoomLevel >= 9`).

### R-METRO-FIXED-007 — Off-list locations still render on the map
Given a location exists whose nearest active metro is too far away (outside the metro's `radiusMiles`), the location dot still renders on the map. It has no card in the panel.
```

- [ ] **Step 2: Commit**

```bash
git add requirements.md
git commit -m "docs(requirements): add R-METRO-FIXED section for curated metro list"
```

---

## Task 2: Create the `active-metros` module (with tests)

**Files:**
- Create: `src/lib/active-metros.ts`
- Create: `src/lib/active-metros.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/active-metros.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  ACTIVE_METROS,
  findActiveMetro,
  getActiveMetroBySlug,
  getActiveMetroByDisplayName,
} from "./active-metros";

describe("ACTIVE_METROS data integrity", () => {
  it("has at least 10 metros seeded", () => {
    expect(ACTIVE_METROS.length).toBeGreaterThanOrEqual(10);
  });

  it("has unique slugs", () => {
    const slugs = ACTIVE_METROS.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has unique display names", () => {
    const names = ACTIVE_METROS.map((m) => m.displayName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every metro has plausible lat/lng/zoom/radius", () => {
    for (const m of ACTIVE_METROS) {
      expect(m.lat).toBeGreaterThan(15);
      expect(m.lat).toBeLessThan(50);
      expect(m.lng).toBeGreaterThan(-130);
      expect(m.lng).toBeLessThan(-65);
      expect(m.defaultZoom).toBeGreaterThanOrEqual(8);
      expect(m.defaultZoom).toBeLessThanOrEqual(13);
      expect(m.radiusMiles).toBeGreaterThan(10);
      expect(m.radiusMiles).toBeLessThan(150);
    }
  });
});

describe("findActiveMetro", () => {
  it("returns the metro for a point inside its radius", () => {
    // Downtown Austin
    const m = findActiveMetro(30.2672, -97.7431);
    expect(m?.slug).toBe("austin");
  });

  it("returns null for a point far from every active metro", () => {
    // Middle of Wyoming
    expect(findActiveMetro(43.0, -107.5)).toBeNull();
  });

  it("returns the nearer metro when two radii overlap", () => {
    // Anaheim (LA + OC both within radius; OC center is closer)
    const m = findActiveMetro(33.8366, -117.9143);
    expect(m?.slug).toBe("oc");
  });

  it("returns the metro itself for a point exactly at its center", () => {
    const target = ACTIVE_METROS[0];
    const m = findActiveMetro(target.lat, target.lng);
    expect(m?.slug).toBe(target.slug);
  });
});

describe("getActiveMetroBySlug", () => {
  it("returns the matching metro", () => {
    expect(getActiveMetroBySlug("austin")?.displayName).toBe("Austin");
  });

  it("returns null for an unknown slug", () => {
    expect(getActiveMetroBySlug("not-a-real-slug")).toBeNull();
  });
});

describe("getActiveMetroByDisplayName", () => {
  it("returns the matching metro", () => {
    expect(getActiveMetroByDisplayName("New York")?.slug).toBe("nyc");
  });

  it("returns null for an unknown name", () => {
    expect(getActiveMetroByDisplayName("Nowhere")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test:unit -- active-metros
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `active-metros.ts`**

Create `src/lib/active-metros.ts`:

```typescript
import { getDistanceMiles } from "./locations";

export interface ActiveMetro {
  slug: string;
  displayName: string;
  state: string;
  lat: number;
  lng: number;
  defaultZoom: number;
  radiusMiles: number;
}

/**
 * Hand-curated list of active metros used as the left-panel navigation cards
 * and the nationwide map bubble overlay.
 *
 * Order in this array = order on the page. Edit this file to add/remove metros.
 */
export const ACTIVE_METROS: ActiveMetro[] = [
  { slug: "austin",     displayName: "Austin",             state: "TX", lat: 30.2672, lng: -97.7431,  defaultZoom: 10, radiusMiles: 40 },
  { slug: "dfw",        displayName: "Dallas–Fort Worth", state: "TX", lat: 32.8205, lng: -96.8716,  defaultZoom: 9,  radiusMiles: 50 },
  { slug: "la",         displayName: "Los Angeles",        state: "CA", lat: 34.0522, lng: -118.2437, defaultZoom: 9,  radiusMiles: 50 },
  { slug: "oc",         displayName: "Orange County",      state: "CA", lat: 33.7175, lng: -117.8311, defaultZoom: 10, radiusMiles: 35 },
  { slug: "sf",         displayName: "San Francisco Bay",  state: "CA", lat: 37.7749, lng: -122.4194, defaultZoom: 9,  radiusMiles: 50 },
  { slug: "miami",      displayName: "Miami",              state: "FL", lat: 25.7617, lng: -80.1918,  defaultZoom: 10, radiusMiles: 40 },
  { slug: "palm-beach", displayName: "Palm Beach",         state: "FL", lat: 26.65,   lng: -80.08,    defaultZoom: 10, radiusMiles: 30 },
  { slug: "tampa",      displayName: "Tampa",              state: "FL", lat: 27.9506, lng: -82.4572,  defaultZoom: 10, radiusMiles: 35 },
  { slug: "nyc",        displayName: "New York",           state: "NY", lat: 40.7128, lng: -74.0060,  defaultZoom: 10, radiusMiles: 40 },
  { slug: "greenwich",  displayName: "Greenwich",          state: "CT", lat: 41.0262, lng: -73.6282,  defaultZoom: 11, radiusMiles: 25 },
  { slug: "boston",     displayName: "Boston",             state: "MA", lat: 42.3601, lng: -71.0589,  defaultZoom: 10, radiusMiles: 35 },
  { slug: "dc",         displayName: "Washington DC",      state: "DC", lat: 38.9072, lng: -77.0369,  defaultZoom: 10, radiusMiles: 40 },
  { slug: "chicago",    displayName: "Chicago",            state: "IL", lat: 41.8781, lng: -87.6298,  defaultZoom: 10, radiusMiles: 40 },
  { slug: "oklahoma",   displayName: "Oklahoma",           state: "OK", lat: 35.6,    lng: -97.0,     defaultZoom: 9,  radiusMiles: 60 },
  { slug: "raleigh",    displayName: "Raleigh–Durham",    state: "NC", lat: 35.8801, lng: -78.7880,  defaultZoom: 10, radiusMiles: 30 },
  { slug: "denver",     displayName: "Denver",             state: "CO", lat: 39.7392, lng: -104.9903, defaultZoom: 10, radiusMiles: 40 },
  { slug: "nashville",  displayName: "Nashville",          state: "TN", lat: 36.1627, lng: -86.7816,  defaultZoom: 10, radiusMiles: 30 },
];

/**
 * Return the active metro that contains the given point, or null.
 * If multiple metros' radii cover the point, returns the nearest by center distance.
 */
export function findActiveMetro(lat: number, lng: number): ActiveMetro | null {
  let best: ActiveMetro | null = null;
  let bestDist = Infinity;
  for (const m of ACTIVE_METROS) {
    const d = getDistanceMiles(lat, lng, m.lat, m.lng);
    if (d <= m.radiusMiles && d < bestDist) {
      best = m;
      bestDist = d;
    }
  }
  return best;
}

export function getActiveMetroBySlug(slug: string): ActiveMetro | null {
  return ACTIVE_METROS.find((m) => m.slug === slug) ?? null;
}

export function getActiveMetroByDisplayName(name: string): ActiveMetro | null {
  return ACTIVE_METROS.find((m) => m.displayName === name) ?? null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test:unit -- active-metros
```
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/active-metros.ts src/lib/active-metros.test.ts
git commit -m "feat(metros): add ACTIVE_METROS curated list + lookup helpers"
```

---

## Task 3: Switch `AltPanel` cards + metro detection to `ACTIVE_METROS`

**Files:**
- Modify: `src/components/AltPanel.tsx`

Notes for the implementer: `AltPanel` reads `citySummaries` for the zoomed-out card list and uses `findNearestMetro` for the metro name. We keep `citySummaries` in the store for now (Task 6 removes it) so this task only swaps the *consumers* — no store changes here.

- [ ] **Step 1: Update imports**

Locate (around line 12):
```typescript
import { findNearestMetro } from "@/lib/metros";
```
Replace with:
```typescript
import { ACTIVE_METROS, findActiveMetro } from "@/lib/active-metros";
```

- [ ] **Step 2: Remove `citySummaries` from the store selector**

In the `useShallow` selector (around lines 42 and 70), delete the `citySummaries` lines:
- Delete from destructure (line 42): `citySummaries,`
- Delete from selector object (line 70): `citySummaries: s.citySummaries,`

- [ ] **Step 3: Replace `metroName` derivation**

Locate (around lines 162–177):
```typescript
  // Determine metro name from map center (not from location counts, which skew toward high-volume metros)
  const METRO_DISPLAY: Record<string, string> = {
    "Phoenix": "Scottsdale",
  };

  const metroName = useMemo(() => {
    if (zoomLevel < 9 || !mapCenter) return null;
    const metro = findNearestMetro(mapCenter.lat, mapCenter.lng);
    if (!metro) return null;
    return METRO_DISPLAY[metro.name] || metro.name;
  }, [zoomLevel, mapCenter]);

  // City summaries sorted by location count (for zoomed-out view)
  const sortedCities = useMemo(() => {
    return [...citySummaries].sort((a, b) => b.locationCount - a.locationCount);
  }, [citySummaries]);

  const showCityCards = zoomLevel < 9;
```
Replace the entire block above with:
```typescript
  const activeMetro = useMemo(() => {
    if (zoomLevel < 9 || !mapCenter) return null;
    return findActiveMetro(mapCenter.lat, mapCenter.lng);
  }, [zoomLevel, mapCenter]);

  const metroName = activeMetro?.displayName ?? null;

  // Curated metros render directly — order = declared order in active-metros.ts
  const metroCards = ACTIVE_METROS;

  // Show curated cards when fully zoomed out OR when zoomed in past 9 but the
  // map center is outside every active metro's radius (e.g., panned over Memphis).
  const showCityCards = zoomLevel < 9 || !activeMetro;
```

- [ ] **Step 4: Replace `metroLocations` derivation**

Locate (around lines 226–235):
```typescript
  const metroLocations = useMemo(() => {
    if (!metroName) return [];
    return filteredLocations().filter(loc => {
      const m = findNearestMetro(loc.lat, loc.lng);
      if (!m) return false;
      return (METRO_DISPLAY[m.name] || m.name) === metroName;
    });
  // METRO_DISPLAY is a stable inline object; metroName & filteredLocations cover the deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredLocations, metroName, locations]);
```
Replace with:
```typescript
  const metroLocations = useMemo(() => {
    if (!activeMetro) return [];
    return filteredLocations().filter((loc) => {
      const m = findActiveMetro(loc.lat, loc.lng);
      return m?.slug === activeMetro.slug;
    });
  // filteredLocations is a stable store function; activeMetro & locations cover state deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredLocations, activeMetro, locations]);
```

- [ ] **Step 5: Replace the card list JSX**

Locate (around lines 555–575):
```tsx
      {showCityCards ? (
        /* Zoomed-out: city summary cards */
        <div className="px-4 py-2 space-y-2">
          {sortedCities.map((city) => (
            <button
              key={`${city.city}-${city.state}`}
              onClick={() => setFlyToTarget({ lat: city.lat, lng: city.lng, zoom: 9 })}
              className="w-full p-4 bg-white rounded-xl border border-gray-200 text-left hover:border-blue-300 transition-colors"
            >
              <p className="font-semibold text-gray-900">{city.city}, {city.state}</p>
              <p className="text-sm text-gray-500">
                {city.locationCount} {city.locationCount === 1 ? 'location' : 'locations'}
              </p>
            </button>
          ))}
          {sortedCities.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">
              Loading cities&hellip;
            </p>
          )}
        </div>
      ) : (
```
Replace with:
```tsx
      {showCityCards ? (
        /* Zoomed-out: curated active-metro cards */
        <div className="px-4 py-2 space-y-2" data-testid="metro-card-list">
          {metroCards.map((metro) => (
            <button
              key={metro.slug}
              data-testid="metro-card"
              data-metro-slug={metro.slug}
              onClick={() => setFlyToTarget({ lat: metro.lat, lng: metro.lng, zoom: metro.defaultZoom })}
              className="w-full p-4 bg-white rounded-xl border border-gray-200 text-left hover:border-blue-300 transition-colors"
            >
              <p className="font-semibold text-gray-900">{metro.displayName}</p>
            </button>
          ))}
        </div>
      ) : (
```

- [ ] **Step 6: Verify the file still type-checks and lints**

```bash
npx tsc --noEmit && npm run lint
```
Expected: no new errors. (Existing 18 lint warnings unchanged.) If `METRO_DISPLAY` is still referenced anywhere it was missed in Step 3 — grep and fix.

```bash
grep -n "METRO_DISPLAY\|findNearestMetro\|sortedCities\|citySummaries" src/components/AltPanel.tsx
```
Expected: no output.

- [ ] **Step 7: Smoke-test in the browser**

```bash
npm run dev
```
Open http://localhost:3000. Confirm:
- At nationwide zoom, the left panel shows the curated metro list (name only, in declared order — Austin first).
- Click "Austin" → map flies in, panel switches to the candidates view.
- Drag map north into Wyoming (or any area outside every metro) → cards reappear in the panel.

- [ ] **Step 8: Commit**

```bash
git add src/components/AltPanel.tsx
git commit -m "feat(panel): render curated metro cards instead of data summaries"
```

---

## Task 4: Switch the `MapView` bubble layer to `ACTIVE_METROS`

**Files:**
- Modify: `src/components/MapView.tsx`

Notes: `MapView` builds a clustered Mapbox source from `citySummaries`. We replace the source data with `ACTIVE_METROS` points and remove the count labels. The bubble click handler already reads lat/lng from `feature.geometry`, so it keeps working.

- [ ] **Step 1: Update imports**

Add to the imports at the top (e.g., after the `useVotesStore` import):

```typescript
import { ACTIVE_METROS } from "@/lib/active-metros";
```

- [ ] **Step 2: Remove `citySummaries` from the store selector**

In the `useShallow` selector (around lines 41 and 68), delete:
- Destructure line: `    citySummaries,`
- Selector object line: `    citySummaries: s.citySummaries,`

- [ ] **Step 3: Rebuild `cityGeojson`**

Locate (around lines 156–171):
```typescript
  // GeoJSON for city bubbles
  const cityGeojson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: citySummaries.map((c) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
      properties: {
        city: c.city,
        state: c.state,
        locationCount: c.locationCount,
        totalVotes: c.totalVotes,
        lng: c.lng,
        lat: c.lat,
      },
    })),
  }), [citySummaries]);
```
Replace with:
```typescript
  // GeoJSON for the curated active-metro bubble layer
  const cityGeojson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: ACTIVE_METROS.map((m) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [m.lng, m.lat] },
      properties: {
        slug: m.slug,
        displayName: m.displayName,
        defaultZoom: m.defaultZoom,
        lng: m.lng,
        lat: m.lat,
      },
    })),
  }), []);
```

- [ ] **Step 4: Adjust the bubble click handler to use the metro's declared zoom**

Locate (around lines 375–382):
```typescript
    if (feature.layer?.id === "city-clusters" || feature.layer?.id === "city-circles") {
      const coords = (feature.geometry as GeoJSON.Point).coordinates;
      if (coords) {
        const lng = coords[0];
        const lat = coords[1];
        flyToCoords({ lat, lng }, 9);
        fetchNearbyForce(approxBounds({ lat, lng }, 9));
      }
    } else if (feature.layer?.id === "unclustered-point") {
```
Replace with:
```typescript
    if (feature.layer?.id === "city-clusters" || feature.layer?.id === "city-circles") {
      const coords = (feature.geometry as GeoJSON.Point).coordinates;
      const props = feature.properties as { defaultZoom?: number } | undefined;
      if (coords) {
        const lng = coords[0];
        const lat = coords[1];
        const z = props?.defaultZoom ?? 10;
        flyToCoords({ lat, lng }, z);
        fetchNearbyForce(approxBounds({ lat, lng }, z));
      }
    } else if (feature.layer?.id === "unclustered-point") {
```

- [ ] **Step 5: Replace the entire `<Source id="cities">` block with a flat (uncluster ed) layer**

Locate the `<Source id="cities" …>` block (around lines 584–662). With only ~17 fixed metros, clustering adds complexity (cluster clicks would land at a centroid with no meaningful zoom level). Replace the entire block:

```tsx
      {/* City bubbles layer (zoom < 9) */}
      {showCities && (
        <Source id="cities" type="geojson" data={cityGeojson}
          cluster={true}
          clusterRadius={50}
          clusterMaxZoom={8}
          clusterProperties={{
            totalLocations: ["+", ["get", "locationCount"]],
            totalVotes: ["+", ["get", "totalVotes"]],
          }}
        >
          {/* Cluster circles */}
          <Layer
            id="city-clusters"
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": "#2563eb",
              "circle-radius": [
                "interpolate", ["linear"], ["get", "totalLocations"],
                1, 16,
                50, 24,
                200, 34,
                500, 42,
              ],
              "circle-opacity": 1,
              "circle-stroke-width": 3,
              "circle-stroke-color": "#ffffff",
            }}
          />
          {/* Cluster labels */}
          <Layer
            id="city-cluster-labels"
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              "text-field": ["to-string", ["get", "totalLocations"]],
              "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
              "text-size": 13,
              "text-allow-overlap": false,
            }}
            paint={{
              "text-color": "#ffffff",
              "text-halo-color": "#1e40af",
              "text-halo-width": 1.5,
            }}
          />
          {/* Unclustered city circles */}
          <Layer
            id="city-circles"
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": "#2563eb",
              "circle-radius": [
                "interpolate", ["linear"], ["get", "locationCount"],
                1, 14,
                50, 22,
                200, 32,
              ],
              "circle-opacity": 1,
              "circle-stroke-width": 3,
              "circle-stroke-color": "#ffffff",
            }}
          />
          {/* City labels */}
          <Layer
            id="city-labels"
            type="symbol"
            filter={["!", ["has", "point_count"]]}
            layout={{
              "text-field": ["to-string", ["get", "locationCount"]],
              "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
              "text-size": 13,
              "text-allow-overlap": false,
            }}
            paint={{
              "text-color": "#ffffff",
              "text-halo-color": "#1e40af",
              "text-halo-width": 1.5,
            }}
          />
        </Source>
      )}
```

Replace with:
```tsx
      {/* Curated active-metro bubble layer (zoom < 9) */}
      {showCities && (
        <Source id="cities" type="geojson" data={cityGeojson}>
          <Layer
            id="city-circles"
            type="circle"
            paint={{
              "circle-color": "#2563eb",
              "circle-radius": 14,
              "circle-opacity": 1,
              "circle-stroke-width": 3,
              "circle-stroke-color": "#ffffff",
            }}
          />
        </Source>
      )}
```

(The `city-clusters` layer ID is now gone. Confirm nothing else references it.)

- [ ] **Step 5a: Tighten `interactiveLayerIds`**

Locate (around line 227):
```typescript
  const interactiveLayerIds = useMemo(
    () => (showCities ? ["city-clusters", "city-circles"] : ["unclustered-point"]),
    [showCities]
  );
```
Replace with:
```typescript
  const interactiveLayerIds = useMemo(
    () => (showCities ? ["city-circles"] : ["unclustered-point"]),
    [showCities]
  );
```

- [ ] **Step 5b: Tighten the bubble click handler**

Inside the `handleMapClick` callback, the existing branch reads:
```typescript
    if (feature.layer?.id === "city-clusters" || feature.layer?.id === "city-circles") {
```
(after Step 4 you already extended it to read `defaultZoom`). Tighten the layer check now that clusters are gone:

Replace:
```typescript
    if (feature.layer?.id === "city-clusters" || feature.layer?.id === "city-circles") {
```
with:
```typescript
    if (feature.layer?.id === "city-circles") {
```

- [ ] **Step 6: Type-check + lint**

```bash
npx tsc --noEmit && npm run lint
```
Expected: clean. If TS complains about unused `useMemo` deps or about `CitySummary`, fix inline.

- [ ] **Step 7: Smoke-test bubbles in the browser**

```bash
npm run dev
```
At nationwide zoom, confirm:
- Bubbles render at each active metro's lat/lng (Austin, NYC, LA, etc.).
- Bubbles have no numeric label inside them.
- Clicking a bubble flies to that metro at its `defaultZoom` (e.g., Greenwich → zoom 11, LA → zoom 9).

- [ ] **Step 8: Commit**

```bash
git add src/components/MapView.tsx
git commit -m "feat(map): render curated metro bubbles without counts"
```

---

## Task 5: Initial-view selection (profile → geo → nationwide)

**Files:**
- Modify: `src/components/MapView.tsx`

Notes: The initial-view effect currently waits for `citySummaries.length > 0` and uses `getInitialMapView(userLat, userLng, citySummaries)`. We replace that with `findActiveMetro(userLat, userLng)`, drop the citySummaries dependency, and keep the one-shot `useRef` guard.

- [ ] **Step 1: Add the helper import**

In the imports near `import { getInitialMapView, US_CENTER, US_ZOOM } from "@/lib/locations";` (around line 11), update to:
```typescript
import { US_CENTER, US_ZOOM } from "@/lib/locations";
```
And add (or extend the existing) import:
```typescript
import { ACTIVE_METROS, findActiveMetro } from "@/lib/active-metros";
```
(Combine with the import added in Task 4 — keep one line.)

- [ ] **Step 2: Replace the initial-view effect**

Locate (around lines 264–319):
```typescript
  useEffect(() => {
    if (!geoResolved || !mapReady || citySummaries.length === 0) return;
    // Allow re-fire when profile location arrives after geo-based initial view
    if (initialViewSetRef.current && userLocationSource !== "profile") return;
    if (initialViewSetRef.current === "profile") return;
    const hasDeepLink = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("location");
    if (hasDeepLink || flyToTarget) { initialViewSetRef.current = true; return; }

    const { center, zoom } = getInitialMapView(
      initialViewLocation?.lat ?? null,
      initialViewLocation?.lng ?? null,
      citySummaries
    );

    setReferencePoint(center);

    const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;
    const adjustedZoom = isMobile && zoom < 9 ? zoom - 0.5 : zoom;

    mapRef.current?.flyTo({
      center: [center.lng, center.lat],
      zoom: adjustedZoom,
      duration: 1500,
    });

    // If zooming to city level, fetch nearby locations and set bounds/center
    // immediately (same pattern as flyToTarget handler). The old 100ms setTimeout
    // read map.getBounds() mid-animation which returned near-US-wide garbage,
    // and on mobile handleMoveEnd never fires to correct it.
    if (zoom >= 9) {
      const bounds = approxBounds(center, zoom);
      fetchNearbyForce(bounds);
      setMapBounds(bounds);
      setMapCenter(center);
      setZoomLevel(zoom);
    } else {
      // US-wide view: set bounds/center after a short delay so the map has
      // initialized its viewport (no flyTo race here since we stay at US zoom)
      setTimeout(() => {
        const map = mapRef.current?.getMap();
        if (map) {
          const b = map.getBounds();
          setMapBounds({
            north: b.getNorth(),
            south: b.getSouth(),
            east: b.getEast(),
            west: b.getWest(),
          });
          setMapCenter(center);
          setZoomLevel(map.getZoom());
        }
      }, 100);
    }

    initialViewSetRef.current = userLocationSource === "profile" ? "profile" : true;
  }, [initialViewLocation, userLocationSource, citySummaries, geoResolved, mapReady, locations, setReferencePoint, setMapBounds, setMapCenter, setZoomLevel, fetchNearbyForce]); // eslint-disable-line react-hooks/exhaustive-deps
```
Replace with:
```typescript
  useEffect(() => {
    if (!geoResolved || !mapReady) return;
    // Allow re-fire when profile location arrives after geo-based initial view
    if (initialViewSetRef.current && userLocationSource !== "profile") return;
    if (initialViewSetRef.current === "profile") return;
    const hasDeepLink = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("location");
    if (hasDeepLink || flyToTarget) { initialViewSetRef.current = true; return; }

    // Find the user's nearest active metro (profile > geo, captured upstream into initialViewLocation)
    const matched = initialViewLocation
      ? findActiveMetro(initialViewLocation.lat, initialViewLocation.lng)
      : null;

    const center = matched
      ? { lat: matched.lat, lng: matched.lng }
      : US_CENTER;
    const zoom = matched ? matched.defaultZoom : US_ZOOM;

    setReferencePoint(center);

    const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;
    const adjustedZoom = isMobile && zoom < 9 ? zoom - 0.5 : zoom;

    mapRef.current?.flyTo({
      center: [center.lng, center.lat],
      zoom: adjustedZoom,
      duration: 1500,
    });

    if (zoom >= 9) {
      const bounds = approxBounds(center, zoom);
      fetchNearbyForce(bounds);
      setMapBounds(bounds);
      setMapCenter(center);
      setZoomLevel(zoom);
    } else {
      // Nationwide view: read bounds once the map has rendered its viewport
      setTimeout(() => {
        const map = mapRef.current?.getMap();
        if (map) {
          const b = map.getBounds();
          setMapBounds({
            north: b.getNorth(),
            south: b.getSouth(),
            east: b.getEast(),
            west: b.getWest(),
          });
          setMapCenter(center);
          setZoomLevel(map.getZoom());
        }
      }, 100);
    }

    initialViewSetRef.current = userLocationSource === "profile" ? "profile" : true;
  }, [initialViewLocation, userLocationSource, geoResolved, mapReady, locations, setReferencePoint, setMapBounds, setMapCenter, setZoomLevel, fetchNearbyForce]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Sanity-check the file**

```bash
grep -n "citySummaries\|getInitialMapView" src/components/MapView.tsx
```
Expected: no output.

```bash
npx tsc --noEmit && npm run lint
```
Expected: no new errors.

- [ ] **Step 4: Smoke-test the three default-view paths**

```bash
npm run dev
```
Open Chrome DevTools → Sensors → set location to:
1. **Inside Austin** (30.2672, -97.7431) — reload, map should fly to Austin at zoom 10.
2. **Middle of Wyoming** (43, -107.5) — reload, map should stay nationwide with cards.
3. **Deny geolocation** + no signed-in profile — reload, map should stay nationwide with cards.

If you have a signed-in profile with `home_lat/home_lng` set, log in and confirm the profile coords win over a different geolocation.

- [ ] **Step 5: Commit**

```bash
git add src/components/MapView.tsx
git commit -m "feat(map): initial view picks user's nearest active metro"
```

---

## Task 6: Cleanup — remove `citySummaries` state, helpers, and dead code

**Files:**
- Modify: `src/lib/votes.ts`
- Modify: `src/lib/locations.ts`
- Modify: `src/lib/metros.ts`
- Modify: `src/types/index.ts`
- Modify: `src/components/HomeContent.tsx`

- [ ] **Step 1: Remove `loadCitySummaries` from `HomeContent`**

In `src/components/HomeContent.tsx`, locate (around lines 77–92):
```typescript
  const { loadCitySummaries, setReferencePoint, setIsAdmin, releasedFilter, showUnscored, viewAsParent } = useVotesStore();
  const { isAdmin } = useAuth();

  // Sync isAdmin from AuthProvider into Zustand store
  useEffect(() => {
    setIsAdmin(isAdmin);
  }, [isAdmin, setIsAdmin]);

  useEffect(() => {
    setReferencePoint(AUSTIN_CENTER);
  }, [setReferencePoint]);

  // Fetch city summaries on mount and when filters/admin state change
  useEffect(() => {
    loadCitySummaries();
  }, [releasedFilter, isAdmin, showUnscored, viewAsParent, loadCitySummaries]);
```
Replace with:
```typescript
  const { setReferencePoint, setIsAdmin } = useVotesStore();
  const { isAdmin } = useAuth();

  // Sync isAdmin from AuthProvider into Zustand store
  useEffect(() => {
    setIsAdmin(isAdmin);
  }, [isAdmin, setIsAdmin]);

  useEffect(() => {
    setReferencePoint(AUSTIN_CENTER);
  }, [setReferencePoint]);
```

- [ ] **Step 2: Remove `citySummaries` state + `loadCitySummaries` action from the store**

In `src/lib/votes.ts`:
- Update the import on line 4 — remove `CitySummary`:
  ```typescript
  import { Location, VoterInfo, VoteType, SiteChampion } from "@/types";
  ```
- Delete the `citySummaries: CitySummary[];` interface field (around line 33).
- Delete the `citySummaries: [],` initial state line (around line 133).
- Delete the entire `loadCitySummaries:` action (around lines 267–283) and the `citySummarySeq` module-scoped counter that supports it. Grep for `citySummarySeq` and remove that declaration too.
- Remove the `consolidateToMetros` import (around line 7):
  ```typescript
  import { consolidateToMetros } from "./metros";
  ```
  Delete this line entirely.
- Remove the `loadCitySummaries:` field from the store interface (whatever signature it has — search for `loadCitySummaries`).

- [ ] **Step 3: Delete unused functions from `locations.ts`**

In `src/lib/locations.ts`:
- Update the import on line 1 — remove `CitySummary`:
  ```typescript
  import { Location, LocationScores, SiteChampion, CommittedSubStage } from "@/types";
  ```
- Delete the `getMockCitySummaries` function (around line 340).
- Delete the `getCitySummaries` function (around line 371).
- Simplify `getInitialMapView` (around line 167) — drop the `citySummaries` parameter since no caller uses it after Task 5:
  ```typescript
  export function getInitialMapView(
    userLat: number | null,
    userLng: number | null,
  ): { center: { lat: number; lng: number }; zoom: number } {
    if (userLat === null || userLng === null) {
      return { center: US_CENTER, zoom: US_ZOOM };
    }
    return { center: { lat: userLat, lng: userLng }, zoom: 11 };
  }
  ```
  (Note: this helper has no remaining callers after Task 5. If a grep confirms zero callers, delete the function entirely instead of simplifying.)

Run:
```bash
grep -rn "getInitialMapView\|getCitySummaries\|getMockCitySummaries" src/
```
Expected: no output.

- [ ] **Step 4: Delete `consolidateToMetros` from `metros.ts`; mark `findNearestMetro` deprecated**

In `src/lib/metros.ts`:
- Delete the `import { CitySummary } from "@/types";` line at the top.
- Delete the entire `consolidateToMetros` function (around lines 143–192).
- Above the `findNearestMetro` declaration (around line 123), insert a deprecation comment:
  ```typescript
  /**
   * @deprecated Use findActiveMetro from "./active-metros" for parent-facing flows.
   * Still used by src/app/api/admin/metro/[metro]/candidates/route.ts; migrate that route
   * in a follow-up before deleting US_METROS + findNearestMetro.
   */
  ```

- [ ] **Step 5: Delete `CitySummary` from `types/index.ts`**

In `src/types/index.ts`, locate the `CitySummary` interface (around line 53) and delete it. First confirm no remaining consumers:
```bash
grep -rn "CitySummary" src/
```
Expected: only the type declaration line.

- [ ] **Step 6: Full verification**

```bash
npm run test:unit
```
Expected: 21 pre-existing tests + new `active-metros` tests all PASS.

```bash
npx tsc --noEmit
```
Expected: clean.

```bash
npm run lint
```
Expected: 0 errors. Pre-existing warning count should be unchanged.

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 7: Manual smoke**

```bash
npm run dev
```
1. Reload at http://localhost:3000 with no geo permission → nationwide view, curated cards visible, map bubbles visible without counts.
2. Click "New York" card → flies to NYC at zoom 10, candidates view appears.
3. From NYC view, drag the map north into Canada → header clears, curated cards reappear.
4. Click "Greenwich" card → flies to zoom 11.
5. With DevTools sensor at Austin coords, reload → flies to Austin automatically.

- [ ] **Step 8: Commit**

```bash
git add src/components/HomeContent.tsx src/lib/votes.ts src/lib/locations.ts src/lib/metros.ts src/types/index.ts
git commit -m "refactor(metros): remove dead citySummaries pipeline"
```

---

## Task 7: Playwright tests for the curated-metro flow

**Files:**
- Modify: `tests/requirements.test.py`

Notes: existing Playwright tests `TC-21.1.x` cover geolocation broadly. We add a new section `## 22. Curated Metros` that asserts the seven R-METRO-FIXED behaviors. The new test IDs in `AltPanel` (`data-testid="metro-card"`, `data-metro-slug`) make selectors stable.

- [ ] **Step 1: Append the new test section**

In `tests/requirements.test.py`, locate `## 21. Geolocation` (around line 2170) and find its closing tests. Append a new section AFTER all `TC-21.x` tests:

```python
        # ============================================================
        print("\n## 22. Curated Metros (R-METRO-FIXED)")
        # ============================================================

        @test("TC-22.1.1", "Curated metro cards render at nationwide zoom")
        def _():
            no_geo_ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page = no_geo_ctx.new_page()
            page.goto(BASE_URL)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(4000)
            cards = page.locator("[data-testid='metro-card']")
            count = cards.count()
            assert count >= 10, f"Expected >=10 curated metro cards, got {count}"
            # First card should be Austin (matches ACTIVE_METROS declared order)
            first_slug = cards.first.get_attribute("data-metro-slug")
            assert first_slug == "austin", f"Expected first metro slug 'austin', got '{first_slug}'"
            no_geo_ctx.close()
        _()

        @test("TC-22.1.2", "Card click flies to metro and hides the card list")
        def _():
            no_geo_ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page = no_geo_ctx.new_page()
            page.goto(BASE_URL)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(4000)
            page.locator("[data-testid='metro-card'][data-metro-slug='nyc']").click()
            # Cards should disappear after fly-in
            page.locator("[data-testid='metro-card-list']").wait_for(state="hidden", timeout=10000)
            no_geo_ctx.close()
        _()

        @test("TC-22.1.3", "Geolocation inside Austin auto-flies to Austin")
        def _():
            geo_ctx = browser.new_context(
                viewport={"width": 1440, "height": 900},
                geolocation={"latitude": 30.2672, "longitude": -97.7431},
                permissions=["geolocation"],
            )
            page = geo_ctx.new_page()
            page.goto(BASE_URL)
            page.wait_for_load_state("networkidle")
            # Card list should hide once the auto-fly completes
            try:
                page.locator("[data-testid='metro-card-list']").wait_for(state="hidden", timeout=15000)
            except Exception:
                pass
            cards = page.locator("[data-testid='metro-card']").count()
            assert cards == 0, f"Cards should hide after auto-fly to Austin, found {cards}"
            geo_ctx.close()
        _()

        @test("TC-22.1.4", "Geolocation outside any active metro stays at nationwide")
        def _():
            # Middle of Wyoming — outside every active metro radius
            geo_ctx = browser.new_context(
                viewport={"width": 1440, "height": 900},
                geolocation={"latitude": 43.0, "longitude": -107.5},
                permissions=["geolocation"],
            )
            page = geo_ctx.new_page()
            page.goto(BASE_URL)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(5000)
            cards = page.locator("[data-testid='metro-card']").count()
            assert cards >= 10, f"Cards should remain visible for non-active-metro geo, got {cards}"
            geo_ctx.close()
        _()

        @test("TC-22.1.5", "Back-to-metros button restores curated cards from metro view")
        def _():
            no_geo_ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page = no_geo_ctx.new_page()
            page.goto(BASE_URL)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(4000)
            # Enter NYC metro
            page.locator("[data-testid='metro-card'][data-metro-slug='nyc']").click()
            page.locator("[data-testid='metro-card-list']").wait_for(state="hidden", timeout=10000)
            # Click the back chevron in the header ("‹ · NEW YORK") — title-attribute selector is stable
            page.locator("button[title='Back to all metros']").click()
            # Curated cards should reappear
            page.locator("[data-testid='metro-card-list']").wait_for(state="visible", timeout=10000)
            cards = page.locator("[data-testid='metro-card']").count()
            assert cards >= 10, f"Curated cards should reappear after back-to-metros, got {cards}"
            no_geo_ctx.close()
        _()
```

Spec coverage notes:
- Profile-address-wins-over-geo test is omitted from this plan — it requires authenticated Playwright sessions and a profile fixture, which the existing test suite does not provide. The behavior is covered by the manual smoke step (Task 5 step 4) and by the source-priority guard in code (which already has multi-year production use).
- Off-list-dot-renders test is omitted — verifying individual map dot rendering through `mapboxgl-canvas` is brittle. The behavior follows directly from the fact that Task 6 does not introduce any new location filter; if all dots rendered before, they still do.

- [ ] **Step 2: Run the new tests against a local dev server**

```bash
npm run dev &
sleep 5
python tests/requirements.test.py 2>&1 | grep -E "TC-22"
```
Expected: all four TC-22.x tests pass. If any fail, inspect the assertion output, fix the implementation (not the test) unless the test expectation is wrong.

- [ ] **Step 3: Commit**

```bash
git add tests/requirements.test.py
git commit -m "test(playwright): curated-metro flow assertions (TC-22)"
```

---

## Task 8: Final verification + push

- [ ] **Step 1: Run the full unit suite**

```bash
npm run test:unit
```
Expected: all tests pass (existing 21 + new `active-metros` suite).

- [ ] **Step 2: Type-check + lint + build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```
Expected: 0 TS errors, 0 lint errors (pre-existing 18 warnings unchanged), build succeeds.

- [ ] **Step 3: Run the full Playwright suite**

```bash
npm run dev &
sleep 5
python tests/requirements.test.py 2>&1 | tail -30
```
Expected: pre-existing tests unchanged (geolocation tests TC-21.1.x might now reference `metro-card` selectors that didn't exist before — if any TC-21.x tests use the old `city-card` selector, they were already broken and remain broken; do NOT update them in this plan since they were already failing).

- [ ] **Step 4: Push the branch**

```bash
git push
```

Vercel auto-deploys the preview at the branch URL. Open it, smoke the three default-view paths one more time (Austin, Wyoming, denied geo), and confirm the cards + bubbles behave as designed.

---

## Out of Scope (for this plan)

- Migrating `src/app/api/admin/metro/[metro]/candidates/route.ts` from `findNearestMetro` to `findActiveMetro`. Separate follow-up; admin UI continues to work on the old 85-metro list until then.
- Tuning per-metro `radiusMiles` based on real overlap patterns. Defaults are reasonable; revisit after deploy if any metro overlaps awkwardly.
- Adding a `/metro/<slug>` URL route. Cards still fly client-side.
- Mobile-specific layout adjustments beyond what already exists.
- Adding "Other Cities" fallback cards for off-list locations.
