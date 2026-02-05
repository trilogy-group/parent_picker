import { Location } from "@/types";

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
    name: "Westlake Hills Location",
    address: "3425 Bee Cave Rd",
    city: "Austin",
    state: "TX",
    lat: 30.276329,
    lng: -97.803671,
    votes: 28,
  },
  {
    id: "3",
    name: "Round Rock Site",
    address: "201 E Main St",
    city: "Round Rock",
    state: "TX",
    lat: 30.508723,
    lng: -97.677449,
    votes: 35,
  },
  {
    id: "4",
    name: "Cedar Park Campus",
    address: "500 Discovery Blvd",
    city: "Cedar Park",
    state: "TX",
    lat: 30.519457,
    lng: -97.823892,
    votes: 19,
  },
  {
    id: "5",
    name: "South Congress Location",
    address: "1619 S Congress Ave",
    city: "Austin",
    state: "TX",
    lat: 30.247488,
    lng: -97.750453,
    votes: 56,
  },
  {
    id: "6",
    name: "Mueller Development",
    address: "4550 Mueller Blvd",
    city: "Austin",
    state: "TX",
    lat: 30.297248,
    lng: -97.707322,
    votes: 31,
  },
  {
    id: "7",
    name: "Lakeway Center",
    address: "103 Main St",
    city: "Lakeway",
    state: "TX",
    lat: 30.347183,
    lng: -97.968561,
    votes: 23,
  },
  {
    id: "8",
    name: "Pflugerville Campus",
    address: "201 E Pecan St",
    city: "Pflugerville",
    state: "TX",
    lat: 30.43919,
    lng: -97.61993,
    votes: 17,
  },
];

export async function getLocations(): Promise<Location[]> {
  // Stub: In v2, this will fetch from Supabase
  return mockLocations;
}

export async function suggestLocation(
  address: string,
  city: string,
  state: string,
  _notes?: string,
  coordinates?: { lat: number; lng: number } | null
): Promise<Location> {
  // Stub: In v2, this will insert into Supabase and trigger scoring
  // _notes will be used in v2 for parent feedback
  const newLocation: Location = {
    id: `suggested-${Date.now()}`,
    name: `Suggested: ${address}`,
    address,
    city,
    state,
    lat: coordinates?.lat ?? 30.2672, // Fallback to Austin center if no coordinates
    lng: coordinates?.lng ?? -97.7431,
    votes: 0,
    suggested: true,
  };
  return newLocation;
}
