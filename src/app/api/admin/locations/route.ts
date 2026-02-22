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

  // Get pending locations with scores and suggestor profile
  const { data: locations, error } = await supabase
    .from("pp_locations")
    .select("*")
    .eq("status", "pending_review")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with scores and suggestor emails
  const enriched = await Promise.all(
    (locations || []).map(async (loc) => {
      // Get scores
      const { data: scoreData } = await supabase
        .from("pp_location_scores")
        .select("*")
        .eq("location_id", loc.id)
        .maybeSingle();

      // Get suggestor email from auth.users (pp_profiles may not be populated)
      let suggestorEmail: string | null = null;
      if (loc.suggested_by) {
        const { data: userData } = await supabase.auth.admin.getUserById(loc.suggested_by);
        suggestorEmail = userData?.user?.email || null;
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
        suggestor_email: suggestorEmail,
      };
    })
  );

  return NextResponse.json(enriched);
}
