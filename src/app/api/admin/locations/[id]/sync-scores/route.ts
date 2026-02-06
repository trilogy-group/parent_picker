import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { UpstreamMetrics, MetroInfo } from "@/types";

// Alpha schools data — static lookup (13 schools, rarely changes)
const ALPHA_SCHOOLS = [
  { market: "CA - Los Angeles", city: "Lake Forest", state: "CA", tuition: 50000 },
  { market: "FL - Miami", city: "Miami", state: "FL", tuition: 50000 },
  { market: "TX - Austin", city: "Austin", state: "TX", tuition: 40000 },
  { market: "TX - Dallas", city: "Plano", state: "TX", tuition: 50000 },
  { market: "AZ - Phoenix", city: "Scottsdale", state: "AZ", tuition: 40000 },
  { market: "DC - Washington DC", city: "Chantilly", state: "VA", tuition: 65000 },
  { market: "NC - Raleigh-Durham", city: "Raleigh", state: "NC", tuition: 45000 },
  { market: "CA - Santa Barbara", city: "Santa Barbara", state: "CA", tuition: 50000 },
  { market: "NC - Charlotte", city: "Charlotte", state: "NC", tuition: 45000 },
  { market: "FL - West Palm Beach", city: "Palm Beach Gardens", state: "FL", tuition: 50000 },
  { market: "CA - Bay Area", city: "San Francisco", state: "CA", tuition: 75000 },
  { market: "TX - Fort Worth", city: "Fort Worth", state: "TX", tuition: 40000 },
];

// State → markets mapping for metro matching
const STATE_MARKETS: Record<string, { market: string; tuition: number }[]> = {};
for (const school of ALPHA_SCHOOLS) {
  if (!STATE_MARKETS[school.state]) STATE_MARKETS[school.state] = [];
  STATE_MARKETS[school.state].push({ market: school.market, tuition: school.tuition });
}

// Tuition tier thresholds (cost per student per year)
const TUITION_THRESHOLDS: Record<number, { green: number; red: number }> = {
  40000: { green: 6000, red: 10000 },
  45000: { green: 8000, red: 12000 },
  50000: { green: 10000, red: 15000 },
  65000: { green: 15000, red: 20000 },
  75000: { green: 15000, red: 20000 },
};

function getThresholds(tuition: number): { green: number; red: number } {
  const tiers = Object.keys(TUITION_THRESHOLDS).map(Number).sort((a, b) => a - b);
  for (const tier of tiers) {
    if (tuition <= tier) return TUITION_THRESHOLDS[tier];
  }
  return TUITION_THRESHOLDS[tiers[tiers.length - 1]];
}

function computeMetroInfo(locationState: string | null, locationCity: string | null): MetroInfo {
  if (!locationState) {
    return { market: null, tuition: null, hasExistingAlpha: false, greenThreshold: 10000, redThreshold: 15000 };
  }

  const stateSchools = STATE_MARKETS[locationState] || [];
  // For now, if any Alpha exists in the same state, consider it "existing in metro"
  // A more refined approach would match by county/metro area
  const match = stateSchools.length > 0 ? stateSchools[0] : null;

  const hasExisting = stateSchools.length > 0;
  const tuition = match?.tuition || 50000;
  const thresholds = getThresholds(tuition);

  return {
    market: match?.market || null,
    tuition,
    hasExistingAlpha: hasExisting,
    greenThreshold: thresholds.green,
    redThreshold: thresholds.red,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request.headers.get("authorization"));
  if (!auth.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  // Get the location's address and city/state
  const { data: location, error: fetchError } = await supabase
    .from("pp_locations")
    .select("address, city, state")
    .eq("id", id)
    .single();

  if (fetchError || !location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  // Call the modified RPC — returns TABLE with sync count + upstream metrics
  const { data: syncRows, error: syncError } = await supabase.rpc(
    "sync_scores_for_address",
    { target_address: location.address }
  );

  if (syncError) {
    return NextResponse.json({ error: syncError.message }, { status: 500 });
  }

  // RPC returns array of rows (0 or 1 rows)
  const syncRow = Array.isArray(syncRows) && syncRows.length > 0 ? syncRows[0] : null;
  const syncedCount = syncRow?.synced_count ?? 0;

  // Fetch the updated scores
  const { data: scores } = await supabase
    .from("pp_location_scores")
    .select("*")
    .eq("location_id", id)
    .maybeSingle();

  // Build upstream metrics from RPC result
  let upstreamMetrics: UpstreamMetrics | null = null;
  if (syncRow) {
    // Normalize rent to annual $/SF
    let rentPerSfYear = syncRow.lease_asking_rent_general_price_average_amount
      ? Number(syncRow.lease_asking_rent_general_price_average_amount)
      : null;

    // If period is null and we have space_size, the value might be total annual rent
    // Most data is already $/SF/year with period=ANNUAL or null
    // Sanity cap at $500/SF/yr
    if (rentPerSfYear !== null && rentPerSfYear > 500) {
      const space = syncRow.space_size_available ? Number(syncRow.space_size_available) : null;
      if (space && space > 0) {
        rentPerSfYear = rentPerSfYear / space;
      }
    }

    upstreamMetrics = {
      enrollmentScore: syncRow.enrollment_score,
      wealthScore: syncRow.wealth_score,
      relativeEnrollmentScore: syncRow.relative_enrollment_score,
      relativeWealthScore: syncRow.relative_wealth_score,
      rentPerSfYear,
      rentPeriod: syncRow.lease_asking_rent_general_price_period,
      spaceSizeAvailable: syncRow.space_size_available ? Number(syncRow.space_size_available) : null,
      sizeClassification: syncRow.size_classification,
      zoningCode: syncRow.zoning_code,
      lotZoning: syncRow.lot_zoning,
      county: syncRow.location_county,
      city: syncRow.location_city || location.city,
      state: syncRow.location_state || location.state,
    };
  }

  // Compute metro info from location state
  const metroState = upstreamMetrics?.state || location.state;
  const metroCity = upstreamMetrics?.city || location.city;
  const metroInfo = computeMetroInfo(metroState, metroCity);

  return NextResponse.json({
    synced: syncedCount,
    scores: scores || null,
    upstreamMetrics,
    metroInfo,
  });
}
