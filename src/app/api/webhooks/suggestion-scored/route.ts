import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, generateScoredNotificationHtml } from "@/lib/email";

export async function POST(request: NextRequest) {
  // Authenticate: pg_net sends the service role key as bearer token
  const authHeader = request.headers.get("authorization");
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const locationId: string | undefined = body?.location_id;
  if (!locationId) {
    return NextResponse.json({ error: "location_id required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  // Fetch location
  const { data: location, error: locErr } = await supabase
    .from("pp_locations")
    .select("id, address, city, state, name, suggested_by")
    .eq("id", locationId)
    .single();

  if (locErr || !location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  if (!location.suggested_by) {
    // Not a parent suggestion — nothing to notify
    return NextResponse.json({ skipped: true, reason: "no suggested_by" });
  }

  // Look up parent email
  const { data: userData } = await supabase.auth.admin.getUserById(location.suggested_by);
  const parentEmail = userData?.user?.email;
  if (!parentEmail) {
    return NextResponse.json({ skipped: true, reason: "no email for user" });
  }

  // Fetch details URL for email link
  const { data: scoreRow } = await supabase
    .from("pp_location_scores")
    .select("overall_details_url")
    .eq("location_id", locationId)
    .maybeSingle();

  const detailsUrl = (scoreRow?.overall_details_url as string) || null;

  // Generate and send email
  const html = generateScoredNotificationHtml({
    location: {
      name: location.name || location.address,
      address: location.address,
      city: location.city,
      state: location.state,
    },
    locationId: location.id,
    detailsUrl,
  });

  const result = await sendEmail(parentEmail, `Your suggested location has been evaluated`, html);

  // Log to history (with failure flag if email failed)
  await supabase.from("pp_admin_actions").insert({
    location_id: locationId,
    action: "scored_notified",
    admin_email: "system",
    recipient_emails: [parentEmail],
    email_failed: !result.success,
  });

  return NextResponse.json({ sent: result.success, to: parentEmail, error: result.error || undefined });
}
