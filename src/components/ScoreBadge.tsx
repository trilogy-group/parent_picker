"use client";

import { ExternalLink } from "lucide-react";
import { LocationScores, SubScore } from "@/types";

const colorClasses: Record<string, string> = {
  GREEN: "bg-green-500 text-white",
  YELLOW: "bg-yellow-400 text-gray-900",
  AMBER: "bg-amber-500 text-white",
  RED: "bg-red-500 text-white",
};

const colorClassesBorder: Record<string, string> = {
  GREEN: "border-green-500 text-green-700",
  YELLOW: "border-yellow-400 text-yellow-700",
  AMBER: "border-amber-500 text-amber-700",
  RED: "border-red-500 text-red-700",
};

function ScorePill({ label, sub }: { label: string; sub: SubScore }) {
  const score = sub.score;
  const display = score != null ? Math.round(score * 100) : "–";
  const borderClass = sub.color ? colorClassesBorder[sub.color] : "border-gray-300 text-gray-400";

  const hasLink = !!sub.detailsUrl;

  const pill = (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${borderClass} ${hasLink ? "cursor-pointer hover:shadow-sm" : ""}`}
    >
      <span>{label}</span>
      <span className="font-semibold">{display}</span>
      {hasLink && <ExternalLink className="h-2 w-2 flex-shrink-0 opacity-60" />}
    </span>
  );

  if (hasLink) {
    return (
      <a href={sub.detailsUrl!} target="_blank" rel="noopener noreferrer" className="hover:opacity-80" onClick={(e) => e.stopPropagation()}>
        {pill}
      </a>
    );
  }
  return pill;
}

export function ScoreBadge({ scores }: { scores?: LocationScores }) {
  if (!scores || scores.overall == null) return null;

  const overallClass = scores.overallColor ? colorClasses[scores.overallColor] : "bg-gray-400 text-white";

  const hasOverallLink = !!scores.overallDetailsUrl;

  const overallBadge = (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${overallClass}`}>
      {Math.round(scores.overall)}
    </span>
  );

  return (
    <div className="mt-2 flex items-center gap-2">
      {hasOverallLink ? (
        <a href={scores.overallDetailsUrl!} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 flex-shrink-0 inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          {overallBadge}
          <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
        </a>
      ) : (
        <div className="flex-shrink-0">{overallBadge}</div>
      )}
      <div className="flex flex-wrap gap-1">
        <ScorePill label="Demographics" sub={scores.demographics} />
        <ScorePill label="Price" sub={scores.price} />
        <ScorePill label="Zoning" sub={scores.zoning} />
        <ScorePill label="Neighborhood" sub={scores.neighborhood} />
        <ScorePill label="Building" sub={scores.building} />
      </div>
    </div>
  );
}
