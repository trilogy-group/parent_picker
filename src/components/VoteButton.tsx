"use client";

import { useState, useRef, useEffect } from "react";
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
  onVote: (comment?: string) => void;
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
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (showComment && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showComment]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isAuthenticated) {
      setShowSignIn(true);
      return;
    }

    if (hasVoted) {
      onUnvote();
    } else {
      setShowComment(true);
    }
  };

  const handleSkip = () => {
    setShowComment(false);
    setComment("");
    onVote();
  };

  const handleVoteWithComment = () => {
    setShowComment(false);
    const trimmed = comment.trim();
    setComment("");
    onVote(trimmed || undefined);
  };

  return (
    <>
      <Button
        data-testid="vote-button"
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 px-2 h-8 min-h-[44px] lg:min-h-0",
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

      <Dialog open={showComment} onOpenChange={(open) => { if (!open) handleSkip(); }}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Vote for this location</DialogTitle>
            <DialogDescription>
              Want to tell us why you like this spot? (optional)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                placeholder="e.g. Close to my home, great neighborhood..."
                rows={2}
                maxLength={500}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
              <span className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">
                {comment.length}/500
              </span>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleSkip}>
                Just vote
              </Button>
              <Button size="sm" onClick={handleVoteWithComment}>
                Vote with comment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
