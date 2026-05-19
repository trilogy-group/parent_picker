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
  capacity: number | null;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip?: string | null;
  lat: number;
  lng: number;
  votes: number;
  notHereVotes: number;   // count of 'not_here' votes
  suggested?: boolean;
  duplicateOf?: boolean;
  released?: boolean;
  proposed?: boolean;
  scores?: LocationScores;
  photos?: string[];
  brochureUrl?: string | null;
  rebl3SiteId?: string | null;
  feedbackDeadline?: string | null;
  isBridge?: boolean;
  // Community Site card fields (2026-05-18 migration)
  // For regulatory/permits: true = approved/acquired, false = in progress, null = unknown/N/A
  openedAt?: string | null;
  upgradeForLocationId?: string | null;
  regulatoryApproved?: boolean | null;
  permitsAcquired?: boolean | null;
  zoningCleared?: boolean | null;
  summerProgram?: boolean | null;
  // pp_location_overrides — temporary admin overrides until upstream data is fixed
  capacityOverride?: number | null;
  targetOpenDateOverride?: string | null;
  maxCapCapacityOverride?: number | null;
  maxCapDateOverride?: string | null;
  champions?: SiteChampion[];
  problems?: SiteProblem[];
  derived?: LocationDerived;
}

export type VoteType = 'in' | 'not_here';

export interface VoterInfo {
  userId: string;
  voteType: VoteType;
  displayName: string | null;
  email: string;
  comment: string | null;
  createdAt: string | null;
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
  // Computed from rebl3_site_id
  overall_details_url?: string | null;
}

// === Parent Feedback Redesign types ===

// Site stages map the real-estate pipeline parents see (4-stage taxonomy):
//   prospecting → pre-LOI activity, evaluating fit
//   diligence   → LOI signed, working out lease terms (incl. lease-ready)
//   build_out   → lease signed, school under construction / awaiting first day
//   open        → school operating
//   moved_on    → killed / cut / process-exception (side track)
export type SiteStage =
  | 'prospecting'
  | 'diligence'
  | 'build_out'
  | 'open'
  | 'moved_on';
export type SiteCategory = 'parent' | 'ai' | 'short_term';
export type CommittedSubStage = 'loi' | 'lease' | 'zoning' | 'permits' | 'buildout' | 'co';
export type ProblemStatus = 'open' | 'in_progress' | 'resolved' | 'unresolvable';
export type ChampionRole = 'lead' | 'supporter';

export interface SiteChampion {
  id: string;
  siteId: string;
  userId: string;
  role: ChampionRole;
  claimedAt: string;
  releasedAt: string | null;
  passedToUserId: string | null;
  // Joined display fields
  displayName?: string;
}

export type ProblemCategory = 'zoning' | 'licensing' | 'other';
export type ProblemSeverity = 'H' | 'M' | 'L';

export interface ProblemSourceRef {
  system: string;
  site_id: string;
  name: string;
}

export interface SiteProblem {
  id: string;
  siteId: string | null;
  metro: string;
  title: string;
  description: string | null;
  deadline: string | null;
  pivotTrigger: boolean;
  status: ProblemStatus;
  outcomeText: string | null;
  createdAt: string;
  closedAt: string | null;
  parentOwnable: boolean;
  category: ProblemCategory;
  severity: ProblemSeverity;
  sourceRef: ProblemSourceRef | null;
  // Derived
  owner?: ProblemOwner | null;
  updates?: ProblemUpdate[];
}

export interface ProblemOwner {
  id: string;
  problemId: string;
  userId: string;
  claimedAt: string;
  releasedAt: string | null;
  displayName?: string;
}

export interface ProblemUpdate {
  id: string;
  problemId: string;
  userId: string;
  body: string;
  createdAt: string;
  displayName?: string;
}

export interface PivotCondition {
  triggerProblemId: string;
  description: string;
  newRoleAssignment?: { siteId: string; role: 'primary_long_term' | 'bridge' | 'watch' };
}

export interface MetroPlan {
  metro: string;
  narrativeTemplateInputs: {
    primaryLongTermSiteId?: string;
    bridgeSiteId?: string;
    watchSiteIds?: string[];
  };
  pivotConditions: PivotCondition[];
  narrativeOverride: string | null;
  backupPlan: string | null;
  lastCuratedAt: string;
}

// Extend Location with derived fields (set client-side, not stored)
export interface LocationDerived {
  stage: SiteStage;
  category: SiteCategory;
  committedSubStage?: CommittedSubStage;
  movedOnReason?: string;
  // Raw REBL pipeline state, surfaced for display (e.g. "LOI sent to landlord")
  leasingStatus?: string | null;
  loiStatus?: string | null;
  // REBL numeric overall score (0-100); paired with scores.overallColor on the UI
  reblScore?: number | null;
  // Due-diligence "fast open" capacity + projected open date (committed sites only)
  fastOpenCapacity?: number | null;
  fastOpenDate?: string | null;
  // Due-diligence "max capacity" (full buildout)
  maxCapCapacity?: number | null;
  maxCapDate?: string | null;
}

