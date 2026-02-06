"use client";

import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { VoteButton } from "./VoteButton";
import { ArtifactLink, SizeLabel, ScoreDetails, overallCardBg } from "./ScoreBadge";
import { Location } from "@/types";
import { cn } from "@/lib/utils";

interface LocationCardProps {
  location: Location;
  isSelected: boolean;
  hasVoted: boolean;
  isAuthenticated: boolean;
  onSelect: () => void;
  onVote: () => void;
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
  const cardBg = location.scores?.overallColor
    ? overallCardBg[location.scores.overallColor] || ""
    : "";

  return (
    <Card
      data-testid="location-card"
      onClick={onSelect}
      className={cn(
        "px-2 py-1.5 gap-0 cursor-pointer transition-all hover:shadow-md relative",
        cardBg,
        isSelected && "ring-2 ring-primary shadow-md",
        location.suggested && "border-dashed border-amber-400",
      )}
    >
      {/* Row 1: Name + Size + Artifact Link + Vote */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-sm truncate flex-1 min-w-0">{location.name}</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          <SizeLabel scores={location.scores} />
          <ArtifactLink scores={location.scores} />
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
      <div className="flex items-center gap-1 text-muted-foreground">
        <MapPin className="h-3 w-3 flex-shrink-0" />
        <span className="text-xs truncate">{location.address}, {location.city}, {location.state}</span>
      </div>

      {location.suggested && (
        <span className="inline-block text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full">
          Parent Suggested
        </span>
      )}

      {/* Row 3: Sub-scores */}
      <ScoreDetails scores={location.scores} />
    </Card>
  );
}
