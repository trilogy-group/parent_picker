"use client";

import { Location, VoterInfo } from "@/types";
import { AvatarRow } from "./AvatarRow";
import { cn } from "@/lib/utils";
import { extractStreet } from "@/lib/address";
import { statusBadge } from "@/lib/status";

const LAUNCH_THRESHOLD = 30;

interface AltLocationCardProps {
  location: Location;
  voters: VoterInfo[];
  isSelected: boolean;
  isProposed?: boolean;
  distanceMi?: number | null;
  onSelect: () => void;
}

export function AltLocationCard({
  location, voters, isSelected, isProposed, distanceMi, onSelect,
}: AltLocationCardProps) {
  const badge = statusBadge(location.scores?.overallColor);
  const remaining = Math.max(0, LAUNCH_THRESHOLD - location.votes);

  return (
    <div
      onClick={onSelect}
      className={cn(
        "border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md",
        isProposed
          ? "border-2 border-indigo-300 bg-indigo-50/30"
          : isSelected ? "border-gray-900 shadow-md" : "border-gray-200",
      )}
    >
      {/* Proposed badge */}
      {isProposed && (
        <span className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase block mb-1">Proposed</span>
      )}

      {/* Name */}
      <h3 className="font-semibold text-[15px] leading-tight">
        {extractStreet(location.address, location.city)}
      </h3>

      {/* Status badge + distance */}
      {(badge || distanceMi != null) && (
        <div className="flex items-center justify-between mt-1.5">
          {badge && (
            <span className={cn("text-xs font-medium", badge.className)}>
              &#10003; {badge.label}
            </span>
          )}
          {distanceMi != null && (
            <span className="text-xs text-gray-400 ml-auto">
              {distanceMi.toFixed(1)} mi from you
            </span>
          )}
        </div>
      )}

      {/* Proposed one-liner */}
      {isProposed && (
        <p className="text-[12px] text-gray-500 mt-1 leading-snug">
          We&rsquo;re pursuing this &mdash; your vote helps finalize
        </p>
      )}

      {/* Avatar row */}
      {voters.length > 0 && (
        <div className="mt-2">
          <AvatarRow voters={voters} />
        </div>
      )}

      {/* Progress bar + concerns */}
      {(location.votes > 0 || location.notHereVotes > 0) && (
        <div className="mt-2">
          {location.votes > 0 && (() => {
            const pct = Math.min(100, (location.votes / LAUNCH_THRESHOLD) * 100);
            const label = <>{location.votes} in &middot; {remaining} to go</>;
            return (
              <div className="w-full bg-gray-100 rounded-full h-5 relative overflow-hidden">
                <div
                  className="bg-blue-600 h-5 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
                {/* Dark text on gray background */}
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-gray-700">
                  {label}
                </span>
                {/* White text clipped to blue fill */}
                <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
                  <span
                    className="flex items-center justify-center text-[11px] font-medium text-white h-full whitespace-nowrap"
                    style={{ width: `${10000 / pct}%` }}
                  >
                    {label}
                  </span>
                </div>
              </div>
            );
          })()}
          {location.notHereVotes > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              {location.notHereVotes} concern{location.notHereVotes !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
