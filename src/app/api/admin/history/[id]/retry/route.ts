import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  sendEmail,
  generateScoredNotificationHtml,
  generateLocationHelpHtml,
  generateGenericHelpHtml,
} from "@/lib/email";

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

  // Fetch the failed action
  const { data: action, error: fetchErr } = await supabase
    .from("pp_admin_actions")
    .select("*")
    .eq("id", id)
    .eq("email_failed", true)
    .single();

  if (fetchErr || !action) {
    return NextResponse.json({ error: "Failed action not found" }, { status: 404 });
  }

  const recipients: string[] = action.recipient_emails || [];
  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients to retry" }, { status: 400 });
  }

  // Look up location info fresh
  let location: { address: string; city: string; state: string; name: string } | null = null;
  let detailsUrl: string | null = null;

  if (action.location_id) {
    const { data: loc } = await supabase
      .from("pp_locations")
      .select("address, city, state, name")
      .eq("id", action.location_id)
      .single();
    location = loc;

    const { data: scoreRow } = await supabase
      .from("pp_location_scores")
      .select("overall_details_url")
      .eq("location_id", action.location_id)
      .maybeSingle();
    detailsUrl = scoreRow?.overall_details_url || null;
  }

  // Regenerate the appropriate email
  let html: string;
  let subject: string;

  switch (action.action) {
    case "scored_notified": {
      if (!location) {
        return NextResponse.json({ error: "Location not found" }, { status: 404 });
      }
      html = generateScoredNotificationHtml({
        location: {
          name: location.name || location.address,
          address: location.address,
          city: location.city,
          state: location.state,
        },
        locationId: action.location_id!,
        detailsUrl,
      });
      subject = "Your suggested location has been evaluated";
      break;
    }
    case "parent_help": {
      if (location) {
        html = generateLocationHelpHtml(
          location.address,
          location.city,
          location.state,
          action.location_id!,
          detailsUrl
        );
        subject = `How you can help with ${location.address}`;
      } else {
        html = generateGenericHelpHtml();
        subject = "Thank you for volunteering to help!";
      }
      break;
    }
    default:
      return NextResponse.json({ error: `Cannot retry action type: ${action.action}` }, { status: 400 });
  }

  // Send to all recipients
  let sent = 0;
  const failed: string[] = [];
  for (const email of recipients) {
    const result = await sendEmail(email, subject, html);
    if (result.success) {
      sent++;
    } else {
      failed.push(`${email}: ${result.error}`);
    }
  }

  // Update the record — clear failed flag if all succeeded
  if (sent === recipients.length) {
    await supabase
      .from("pp_admin_actions")
      .update({ email_failed: false })
      .eq("id", id);
  }

  return NextResponse.json({ success: sent > 0, sent, failed });
}
