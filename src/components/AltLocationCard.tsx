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
} from "@/components/ui/dialog";
import { SignInPrompt } from "./SignInPrompt";
import NotHereReasonModal from "./NotHereReasonModal";

const LAUNCH_THRESHOLD = 30;

interface AltLocationCardProps {
  location: Location;
  voters: VoterInfo[];
  hasVotedIn: boolean;
  hasVotedNotHere: boolean;
  isAuthenticated: boolean;
  isSelected: boolean;
  distanceMi?: number | null;
  onSelect: () => void;
  onVoteIn: () => void;
  onVoteNotHere: (comment?: string) => void;
  onRemoveVote?: () => void;
}

export function AltLocationCard({
  location, voters, hasVotedIn, hasVotedNotHere,
  isAuthenticated, isSelected, distanceMi, onSelect, onVoteIn, onVoteNotHere, onRemoveVote,
}: AltLocationCardProps) {
  const [showSignIn, setShowSignIn] = useState(false);
  const [notHereModalOpen, setNotHereModalOpen] = useState(false);
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
    setNotHereModalOpen(true);
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
        {/* Name */}
        <h3 className="font-semibold text-[15px] leading-tight">
          {extractStreet(location.address, location.city)}
        </h3>

        {/* Status badge + distance */}
        {(badge || distanceMi != null) && (
          <div className="flex items-center gap-2 mt-1.5">
            {badge && (
              <span className={cn("text-xs font-medium", badge.className)}>
                &#10003; {badge.label}
              </span>
            )}
            {distanceMi != null && (
              <span className="text-xs text-gray-400">
                {distanceMi.toFixed(1)} mi from you
              </span>
            )}
          </div>
        )}

        {/* Avatar row + stats — only show if there are votes or concerns */}
        {(location.votes > 0 || location.notHereVotes > 0) && (
          <div className="flex items-center gap-2 mt-2">
            <AvatarRow voters={voters} />
            <span className="text-xs text-gray-600">
              {location.votes > 0 && (
                <>
                  <strong>{location.votes}</strong> in
                  {remaining > 0 && (
                    <> &middot; <span className="text-gray-400">{remaining} more to launch</span></>
                  )}
                </>
              )}
              {location.notHereVotes > 0 && (
                <>
                  {location.votes > 0 && <> &middot; </>}
                  <span className="text-amber-600">{location.notHereVotes} concern{location.notHereVotes !== 1 ? "s" : ""}</span>
                </>
              )}
            </span>
          </div>
        )}

        {/* Vote buttons */}
        <div className="flex gap-2 mt-3">
          {hasVotedIn ? (
            <div className="flex items-center gap-1.5 text-sm text-gray-700 font-medium py-2">
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
              You&apos;re in
              {onRemoveVote && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveVote(); }}
                  className="ml-2 text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  undo
                </button>
              )}
            </div>
          ) : hasVotedNotHere ? (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 font-medium py-2">
              Concern noted
              {onRemoveVote && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveVote(); }}
                  className="ml-2 text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  undo
                </button>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={handleVoteIn}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors bg-blue-600 text-white hover:bg-blue-700"
              >
                I&apos;d choose this location
              </button>
              <button
                onClick={handleVoteNotHere}
                className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Not for me
              </button>
            </>
          )}
        </div>
      </div>

      <Dialog open={showSignIn} onOpenChange={setShowSignIn}>
        <DialogContent className="sm:max-w-md">
          <SignInPrompt
            title="Sign in to vote"
            description="Enter your email to receive a magic link. No password needed."
          />
        </DialogContent>
      </Dialog>

      <NotHereReasonModal
        open={notHereModalOpen}
        onOpenChange={setNotHereModalOpen}
        locationName={location.name}
        onSubmit={(reason) => {
          onVoteNotHere(reason || undefined);
          setNotHereModalOpen(false);
        }}
      />
    </>
  );
}
