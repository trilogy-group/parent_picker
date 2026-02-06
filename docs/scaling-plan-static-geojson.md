# Scaling Plan: Static Map Data Architecture

## Current State

The map uses a two-tier model: city bubble summaries at wide zoom (from a database RPC), and individual location dots at street zoom (from a second RPC that fetches the 500 nearest). Each pan/zoom at street level triggers a database query. This works at small scale but introduces network latency on every interaction and breaks on spotty mobile connections.

## Target Architecture

Replace the two-tier model with a single pre-built dataset served to Mapbox GL JS. The database is never queried by end users for map data. An admin-triggered rebuild pipeline generates the dataset on demand.

There are two tiers of this architecture, sharing the same rebuild pipeline and admin controls, differing only in how the pre-built data reaches the browser:

- **Tier 1 (up to ~200k locations): Static GeoJSON on Vercel edge cache.** The browser downloads the full GeoJSON file; Mapbox clusters and renders client-side.
- **Tier 2 (200k+ locations): Mapbox Tileset.** The rebuild pipeline uploads GeoJSON to Mapbox, which pre-processes it into vector tiles on their CDN. The browser downloads only visible viewport tiles.

The system is designed so switching from Tier 1 to Tier 2 is a minimal change: the rebuild pipeline gains an upload step, and the map Source reference changes from a Vercel URL to a `mapbox://` URI. Everything else — admin controls, GeoJSON schema, map layers, click handlers, sidebar — stays the same.

## Why This Works

- **Mapbox GL renders via WebGL, not the DOM.** Any number of points in a source produce zero DOM elements. They are drawn as GPU pixels on a single canvas.
- **Built-in clustering runs on a web worker.** Mapbox computes clusters in a background thread without blocking the UI. (Tier 1 only — Tier 2 can pre-bake clusters during tileset processing.)
- **One fetch, then fully offline.** After the initial data load, all zoom/pan/cluster interactions happen client-side with no network requests. Dramatically better on mobile.

## Scale Guidance

| Location Count | Tier | Data to Browser | Initial Load (3G) |
|---|---|---|---|
| < 10,000 | 1 (GeoJSON) | ~100 KB gzipped | < 1s |
| 10k – 200k | 1 (GeoJSON) | ~1-2 MB gzipped | 2-4s |
| 200k+ | 2 (Tileset) | ~KB per viewport tile | Instant |

## Data Flow

Both tiers share the same first two steps. They diverge only in how data reaches the browser.

```
Database
    |
    | (queried only during rebuild — never by end users)
    v
Rebuild Pipeline: query DB → build GeoJSON FeatureCollection
    |
    |--- Tier 1: Cache GeoJSON at Vercel edge → browser fetches file
    |
    |--- Tier 2: Upload GeoJSON to Mapbox Uploads API
    |            → Mapbox processes into vector tiles (1-5 min)
    |            → browser fetches viewport tiles from mapbox:// URI
    |
    v
Mapbox GL JS: clustering + rendering on GPU
```

## GeoJSON Schema

The GeoJSON should contain only fields needed for map rendering and click interaction. Full location details (score breakdowns, report URLs, notes) should be fetched on demand when a user interacts with a specific dot.

**Minimal feature properties:**
- `id` — database primary key (used as Mapbox feature ID via `promoteId`)
- `votes` — vote count (for cluster aggregation and display)
- `overallColor` — score color band: GREEN/YELLOW/AMBER/RED/null (for dot coloring)
- `name` — location name (for popup on click)
- `address` — address (for popup on click)
- `city`, `state` — for sidebar filtering

Coordinates are in the GeoJSON geometry, not duplicated in properties.

At 100k locations with these fields, expect ~60-80 bytes per feature, ~6-8 MB raw, ~1-2 MB gzipped.

This schema is the same for both tiers. The GeoJSON built by the rebuild pipeline is either cached directly (Tier 1) or uploaded to Mapbox (Tier 2).

## Rebuild and Invalidation

### Who triggers a rebuild

The **admin** is the primary trigger. A "Revalidate Map" button in the admin console triggers the rebuild pipeline. The admin clicks this after any data change — batch import, score update, location approval, etc.

Additionally, the rebuild should fire automatically after:
- Admin approves or rejects a suggested location
- A user suggests a new location (so the dot appears for others)

External data tools (batch importers, scoring agents) do NOT need to know about the map. The admin revalidates when ready.

### How the rebuild works

**Tier 1:** The API route that serves the GeoJSON is tagged with a cache tag. Calling the framework's cache invalidation function busts the edge cache. The next request triggers a fresh build. The framework serves stale content while rebuilding in the background, so no user waits.

- Rebuild cost: ~200-500ms at 5k locations, ~1-3 seconds at 100k
- Users never see a delay — stale-while-revalidate

**Tier 2:** Same rebuild pipeline, but after building the GeoJSON, it uploads to the Mapbox Uploads API. Mapbox processes the tileset (1-5 minutes). The tileset ID is **stable** — it doesn't change between uploads. The same `mapbox://` URI always works. After processing completes, Mapbox CDN serves the updated tiles.

- Rebuild cost: same DB query time, plus 1-5 minutes Mapbox processing
- Small CDN cache delay (~minutes) after processing completes

### What the admin sees

The admin page has a "Revalidate Map" button. Clicking it triggers the pipeline and shows confirmation. The admin does not need to know which tier is active — the pipeline handles it.

## Map Configuration

A single Mapbox Source replaces all current sources:

- **Tier 1**: `type: "geojson"` pointing at the edge-cached URL
- **Tier 2**: `type: "vector"` pointing at the `mapbox://` tileset URI

In both cases:
- `promoteId: "id"` — use database ID as the Mapbox feature ID, enabling `featureState` for hover/selection effects without React re-renders

For Tier 1, clustering is configured on the Source:
- `cluster: true`
- `clusterRadius: 50` (pixel radius for grouping)
- `clusterMaxZoom: 14` (stop clustering at street level)
- `clusterProperties` to aggregate `votes` across clusters

For Tier 2, clustering can either be pre-baked during tileset processing (using tippecanoe or Mapbox recipes) or done client-side on the vector tile data.

**Layers** (same for both tiers):
1. **Cluster circles** — filtered by `["has", "point_count"]`, sized by aggregated count
2. **Cluster labels** — shows aggregated count inside cluster circles
3. **Individual dot circles** — filtered by `["!", ["has", "point_count"]]`, colored by `overallColor`

Clicking a cluster zooms in. Clicking an individual dot shows a popup.

## What Gets Removed (from current architecture)

The two-tier model introduces complexity that the static data approach eliminates:

- **City summaries database function** — clustering replaces it
- **Nearby locations database function** — all data is already loaded
- **Incremental fetch logic** (fetch on pan, skip if moved < 5 miles, force-fetch) — no incremental loading
- **Two separate Source/Layer blocks** toggled by zoom level — one Source handles everything
- **Zoom-level toggle** between city bubbles and dots — Mapbox clustering transitions automatically
- **City summary types and related application state** — not needed when clustering is automatic

## What Gets Added

- **Rebuild pipeline** — queries database, builds GeoJSON, caches or uploads depending on tier
- **Invalidation trigger** — admin button + automatic triggers from approve/reject/suggest actions
- **`promoteId`** on the Mapbox Source for stable feature IDs

## Sidebar and Location Details

The sidebar location list reads from the application store. With the new architecture, this store is populated from the same data (either parsed from the GeoJSON on the client, or from a parallel lightweight API call). The sidebar continues to work as before.

For rich location details (score breakdowns, report URLs), fetch on demand when a user clicks a specific dot. This keeps the GeoJSON minimal.

## Votes

Vote counts in the map data are a snapshot from the last rebuild. A user's own vote updates optimistically in the local UI, but other users see it only after the next rebuild. For infrequent-update voting, this is acceptable.

## Migration Path

### Phase 1: Tier 1 (Static GeoJSON)
1. Build the rebuild pipeline (API route that queries DB, returns GeoJSON with cache tag)
2. Add the invalidation trigger and admin button
3. Refactor the map component to use a single Source with clustering
4. Simplify the application store — remove city summaries, incremental fetch logic
5. Clean up unused database functions
6. Test with synthetic data at 100k scale on mobile

### Phase 2: Tier 2 (Mapbox Tilesets) — when needed
1. Add Mapbox Uploads API integration to the rebuild pipeline (after building GeoJSON, upload it)
2. Change the map Source from GeoJSON URL to `mapbox://` tileset URI
3. Optionally pre-bake clustering in the tileset recipe
4. Everything else stays the same — admin button, layers, click handlers, sidebar

The switch from Phase 1 to Phase 2 is two changes: the rebuild pipeline gains an upload step, and the Source reference changes. No other code diverges.
