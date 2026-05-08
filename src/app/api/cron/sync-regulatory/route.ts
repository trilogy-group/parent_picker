import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  computeRegulatorySyncOps,
  RegulatoryIssue,
  ExistingProblem,
} from "@/lib/sync/regulatory";

export const dynamic = "force-dynamic";

// Called by pg_cron via pg_net.http_post with Bearer = SUPABASE_SERVICE_ROLE_KEY,
// matching the existing webhook auth pattern (see /api/webhooks/location-promoted).
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!expected || auth !== `Bearer ${expected}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client unavailable" }, { status: 500 });
  }

  // 1. Fetch every regulatory row
  const { data: rebl3Rows, error: rErr } = await supabase
    .from("rebl3_status")
    .select("site_id, details")
    .eq("system", "regulatory");
  if (rErr) {
    return NextResponse.json({ error: rErr.message }, { status: 500 });
  }

  const rebl3SiteIds = (rebl3Rows ?? []).map(r => r.site_id as string);
  if (rebl3SiteIds.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, updated: 0, skipped: 0 });
  }

  // 2. Map rebl3 site_id -> pp_locations row (id + region/metro)
  const { data: locRows, error: lErr } = await supabase
    .from("pp_locations")
    .select("id, rebl3_site_id, region")
    .in("rebl3_site_id", rebl3SiteIds);
  if (lErr) {
    return NextResponse.json({ error: lErr.message }, { status: 500 });
  }
  const locByRebl3 = new Map<string, { id: string; metro: string }>();
  for (const l of locRows ?? []) {
    if (l.rebl3_site_id) {
      locByRebl3.set(l.rebl3_site_id as string, {
        id: l.id as string,
        metro: (l.region as string) ?? "",
      });
    }
  }

  // 3. Fetch existing regulatory-sourced problems for these sites.
  // Filter source_ref->>system in JS to keep the query simple.
  const siteIds = Array.from(locByRebl3.values()).map(v => v.id);
  const existingBySite = new Map<string, ExistingProblem[]>();
  if (siteIds.length > 0) {
    const { data: existing, error: eErr } = await supabase
      .from("pp_site_problems")
      .select("id, site_id, title, category, severity, admin_edited_at, source_ref")
      .in("site_id", siteIds)
      .not("source_ref", "is", null);
    if (eErr) {
      return NextResponse.json({ error: eErr.message }, { status: 500 });
    }
    for (const e of existing ?? []) {
      const sourceRef = e.source_ref as ExistingProblem["sourceRef"];
      if (sourceRef?.system !== "regulatory") continue;
      const sid = e.site_id as string;
      const arr = existingBySite.get(sid) ?? [];
      arr.push({
        id: e.id as string,
        title: e.title as string,
        category: e.category as 'zoning' | 'licensing' | 'other',
        severity: e.severity as 'H' | 'M' | 'L',
        adminEditedAt: (e.admin_edited_at as string) ?? null,
        sourceRef,
      });
      existingBySite.set(sid, arr);
    }
  }

  // 4. Compute ops per site, then dispatch
  let inserted = 0, updated = 0, skipped = 0;
  for (const row of rebl3Rows ?? []) {
    const rebl3SiteId = row.site_id as string;
    const loc = locByRebl3.get(rebl3SiteId);
    if (!loc) continue;
    const issues = (row.details as { issues?: RegulatoryIssue[] })?.issues ?? [];
    if (!Array.isArray(issues)) continue;
    const existing = existingBySite.get(loc.id) ?? [];
    const ops = computeRegulatorySyncOps({
      siteId: loc.id,
      metro: loc.metro,
      rebl3SiteId,
      issues,
      existing,
    });
    if (ops.insert.length > 0) {
      const { error } = await supabase.from("pp_site_problems").insert(ops.insert);
      if (error) console.error("regulatory sync insert error:", error);
      else inserted += ops.insert.length;
    }
    for (const u of ops.update) {
      const { error } = await supabase.from("pp_site_problems").update(u.patch).eq("id", u.id);
      if (error) console.error("regulatory sync update error:", error);
      else updated += 1;
    }
    skipped += ops.skip.length;
  }

  return NextResponse.json({ ok: true, inserted, updated, skipped });
}
