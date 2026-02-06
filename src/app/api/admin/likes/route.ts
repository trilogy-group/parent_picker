import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Map Supabase row to score fields
function colorFromScore(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 0.75) return "GREEN";
  if (score >= 0.5) return "YELLOW";
  if (score >= 0.25) return "AMBER";
  return "RED";
}

function colorFromOverall(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 75) return "GREEN";
  if (score >= 50) return "YELLOW";
  if (score >= 25) return "AMBER";
  return "RED";
}

function mapScores(s: Record<string, unknown> | null) {
  if (!s || s.overall_score == null) return undefined;
  const overall = Number(s.overall_score);
  const demo = s.demographics_score != null ? Number(s.demographics_score) : null;
  const price = s.price_score != null ? Number(s.price_score) : null;
  const zoning = s.zoning_score != null ? Number(s.zoning_score) : null;
  const nbhd = s.neighborhood_score != null ? Number(s.neighborhood_score) : null;
  const bldg = s.building_score != null ? Number(s.building_score) : null;
  return {
    overall,
    overallColor: (s.overall_color as string) || colorFromOverall(overall),
    overallDetailsUrl: (s.overall_details_url as string) || null,
    demographics: { score: demo, color: (s.demographics_color as string) || colorFromScore(demo), detailsUrl: (s.demographics_details_url as string) || null },
    price: { score: price, color: (s.price_color as string) || colorFromScore(price), detailsUrl: (s.price_details_url as string) || null },
    zoning: { score: zoning, color: (s.zoning_color as string) || colorFromScore(zoning), detailsUrl: (s.zoning_details_url as string) || null },
    neighborhood: { score: nbhd, color: (s.neighborhood_color as string) || colorFromScore(nbhd), detailsUrl: (s.neighborhood_details_url as string) || null },
    building: { score: bldg, color: (s.building_color as string) || colorFromScore(bldg), detailsUrl: (s.building_details_url as string) || null },
  };
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request.headers.get("authorization"));
  if (!auth.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  // Get active locations that have votes, with vote counts
  const { data: votedLocations, error: voteError } = await supabase
    .from("pp_votes")
    .select("location_id, user_id");

  if (voteError) {
    return NextResponse.json({ error: voteError.message }, { status: 500 });
  }

  if (!votedLocations || votedLocations.length === 0) {
    return NextResponse.json([]);
  }

  // Group votes by location_id
  const voteMap = new Map<string, string[]>();
  for (const vote of votedLocations) {
    const existing = voteMap.get(vote.location_id) || [];
    existing.push(vote.user_id);
    voteMap.set(vote.location_id, existing);
  }

  const locationIds = Array.from(voteMap.keys());

  // Fetch active locations that have votes
  const { data: locations, error: locError } = await supabase
    .from("pp_locations")
    .select("*")
    .in("id", locationIds)
    .eq("status", "active");

  if (locError) {
    return NextResponse.json({ error: locError.message }, { status: 500 });
  }

  // Enrich with scores and voter emails
  const enriched = await Promise.all(
    (locations || []).map(async (loc) => {
      // Get scores
      const { data: scoreData } = await supabase
        .from("pp_location_scores")
        .select("*")
        .eq("location_id", loc.id)
        .maybeSingle();

      // Get voter emails
      const voterUserIds = voteMap.get(loc.id) || [];
      const voterEmails: string[] = [];
      for (const uid of voterUserIds) {
        const { data: userData } = await supabase.auth.admin.getUserById(uid);
        if (userData?.user?.email) {
          voterEmails.push(userData.user.email);
        }
      }

      return {
        id: loc.id,
        name: loc.name,
        address: loc.address,
        city: loc.city,
        state: loc.state,
        lat: Number(loc.lat),
        lng: Number(loc.lng),
        status: loc.status,
        source: loc.source,
        notes: loc.notes,
        suggested_by: loc.suggested_by,
        created_at: loc.created_at,
        scores: mapScores(scoreData),
        vote_count: voterUserIds.length,
        voter_emails: voterEmails,
      };
    })
  );

  // Sort by vote count descending
  enriched.sort((a, b) => b.vote_count - a.vote_count);

  return NextResponse.json(enriched);
}
