import type { SiteStage } from "@/types";

const STAGE_STYLES: Record<SiteStage, { label: string; className: string }> = {
  scored: { label: "SCORED", className: "bg-blue-100 text-blue-700" },
  engaged: { label: "ENGAGED", className: "bg-orange-100 text-orange-700" },
  committed: { label: "COMMITTED", className: "bg-green-100 text-green-700" },
  moved_on: { label: "MOVED ON", className: "bg-stone-100 text-stone-500" },
};

export function StageBadge({ stage }: { stage: SiteStage }) {
  const s = STAGE_STYLES[stage];
  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${s.className}`}>
      {s.label}
    </span>
  );
}
