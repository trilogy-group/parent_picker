import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const REBL3_BASE = "https://rebl3.vercel.app";

export async function POST(req: NextRequest) {
  const { locationId } = await req.json();
  if (!locationId) {
    return NextResponse.json({ error: "locationId required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  // Get location with deadline + rebl3_site_id
  const { data: loc } = await supabase
    .from("pp_locations")
    .select("rebl3_site_id, feedback_deadline, vote_count, not_here_count")
    .eq("id", locationId)
    .single();

  if (!loc?.rebl3_site_id || !loc.feedback_deadline) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Check if deadline has passed
  const expired = new Date(loc.feedback_deadline) < new Date();

  // Get vote comments
  const { data: votes } = await supabase
    .from("pp_votes")
    .select("vote_type, comment")
    .eq("location_id", locationId)
    .not("comment", "is", null);

  const inComments = (votes || [])
    .filter((v) => v.vote_type === "in" && v.comment)
    .map((v) => v.comment);
  const notHereComments = (votes || [])
    .filter((v) => v.vote_type === "not_here" && v.comment)
    .map((v) => v.comment);

  const status = expired ? "feedback-complete" : "collecting-feedback";
  const details = {
    deadline: loc.feedback_deadline,
    votes_in: loc.vote_count,
    votes_not_here: loc.not_here_count,
    unique_voters: loc.vote_count + loc.not_here_count,
    in_comments: inComments,
    not_here_comments: notHereComments,
  };

  // PATCH rebl3_status
  const apiKey = process.env.REBL3_PP_API_KEY;
  if (!apiKey) {
    console.error("[sync-parent-status] REBL3_PP_API_KEY not set");
    return NextResponse.json({ ok: false, error: "missing_api_key" }, { status: 500 });
  }

  try {
    const res = await fetch(`${REBL3_BASE}/api/site/${encodeURIComponent(loc.rebl3_site_id)}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Consumer-Key": apiKey,
      },
      body: JSON.stringify({ system: "parents", status, details }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[sync-parent-status] rebl3 PATCH failed ${res.status}: ${body}`);
      return NextResponse.json({ ok: false, error: "rebl3_patch_failed", rebl3_status: res.status }, { status: 502 });
    }
  } catch (err) {
    console.error("[sync-parent-status] rebl3 PATCH threw:", err);
    return NextResponse.json({ ok: false, error: "rebl3_patch_threw" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, status });
}
