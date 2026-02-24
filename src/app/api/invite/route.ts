import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, generateInviteHtml } from "@/lib/email";

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { email } = body;
  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  // Get inviter name — use auth.admin.getUserById (pp_profiles may not exist for pre-signup users)
  const { data: profile } = await supabaseAdmin
    .from("pp_profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user.id);
  const inviterName = profile?.display_name || authUser?.user?.email?.split("@")[0] || "A parent";

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
