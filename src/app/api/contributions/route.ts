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

  // Try to get user_id from auth header if present
  let userId: string | null = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data } = await supabase.auth.getUser(token);
    if (data?.user) {
      userId = data.user.id;
    }
  }

  const { error } = await supabase.from("pp_contributions").insert({
    location_id: locationId,
    user_id: userId,
    comment: comment.trim(),
  });

  if (error) {
    console.error("Failed to insert contribution:", error);
    return NextResponse.json({ error: "Failed to save contribution" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
