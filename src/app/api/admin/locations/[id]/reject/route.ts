import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request.headers.get("authorization"));
  if (!auth.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { emailHtml, emailSubject } = body as { emailHtml?: string; emailSubject?: string };

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  // Get the location
  const { data: location, error: fetchError } = await supabase
    .from("pp_locations")
    .select("*")
    .eq("id", id)
    .eq("status", "pending_review")
    .single();

  if (fetchError || !location) {
    return NextResponse.json({ error: "Location not found or not pending" }, { status: 404 });
  }

  // Update status to rejected
  const { error: updateError } = await supabase
    .from("pp_locations")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Send email if HTML provided
  let recipientEmail: string | null = null;
  let emailFailed: string | null = null;
  if (emailHtml && location.suggested_by) {
    const { data: userData } = await supabase.auth.admin.getUserById(location.suggested_by);
    recipientEmail = userData?.user?.email || null;
    if (recipientEmail) {
      const result = await sendEmail(recipientEmail, emailSubject || "Update on your suggested location", emailHtml);
      if (!result.success) {
        emailFailed = result.error || "Email send failed";
      }
    }
  }

  // Only record to history if email succeeded (or no email needed)
  if (!emailFailed) {
    await supabase.from("pp_admin_actions").insert({
      location_id: id,
      action: "rejected",
      admin_email: auth.email!,
      recipient_emails: recipientEmail ? [recipientEmail] : [],
    });
  }

  return NextResponse.json({
    success: true,
    emailFailed: emailFailed || undefined,
  });
}
