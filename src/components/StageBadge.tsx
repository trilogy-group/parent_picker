import type { SiteStage } from "@/types";

// Stage colors avoid green/yellow/amber — those are reserved for the
// regulatory / zoning / permits hurdle chips (done = green, pending = yellow).
const STAGE_STYLES: Record<SiteStage, { label: string; className: string }> = {
  prospecting: { label: "PROSPECTING", className: "bg-blue-100 text-blue-700" },
  diligence:   { label: "DILIGENCE",   className: "bg-orange-100 text-orange-700" },
  build_out:   { label: "BUILD-OUT",   className: "bg-indigo-100 text-indigo-700" },
  open:        { label: "OPEN",        className: "bg-indigo-600 text-white" },
  moved_on:    { label: "MOVED ON",    className: "bg-stone-100 text-stone-500" },
};

interface Props {
  stage: SiteStage;
}

export function StageBadge({ stage }: Props) {
  const s = STAGE_STYLES[stage];
  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${s.className}`}>
      {s.label}
    </span>
  );
}
