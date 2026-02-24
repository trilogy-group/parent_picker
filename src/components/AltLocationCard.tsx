"use client";

import { useState } from "react";
import { Location, VoterInfo } from "@/types";
import { AvatarRow } from "./AvatarRow";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { extractStreet } from "@/lib/address";
import { statusBadge } from "@/lib/status";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SignInPrompt } from "./SignInPrompt";

const LAUNCH_THRESHOLD = 30;

interface AltLocationCardProps {
  location: Location;
  distance?: number;
  voters: VoterInfo[];
  hasVotedIn: boolean;
  hasVotedNotHere: boolean;
  isAuthenticated: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onVoteIn: () => void;
  onVoteNotHere: () => void;
}

export function AltLocationCard({
  location, distance, voters, hasVotedIn, hasVotedNotHere,
  isAuthenticated, isSelected, onSelect, onVoteIn, onVoteNotHere,
}: AltLocationCardProps) {
  const [showSignIn, setShowSignIn] = useState(false);
  const badge = statusBadge(location.scores?.overallColor);
  const remaining = Math.max(0, LAUNCH_THRESHOLD - location.votes);

  const handleVoteIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) { setShowSignIn(true); return; }
    onVoteIn();
  };

  const handleVoteNotHere = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) { setShowSignIn(true); return; }
    onVoteNotHere();
  };

  return (
    <>
      <div
        onClick={onSelect}
        className={cn(
          "border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md",
          isSelected ? "border-gray-900 shadow-md" : "border-gray-200",
        )}
      >
        {/* Name + distance */}
        <h3 className="font-semibold text-[15px] leading-tight">
          {extractStreet(location.address, location.city)}
        </h3>
        {distance != null && (
          <p className="text-xs text-gray-500 mt-0.5">{distance.toFixed(1)} mi from you</p>
        )}

        {/* Status badge */}
        {badge && (
          <p className={cn("text-xs font-medium mt-1.5", badge.className)}>
            &#10003; {badge.label}
          </p>
        )}

        {/* Avatar row + stats */}
        <div className="flex items-center gap-2 mt-2">
          <AvatarRow voters={voters} />
          <span className="text-xs text-gray-600">
            <strong>{location.votes}</strong> in
            {location.notHereVotes > 0 && (
              <> &middot; <span className="text-amber-600">{location.notHereVotes} concern{location.notHereVotes !== 1 ? "s" : ""}</span></>
            )}
            {remaining > 0 && (
              <> &middot; <span className="text-gray-400">{remaining} more to launch</span></>
            )}
          </span>
        </div>

        {/* Vote buttons */}
        <div className="flex gap-2 mt-3">
          {hasVotedIn ? (
            <div className="flex items-center gap-1.5 text-sm text-gray-700 font-medium py-2">
              <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
              You&apos;re in
            </div>
          ) : (
            <>
              <button
                onClick={handleVoteIn}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors bg-gray-900 text-white hover:bg-gray-800"
              >
                I&apos;m in
              </button>
              <button
                onClick={handleVoteNotHere}
                className={cn(
                  "px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border",
                  hasVotedNotHere
                    ? "border-gray-400 bg-gray-100 text-gray-500"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
              >
                Not here
              </button>
            </>
          )}
        </div>
      </div>

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
