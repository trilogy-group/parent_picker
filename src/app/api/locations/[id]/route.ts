import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function jc(val: number | null): string | null {
  if (val === 1) return "GREEN"; if (val === 2) return "YELLOW"; if (val === 3) return "RED"; return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("pp_locations")
    .select("id, name, address, city, state, zip, lat, lng, source, rebl3_site_id")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch scoring from rebl3_sites
  let scores = null;
  if (data.rebl3_site_id) {
    const { data: r } = await supabase
      .from("rebl3_sites")
      .select("overall, dim_cost, dim_zoning, dim_neighborhood, dim_building, sub_play, school_size_category, capacity, site_id, address, city, state, zip, lat, lng")
      .eq("site_id", data.rebl3_site_id)
      .maybeSingle();
    if (r) {
      scores = {
        overall_color: jc(r.overall),
        overall_details_url: `https://rebl3.vercel.app/site/${r.site_id}`,
        price_color: jc(r.dim_cost),
        zoning_color: jc(r.dim_zoning),
        neighborhood_color: jc(r.dim_neighborhood),
        building_color: jc(r.dim_building),
        play_area_color: jc(r.sub_play),
        size_classification: r.school_size_category,
        capacity: r.capacity,
      };
    }
  }

  return NextResponse.json({
    ...data,
    property_source_key: data.rebl3_site_id,
    pp_location_scores: scores,
  });
}
