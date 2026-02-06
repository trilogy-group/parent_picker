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

function ScoreCell({ icon, sub }: { icon: React.ReactNode; sub: SubScore }) {
  const score = sub.score;
  const display = score != null ? Math.round(score * 100) : "–";
  const dot = sub.color ? colorBg[sub.color] : "bg-gray-300";
  const text = sub.color ? colorText[sub.color] : "text-gray-400";
  const hasLink = !!sub.detailsUrl;

  const content = (
    <div className={`flex items-center gap-0.5 h-4 ${hasLink ? "cursor-pointer hover:opacity-70" : ""}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
      <div className="w-3 h-3 text-gray-400 shrink-0 flex items-center justify-center [&>svg]:block">{icon}</div>
      <div className={`text-[11px] font-semibold tabular-nums leading-none ${text}`}>{display}</div>
    </div>
  );

  if (hasLink) {
    return (
      <a href={sub.detailsUrl!} target="_blank" rel="noopener noreferrer" className="flex" onClick={(e) => e.stopPropagation()}>
        {content}
      </a>
    );
  }
  return content;
}

function ScoreLegend({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute z-50 right-0 bottom-6 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-[11px] w-48"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-gray-700">Score Key</span>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
      </div>
      <div className="space-y-1.5 text-gray-600">
        <div className="flex items-center gap-2"><Users className="h-3 w-3 text-gray-400" /> Demographics</div>
        <div className="flex items-center gap-2"><DollarSign className="h-3 w-3 text-gray-400" /> Price</div>
        <div className="flex items-center gap-2"><Landmark className="h-3 w-3 text-gray-400" /> Regulatory</div>
        <div className="flex items-center gap-2"><Trees className="h-3 w-3 text-gray-400" /> Neighborhood</div>
        <div className="flex items-center gap-2"><Building2 className="h-3 w-3 text-gray-400" /> Building</div>
      </div>
    </div>
  );
}

const ICON_SIZE = "h-3 w-3";

function SubScoresRow({ scores }: { scores: LocationScores }) {
  return (
    <div className="flex items-center gap-1.5">
      <ScoreCell icon={<Users className={ICON_SIZE} />} sub={scores.demographics} />
      <ScoreCell icon={<DollarSign className={ICON_SIZE} />} sub={scores.price} />
      <ScoreCell icon={<Landmark className={ICON_SIZE} />} sub={scores.zoning} />
      <ScoreCell icon={<Trees className={ICON_SIZE} />} sub={scores.neighborhood} />
      <ScoreCell icon={<Building2 className={ICON_SIZE} />} sub={scores.building} />
      {scores.sizeClassification && (
        <div className="flex items-center h-4 text-[11px] text-gray-400 font-medium leading-none">{scores.sizeClassification}</div>
      )}
    </div>
  );
}

function SubScoresGrid({ scores }: { scores: LocationScores }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 items-center">
      <ScoreCell icon={<Users className={ICON_SIZE} />} sub={scores.demographics} />
      <ScoreCell icon={<DollarSign className={ICON_SIZE} />} sub={scores.price} />
      <ScoreCell icon={<Landmark className={ICON_SIZE} />} sub={scores.zoning} />
      <ScoreCell icon={<Trees className={ICON_SIZE} />} sub={scores.neighborhood} />
      <ScoreCell icon={<Building2 className={ICON_SIZE} />} sub={scores.building} />
      {scores.sizeClassification && (
        <div className="flex items-center h-4 text-[11px] text-gray-400 font-medium leading-none">{scores.sizeClassification}</div>
      )}
    </div>
  );
}

/** Inline overall score circle — used in card header row */
export function OverallBadge({ scores }: { scores?: LocationScores }) {
  if (!scores || scores.overall == null) return null;

  const overallClass = scores.overallColor ? overallColorClasses[scores.overallColor] : "bg-gray-400 text-white";
  const hasLink = !!scores.overallDetailsUrl;

  const badge = (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold ${overallClass}`}>
      {Math.round(scores.overall)}
    </span>
  );

  if (hasLink) {
    return (
      <a href={scores.overallDetailsUrl!} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        {badge}
        <ExternalLink className="h-2 w-2 text-muted-foreground" />
      </a>
    );
  }
  return badge;
}

/** Expandable sub-scores section — used below card header and map popup */
export function ScoreDetails({ scores, useGrid }: { scores?: LocationScores; useGrid?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  if (!scores || scores.overall == null) return null;

  return (
    <div className="relative">
      <button
        type="button"
        className="text-[10px] text-gray-400 hover:text-gray-600 inline-flex items-center gap-0.5"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
      >
        {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
        <span>{expanded ? "less" : "details"}</span>
      </button>

      {expanded && (
        <div className="flex items-end justify-between">
          {useGrid ? <SubScoresGrid scores={scores} /> : <SubScoresRow scores={scores} />}
          <button
            type="button"
            className="text-gray-300 hover:text-gray-500 shrink-0 ml-1"
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

/** Combined badge for map popup — compact overall only */
export function ScoreBadge({ scores, compact }: { scores?: LocationScores; compact?: boolean }) {
  if (!scores || scores.overall == null) return null;

  if (compact) {
    return (
      <div data-testid="score-badge" className="mt-1">
        <OverallBadge scores={scores} />
      </div>
    );
  }

  // Full display (legacy — used by map popup)
  return (
    <div data-testid="score-badge" className="mt-1">
      <OverallBadge scores={scores} />
    </div>
  );
}
