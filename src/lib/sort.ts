import { Location } from "@/types";

const COLOR_RANK: Record<string, number> = { GREEN: 0, YELLOW: 1, AMBER: 2, RED: 3 };

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
  // Proposed locations always first
  if (a.proposed && !b.proposed) return -1;
  if (!a.proposed && b.proposed) return 1;
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
  // Proposed locations always first
  if (a.proposed && !b.proposed) return -1;
  if (!a.proposed && b.proposed) return 1;
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
  // Proposed locations always first
  if (a.proposed && !b.proposed) return -1;
  if (!a.proposed && b.proposed) return 1;
  if (b.votes !== a.votes) return b.votes - a.votes;
  return sortMostViable(a, b);
}
