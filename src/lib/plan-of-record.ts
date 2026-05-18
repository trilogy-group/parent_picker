import { useEffect, useState } from "react";
import type { Location, MetroPlan, SiteProblem } from "@/types";

export interface EffectivePlan {
  primaryLongTermSiteId?: string;
  bridgeSiteId?: string;
  watchSiteIds: string[];
  source: "curated" | "auto" | "mixed";
}

export type PlanRole = "primary" | "bridge" | "watch";

/** Hook: fetches the curated MetroPlan for a metro (null when none). */
export function useMetroPlan(metro: string | null): MetroPlan | null {
  const [state, setState] = useState<{ metro: string | null; plan: MetroPlan | null }>({
    metro: null,
    plan: null,
  });
  useEffect(() => {
    if (!metro) return;
    let cancelled = false;
    fetch(`/api/metro/${encodeURIComponent(metro)}/plan`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: MetroPlan | null) => {
        if (!cancelled) setState({ metro, plan: data });
      })
      .catch(() => {
        if (!cancelled) setState({ metro, plan: null });
      });
    return () => {
      cancelled = true;
    };
  }, [metro]);
  // When metro is null OR a fetch is still in flight for a different metro,
  // state.metro won't match — return null until the fetch lands.
  return state.metro === metro ? state.plan : null;
}

/**
 * Hook: fetches all open/in_progress problems for a metro and returns them
 * grouped by site_id. Empty Map when no metro or none found.
 */
export function useMetroProblems(metro: string | null): Map<string, SiteProblem[]> {
  const [state, setState] = useState<{ metro: string | null; map: Map<string, SiteProblem[]> }>({
    metro: null,
    map: new Map(),
  });
  useEffect(() => {
    if (!metro) return;
    let cancelled = false;
    fetch(`/api/problems?metro=${encodeURIComponent(metro)}`)
      .then(r => (r.ok ? r.json() : []))
      .then((problems: SiteProblem[]) => {
        if (cancelled) return;
        const map = new Map<string, SiteProblem[]>();
        for (const p of problems ?? []) {
          if (!p.siteId) continue;
          (map.get(p.siteId) ?? map.set(p.siteId, []).get(p.siteId))!.push(p);
        }
        setState({ metro, map });
      })
      .catch(() => {
        if (!cancelled) setState({ metro, map: new Map() });
      });
    return () => {
      cancelled = true;
    };
  }, [metro]);
  return state.metro === metro ? state.map : new Map();
}

/** Derive a default plan from the data when no admin curation exists. */
export function autoDerivePlan(metroLocations: Location[]): EffectivePlan {
  // "Primary" auto-picks: the single AI site furthest down the pipeline.
  // Build-out / Ready-to-open / Open are stronger signals than Diligence.
  const PRIMARY_STAGES = new Set(["build_out", "ready_to_open", "open"]);
  const primaryCandidates = metroLocations.filter(
    l => l.derived?.category === "ai" && PRIMARY_STAGES.has(l.derived.stage)
  );
  const bridges = metroLocations.filter(l => l.isBridge === true);
  return {
    primaryLongTermSiteId: primaryCandidates.length === 1 ? primaryCandidates[0].id : undefined,
    bridgeSiteId: bridges.length === 1 ? bridges[0].id : undefined,
    watchSiteIds: [],
    source: "auto",
  };
}

/** Merge curated plan over auto-derived defaults. Curated wins per-field. */
export function mergePlan(
  curated: MetroPlan | null,
  auto: EffectivePlan
): EffectivePlan {
  if (!curated) return auto;
  const ci = curated.narrativeTemplateInputs;
  const hasCurated =
    !!curated.narrativeOverride ||
    !!curated.backupPlan ||
    (curated.pivotConditions?.length ?? 0) > 0 ||
    !!ci.primaryLongTermSiteId ||
    !!ci.bridgeSiteId ||
    (ci.watchSiteIds?.length ?? 0) > 0;
  return {
    primaryLongTermSiteId: ci.primaryLongTermSiteId ?? auto.primaryLongTermSiteId,
    bridgeSiteId: ci.bridgeSiteId ?? auto.bridgeSiteId,
    watchSiteIds: ci.watchSiteIds ?? [],
    source: hasCurated ? "mixed" : "auto",
  };
}

/** Look up the role of a site within an effective plan. */
export function getPlanRole(
  locId: string,
  plan: EffectivePlan
): PlanRole | null {
  if (plan.primaryLongTermSiteId === locId) return "primary";
  if (plan.bridgeSiteId === locId) return "bridge";
  if (plan.watchSiteIds.includes(locId)) return "watch";
  return null;
}

/** Stage rank for sort: open > ready_to_open > build_out > ready_to_commit > diligence > prospect > moved_on. */
function stageRank(stage?: string): number {
  switch (stage) {
    case "open":             return 0;
    case "ready_to_open":    return 1;
    case "build_out":        return 2;
    case "ready_to_commit":  return 3;
    case "diligence":        return 4;
    case "prospect":         return 5;
    default:                 return 6; // moved_on / undefined
  }
}

/** Plan-role rank: primary(0) > bridge(1) > watch(2) > none(3). */
function planRoleRank(role: PlanRole | null): number {
  if (role === "primary") return 0;
  if (role === "bridge") return 1;
  if (role === "watch") return 2;
  return 3;
}

/**
 * Comparator for sites within a category block. Pins the user's championed
 * site first (for Parent block), then PoR-named sites in primary/bridge/watch
 * order, then by stage > deadline > votes > alphabetical.
 */
export function comparePlanOrder(
  a: Location,
  b: Location,
  plan: EffectivePlan,
  currentUserId: string | null
): number {
  // 1. Signed-in user's own active championship pins first
  const aIsMine = currentUserId
    ? !!(a.champions ?? []).find(c => c.userId === currentUserId && !c.releasedAt)
    : false;
  const bIsMine = currentUserId
    ? !!(b.champions ?? []).find(c => c.userId === currentUserId && !c.releasedAt)
    : false;
  if (aIsMine !== bIsMine) return aIsMine ? -1 : 1;

  // 2. Plan role
  const aRole = getPlanRole(a.id, plan);
  const bRole = getPlanRole(b.id, plan);
  if (aRole !== bRole) {
    return planRoleRank(aRole) - planRoleRank(bRole);
  }

  // 3. Stage
  const sr = stageRank(a.derived?.stage) - stageRank(b.derived?.stage);
  if (sr !== 0) return sr;

  // 4. Build-out sites: closest deadline first
  if (a.derived?.stage === "build_out" && b.derived?.stage === "build_out") {
    const aD = a.feedbackDeadline ? new Date(a.feedbackDeadline).getTime() : Infinity;
    const bD = b.feedbackDeadline ? new Date(b.feedbackDeadline).getTime() : Infinity;
    if (aD !== bD) return aD - bD;
  }

  // 5. Votes desc
  if (a.votes !== b.votes) return b.votes - a.votes;

  // 6. Alphabetical by address
  return (a.address ?? "").localeCompare(b.address ?? "");
}
