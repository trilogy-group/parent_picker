"use client";

import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { VoteButton } from "./VoteButton";
import { Location } from "@/types";
import { cn } from "@/lib/utils";

interface LocationCardProps {
  location: Location;
  isSelected: boolean;
  hasVoted: boolean;
  onSelect: () => void;
  onVote: () => void;
  onUnvote: () => void;
}

export function LocationCard({
  location,
  isSelected,
  hasVoted,
  onSelect,
  onVote,
  onUnvote,
}: LocationCardProps) {
  return (
    <Card
      onClick={onSelect}
      className={cn(
        "p-4 cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary shadow-md",
        location.suggested && "border-dashed border-amber-400"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{location.name}</h3>
          <div className="flex items-center gap-1 mt-1 text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="text-xs truncate">{location.address}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {location.city}, {location.state}
          </p>
          {location.suggested && (
            <span className="inline-block mt-1.5 text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
              Parent Suggested
            </span>
          )}
        </div>
        <VoteButton
          votes={location.votes}
          hasVoted={hasVoted}
          onVote={onVote}
          onUnvote={onUnvote}
        />
      </div>
    </Card>
  );
}
