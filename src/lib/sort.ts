import { Location } from "@/types";
import { getDistanceMiles } from "./locations";

const COLOR_RANK: Record<string, number> = { GREEN: 0, YELLOW: 1, AMBER: 2, RED: 3 };

// Top-of-list rank: open campuses are the strongest signal (real schools),
// then active parent votes, then pipeline sites, then prospects.
function pipelineRank(loc: Location): number {
  const stage = loc.derived?.stage;
  if (stage === "open" || stage === "ready_to_open") return 0;
  if (loc.proposed) return 1;
  if (stage === "build_out" || stage === "ready_to_commit" || stage === "diligence") return 2;
  return 3;
}

// Count green subscores — used to sort within overall GREEN and YELLOW
// price(1) + building(2) + neighborhood(4) + zoning(8)
export function greenSubRank(loc: Location): number {
  const s = loc.scores;
  if (!s) return 0;
  return (s.price?.color === "GREEN" ? 1 : 0)
       + (s.building?.color === "GREEN" ? 2 : 0)
       + (s.neighborhood?.color === "GREEN" ? 4 : 0)
       + (s.zoning?.color === "GREEN" ? 8 : 0);
}

export function sortMostViable(a: Location, b: Location): number {
  const pipelineDiff = pipelineRank(a) - pipelineRank(b);
  if (pipelineDiff !== 0) return pipelineDiff;
  const aRank = COLOR_RANK[a.scores?.overallColor || ""] ?? 99;
  const bRank = COLOR_RANK[b.scores?.overallColor || ""] ?? 99;
  if (aRank !== bRank) return aRank - bRank;
  const subDiff = greenSubRank(b) - greenSubRank(a);
  if (subDiff !== 0) return subDiff;
  return b.votes - a.votes;
}

type SubPriority = 'zoning' | 'neighborhood' | 'building' | 'price';

function getSubColor(loc: Location, sub: SubPriority): string | null {
  const s = loc.scores;
  if (!s) return null;
  return s[sub]?.color || null;
}

export function sortMostViableWithPriority(a: Location, b: Location, priority: SubPriority): number {
  const pipelineDiff = pipelineRank(a) - pipelineRank(b);
  if (pipelineDiff !== 0) return pipelineDiff;
  // Priority subscore color rank
  const aPri = COLOR_RANK[getSubColor(a, priority) || ""] ?? 99;
  const bPri = COLOR_RANK[getSubColor(b, priority) || ""] ?? 99;
  if (aPri !== bPri) return aPri - bPri;
  // Then overall color rank
  const aRank = COLOR_RANK[a.scores?.overallColor || ""] ?? 99;
  const bRank = COLOR_RANK[b.scores?.overallColor || ""] ?? 99;
  if (aRank !== bRank) return aRank - bRank;
  // Then greenSubRank bitmask
  const subDiff = greenSubRank(b) - greenSubRank(a);
  if (subDiff !== 0) return subDiff;
  // Then votes
  return b.votes - a.votes;
}

export function sortMostSupport(a: Location, b: Location): number {
  const pipelineDiff = pipelineRank(a) - pipelineRank(b);
  if (pipelineDiff !== 0) return pipelineDiff;
  if (b.votes !== a.votes) return b.votes - a.votes;
  return sortMostViable(a, b);
}

export function makeSortNearest(userLat: number, userLng: number) {
  return (a: Location, b: Location): number => {
    const pipelineDiff = pipelineRank(a) - pipelineRank(b);
    if (pipelineDiff !== 0) return pipelineDiff;
    const distA = getDistanceMiles(userLat, userLng, a.lat, a.lng);
    const distB = getDistanceMiles(userLat, userLng, b.lat, b.lng);
    if (distA !== distB) return distA - distB;
    return sortMostViable(a, b);
  };
}
