export function statusBadge(overallColor: string | null | undefined) {
  if (overallColor === "GREEN") return { label: "Promising", className: "text-green-700", bgClassName: "bg-green-50" };
  if (overallColor === "YELLOW" || overallColor === "AMBER") return { label: "Viable", className: "text-amber-600", bgClassName: "bg-amber-50" };
  if (overallColor === "RED") return { label: "Concerning", className: "text-red-600", bgClassName: "bg-red-50" };
  return null;
}

export function sizeTierLabel(sizeClassification: string | null | undefined): string | null {
  if (!sizeClassification) return null;
  const tiers: Record<string, string> = {
    micro: "Micro (25 students)",
    small: "Small (50 students)",
    medium: "Medium (100 students)",
    large: "Large (200 students)",
  };
  return tiers[sizeClassification.toLowerCase()] || sizeClassification;
}
