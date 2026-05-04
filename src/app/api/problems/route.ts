import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SiteProblem, ProblemOwner } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const metro = searchParams.get("metro");
  const all = searchParams.get("all") === "true";
  if (!metro) return NextResponse.json({ error: "metro required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json([]);

  let query = supabase
    .from("pp_site_problems")
    .select("id, site_id, metro, title, description, deadline, pivot_trigger, status, outcome_text, created_at, closed_at")
    .eq("metro", metro);

  if (!all) {
    query = query.in("status", ["open", "in_progress"]);
  }

  query = query
    .order("pivot_trigger", { ascending: false })
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const { data: rows, error } = await query;
  if (error || !rows) return NextResponse.json([], { status: 200 });
  if (rows.length === 0) return NextResponse.json([]);

  const ids = rows.map(r => r.id);
  const { data: owners } = await supabase
    .from("pp_problem_owners")
    .select("id, problem_id, user_id, claimed_at, released_at")
    .in("problem_id", ids)
    .is("released_at", null);

  const ownerByProblem = new Map<string, ProblemOwner>();
  for (const o of owners ?? []) {
    ownerByProblem.set(o.problem_id, {
      id: o.id,
      problemId: o.problem_id,
      userId: o.user_id,
      claimedAt: o.claimed_at,
      releasedAt: o.released_at,
    });
  }

  const problems: SiteProblem[] = rows.map(r => ({
    id: r.id,
    siteId: r.site_id,
    metro: r.metro,
    title: r.title,
    description: r.description,
    deadline: r.deadline,
    pivotTrigger: r.pivot_trigger,
    status: r.status as SiteProblem["status"],
    outcomeText: r.outcome_text,
    createdAt: r.created_at,
    closedAt: r.closed_at,
    owner: ownerByProblem.get(r.id) ?? null,
  }));

  return NextResponse.json(problems);
}
