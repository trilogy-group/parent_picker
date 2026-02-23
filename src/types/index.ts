export interface SubScore {
  color: string | null;
}

export interface LocationScores {
  overallColor: string | null;
  overallDetailsUrl: string | null;
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
  released?: boolean;
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
  voter_comments: { email: string; comment: string | null }[];
  help_sent_at?: string | null;
  help_sent_to?: string[];
  new_voter_emails?: string[];
}

export interface AdminAction {
  id: string;
  location_id: string | null;
  action: string;           // 'approved' | 'rejected' | 'help_requested' | 'parent_help' | 'scored_notified'
  admin_email: string;      // 'system' for auto-sent, admin email for manual
  recipient_emails: string[];
  email_failed: boolean;
  created_at: string;
  // Joined from pp_locations (live)
  address?: string;
  city?: string;
  state?: string;
  // Joined from pp_location_scores (live)
  overall_details_url?: string | null;
}

