import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function mapScores(s: Record<string, unknown> | null) {
  if (!s || s.overall_color == null) return undefined;
  return {
    overallColor: (s.overall_color as string) || null,
    overallDetailsUrl: (s.overall_details_url as string) || null,
    price: { color: (s.price_color as string) || null },
    zoning: { color: (s.zoning_color as string) || null },
    neighborhood: { color: (s.neighborhood_color as string) || null },
    building: { color: (s.building_color as string) || null },
    sizeClassification: (s.size_classification as string) || null,
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
    .select("location_id, user_id, comment");

  if (voteError) {
    return NextResponse.json({ error: voteError.message }, { status: 500 });
  }

  if (!votedLocations || votedLocations.length === 0) {
    return NextResponse.json([]);
  }

  // Group votes by location_id (track user_id + comment)
  const voteMap = new Map<string, { user_id: string; comment: string | null }[]>();
  for (const vote of votedLocations) {
    const existing = voteMap.get(vote.location_id) || [];
    existing.push({ user_id: vote.user_id, comment: vote.comment ?? null });
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

      // Get voter emails and comments
      const voters = voteMap.get(loc.id) || [];
      const voterEmails: string[] = [];
      const voterComments: { email: string; comment: string | null }[] = [];
      for (const v of voters) {
        const { data: userData } = await supabase.auth.admin.getUserById(v.user_id);
        const email = userData?.user?.email || "unknown";
        voterEmails.push(email);
        voterComments.push({ email, comment: v.comment });
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
        vote_count: voters.length,
        voter_emails: voterEmails,
        voter_comments: voterComments,
      };
    })
  );

  // Sort by vote count descending
  enriched.sort((a, b) => b.vote_count - a.vote_count);

  return NextResponse.json(enriched);
}
