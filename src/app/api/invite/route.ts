import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, generateInviteHtml } from "@/lib/email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await request.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  // Get inviter name from profile or email
  const { data: profile } = await supabaseAdmin
    .from("pp_profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .single();
  const inviterName = profile?.display_name || profile?.email?.split("@")[0] || "A parent";

  // Record the invite
  await supabaseAdmin.from("pp_invites").insert({
    inviter_id: user.id,
    invitee_email: email,
  });

  // Send email
  const html = generateInviteHtml(inviterName);
  const result = await sendEmail(email, `${inviterName} invited you to Alpha School`, html);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
