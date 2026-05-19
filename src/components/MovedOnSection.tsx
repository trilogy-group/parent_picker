import type { Location } from "@/types";

export function MovedOnSection({ location }: { location: Location }) {
  const reason = location.derived?.movedOnReason ?? "Moved on";
  return (
    <div className="px-4 py-3 bg-stone-50 border-l-4 border-stone-400 rounded">
      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
        We moved on from this site
      </h3>
      <p className="text-sm text-stone-700">{reason}</p>
      <p className="text-xs text-stone-500 mt-2 italic">
        Check the Plan of Record for the metro to see what we&apos;re pursuing now.
      </p>
    </div>
  );
}
