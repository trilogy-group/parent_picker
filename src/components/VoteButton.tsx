"use client";

import { useState, useRef } from "react";
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

  const handleSubmitVote = (e?: React.FormEvent) => {
    e?.preventDefault();
    onVote(comment.trim() || undefined);
    setShowComment(false);
    setComment("");
  };

  const handleSkip = () => {
    onVote();
    setShowComment(false);
    setComment("");
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

      {/* Comment popover on vote */}
      <Dialog open={showComment} onOpenChange={(open) => { if (!open) handleSkip(); }}>
        <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Heart className="h-4 w-4 text-red-500 fill-red-500" />
              Vote for this location
            </DialogTitle>
            <DialogDescription>
              Want to tell us why you like this spot? (Optional)
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitVote} className="space-y-3 mt-1">
            <textarea
              ref={textareaRef}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. &quot;I drive past this every day — great location!&quot;"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={2}
              maxLength={500}
            />
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground">
                {comment.length}/500
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={handleSkip}>
                  Just vote
                </Button>
                <Button type="submit" size="sm">
                  <Heart className="h-3.5 w-3.5 mr-1 fill-current" />
                  Vote{comment.trim() ? " with comment" : ""}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sign-in dialog */}
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
