"use client";

import { useState } from "react";
import { ExternalLink, MapPin, DollarSign, Landmark, Building2, HelpCircle } from "lucide-react";
import { LocationScores, SubScore } from "@/types";

const colorBg: Record<string, string> = {
  GREEN: "bg-green-500",
  YELLOW: "bg-yellow-400",
  AMBER: "bg-amber-500",
  RED: "bg-red-500",
};

/** Card background tint based on overall score color */
export const overallCardBg: Record<string, string> = {
  GREEN: "bg-green-50",
  YELLOW: "bg-yellow-50",
  AMBER: "bg-amber-50",
  RED: "bg-red-50",
};

function ScoreCell({ icon, sub }: { icon: React.ReactNode; sub: SubScore }) {
  const dot = sub.color ? colorBg[sub.color] : "bg-gray-300";

  return (
    <div className="flex items-center gap-0.5 h-4">
      <div className={`w-2 h-2 rounded-full ${dot} shrink-0`} />
      <div className="w-3 h-3 text-gray-400 shrink-0 flex items-center justify-center [&>svg]:block">{icon}</div>
    </div>
  );
}

function ScoreLegend({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute z-50 right-0 bottom-6 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-[11px] w-40"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-gray-700">Score Key</span>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
      </div>
      <div className="space-y-1.5 text-gray-600">
        <div className="flex items-center gap-2"><MapPin className="h-3 w-3 text-gray-400" /> Neighborhood</div>
        <div className="flex items-center gap-2"><Landmark className="h-3 w-3 text-gray-400" /> Regulatory</div>
        <div className="flex items-center gap-2"><Building2 className="h-3 w-3 text-gray-400" /> Building</div>
        <div className="flex items-center gap-2"><DollarSign className="h-3 w-3 text-gray-400" /> Price</div>
      </div>
    </div>
  );
}

const ICON_SIZE = "h-3 w-3";

function SubScoresRow({ scores }: { scores: LocationScores }) {
  return (
    <div className="flex items-center gap-1.5">
      <ScoreCell icon={<MapPin className={ICON_SIZE} />} sub={scores.neighborhood} />
      <ScoreCell icon={<Landmark className={ICON_SIZE} />} sub={scores.zoning} />
      <ScoreCell icon={<Building2 className={ICON_SIZE} />} sub={scores.building} />
      <ScoreCell icon={<DollarSign className={ICON_SIZE} />} sub={scores.price} />
    </div>
  );
}

/** Artifact link icon — only renders when a details URL exists */
export function ArtifactLink({ scores }: { scores?: LocationScores }) {
  if (!scores?.overallDetailsUrl) return null;

  return (
    <a href={scores.overallDetailsUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 shrink-0" onClick={(e) => e.stopPropagation()}>
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

/** Size classification label */
export function SizeLabel({ scores }: { scores?: LocationScores }) {
  if (!scores?.sizeClassification) return null;
  return (
    <span className="text-[10px] text-gray-400 font-medium leading-none shrink-0">
      {scores.sizeClassification}
    </span>
  );
}

/** Sub-scores row with legend — always visible */
export function ScoreDetails({ scores }: { scores?: LocationScores }) {
  const [showLegend, setShowLegend] = useState(false);

  if (!scores || scores.overallColor == null) return null;

  return (
    <div className="relative flex items-center justify-between">
      <SubScoresRow scores={scores} />
      <button
        type="button"
        className="text-gray-300 hover:text-gray-500 shrink-0 ml-1"
        onClick={(e) => { e.stopPropagation(); setShowLegend(!showLegend); }}
      >
        <HelpCircle className="h-3 w-3" />
      </button>
      {showLegend && <ScoreLegend onClose={() => setShowLegend(false)} />}
    </div>
  );
}

/** Legacy export for AdminLocationCard */
export function ScoreBadge({ scores }: { scores?: LocationScores }) {
  if (!scores || scores.overallColor == null) return null;

  return (
    <div data-testid="score-badge" className="mt-1">
      <ArtifactLink scores={scores} />
    </div>
  );
}
