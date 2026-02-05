import { Location, LocationScores } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabase";

// Generate a color from a 0-1 sub-score
function colorFromScore(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 0.75) return "GREEN";
  if (score >= 0.5) return "YELLOW";
  if (score >= 0.25) return "AMBER";
  return "RED";
}

// Generate a color from a 0-100 overall score
function colorFromOverall(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 75) return "GREEN";
  if (score >= 50) return "YELLOW";
  if (score >= 25) return "AMBER";
  return "RED";
}

// Seeded pseudo-random for deterministic mock scores
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

// Generate deterministic mock scores from a location index
function mockScores(index: number): LocationScores {
  const rand = seededRandom(index * 7919 + 42);
  const demo = Math.round(rand() * 100) / 100;
  const price = Math.round(rand() * 100) / 100;
  const zoning = Math.round(rand() * 100) / 100;
  const nbhd = Math.round(rand() * 100) / 100;
  const bldg = Math.round(rand() * 100) / 100;
  const overall = Math.round((demo * 20 + price * 20 + zoning * 20 + nbhd * 20 + bldg * 20) * 100) / 100;
  return {
    overall,
    overallColor: colorFromOverall(overall),
    overallDetailsUrl: null,
    demographics: { score: demo, color: colorFromScore(demo), detailsUrl: null },
    price: { score: price, color: colorFromScore(price), detailsUrl: null },
    zoning: { score: zoning, color: colorFromScore(zoning), detailsUrl: null },
    neighborhood: { score: nbhd, color: colorFromScore(nbhd), detailsUrl: null },
    building: { score: bldg, color: colorFromScore(bldg), detailsUrl: null },
  };
}

// Map Supabase view row to LocationScores
function mapRowToScores(row: Record<string, unknown>): LocationScores | undefined {
  if (row.overall_score == null) return undefined;
  const overall = Number(row.overall_score);
  const demo = row.demographics_score != null ? Number(row.demographics_score) : null;
  const price = row.price_score != null ? Number(row.price_score) : null;
  const zoning = row.zoning_score != null ? Number(row.zoning_score) : null;
  const nbhd = row.neighborhood_score != null ? Number(row.neighborhood_score) : null;
  const bldg = row.building_score != null ? Number(row.building_score) : null;
  return {
    overall,
    overallColor: (row.overall_color as string) || colorFromOverall(overall),
    overallDetailsUrl: (row.overall_details_url as string) || null,
    demographics: {
      score: demo,
      color: (row.demographics_color as string) || colorFromScore(demo),
      detailsUrl: (row.demographics_details_url as string) || null,
    },
    price: {
      score: price,
      color: (row.price_color as string) || colorFromScore(price),
      detailsUrl: (row.price_details_url as string) || null,
    },
    zoning: {
      score: zoning,
      color: (row.zoning_color as string) || colorFromScore(zoning),
      detailsUrl: (row.zoning_details_url as string) || null,
    },
    neighborhood: {
      score: nbhd,
      color: (row.neighborhood_color as string) || colorFromScore(nbhd),
      detailsUrl: (row.neighborhood_details_url as string) || null,
    },
    building: {
      score: bldg,
      color: (row.building_color as string) || colorFromScore(bldg),
      detailsUrl: (row.building_details_url as string) || null,
    },
  };
}

// Mock data for testing when Supabase is not configured
// 50 real locations from TX, FL, and CA
export const mockLocations: Location[] = [
  // Texas - Austin area
  { id: "e6c2e0e1-cf3f-4695-8054-91f49ef0ef1c", name: "Domain Central 1", address: "11420 Alterra Pkwy", city: "Austin", state: "TX", lat: 30.4000519, lng: -97.7209961, votes: 47 },
  { id: "37573b5b-796d-48f4-8edd-4af68ebe60c9", name: "Building 10", address: "1005 E Saint Elmo Rd", city: "Austin", state: "TX", lat: 30.212515, lng: -97.7564217, votes: 38 },
  { id: "e7b8c50d-3e62-4789-b1cc-9577c5e24a83", name: "2006 W Parmer Ln", address: "2006 W Parmer Ln", city: "Austin", state: "TX", lat: 30.4159675, lng: -97.6950974, votes: 33 },
  { id: "9b87e281-653a-46e0-aa9c-23ecff46a156", name: "Bailey Square Medical Center", address: "1111 W 34th St", city: "Austin", state: "TX", lat: 30.3028294, lng: -97.7467969, votes: 29 },
  { id: "139e0813-7cc1-4854-be9b-18e9868b0616", name: "Building 4", address: "6101 W Courtyard Dr", city: "Austin", state: "TX", lat: 30.3568458, lng: -97.799063, votes: 25 },
  { id: "64133c8f-9c54-4138-97c9-ab3770fbe8a0", name: "The Offices at the Domain 1", address: "11401 Century Oaks Ter", city: "Austin", state: "TX", lat: 30.402315, lng: -97.726046, votes: 41 },
  { id: "1ac0e210-818b-47a2-b7bd-af59b133460e", name: "Building 2", address: "6001 Wilcab Rd", city: "Austin", state: "TX", lat: 30.2722104, lng: -97.6742728, votes: 19 },
  { id: "7f3ceb0e-5d43-43ea-8849-620361a6a551", name: "3305 Ranch Rd 620 N", address: "3305 Ranch Road 620 N", city: "Austin", state: "TX", lat: 30.3939204, lng: -97.9340434, votes: 22 },
  { id: "84c8f09c-452e-4887-80bf-8178a193212a", name: "1119 Airport Blvd", address: "1119 Airport Blvd", city: "Austin", state: "TX", lat: 30.2663593, lng: -97.6954769, votes: 17 },

  // Texas - Dallas/Frisco area
  { id: "b56eec01-872e-47db-a651-8008823f4f73", name: "4585 Preston Rd", address: "4585 Preston Rd", city: "Frisco", state: "TX", lat: 33.1163892, lng: -96.8062153, votes: 52 },
  { id: "ffaec227-32c0-46e2-a4ac-a72b36ef605a", name: "8001 Parkwood Blvd", address: "8001 Parkwood Blvd", city: "Plano", state: "TX", lat: 33.086053, lng: -96.8187608, votes: 44 },
  { id: "a8086fc4-a123-40b7-a10f-78203e9abbe3", name: "8201 Preston Rd", address: "8201 Preston Rd", city: "Dallas", state: "TX", lat: 32.8628006, lng: -96.8049239, votes: 39 },
  { id: "3bc24115-60a7-4739-826e-77b006930d02", name: "16800 Dallas Pkwy", address: "16800 Dallas Pkwy", city: "Dallas", state: "TX", lat: 32.9764107, lng: -96.8235787, votes: 36 },
  { id: "e28ced19-b430-43f5-ae89-8c17fa412aeb", name: "2701 Valley View Ln", address: "2701 Valley View Ln", city: "Farmers Branch", state: "TX", lat: 32.9246743, lng: -96.8871984, votes: 28 },
  { id: "e26c9889-30b9-41ff-ba0a-a3fc381f454f", name: "2292 Vantage St", address: "2292 Vantage St", city: "Dallas", state: "TX", lat: 32.8003587, lng: -96.8358981, votes: 31 },
  { id: "89b1a168-4ca7-4d2b-8abb-133ba64ae789", name: "6718 Snider Plaza", address: "6718 Snider Plaza", city: "Dallas", state: "TX", lat: 32.8480517, lng: -96.7876371, votes: 27 },

  // Texas - Houston
  { id: "fa77cd7f-120b-48e4-baee-b0d15ca669aa", name: "1835 Richmond Ave", address: "1835 Richmond Ave", city: "Houston", state: "TX", lat: 29.7339571, lng: -95.4059031, votes: 45 },
  { id: "3c79d15b-a374-40d7-9518-6047117de0d4", name: "5625 Schumacher Ln", address: "5625 Schumacher Ln", city: "Houston", state: "TX", lat: 29.7283263, lng: -95.478064, votes: 37 },

  // Florida - Palm Beach area
  { id: "10e7f485-861f-49d5-9031-9dbf46808a1b", name: "314 Clematis St", address: "314 Clematis St", city: "West Palm Beach", state: "FL", lat: 26.7131163, lng: -80.0525755, votes: 48 },
  { id: "12fb416c-e8e8-4c76-a75d-7734a69b795b", name: "32 S Dixie Hwy", address: "32 S Dixie Hwy", city: "Lake Worth Beach", state: "FL", lat: 26.6148624, lng: -80.0572187, votes: 35 },
  { id: "faea9f3b-f057-4e53-879d-bf68e453bf6c", name: "701 Northpoint Pkwy", address: "701 Northpoint Pkwy", city: "West Palm Beach", state: "FL", lat: 26.7616479, lng: -80.0954815, votes: 42 },
  { id: "8d68bac5-1ddb-43b5-8c7d-5b6e073352f8", name: "4750 E Park Dr", address: "4750 E Park Dr", city: "Palm Beach Gardens", state: "FL", lat: 26.831367, lng: -80.0947916, votes: 39 },
  { id: "023b8593-6d1c-4aa8-9754-3585596481a6", name: "500 Northpoint Pkwy", address: "500 Northpoint Pkwy", city: "West Palm Beach", state: "FL", lat: 26.7603382, lng: -80.0956521, votes: 33 },
  { id: "774d085e-5de2-4da6-985f-06113d06c6e9", name: "210 Jupiter Lakes Blvd", address: "210 Jupiter Lakes Blvd", city: "Jupiter", state: "FL", lat: 26.9208215, lng: -80.0968401, votes: 29 },
  { id: "ab52b29b-9537-4296-aad0-c1e39f0edd43", name: "11770 US-1", address: "11770 US-1", city: "Palm Beach Gardens", state: "FL", lat: 26.8490296, lng: -80.0582946, votes: 26 },
  { id: "5fb07784-3653-4cbe-aa1a-480b1c409309", name: "560 Village Blvd", address: "560 Village Blvd", city: "West Palm Beach", state: "FL", lat: 26.7140301, lng: -80.0970424, votes: 31 },
  { id: "c87811b1-0b01-473c-abe4-80be45065316", name: "2655 N Ocean Dr", address: "2655 N Ocean Dr", city: "Riviera Beach", state: "FL", lat: 26.7844727, lng: -80.0357232, votes: 24 },

  // Florida - Boca Raton
  { id: "faaeae85-6f24-4178-88a6-4404d5d1de9d", name: "5000 T-Rex Ave", address: "5000 T-Rex Ave", city: "Boca Raton", state: "FL", lat: 26.3915768, lng: -80.1072322, votes: 43 },
  { id: "7e89ec5f-9098-4952-872b-97afe94872d6", name: "1800 N Military Trl", address: "1800 N Military Trl", city: "Boca Raton", state: "FL", lat: 26.3615864, lng: -80.1214554, votes: 38 },

  // Florida - Miami
  { id: "5a2db686-7e39-481a-bb3f-ea8c70ecc957", name: "1333 Dade Blvd", address: "1333 Dade Blvd", city: "Miami Beach", state: "FL", lat: 25.7926408, lng: -80.1431324, votes: 51 },

  // California - San Diego area
  { id: "5b52ede8-2d5a-48ac-b457-6db461fbe391", name: "1216 Cave St", address: "1216 Cave St", city: "San Diego", state: "CA", lat: 32.8479732, lng: -117.2719746, votes: 46 },
  { id: "6740550e-f502-4267-9c60-39399683c6a5", name: "1253-55 University Ave", address: "1253-55 University Ave", city: "San Diego", state: "CA", lat: 32.7480959, lng: -117.152181, votes: 40 },
  { id: "59548724-8bbb-4295-867c-ac6e8b8896bf", name: "856 Grand Ave", address: "856 Grand Ave", city: "San Diego", state: "CA", lat: 32.7951757, lng: -117.2541546, votes: 35 },
  { id: "0b060344-6be0-4f3d-a77c-78507105f2d1", name: "16644 W Bernardo Dr", address: "16644 W Bernardo Dr", city: "San Diego", state: "CA", lat: 33.0152602, lng: -117.0834296, votes: 32 },
  { id: "190144c2-b0ad-4ed7-905b-7526070c7c7a", name: "2650 Camino Del Rio North", address: "2650 Camino Del Rio North", city: "San Diego", state: "CA", lat: 32.7733657, lng: -117.1353255, votes: 28 },
  { id: "14015d8f-7d73-4302-b055-8879ef896fef", name: "605 3rd St", address: "605 3rd St", city: "Encinitas", state: "CA", lat: 33.0442779, lng: -117.2953954, votes: 25 },
  { id: "4135d9ba-b00b-423b-8c77-e182510f3848", name: "1705 San Elijo Rd S", address: "1705 San Elijo Rd S", city: "San Marcos", state: "CA", lat: 33.096539, lng: -117.200753, votes: 22 },
  { id: "62174271-3479-417c-8183-49deb1c33b7a", name: "4183 Avenida De La Plata", address: "4183 Avenida De La Plata", city: "Oceanside", state: "CA", lat: 33.2123397, lng: -117.2870975, votes: 19 },

  // California - Orange County
  { id: "07df6889-3a6c-46f0-8504-453e4887a48b", name: "714 N Spurgeon St", address: "714 N Spurgeon St", city: "Santa Ana", state: "CA", lat: 33.7511406, lng: -117.8658268, votes: 44 },
  { id: "c8a8a5ab-aeed-42af-b117-7be48158c171", name: "3740 S Susan St", address: "3740 S Susan St", city: "Santa Ana", state: "CA", lat: 33.6966618, lng: -117.9139886, votes: 37 },
  { id: "f875e406-cdd3-44ef-b98b-bf0310349f05", name: "2 S Pointe Dr", address: "2 S Pointe Dr", city: "Lake Forest", state: "CA", lat: 33.6596222, lng: -117.6982659, votes: 33 },
  { id: "dcd603cd-a2fe-4f76-b70d-7d58a31a90ac", name: "3519 East Coast Hwy", address: "3519 East Coast Hwy", city: "Corona Del Mar", state: "CA", lat: 33.5947353, lng: -117.8692993, votes: 30 },
  { id: "e6eea74a-3597-4e5e-abfe-c424216385ae", name: "1401 S Coast Hwy", address: "1401 S Coast Hwy", city: "Laguna Beach", state: "CA", lat: 33.5314138, lng: -117.7750965, votes: 27 },

  // California - Bay Area
  { id: "c84e49a4-8bf5-4a9b-9ce5-2e83420960d8", name: "610 Walnut St", address: "610 Walnut St", city: "Redwood City", state: "CA", lat: 37.4883912, lng: -122.2257275, votes: 49 },
  { id: "063dff8d-43b2-436a-939a-d68d16b09a55", name: "4500 Great America Pkwy", address: "4500 Great America Pkwy", city: "Santa Clara", state: "CA", lat: 37.395078, lng: -121.9783255, votes: 42 },
  { id: "9596efa6-1251-40a3-a416-7d7940e7d5bd", name: "1265 El Camino Real", address: "1265 El Camino Real", city: "Santa Clara", state: "CA", lat: 37.3536148, lng: -121.9504218, votes: 38 },
  { id: "5f7e1c73-1521-485d-976a-4c38f121fb09", name: "1940 The Alameda", address: "1940 The Alameda", city: "San Jose", state: "CA", lat: 37.3417264, lng: -121.9234476, votes: 35 },
  { id: "788f0111-4df4-425c-979b-cb2aa9dd7dee", name: "255 N Market St", address: "255 N Market St", city: "San Jose", state: "CA", lat: 37.3391987, lng: -121.895274, votes: 31 },
  { id: "6620f8ce-3e45-44f7-ae4f-5bcc646b2052", name: "66 Willow Pl", address: "66 Willow Pl", city: "Menlo Park", state: "CA", lat: 37.4513124, lng: -122.1663633, votes: 28 },

  // California - LA/Pasadena
  { id: "01e6bac0-3285-4baf-a6f2-5c84af035cef", name: "260 S Raymond Ave", address: "260 S Raymond Ave", city: "Pasadena", state: "CA", lat: 34.141479, lng: -118.1485645, votes: 41 },
].map((loc, i) => ({ ...loc, scores: mockScores(i) }));

// Austin TX - default location when user location unavailable
export const AUSTIN_CENTER = { lat: 30.2672, lng: -97.7431 };
export const AUSTIN_ZOOM = 10;

// Threshold distance in miles to consider "nearby"
const NEARBY_THRESHOLD_MILES = 50;

// Calculate distance between two points using Haversine formula
function getDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Find nearby locations within threshold distance
export function findNearbyLocations(
  userLat: number,
  userLng: number,
  locations: Location[],
  thresholdMiles: number = NEARBY_THRESHOLD_MILES
): Location[] {
  return locations.filter(loc =>
    getDistanceMiles(userLat, userLng, loc.lat, loc.lng) <= thresholdMiles
  );
}

// Get initial map view based on user location and available locations
export function getInitialMapView(
  userLat: number | null,
  userLng: number | null,
  locations: Location[]
): { center: { lat: number; lng: number }; zoom: number } {
  // If no user location, default to Austin TX
  if (userLat === null || userLng === null) {
    return { center: AUSTIN_CENTER, zoom: AUSTIN_ZOOM };
  }

  // Check if there are nearby locations
  const nearbyLocations = findNearbyLocations(userLat, userLng, locations);

  if (nearbyLocations.length > 0) {
    // Center on user with city-level zoom
    return { center: { lat: userLat, lng: userLng }, zoom: 10 };
  }

  // No nearby locations, default to Austin TX
  return { center: AUSTIN_CENTER, zoom: AUSTIN_ZOOM };
}

export async function getLocations(): Promise<Location[]> {
  // If Supabase is not configured, return mock data
  if (!isSupabaseConfigured || !supabase) {
    console.log("Supabase not configured, using mock data");
    return mockLocations;
  }

  try {
    const { data, error } = await supabase
      .from("pp_locations_with_votes")
      .select("*")
      .order("votes", { ascending: false });

    if (error) {
      console.error("Error fetching locations:", error);
      return mockLocations;
    }

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.city,
      state: row.state,
      lat: Number(row.lat),
      lng: Number(row.lng),
      votes: row.votes,
      suggested: row.source === "parent_suggested",
      scores: mapRowToScores(row),
    }));
  } catch (error) {
    console.error("Failed to fetch locations:", error);
    return mockLocations;
  }
}

interface GeocodeResult {
  lat: number;
  lng: number;
}

async function geocodeAddress(
  address: string,
  city: string,
  state: string
): Promise<GeocodeResult | null> {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!mapboxToken) {
    console.log("Mapbox token not configured, skipping geocoding");
    return null;
  }

  const query = encodeURIComponent(`${address}, ${city}, ${state}`);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxToken}&limit=1`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { lat, lng };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

export async function suggestLocation(
  address: string,
  city: string,
  state: string,
  notes?: string,
  coordinates?: { lat: number; lng: number } | null,
  userId?: string
): Promise<Location> {
  // Geocode the address
  const coords = await geocodeAddress(address, city, state);

  // Use geocoded coordinates or fall back to approximate Austin area
  const lat = coords?.lat ?? 30.2672 + (Math.random() - 0.5) * 0.1;
  const lng = coords?.lng ?? -97.7431 + (Math.random() - 0.5) * 0.1;

  const locationName = `Suggested: ${address}`;

  // If user is authenticated and Supabase is configured, persist to database
  if (userId && isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from("pp_locations")
        .insert({
          name: locationName,
          address,
          city,
          state,
          lat,
          lng,
          status: "pending_review",
          source: "parent_suggested",
          notes: notes || null,
          suggested_by: userId,
        })
        .select()
        .single();

      if (error) {
        console.error("Error inserting location:", error.message, error.code, error.details, error.hint);
        // Fall through to return local-only location
      } else if (data) {
        return {
          id: data.id,
          name: data.name,
          address: data.address,
          city: data.city,
          state: data.state,
          lat: Number(data.lat),
          lng: Number(data.lng),
          votes: 0,
          suggested: true,
        };
      }
    } catch (error) {
      console.error("Failed to insert location:", error);
    }
  }

  // Return local-only location (not persisted)
  return {
    id: `suggested-${Date.now()}`,
    name: locationName,
    address,
    city,
    state,
    lat: coordinates?.lat ?? 30.2672, // Fallback to Austin center if no coordinates
    lng: coordinates?.lng ?? -97.7431,
    votes: 0,
    suggested: true,
  };
}
