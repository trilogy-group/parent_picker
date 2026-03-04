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

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Auth required" }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData?.user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("pp_contributions")
    .insert({
      location_id: locationId,
      user_id: authData.user.id,
      comment: comment.trim(),
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error("Failed to insert contribution:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id, created_at: data.created_at });
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const locationId = request.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json({ error: "Missing locationId" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pp_contributions")
    .select("id, user_id, comment, created_at")
    .eq("location_id", locationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch contributions:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  // Fetch display names for all user_ids
  const userIds = [...new Set((data || []).map(c => c.user_id).filter(Boolean))];
  const profileMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("pp_profiles")
      .select("id, display_name, email")
      .in("id", userIds);
    for (const p of profiles || []) {
      profileMap.set(p.id, p.display_name || p.email?.split("@")[0] || "Anonymous");
    }
  }

  const contributions = (data || []).map(c => ({
    id: c.id,
    userId: c.user_id,
    displayName: profileMap.get(c.user_id) || "Anonymous",
    comment: c.comment,
    createdAt: c.created_at,
  }));

  return NextResponse.json({ contributions });
}

export async function DELETE(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Auth required" }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData?.user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Check if user owns the contribution or is admin
  const { data: contribution } = await supabase
    .from("pp_contributions")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!contribution) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = contribution.user_id === authData.user.id;
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  const isAdmin = !!authData.user.email && adminEmails.includes(authData.user.email.toLowerCase());

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("pp_contributions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete contribution:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
