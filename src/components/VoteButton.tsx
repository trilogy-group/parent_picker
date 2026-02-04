"use client";

import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoteButtonProps {
  votes: number;
  hasVoted: boolean;
  onVote: () => void;
  onUnvote: () => void;
}

export function VoteButton({ votes, hasVoted, onVote, onUnvote }: VoteButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        if (hasVoted) {
          onUnvote();
        } else {
          onVote();
        }
      }}
      className={cn(
        "flex items-center gap-1.5 px-2 h-8",
        hasVoted && "text-red-500 hover:text-red-600"
      )}
    >
      <Heart
        className={cn("h-4 w-4", hasVoted && "fill-current")}
      />
      <span className="text-sm font-medium">{votes}</span>
    </Button>
  );
}
