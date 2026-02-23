import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, generateLocationHelpHtml, generateGenericHelpHtml } from "@/lib/email";

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  let body: { email?: string; locationId?: string; locationAddress?: string; locationName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Rate limit: check for duplicate email+location combo in last 24h
  const locationId = body.locationId || null;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let dupeQuery = supabase
    .from("pp_help_requests")
    .select("id")
    .eq("email", email)
    .gte("created_at", cutoff);

  if (locationId) {
    dupeQuery = dupeQuery.eq("location_id", locationId);
  } else {
    dupeQuery = dupeQuery.is("location_id", null);
  }

  const { data: existing } = await dupeQuery.limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "You already submitted a help request for this recently" }, { status: 429 });
  }

  // Try to get user_id from auth header if present
  let userId: string | null = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data } = await supabase.auth.getUser(token);
    if (data?.user) {
      userId = data.user.id;
    }
  }

  // Insert help request
  const { error: insertError } = await supabase.from("pp_help_requests").insert({
    email,
    user_id: userId,
    location_id: locationId,
    location_address: body.locationAddress || null,
    location_name: body.locationName || null,
  });

  if (insertError) {
    console.error("Failed to insert help request:", insertError);
    return NextResponse.json({ error: "Failed to save help request" }, { status: 500 });
  }

  // Generate email — location-specific vs generic
  let html: string;
  let subject: string;

  if (locationId) {
    // Look up details URL fresh from pp_location_scores
    let detailsUrl: string | null = null;
    const { data: scoreRow } = await supabase
      .from("pp_location_scores")
      .select("overall_details_url")
      .eq("location_id", locationId)
      .maybeSingle();
    if (scoreRow) {
      detailsUrl = scoreRow.overall_details_url;
    }

    // Get location info for the email
    const address = body.locationAddress || "this location";
    const parts = address.split(",").map((s: string) => s.trim());
    const streetAddress = parts[0] || address;
    const city = parts[1] || "";
    const state = parts[2] || "";

    html = generateLocationHelpHtml(streetAddress, city, state, locationId, detailsUrl);
    subject = `How you can help with ${streetAddress}`;
  } else {
    html = generateGenericHelpHtml();
    subject = "Thank you for volunteering to help!";
  }

  sendEmail(email, subject, html).catch((err) => {
    console.error("Failed to send help guide email:", err);
  });

  // Log to history
  await supabase.from("pp_admin_actions").insert({
    location_id: locationId,
    action: "parent_help",
    admin_email: "system",
    recipient_emails: [email],
  });

  return NextResponse.json({ success: true });
}
