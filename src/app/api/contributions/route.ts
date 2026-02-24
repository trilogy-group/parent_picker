import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  let body: { locationId?: string; comment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { locationId, comment } = body;

  if (!locationId || !comment?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Require auth — must have a vote to attach a comment
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Auth required" }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData?.user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const userId = authData.user.id;

  // Fetch existing comment so we can append
  const { data: vote } = await supabase
    .from("pp_votes")
    .select("comment")
    .eq("location_id", locationId)
    .eq("user_id", userId)
    .single();

  if (!vote) {
    return NextResponse.json({ error: "Vote first to leave a comment" }, { status: 400 });
  }

  const newComment = vote.comment
    ? `${vote.comment}\n${comment.trim()}`
    : comment.trim();

  const { error } = await supabase
    .from("pp_votes")
    .update({ comment: newComment })
    .eq("location_id", locationId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to update vote comment:", error);
    return NextResponse.json({ error: "Failed to save comment" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
