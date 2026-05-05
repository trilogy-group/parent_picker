import type { CommittedSubStage } from "@/types";

const SUB_STAGES: { key: CommittedSubStage; label: string }[] = [
  { key: "loi", label: "LOI" },
  { key: "lease", label: "Lease" },
  { key: "zoning", label: "Zoning" },
  { key: "permits", label: "Permits" },
  { key: "buildout", label: "Buildout" },
  { key: "co", label: "CO" },
];

interface Props {
  current: CommittedSubStage;
  /** Compact: bars only, no labels — used inside cards. */
  compact?: boolean;
}

export function StageTimeline({ current, compact = false }: Props) {
  const idx = SUB_STAGES.findIndex(s => s.key === current);
  return (
    <div>
      <div className={`flex gap-1 ${compact ? "" : ""}`}>
        {SUB_STAGES.map((s, i) => (
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
          {SUB_STAGES.map(s => (
            <span key={s.key} className="flex-1 text-center">{s.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
