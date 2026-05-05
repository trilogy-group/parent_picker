"use client";

import type { Location, MetroPlan } from "@/types";
import { useVotesStore } from "@/lib/votes";
import type { EffectivePlan } from "@/lib/plan-of-record";

interface Props {
  metro: string;
  plan: MetroPlan | null; // curated; null if none
  effectivePlan: EffectivePlan; // merged (curated + auto-derived)
}

export function PlanOfRecord({ plan, effectivePlan }: Props) {
  const locations = useVotesStore(s => s.locations);
  const findSite = (id?: string) => (id ? locations.find(l => l.id === id) : null);
  const primary = findSite(effectivePlan.primaryLongTermSiteId);
  const bridge = findSite(effectivePlan.bridgeSiteId);
  const watch = (effectivePlan.watchSiteIds ?? [])
    .map(id => findSite(id))
    .filter((s): s is NonNullable<typeof s> => s != null);

  // Narrative: curated override > auto narrative built from primary/bridge/watch
  const hasAnything = !!primary || !!bridge || watch.length > 0 || !!plan?.narrativeOverride;
  if (!hasAnything) return null; // hide entirely when nothing to say

  const bullets = plan?.narrativeOverride
    ? splitNarrative(plan.narrativeOverride)
    : buildAutoNarrative(primary, bridge, watch);

  return (
    <div className="mx-4 my-3 p-4 bg-white border-l-4 border-stone-700 rounded-md shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
        Plan of Record
        {effectivePlan.source === "auto" && (
          <span className="ml-2 text-[10px] font-normal text-stone-400">auto</span>
        )}
      </h2>
      <ul className="space-y-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="text-sm text-stone-700 leading-relaxed flex gap-2">
            <span className="text-stone-400 leading-relaxed">•</span>
            <span className="flex-1">{b}</span>
          </li>
        ))}
      </ul>
      {(plan?.pivotConditions?.length ?? 0) > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-200">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">What would change this</h3>
          <ul className="space-y-1">
            {plan!.pivotConditions.map((pc, i) => (
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
  primary: Location | null | undefined,
  bridge: Location | null | undefined,
  watch: Location[]
): string[] {
  const bullets: string[] = [];
  if (bridge && primary) {
    bullets.push(`Launching at ${bridge.name} as a bridge site while we build out ${primary.name} for the long term.`);
  } else if (bridge) {
    bullets.push(`Launching at ${bridge.name} as a bridge site while we evaluate longer-term options.`);
  } else if (primary) {
    bullets.push(`Pursuing ${primary.name} as our primary long-term home.`);
  } else {
    bullets.push("Evaluating sites in this metro.");
  }
  if (watch.length > 0) {
    bullets.push(`Also watching: ${watch.map(w => w.name).join(", ")}.`);
  }
  return bullets;
}

function splitNarrative(text: string): string[] {
  // Prefer line-separated bullets; fall back to splitting on sentence boundaries.
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [text];
  return sentences.map(s => s.trim()).filter(Boolean);
}
