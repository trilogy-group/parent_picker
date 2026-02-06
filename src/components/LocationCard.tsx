"use client";

import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { VoteButton } from "./VoteButton";
import { OverallBadge, ScoreDetails } from "./ScoreBadge";
import { Location } from "@/types";
import { cn } from "@/lib/utils";

interface LocationCardProps {
  location: Location;
  isSelected: boolean;
  hasVoted: boolean;
  isAuthenticated: boolean;
  isInViewport: boolean;
  onSelect: () => void;
  onVote: () => void;
  onUnvote: () => void;
}

export function LocationCard({
  location,
  isSelected,
  hasVoted,
  isAuthenticated,
  isInViewport,
  onSelect,
  onVote,
  onUnvote,
}: LocationCardProps) {
  return (
    <Card
      data-testid="location-card"
      onClick={onSelect}
      className={cn(
        "p-3 cursor-pointer transition-all hover:shadow-md relative",
        isSelected && "ring-2 ring-primary shadow-md",
        location.suggested && "border-dashed border-amber-400",
        isInViewport ? "border-l-4 border-l-blue-500" : "border-l-4 border-l-gray-200"
      )}
    >
      {/* Row 1: Name + Overall Badge + Vote */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-sm truncate flex-1 min-w-0">{location.name}</h3>
        <div className="flex items-center gap-1 shrink-0">
          <OverallBadge scores={location.scores} />
          <VoteButton
            votes={location.votes}
            hasVoted={hasVoted}
            isAuthenticated={isAuthenticated}
            onVote={onVote}
            onUnvote={onUnvote}
          />
        </div>
      </div>

      {/* Row 2: Address */}
      <div className="flex items-center gap-1 mt-0.5 text-muted-foreground">
        <MapPin className="h-3 w-3 flex-shrink-0" />
        <span className="text-xs truncate">{location.address}, {location.city}, {location.state}</span>
      </div>

      {location.suggested && (
        <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
          Parent Suggested
        </span>
      )}

      {/* Row 3: Expandable sub-scores */}
      <ScoreDetails scores={location.scores} />
    </Card>
  );
}
