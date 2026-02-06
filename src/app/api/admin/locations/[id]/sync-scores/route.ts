import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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

  // Get the location's address
  const { data: location, error: fetchError } = await supabase
    .from("pp_locations")
    .select("address")
    .eq("id", id)
    .single();

  if (fetchError || !location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  // Call the address-scoped sync function
  const { data: syncResult, error: syncError } = await supabase.rpc(
    "sync_scores_for_address",
    { target_address: location.address }
  );

  if (syncError) {
    return NextResponse.json({ error: syncError.message }, { status: 500 });
  }

  // Fetch the updated scores
  const { data: scores } = await supabase
    .from("pp_location_scores")
    .select("*")
    .eq("location_id", id)
    .maybeSingle();

  return NextResponse.json({
    synced: syncResult ?? 0,
    scores: scores || null,
  });
}
