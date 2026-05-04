import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { ProblemUpdate } from "@/types";

async function getUserFromAuth(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: problemId } = await params;
  const user = await getUserFromAuth(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const updateBody = (body as { body?: string }).body?.trim();
  if (!updateBody) return NextResponse.json({ error: "body required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  // Verify caller is the active owner
  const { data: owner } = await supabase
    .from("pp_problem_owners")
    .select("id")
    .eq("problem_id", problemId)
    .eq("user_id", user.id)
    .is("released_at", null)
    .maybeSingle();
  if (!owner) return NextResponse.json({ error: "only the active owner can post updates" }, { status: 403 });

  const { error: insertErr } = await supabase
    .from("pp_problem_updates")
    .insert({ problem_id: problemId, user_id: user.id, body: updateBody });
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("pp_problem_updates")
    .select("id, problem_id, user_id, body, created_at")
    .eq("problem_id", id)
    .order("created_at", { ascending: false });

  if (error || !data) return NextResponse.json([]);

  const updates: ProblemUpdate[] = data.map(r => ({
    id: r.id,
    problemId: r.problem_id,
    userId: r.user_id,
    body: r.body,
    createdAt: r.created_at,
  }));
  return NextResponse.json(updates);
}
