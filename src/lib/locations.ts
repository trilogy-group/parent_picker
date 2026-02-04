import { Location } from "@/types";

export const mockLocations: Location[] = [
  {
    id: "1",
    name: "Downtown Austin Campus",
    address: "401 Congress Ave",
    city: "Austin",
    state: "TX",
    lat: 30.2672,
    lng: -97.7431,
    votes: 42,
  },
  {
    id: "2",
    name: "Westlake Hills Location",
    address: "3425 Bee Cave Rd",
    city: "Austin",
    state: "TX",
    lat: 30.2969,
    lng: -97.8014,
    votes: 28,
  },
  {
    id: "3",
    name: "Round Rock Site",
    address: "201 E Main St",
    city: "Round Rock",
    state: "TX",
    lat: 30.5083,
    lng: -97.6789,
    votes: 35,
  },
  {
    id: "4",
    name: "Cedar Park Campus",
    address: "500 Discovery Blvd",
    city: "Cedar Park",
    state: "TX",
    lat: 30.5052,
    lng: -97.8203,
    votes: 19,
  },
  {
    id: "5",
    name: "South Congress Location",
    address: "1619 S Congress Ave",
    city: "Austin",
    state: "TX",
    lat: 30.2449,
    lng: -97.7494,
    votes: 56,
  },
  {
    id: "6",
    name: "Mueller Development",
    address: "4550 Mueller Blvd",
    city: "Austin",
    state: "TX",
    lat: 30.2984,
    lng: -97.7048,
    votes: 31,
  },
  {
    id: "7",
    name: "Lakeway Center",
    address: "103 Main St",
    city: "Lakeway",
    state: "TX",
    lat: 30.3628,
    lng: -97.9797,
    votes: 23,
  },
  {
    id: "8",
    name: "Pflugerville Campus",
    address: "201 E Pecan St",
    city: "Pflugerville",
    state: "TX",
    lat: 30.4394,
    lng: -97.6201,
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
  _notes?: string
): Promise<Location> {
  // Stub: In v2, this will insert into Supabase and trigger scoring
  // _notes will be used in v2 for parent feedback
  const newLocation: Location = {
    id: `suggested-${Date.now()}`,
    name: `Suggested: ${address}`,
    address,
    city,
    state,
    lat: 30.2672 + (Math.random() - 0.5) * 0.1, // Mock coordinates
    lng: -97.7431 + (Math.random() - 0.5) * 0.1,
    votes: 0,
    suggested: true,
  };
  return newLocation;
}
