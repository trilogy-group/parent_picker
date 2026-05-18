import type { SiteStage } from "@/types";

const STAGE_STYLES: Record<SiteStage, { label: string; className: string }> = {
  prospect:         { label: "PROSPECT",         className: "bg-blue-100 text-blue-700" },
  diligence:        { label: "DILIGENCE",        className: "bg-orange-100 text-orange-700" },
  ready_to_commit:  { label: "READY TO COMMIT",  className: "bg-violet-100 text-violet-700" },
  build_out:        { label: "BUILD-OUT",        className: "bg-green-100 text-green-700" },
  ready_to_open:    { label: "READY TO OPEN",    className: "bg-emerald-100 text-emerald-700" },
  open:             { label: "OPEN",             className: "bg-emerald-600 text-white" },
  moved_on:         { label: "MOVED ON",         className: "bg-stone-100 text-stone-500" },
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
