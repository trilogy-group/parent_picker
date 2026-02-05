import { Location } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabase";

// Mock data for testing when Supabase is not configured
export const mockLocations: Location[] = [
  {
    id: "1",
    name: "Downtown Austin Campus",
    address: "401 Congress Ave",
    city: "Austin",
    state: "TX",
    lat: 30.266595,
    lng: -97.74291,
    votes: 42,
  },
  {
    id: "2",
    name: "South Austin Learning Center",
    address: "2110 S Lamar Blvd",
    city: "Austin",
    state: "TX",
    lat: 30.276329,
    lng: -97.803671,
    votes: 28,
  },
  {
    id: "3",
    name: "Mueller Development Site",
    address: "4550 Mueller Blvd",
    city: "Austin",
    state: "TX",
    lat: 30.508723,
    lng: -97.677449,
    votes: 35,
  },
  {
    id: "4",
    name: "Round Rock Campus",
    address: "1 Dell Way",
    city: "Round Rock",
    state: "TX",
    lat: 30.519457,
    lng: -97.823892,
    votes: 19,
  },
  {
    id: "5",
    name: "Cedar Park Location",
    address: "1890 Ranch Shopping Center",
    city: "Cedar Park",
    state: "TX",
    lat: 30.247488,
    lng: -97.750453,
    votes: 56,
  },
  {
    id: "6",
    name: "Domain Area",
    address: "11410 Century Oaks Terrace",
    city: "Austin",
    state: "TX",
    lat: 30.297248,
    lng: -97.707322,
    votes: 31,
  },
  {
    id: "7",
    name: "Bee Cave Community Center",
    address: "4000 Galleria Pkwy",
    city: "Bee Cave",
    state: "TX",
    lat: 30.347183,
    lng: -97.968561,
    votes: 23,
  },
  {
    id: "8",
    name: "Pflugerville Site",
    address: "1200 E Pecan St",
    city: "Pflugerville",
    state: "TX",
    lat: 30.43919,
    lng: -97.61993,
    votes: 17,
  },
];

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
  _notes?: string,
  coordinates?: { lat: number; lng: number } | null
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
        console.error("Error inserting location:", error);
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
