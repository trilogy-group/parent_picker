import type { SiteStage } from "@/types";

// 4-stage parent-visible pipeline. Moved On is a side track and doesn't
// appear in the timeline.
const STAGES: { key: SiteStage; label: string }[] = [
  { key: "prospecting", label: "Prospecting" },
  { key: "diligence",   label: "Diligence" },
  { key: "build_out",   label: "Build-out" },
  { key: "open",        label: "Open" },
];

interface Props {
  current: SiteStage;
  /** Compact: bars only, no labels. */
  compact?: boolean;
}

export function StageTimeline({ current, compact = false }: Props) {
  const idx = STAGES.findIndex(s => s.key === current);
  return (
    <div>
      <div className="flex gap-1">
        {STAGES.map((s, i) => (
          <div
            key={s.key}
            className={`h-1.5 flex-1 rounded ${
              i < idx
                ? "bg-emerald-500"
                : i === idx
                ? "bg-orange-500"
                : "bg-stone-200"
            }`}
          />
        ))}
      </div>
      {!compact && (
        <div className="flex justify-between text-[9px] uppercase tracking-wider text-stone-500 mt-1">
          {STAGES.map(s => (
            <span key={s.key} className="flex-1 text-center">{s.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
