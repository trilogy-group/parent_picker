"use client";

import { Card } from "@/components/ui/card";
import { VoteButton } from "./VoteButton";
import { HelpModal } from "./HelpModal";
import { SizeLabel, ScoreDetails, overallCardBg, overallCardBorder } from "./ScoreBadge";
import { Location } from "@/types";
import { cn } from "@/lib/utils";
import { extractStreet } from "@/lib/address";

interface LocationCardProps {
  location: Location;
  isSelected: boolean;
  hasVoted: boolean;
  isAuthenticated: boolean;
  onSelect: () => void;
  onVote: (comment?: string) => void;
  onUnvote: () => void;
}

export function LocationCard({
  location,
  isSelected,
  hasVoted,
  isAuthenticated,
  onSelect,
  onVote,
  onUnvote,
}: LocationCardProps) {
  const color = location.scores?.overallColor;
  const borderClass = color ? overallCardBorder[color] || "" : "";
  const selectedBg = color ? overallCardBg[color] || "" : "";

  return (
    <Card
      data-testid="location-card"
      onClick={onSelect}
      className={cn(
        "px-2 py-2 gap-1 cursor-pointer transition-all hover:shadow-md relative border-[3px]",
        borderClass,
        isSelected && cn("shadow-md", selectedBg),
        !isSelected && !location.suggested && "bg-white",
        location.suggested && "border-dashed border-amber-400",
      )}
    >
      {/* Row 1: Street Address + Size + Vote */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-sm truncate flex-1 min-w-0">
          {extractStreet(location.address, location.city)}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          <SizeLabel scores={location.scores} />
          <VoteButton
            votes={location.votes}
            hasVoted={hasVoted}
            isAuthenticated={isAuthenticated}
            onVote={onVote}
            onUnvote={onUnvote}
          />
        </div>
      </div>

      {location.suggested && (
        <span className="inline-block text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full">
          Parent Suggested
        </span>
      )}

      {/* Row 2: Sub-scores with info + legend */}
      <ScoreDetails scores={location.scores} />

      {/* Row 3: I can help */}
      <div className="flex items-center justify-between pt-0.5">
        <HelpModal
          variant="card"
          locationName={location.name}
          locationAddress={`${location.address}, ${location.city}, ${location.state}`}
        />
      </div>
    </Card>
  );
}
