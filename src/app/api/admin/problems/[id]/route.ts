import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyAdmin } from "@/lib/admin";

const ALLOWED_KEYS = new Set([
  "title", "description", "deadline", "pivot_trigger",
  "status", "outcome_text",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await verifyAdmin(request.headers.get("authorization"));
  if (!auth.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_KEYS.has(k)) updates[k] = v;
  }
  if (body.status === "resolved" || body.status === "unresolvable") {
    updates.closed_at = new Date().toISOString();
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const { error } = await supabase
    .from("pp_site_problems")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await verifyAdmin(request.headers.get("authorization"));
  if (!auth.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const { error } = await supabase
    .from("pp_site_problems")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
