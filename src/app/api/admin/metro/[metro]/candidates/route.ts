import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyAdmin } from "@/lib/admin";
import { findNearestMetro } from "@/lib/metros";

// Display-name → canonical metro name reversal (mirrors AltPanel METRO_DISPLAY).
// The panel shows e.g. "Scottsdale" for Phoenix; admin types either name.
const DISPLAY_TO_CANONICAL: Record<string, string> = {
  Scottsdale: "Phoenix",
};

interface CandidateRow {
  id: string;
  address: string;
  city: string;
  state: string;
  leasing_status: string | null;
  loi_status: string | null;
  is_bridge: boolean;
  champion_count: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ metro: string }> }
) {
  const { metro } = await params;
  const auth = await verifyAdmin(request.headers.get("authorization"));
  if (!auth.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const decodedMetro = decodeURIComponent(metro);
  const canonicalMetro = DISPLAY_TO_CANONICAL[decodedMetro] ?? decodedMetro;

  // Pull sites with any REBL pipeline activity OR is_bridge OR active champions.
  // The view already exposes leasing_status / loi_status / is_bridge.
  const { data: rows, error } = await supabase
    .from("pp_locations_with_votes")
    .select("id, address, city, state, lat, lng, leasing_status, loi_status, is_bridge")
    .or("leasing_status.not.is.null,loi_status.not.is.null,is_bridge.eq.true")
    .limit(2000);

  if (error || !rows) return NextResponse.json([], { status: 200 });

  // Filter to sites whose nearest metro matches the requested one.
  const candidates: CandidateRow[] = [];
  for (const r of rows) {
    const nearest = findNearestMetro(Number(r.lat), Number(r.lng));
    if (!nearest) continue;
    if (nearest.name !== canonicalMetro) continue;
    candidates.push({
      id: r.id,
      address: r.address,
      city: r.city,
      state: r.state,
      leasing_status: r.leasing_status,
      loi_status: r.loi_status,
      is_bridge: r.is_bridge === true,
      champion_count: 0,
    });
  }

  // Augment with active champion counts so admin can see which are parent-led.
  if (candidates.length > 0) {
    const ids = candidates.map(c => c.id);
    const { data: champs } = await supabase
      .from("pp_site_champions")
      .select("site_id")
      .in("site_id", ids)
      .is("released_at", null);
    const counts = new Map<string, number>();
    for (const c of champs ?? []) {
      counts.set(c.site_id, (counts.get(c.site_id) ?? 0) + 1);
    }
    for (const cand of candidates) {
      cand.champion_count = counts.get(cand.id) ?? 0;
      // Pull in champion-only sites that aren't otherwise in REBL pipeline?
      // (Skip — those would need a separate pass; defer until needed.)
    }
  }

  // Sort: bridges first, then committed (loi=done/signed/etc.), then engaged, then alphabetical.
  const COMMITTED = new Set(["done", "signed", "loi-signed", "completed"]);
  candidates.sort((a, b) => {
    if (a.is_bridge !== b.is_bridge) return a.is_bridge ? -1 : 1;
    const aCommitted = (a.loi_status && COMMITTED.has(a.loi_status)) || a.leasing_status === "done";
    const bCommitted = (b.loi_status && COMMITTED.has(b.loi_status)) || b.leasing_status === "done";
    if (aCommitted !== bCommitted) return aCommitted ? -1 : 1;
    return (a.address ?? "").localeCompare(b.address ?? "");
  });

  return NextResponse.json(candidates);
}
