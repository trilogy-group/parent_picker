import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ photos: [], brochureUrl: null });
  }

  const [photosRes, locationRes] = await Promise.all([
    supabase
      .from("pp_location_photos")
      .select("url")
      .eq("location_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("pp_locations")
      .select("brochure_url")
      .eq("id", id)
      .single(),
  ]);

  return NextResponse.json({
    photos: (photosRes.data || []).map((r: { url: string }) => r.url),
    brochureUrl: locationRes.data?.brochure_url || null,
  });
}
