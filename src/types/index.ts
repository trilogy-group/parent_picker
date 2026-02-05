export interface SubScore {
  score: number | null;
  color: string | null;
  detailsUrl: string | null;
}

export interface LocationScores {
  overall: number | null;
  overallColor: string | null;
  overallDetailsUrl: string | null;
  demographics: SubScore;
  price: SubScore;
  zoning: SubScore;
  neighborhood: SubScore;
  building: SubScore;
}

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
  scores?: LocationScores;
}

export interface SuggestedLocation {
  address: string;
  city: string;
  state: string;
  notes?: string;
}
