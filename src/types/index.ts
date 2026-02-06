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
  sizeClassification: string | null;
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

export interface CitySummary {
  city: string;
  state: string;
  lat: number;
  lng: number;
  locationCount: number;
  totalVotes: number;
}

export interface SuggestedLocation {
  address: string;
  city: string;
  state: string;
  notes?: string;
}

export interface AdminLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  status: string;
  source: string;
  notes: string | null;
  suggested_by: string | null;
  created_at: string;
  scores?: LocationScores;
  suggestor_email?: string | null;
}

export interface LikedLocation extends AdminLocation {
  vote_count: number;
  voter_emails: string[];
}

export interface UpstreamMetrics {
  enrollmentScore: number | null;
  wealthScore: number | null;
  relativeEnrollmentScore: number | null;
  relativeWealthScore: number | null;
  rentPerSfYear: number | null;
  rentPeriod: string | null;
  spaceSizeAvailable: number | null;
  sizeClassification: string | null;
  zoningCode: string | null;
  lotZoning: string | null;
  county: string | null;
  city: string | null;
  state: string | null;
}

export interface MetroInfo {
  market: string | null;
  tuition: number | null;
  hasExistingAlpha: boolean;
  greenThreshold: number;
  redThreshold: number;
}

export type TodoType = "zoning" | "demographics" | "pricing";

export interface LocationTodo {
  type: TodoType;
  scenario: string;
  title: string;
  message: string;
  dataTable?: { label: string; current: string; needed: string; gap?: string }[];
}
