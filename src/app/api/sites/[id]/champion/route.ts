import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

async function getUserFromAuth(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// POST → claim championship (lead if no active lead, else supporter)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: siteId } = await params;
  const user = await getUserFromAuth(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: "supabase unavailable" }, { status: 500 });

  // Already an active champion?
  const { data: existing } = await supabaseAdmin
    .from("pp_site_champions")
    .select("id, role")
    .eq("site_id", siteId)
    .eq("user_id", user.id)
    .is("released_at", null)
    .maybeSingle();
  if (existing) return NextResponse.json({ success: true, role: existing.role });

  // Is there an active lead already?
  const { data: lead } = await supabaseAdmin
    .from("pp_site_champions")
    .select("id")
    .eq("site_id", siteId)
    .eq("role", "lead")
    .is("released_at", null)
    .maybeSingle();

  const role: 'lead' | 'supporter' = lead ? 'supporter' : 'lead';

  const { error } = await supabaseAdmin
    .from("pp_site_champions")
    .insert({ site_id: siteId, user_id: user.id, role });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, role });
}

// DELETE → release championship
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: siteId } = await params;
  const user = await getUserFromAuth(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: "supabase unavailable" }, { status: 500 });

  const { data: existing } = await supabaseAdmin
    .from("pp_site_champions")
    .select("id, role")
    .eq("site_id", siteId)
    .eq("user_id", user.id)
    .is("released_at", null)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "not a champion" }, { status: 404 });

  const releasedAt = new Date().toISOString();
  await supabaseAdmin
    .from("pp_site_champions")
    .update({ released_at: releasedAt })
    .eq("id", existing.id);

  // If this was the lead, promote the longest-serving active supporter
  if (existing.role === "lead") {
    const { data: nextSupporter } = await supabaseAdmin
      .from("pp_site_champions")
      .select("id")
      .eq("site_id", siteId)
      .eq("role", "supporter")
      .is("released_at", null)
      .order("claimed_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextSupporter) {
      await supabaseAdmin
        .from("pp_site_champions")
        .update({ role: "lead" })
        .eq("id", nextSupporter.id);
    }
  }

  return NextResponse.json({ success: true });
}
