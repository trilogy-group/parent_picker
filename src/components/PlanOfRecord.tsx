"use client";

import { useEffect, useState } from "react";
import type { MetroPlan } from "@/types";
import { useVotesStore } from "@/lib/votes";

interface Props {
  metro: string;
}

export function PlanOfRecord({ metro }: Props) {
  const [state, setState] = useState<{ metro: string | null; plan: MetroPlan | null }>({
    metro: null,
    plan: null,
  });
  const locations = useVotesStore(s => s.locations);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/metro/${encodeURIComponent(metro)}/plan`)
      .then(r => r.json())
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

  // Hide while the first fetch for this metro is in flight or if no plan exists
  if (state.metro !== metro || !state.plan) return null;
  const plan = state.plan;

  // Resolve site names for narrative
  const findSite = (id?: string) =>
    id ? locations.find(l => l.id === id) : null;
  const primary = findSite(plan.narrativeTemplateInputs.primaryLongTermSiteId);
  const bridge = findSite(plan.narrativeTemplateInputs.bridgeSiteId);
  const watch = (plan.narrativeTemplateInputs.watchSiteIds ?? [])
    .map(id => findSite(id))
    .filter((s): s is NonNullable<typeof s> => s !== null && s !== undefined);

  // Build narrative
  const narrative = plan.narrativeOverride ?? buildAutoNarrative(primary, bridge, watch);

  return (
    <div className="mx-4 my-3 p-4 bg-white border-l-4 border-stone-700 rounded-md shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Plan of Record</h2>
      <p className="text-sm text-stone-700 leading-relaxed">{narrative}</p>
      {plan.pivotConditions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-200">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">What would change this</h3>
          <ul className="space-y-1">
            {plan.pivotConditions.map((pc, i) => (
              <li key={i} className="text-sm text-stone-700">
                <span className="text-orange-600">▸</span> {pc.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function buildAutoNarrative(
  primary: { name: string; address: string } | null | undefined,
  bridge: { name: string; address: string } | null | undefined,
  watch: { name: string; address: string }[]
): string {
  const parts: string[] = [];
  if (bridge) {
    parts.push(`Launching at ${bridge.name} as a bridge site`);
    if (primary) {
      parts.push(`while we build out ${primary.name} for the long term.`);
    } else {
      parts.push("while we evaluate longer-term options.");
    }
  } else if (primary) {
    parts.push(`Pursuing ${primary.name} as our primary long-term home.`);
  } else {
    parts.push("Evaluating sites in this metro.");
  }
  if (watch.length > 0) {
    parts.push(`Also watching: ${watch.map(w => w.name).join(", ")}.`);
  }
  return parts.join(" ");
}
