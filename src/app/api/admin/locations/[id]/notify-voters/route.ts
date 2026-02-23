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
  const { emailHtml, emailSubject, voterEmails } = body as {
    emailHtml?: string;
    emailSubject?: string;
    voterEmails?: string[];
  };

  if (!emailHtml || !voterEmails || voterEmails.length === 0) {
    return NextResponse.json(
      { error: "emailHtml and voterEmails are required" },
      { status: 400 }
    );
  }

  const subject = emailSubject || "Update on a location you liked";

  let sent = 0;
  const failed: string[] = [];
  for (const email of voterEmails) {
    const result = await sendEmail(email, subject, emailHtml);
    if (result.success) {
      sent++;
    } else {
      failed.push(`${email}: ${result.error}`);
    }
  }

  // Only record to history if at least some emails succeeded
  if (sent > 0) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const successEmails = voterEmails.filter((e) => !failed.some((f) => f.startsWith(e)));
      await supabase.from("pp_admin_actions").insert({
        location_id: id,
        action: "help_requested",
        admin_email: auth.email!,
        recipient_emails: successEmails,
      });
    }
  }

  return NextResponse.json({ success: sent > 0, sent, failed });
}
