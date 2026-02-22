/**
 * Mapbox Isochrone API — fetch drive-time polygons with session cache.
 * Uses driving-traffic profile with Monday 8am departure for realistic commute times.
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();

// Session cache: key = "lng,lat,minutes" → GeoJSON FeatureCollection
const cache = new Map<string, GeoJSON.FeatureCollection>();

/** Returns next Monday at 08:00 local time as ISO string (no timezone). */
function getNextMondayMorning(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  monday.setHours(8, 0, 0, 0);
  // Format as "YYYY-MM-DDTHH:MM" (local time, no TZ — Mapbox interprets as local to the coordinate)
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T08:00`;
}

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
    `https://api.mapbox.com/isochrone/v1/mapbox/driving-traffic/${lng},${lat}`
  );
  url.searchParams.set("contours_minutes", String(minutes));
  url.searchParams.set("polygons", "true");
  url.searchParams.set("denoise", "0.5");
  url.searchParams.set("depart_at", getNextMondayMorning());
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
