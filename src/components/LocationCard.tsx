"use client";

import { Card } from "@/components/ui/card";
import { VoteButton } from "./VoteButton";
import { HelpModal } from "./HelpModal";
import { ScoreDetails, DetailedInfoLink, SizeLabel, overallCardBg, overallCardBorder } from "./ScoreBadge";
import { Location } from "@/types";
import { cn } from "@/lib/utils";
import { extractStreet } from "@/lib/address";

interface LocationCardProps {
  location: Location;
  rank?: number;
  cardVersion?: "v1" | "v2";
  isSelected: boolean;
  hasVoted: boolean;
  isAuthenticated: boolean;
  onSelect: () => void;
  onVote: (comment?: string) => void;
  onUnvote: () => void;
}

function CardContentV1({ location, rank, hasVoted, isAuthenticated, onVote, onUnvote }: {
  location: Location; rank?: number; hasVoted: boolean; isAuthenticated: boolean;
  onVote: (comment?: string) => void; onUnvote: () => void;
}) {
  return (
    <>
      {/* Row 1: Rank + Street Address + Vote */}
      <div className="flex items-center justify-between gap-2">
        {rank != null && (
          <span className="text-sm font-bold text-gray-800 w-7 shrink-0">#{rank}</span>
        )}
        <h3 className="font-semibold text-sm truncate flex-1 min-w-0">
          {extractStreet(location.address, location.city)}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
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

      {/* Row 2: Size | I can help | Detailed Info */}
      <div className="flex items-center justify-between">
        <SizeLabel scores={location.scores} />
        <HelpModal
          variant="card-compact"
          locationId={location.id}
          locationName={location.name}
          locationAddress={`${location.address}, ${location.city}, ${location.state}`}
        />
        <DetailedInfoLink scores={location.scores} />
      </div>
    </>
  );
}

function CardContentV2({ location, rank, hasVoted, isAuthenticated, onVote, onUnvote }: {
  location: Location; rank?: number; hasVoted: boolean; isAuthenticated: boolean;
  onVote: (comment?: string) => void; onUnvote: () => void;
}) {
  return (
    <>
      {/* Row 1: Rank + Street Address + Vote */}
      <div className="flex items-center justify-between gap-2">
        {rank != null && (
          <span className="text-sm font-bold text-gray-800 w-7 shrink-0">#{rank}</span>
        )}
        <h3 className="font-semibold text-sm truncate flex-1 min-w-0">
          {extractStreet(location.address, location.city)}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
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

      {/* Row 3: I can help + Detailed Info */}
      <div className="flex items-center justify-between pt-0.5">
        <HelpModal
          variant="card"
          locationId={location.id}
          locationName={location.name}
          locationAddress={`${location.address}, ${location.city}, ${location.state}`}
        />
        <DetailedInfoLink scores={location.scores} />
      </div>
    </>
  );
}

export function LocationCard({
  location,
  rank,
  cardVersion = "v1",
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

  const Content = cardVersion === "v2" ? CardContentV2 : CardContentV1;

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
      <Content
        location={location}
        rank={rank}
        hasVoted={hasVoted}
        isAuthenticated={isAuthenticated}
        onVote={onVote}
        onUnvote={onUnvote}
      />
    </Card>
  );
}
