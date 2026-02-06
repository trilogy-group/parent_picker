import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { sendEmail } from "@/lib/email";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request.headers.get("authorization"));
  if (!auth.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await params; // consume params (id not needed for sending)

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
  for (const email of voterEmails) {
    await sendEmail(email, subject, emailHtml);
    sent++;
  }

  return NextResponse.json({ success: true, sent });
}
