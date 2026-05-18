export function statusBadge(overallColor: string | null | undefined) {
  if (overallColor === "GREEN") return { label: "Green", className: "text-green-700", bgClassName: "bg-green-50" };
  if (overallColor === "YELLOW" || overallColor === "AMBER") return { label: "Yellow", className: "text-amber-600", bgClassName: "bg-amber-50" };
  if (overallColor === "RED") return { label: "Red", className: "text-red-600", bgClassName: "bg-red-50" };
  return null;
}

export function sizeTierLabel(sizeClassification: string | null | undefined, capacity?: number | null): string | null {
  // Prefer the exact capacity number when known
  if (capacity != null && capacity > 0) return `~${capacity} students`;
  // Fall back to size category
  if (!sizeClassification) return null;
  const tiers: Record<string, string> = {
    micro: "25-100 students",
    micro2: "100-200 students",
    growth: "200-500 students",
    "full size": "500+ students",
    flagship: "500+ students",
    too_small: "Too small",
  };
  return tiers[sizeClassification.toLowerCase()] || sizeClassification;
}
