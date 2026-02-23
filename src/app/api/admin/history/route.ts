import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request.headers.get("authorization"));
  if (!auth.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  // Query admin actions joined with live location + score data (nested through pp_locations)
  const { data, error } = await supabase
    .from("pp_admin_actions")
    .select(`
      id,
      location_id,
      action,
      admin_email,
      recipient_emails,
      email_failed,
      created_at,
      pp_locations (address, city, state, pp_location_scores (overall_details_url))
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Failed to fetch admin history:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten the nested joined data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actions = (data || []).map((row: any) => {
    const loc = row.pp_locations;
    // pp_location_scores is nested inside pp_locations (array or object)
    const scores = loc?.pp_location_scores;
    const scoreRow = Array.isArray(scores) ? scores[0] : scores;
    return {
      id: row.id,
      location_id: row.location_id,
      action: row.action,
      admin_email: row.admin_email,
      recipient_emails: row.recipient_emails,
      email_failed: row.email_failed || false,
      created_at: row.created_at,
      address: loc?.address || null,
      city: loc?.city || null,
      state: loc?.state || null,
      overall_details_url: scoreRow?.overall_details_url || null,
    };
  });

  return NextResponse.json(actions);
}
