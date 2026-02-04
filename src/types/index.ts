export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  votes: number;
  suggested?: boolean;
}

export interface SuggestedLocation {
  address: string;
  city: string;
  state: string;
  notes?: string;
}
