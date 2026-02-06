"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SignInPrompt } from "./SignInPrompt";

interface VoteButtonProps {
  votes: number;
  hasVoted: boolean;
  isAuthenticated: boolean;
  onVote: () => void;
  onUnvote: () => void;
}

export function VoteButton({
  votes,
  hasVoted,
  isAuthenticated,
  onVote,
  onUnvote,
}: VoteButtonProps) {
  const [showSignIn, setShowSignIn] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isAuthenticated) {
      setShowSignIn(true);
      return;
    }

    if (hasVoted) {
      onUnvote();
    } else {
      onVote();
    }
  };

  return (
    <>
      <Button
        data-testid="vote-button"
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 px-2 h-8",
          hasVoted && "text-red-500 hover:text-red-600"
        )}
      >
        <Heart className={cn("h-4 w-4", hasVoted && "fill-current")} />
        <span className="text-sm font-medium">{votes}</span>
      </Button>

      <Dialog open={showSignIn} onOpenChange={setShowSignIn}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign In to Vote</DialogTitle>
            <DialogDescription>
              Sign in to vote for this location.
            </DialogDescription>
          </DialogHeader>
          <SignInPrompt
            title="Sign in to vote"
            description="Enter your email to receive a magic link. No password needed."
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
