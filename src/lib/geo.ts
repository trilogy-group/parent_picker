/**
 * Point-in-polygon test using ray casting algorithm.
 * Used to check if a location falls within an isochrone polygon.
 */

type Position = [number, number]; // [lng, lat]

function pointInRing(lng: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Check if a lat/lng point falls inside a GeoJSON FeatureCollection of polygons. */
export function pointInIsochrone(
  lat: number,
  lng: number,
  geojson: GeoJSON.FeatureCollection
): boolean {
  for (const feature of geojson.features) {
    const geom = feature.geometry;
    if (geom.type === "Polygon") {
      if (!pointInRing(lng, lat, geom.coordinates[0] as Position[])) continue;
      const inHole = geom.coordinates.slice(1).some(hole => pointInRing(lng, lat, hole as Position[]));
      if (!inHole) return true;
    } else if (geom.type === "MultiPolygon") {
      for (const polygon of geom.coordinates) {
        if (!pointInRing(lng, lat, polygon[0] as Position[])) continue;
        const inHole = polygon.slice(1).some(hole => pointInRing(lng, lat, hole as Position[]));
        if (!inHole) return true;
      }
    }
  }
  return false;
}
