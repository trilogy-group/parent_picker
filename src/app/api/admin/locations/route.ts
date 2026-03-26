import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function jc(val: number | null): string | null {
  if (val === 1) return "GREEN"; if (val === 2) return "YELLOW"; if (val === 3) return "RED"; return null;
}

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
    .in("status", ["pending_scoring", "pending_review"])
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with scores and suggestor emails
  const enriched = await Promise.all(
    (locations || []).map(async (loc) => {
      // Get scores from rebl3_sites
      let scoreData: Record<string, unknown> | null = null;
      if (loc.rebl3_site_id) {
        const { data: r } = await supabase
          .from("rebl3_sites")
          .select("overall, dim_cost, dim_zoning, dim_neighborhood, dim_building, sub_play, school_size_category, site_id")
          .eq("site_id", loc.rebl3_site_id)
          .maybeSingle();
        if (r) {
          scoreData = {
            overall_color: jc(r.overall), overall_details_url: `https://rebl3.vercel.app/site/${r.site_id}`,
            price_color: jc(r.dim_cost), zoning_color: jc(r.dim_zoning),
            neighborhood_color: jc(r.dim_neighborhood), building_color: jc(r.dim_building),
            size_classification: r.school_size_category,
          };
        }
      }

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
