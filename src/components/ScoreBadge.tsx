"use client";

import { useState } from "react";
import { ExternalLink, Users, DollarSign, Landmark, Trees, Building2, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { LocationScores, SubScore } from "@/types";

const colorBg: Record<string, string> = {
  GREEN: "bg-green-500",
  YELLOW: "bg-yellow-400",
  AMBER: "bg-amber-500",
  RED: "bg-red-500",
};

const colorText: Record<string, string> = {
  GREEN: "text-green-600",
  YELLOW: "text-yellow-600",
  AMBER: "text-amber-600",
  RED: "text-red-500",
};

const overallColorClasses: Record<string, string> = {
  GREEN: "bg-green-500 text-white",
  YELLOW: "bg-yellow-400 text-gray-900",
  AMBER: "bg-amber-500 text-white",
  RED: "bg-red-500 text-white",
};

interface ScoreCellProps {
  icon: React.ReactNode;
  sub: SubScore;
  detailsUrl?: string | null;
}

function ScoreCell({ icon, sub }: ScoreCellProps) {
  const score = sub.score;
  const display = score != null ? Math.round(score * 100) : "–";
  const dot = sub.color ? colorBg[sub.color] : "bg-gray-300";
  const text = sub.color ? colorText[sub.color] : "text-gray-400";
  const hasLink = !!sub.detailsUrl;

  const content = (
    <span className={`inline-flex items-center gap-1 ${hasLink ? "cursor-pointer hover:opacity-70" : ""}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
      <span className="text-gray-400 shrink-0">{icon}</span>
      <span className={`text-[11px] font-semibold tabular-nums ${text}`}>{display}</span>
    </span>
  );

  if (hasLink) {
    return (
      <a href={sub.detailsUrl!} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
        {content}
      </a>
    );
  }
  return content;
}

function ScoreLegend({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute z-50 right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-[11px] w-48"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-gray-700">Score Key</span>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
      </div>
      <div className="space-y-1.5 text-gray-600">
        <div className="flex items-center gap-2"><Users className="h-3 w-3 text-gray-400" /> Demographics</div>
        <div className="flex items-center gap-2"><DollarSign className="h-3 w-3 text-gray-400" /> Price</div>
        <div className="flex items-center gap-2"><Landmark className="h-3 w-3 text-gray-400" /> Zoning</div>
        <div className="flex items-center gap-2"><Trees className="h-3 w-3 text-gray-400" /> Neighborhood</div>
        <div className="flex items-center gap-2"><Building2 className="h-3 w-3 text-gray-400" /> Building</div>
        <hr className="my-1.5" />
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" /> 75+ Green</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-400" /> 50-74 Yellow</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" /> &lt;50 Red</div>
      </div>
    </div>
  );
}

export function ScoreBadge({ scores, compact }: { scores?: LocationScores; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  if (!scores || scores.overall == null) return null;

  const overallClass = scores.overallColor ? overallColorClasses[scores.overallColor] : "bg-gray-400 text-white";
  const hasOverallLink = !!scores.overallDetailsUrl;

  const overallBadge = (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${overallClass}`}>
      {Math.round(scores.overall)}
    </span>
  );

  const iconSize = "h-3 w-3";

  if (compact) {
    return (
      <div data-testid="score-badge" className="mt-1">
        {hasOverallLink ? (
          <a href={scores.overallDetailsUrl!} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {overallBadge}
            <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
          </a>
        ) : overallBadge}
      </div>
    );
  }

  return (
    <div data-testid="score-badge" className="mt-2 relative">
      {/* Collapsed: overall badge + expand toggle */}
      <div className="flex items-center gap-2">
        {hasOverallLink ? (
          <a href={scores.overallDetailsUrl!} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 flex-shrink-0 inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            {overallBadge}
            <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
          </a>
        ) : (
          <div className="flex-shrink-0">{overallBadge}</div>
        )}
        <button
          type="button"
          className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <span>{expanded ? "less" : "details"}</span>
        </button>
      </div>

      {/* Expanded: sub-scores grid */}
      {expanded && (
        <div className="mt-1.5 flex items-start gap-2">
          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5">
            <ScoreCell icon={<Users className={iconSize} />} sub={scores.demographics} />
            <ScoreCell icon={<DollarSign className={iconSize} />} sub={scores.price} />
            <ScoreCell icon={<Landmark className={iconSize} />} sub={scores.zoning} />
            <ScoreCell icon={<Trees className={iconSize} />} sub={scores.neighborhood} />
            <ScoreCell icon={<Building2 className={iconSize} />} sub={scores.building} />
            {scores.sizeClassification && (
              <span className="text-[10px] text-gray-400 font-medium truncate">{scores.sizeClassification}</span>
            )}
          </div>
          <button
            type="button"
            className="text-gray-300 hover:text-gray-500 shrink-0 mt-0.5"
            onClick={(e) => { e.stopPropagation(); setShowLegend(!showLegend); }}
          >
            <HelpCircle className="h-3 w-3" />
          </button>
        </div>
      )}

      {showLegend && <ScoreLegend onClose={() => setShowLegend(false)} />}
    </div>
  );
}
