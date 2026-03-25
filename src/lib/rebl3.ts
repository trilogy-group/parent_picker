// REBL3 External API client — types, fetch, and fire-and-forget feedback

const REBL3_BASE = "https://rebl3.vercel.app";

const REBL3_DIMENSIONS = ["neighborhood", "zoning", "building", "cost"] as const;
export type Rebl3DimensionKey = (typeof REBL3_DIMENSIONS)[number];

export interface Rebl3Dimension {
  key: string;
  name: string;
  judgment: "GREAT" | "VIABLE" | "CUT" | "N/A";
  prose: string;
}

export interface Rebl3Property {
  size_sqft: number | null;
  school_size_category: string | null;
  capacity: number | null;
  lease_price_sqft_year: number | null;
  zoning_code: string | null;
  listing_status: string | null;
  region: string | null;
  property_type: string | null;
  building_class: string | null;
}

export interface Rebl3ExternalSite {
  site_id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  classification: "GREEN" | "YELLOW" | "RED" | null;
  overall_score: number;
  dimensions: Rebl3Dimension[];
  property: Rebl3Property;
  tuition: number | null;
  cut_by: string[] | null;
  cut_reason: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchRebl3Site(siteId: string): Promise<Rebl3ExternalSite | null> {
  try {
    const res = await fetch(`${REBL3_BASE}/api/site/${encodeURIComponent(siteId)}/external`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function postRebl3Feedback(
  siteId: string,
  dimension: Rebl3DimensionKey,
  feedbackType: "agree" | "disagree" | "help",
  reviewer: string,
  comment?: string | null,
) {
  fetch(`${REBL3_BASE}/api/site/${encodeURIComponent(siteId)}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dimension,
      feedback_type: feedbackType,
      reviewer,
      comment: comment || null,
      judgment: null,
    }),
  }).catch(() => {});
}

export function postRebl3FeedbackAllDimensions(
  siteId: string,
  feedbackType: "agree" | "disagree",
  reviewer: string,
  comment?: string | null,
) {
  for (const dim of REBL3_DIMENSIONS) {
    postRebl3Feedback(siteId, dim, feedbackType, reviewer, comment);
  }
}
