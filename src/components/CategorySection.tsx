import type { Location, SiteCategory } from "@/types";

const CATEGORY_HEADERS: Record<SiteCategory, {
  label: string;
  subtitle: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
}> = {
  parent: {
    label: "PARENT",
    subtitle: "championed",
    borderClass: "border-emerald-600",
    bgClass: "bg-emerald-50",
    textClass: "text-emerald-700",
  },
  ai: {
    label: "AI",
    subtitle: "primary path",
    borderClass: "border-blue-600",
    bgClass: "bg-blue-50",
    textClass: "text-blue-700",
  },
  short_term: {
    label: "SHORT-TERM",
    subtitle: "bridge",
    borderClass: "border-amber-600",
    bgClass: "bg-amber-50",
    textClass: "text-amber-700",
  },
};

export function CategorySection({
  category,
  locations,
  renderCard,
}: {
  category: SiteCategory;
  locations: Location[];
  renderCard: (loc: Location) => React.ReactNode;
}) {
  if (locations.length === 0) return null;
  const h = CATEGORY_HEADERS[category];
  return (
    <div className={`mx-4 mb-3 p-3 bg-white border ${h.borderClass} border-l-4 rounded`}>
      <div className="flex justify-between items-baseline mb-2">
        <div className={`text-xs font-bold uppercase tracking-wider ${h.textClass}`}>
          {h.label} &middot; {locations.length}
        </div>
        <div className="text-xs text-stone-500">{h.subtitle}</div>
      </div>
      <div className="space-y-2">
        {locations.map(renderCard)}
      </div>
    </div>
  );
}
