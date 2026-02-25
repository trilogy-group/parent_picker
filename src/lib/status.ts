export function statusBadge(overallColor: string | null | undefined) {
  if (overallColor === "GREEN") return { label: "Promising", className: "text-green-700", bgClassName: "bg-green-50" };
  if (overallColor === "YELLOW" || overallColor === "AMBER") return { label: "Viable", className: "text-amber-600", bgClassName: "bg-amber-50" };
  if (overallColor === "RED") return { label: "Needs Work", className: "text-red-600", bgClassName: "bg-red-50" };
  return null;
}

export function sizeTierLabel(sizeClassification: string | null | undefined): string | null {
  if (!sizeClassification) return null;
  const tiers: Record<string, string> = {
    micro: "Micro (25 students)",
    micro2: "Micro (50 students)",
    growth: "Growth (250 students)",
    "full size": "Flagship (1000 students)",
  };
  return tiers[sizeClassification.toLowerCase()] || sizeClassification;
}
