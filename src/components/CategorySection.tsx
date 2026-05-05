import type { Location, SiteCategory } from "@/types";

const CATEGORY_HEADERS: Record<SiteCategory, {
  label: string;
  borderClass: string;
  textClass: string;
}> = {
  parent: { label: "PARENT", borderClass: "border-emerald-600", textClass: "text-emerald-700" },
  ai: { label: "AI", borderClass: "border-blue-600", textClass: "text-blue-700" },
  short_term: { label: "SHORT-TERM", borderClass: "border-amber-600", textClass: "text-amber-700" },
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
      <div className="mb-2">
        <div className={`text-xs font-bold uppercase tracking-wider ${h.textClass}`}>
          {h.label} &middot; {locations.length}
        </div>
      </div>
      <div className="space-y-2">
        {locations.map(renderCard)}
      </div>
    </div>
  );
}
