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
 * Full inventory of metros we want to support eventually. Order here =
 * default display order. Edit this list to add/remove metros from the catalog.
 *
 * Whether a metro actually appears in the UI is controlled by
 * `ENABLED_METRO_SLUGS` below. Disabling a metro keeps its config stashed for
 * an easy revert.
 */
export const ALL_METROS: ActiveMetro[] = [
  { slug: "austin",     displayName: "Austin",             state: "TX", lat: 30.2672, lng: -97.7431,  defaultZoom: 10, radiusMiles: 40 },
  { slug: "dfw",        displayName: "Dallas–Fort Worth", state: "TX", lat: 32.8205, lng: -96.8716,  defaultZoom: 9,  radiusMiles: 50 },
  { slug: "la",         displayName: "Los Angeles",        state: "CA", lat: 34.0522, lng: -118.2437, defaultZoom: 9,  radiusMiles: 50 },
  { slug: "oc",         displayName: "Orange County",      state: "CA", lat: 33.7175, lng: -117.8311, defaultZoom: 10, radiusMiles: 35 },
  { slug: "sf",         displayName: "San Francisco Bay",  state: "CA", lat: 37.7749, lng: -122.4194, defaultZoom: 9,  radiusMiles: 50 },
  { slug: "miami",       displayName: "Miami",              state: "FL", lat: 25.7617, lng: -80.1918,  defaultZoom: 10, radiusMiles: 40 },
  { slug: "miami-beach", displayName: "Miami Beach",        state: "FL", lat: 25.81,   lng: -80.14,    defaultZoom: 12, radiusMiles: 12 },
  { slug: "palm-beach",  displayName: "Palm Beach",         state: "FL", lat: 26.65,   lng: -80.08,    defaultZoom: 10, radiusMiles: 30 },
  { slug: "boca",        displayName: "Boca Raton",         state: "FL", lat: 26.37,   lng: -80.10,    defaultZoom: 11, radiusMiles: 12 },
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
 * Temporary scope-down: only the South Florida metros are surfaced while we
 * curate Plan-of-Record content. To re-enable a stashed metro, just add its
 * slug back to this set.
 */
const ENABLED_METRO_SLUGS = new Set<string>([
  "miami",
  "miami-beach",
  "palm-beach",
  "boca",
]);

/**
 * Hand-curated list of active metros used as the left-panel navigation cards
 * and the nationwide map bubble overlay. Filtered from ALL_METROS by
 * ENABLED_METRO_SLUGS so disabled metros stay in source for easy revert.
 */
export const ACTIVE_METROS: ActiveMetro[] = ALL_METROS.filter((m) =>
  ENABLED_METRO_SLUGS.has(m.slug)
);

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
