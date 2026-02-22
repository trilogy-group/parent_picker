/**
 * Mapbox Isochrone API — fetch drive-time polygons with session cache.
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Session cache: key = "lng,lat,minutes" → GeoJSON FeatureCollection
const cache = new Map<string, GeoJSON.FeatureCollection>();

export async function fetchIsochrone(
  lng: number,
  lat: number,
  minutes: number = 30
): Promise<GeoJSON.FeatureCollection | null> {
  if (!MAPBOX_TOKEN) return null;

  const key = `${lng.toFixed(5)},${lat.toFixed(5)},${minutes}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const url = new URL(
    `https://api.mapbox.com/isochrone/v1/mapbox/driving/${lng},${lat}`
  );
  url.searchParams.set("contours_minutes", String(minutes));
  url.searchParams.set("polygons", "true");
  url.searchParams.set("denoise", "0.5");
  url.searchParams.set("access_token", MAPBOX_TOKEN);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data: GeoJSON.FeatureCollection = await res.json();
    if (!data.features || data.features.length === 0) return null;

    cache.set(key, data);
    return data;
  } catch {
    return null;
  }
}
