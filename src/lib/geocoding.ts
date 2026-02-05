export interface GeocodingResult {
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  fullAddress: string;
}

export interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  context?: Array<{
    id: string;
    text: string;
    short_code?: string;
  }>;
  address?: string;
  text: string;
}

interface MapboxGeocodingResponse {
  features: MapboxFeature[];
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export async function searchAddresses(query: string): Promise<GeocodingResult[]> {
  if (!MAPBOX_TOKEN || query.length < 3) {
    return [];
  }

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=US&types=address,poi&limit=5`
    );

    if (!response.ok) {
      console.error("Geocoding API error:", response.status);
      return [];
    }

    const data: MapboxGeocodingResponse = await response.json();

    return data.features.map((feature) => {
      const { city, state } = extractCityState(feature);
      return {
        address: feature.address
          ? `${feature.address} ${feature.text}`
          : feature.text,
        city,
        state,
        lat: feature.center[1],
        lng: feature.center[0],
        fullAddress: feature.place_name,
      };
    });
  } catch (error) {
    console.error("Geocoding error:", error);
    return [];
  }
}

export async function geocodeAddress(
  address: string,
  city: string,
  state: string
): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN) {
    return null;
  }

  const query = `${address}, ${city}, ${state}`;

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=US&types=address&limit=1`
    );

    if (!response.ok) {
      return null;
    }

    const data: MapboxGeocodingResponse = await response.json();

    if (data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { lat, lng };
    }

    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

function extractCityState(feature: MapboxFeature): { city: string; state: string } {
  let city = "";
  let state = "";

  if (feature.context) {
    for (const ctx of feature.context) {
      if (ctx.id.startsWith("place.")) {
        city = ctx.text;
      } else if (ctx.id.startsWith("region.")) {
        state = ctx.short_code?.replace("US-", "") || ctx.text;
      }
    }
  }

  return { city, state };
}
