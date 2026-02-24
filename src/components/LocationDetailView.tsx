"use client";

import { useState } from "react";
import { Location, VoterInfo } from "@/types";
import { statusBadge, sizeTierLabel } from "@/lib/status";
import { extractStreet } from "@/lib/address";
import NotHereReasonModal from "./NotHereReasonModal";
import { ArrowLeft, ExternalLink } from "lucide-react";

const LAUNCH_THRESHOLD = 30;

interface LocationDetailViewProps {
  location: Location;
  voters: VoterInfo[];
  hasVotedIn: boolean;
  hasVotedNotHere: boolean;
  isAuthenticated: boolean;
  session?: { access_token: string } | null;
  onBack: () => void;
  onVoteIn: () => void;
  onVoteNotHere: (comment?: string) => void;
  onRemoveVote?: () => void;
}

export default function LocationDetailView({
  location,
  voters,
  hasVotedIn,
  hasVotedNotHere,
  isAuthenticated,
  session,
  onBack,
  onVoteIn,
  onVoteNotHere,
  onRemoveVote,
}: LocationDetailViewProps) {
  const [notHereModalOpen, setNotHereModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"in" | "concerns">("in");
  const [contribution, setContribution] = useState("");
  const [contributionSubmitted, setContributionSubmitted] = useState(false);
  const [contributionSubmitting, setContributionSubmitting] = useState(false);

  const badge = statusBadge(location.scores?.overallColor);
  const sizeLabel = sizeTierLabel(location.scores?.sizeClassification);
  const remaining = Math.max(0, LAUNCH_THRESHOLD - location.votes);
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  const inVoters = voters.filter((v) => v.voteType === "in");
  const concernVoters = voters.filter((v) => v.voteType === "not_here");

  const handleVoteIn = () => {
    onVoteIn();
  };

  const handleVoteNotHere = () => {
    setNotHereModalOpen(true);
  };

  const handleContributionSubmit = async () => {
    if (!contribution.trim()) return;
    setContributionSubmitting(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const res = await fetch("/api/contributions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          locationId: location.id,
          comment: contribution.trim(),
        }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setContributionSubmitted(true);
      setContribution("");
    } catch (err) {
      console.error("Failed to submit contribution:", err);
    } finally {
      setContributionSubmitting(false);
    }
  };

  function getInitial(voter: VoterInfo): string {
    if (voter.displayName) {
      return voter.displayName.charAt(0).toUpperCase();
    }
    return voter.email.charAt(0).toUpperCase();
  }

  function getDisplayName(voter: VoterInfo): string {
    if (voter.displayName) return voter.displayName;
    // Show email prefix (before @) as fallback
    return voter.email.split("@")[0];
  }

  const AVATAR_COLORS = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-rose-500",
  ];

  function avatarColor(index: number): string {
    return AVATAR_COLORS[index % AVATAR_COLORS.length];
  }

  return (
    <>
      <div className="h-full overflow-y-auto bg-white">
        {/* 1. Back arrow */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 pt-4 pb-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to locations
        </button>

        {/* 2. Street View hero image */}
        {mapsKey && (
          <div className="w-full h-48 bg-gray-100 relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://maps.googleapis.com/maps/api/streetview?size=800x300&location=${location.lat},${location.lng}&key=${mapsKey}`}
              alt={`Street view of ${extractStreet(location.address, location.city)}`}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="px-4 pb-8">
          {/* 3. Location name + status badge + size tier */}
          <div className="mt-4">
            <h2 className="text-xl font-bold text-gray-900">
              {extractStreet(location.address, location.city)}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {location.address}, {location.city}, {location.state}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {badge && (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bgClassName} ${badge.className}`}
                >
                  {badge.label}
                </span>
              )}
              {sizeLabel && (
                <span className="text-xs text-gray-500">{sizeLabel}</span>
              )}
              {location.scores?.overallDetailsUrl && (
                <a
                  href={location.scores.overallDetailsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  Details <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* 4. Vote section */}
          <div className="mt-5">
            {hasVotedIn ? (
              /* Already voted in */
              <div className="bg-gray-50 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    You&apos;re in!
                  </h3>
                  {onRemoveVote && (
                    <button
                      onClick={onRemoveVote}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      undo
                    </button>
                  )}
                </div>
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (location.votes / LAUNCH_THRESHOLD) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {location.votes} of {LAUNCH_THRESHOLD} families
                    {remaining > 0
                      ? ` \u2014 ${remaining} more to launch`
                      : " \u2014 ready to launch!"}
                  </p>
                </div>
              </div>
            ) : hasVotedNotHere ? (
              /* Already voted not here */
              <div className="bg-gray-50 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-medium text-gray-600">
                    Concern noted
                  </h3>
                  {onRemoveVote && (
                    <button
                      onClick={onRemoveVote}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      undo
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Not voted */
              <div className="bg-blue-50 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-gray-900">
                  Picture your kid here.
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {location.votes > 0 ? (
                    <>{location.votes} {location.votes === 1 ? "family is" : "families are"} in. </>
                  ) : null}
                  At {LAUNCH_THRESHOLD}, Alpha moves forward and begins lease negotiation.
                </p>
                {location.notHereVotes > 0 && (
                  <p className="text-sm text-amber-600 mt-1">
                    {location.notHereVotes} concern{location.notHereVotes !== 1 ? "s" : ""}
                  </p>
                )}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleVoteIn}
                    disabled={!isAuthenticated}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    I&apos;m in
                  </button>
                  <button
                    onClick={handleVoteNotHere}
                    disabled={!isAuthenticated}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors border border-gray-300 text-gray-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Not here
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 5. Help us fill in the gaps */}
          <div className="mt-6">
            <h3 className="text-base font-semibold text-gray-900">
              Help us fill in the gaps
            </h3>
            {contributionSubmitted ? (
              <p className="text-sm text-green-600 mt-2">
                Thanks for sharing!
              </p>
            ) : (
              <>
                <textarea
                  value={contribution}
                  onChange={(e) => setContribution(e.target.value)}
                  placeholder="Know something about this area? Zoning issues, traffic, nearby schools..."
                  className="w-full mt-2 min-h-[80px] rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                />
                <button
                  onClick={handleContributionSubmit}
                  disabled={!contribution.trim() || contributionSubmitting}
                  className="mt-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {contributionSubmitting ? "Submitting..." : "Submit"}
                </button>
              </>
            )}
          </div>

          {/* 6. Who's in / Concerns tabs */}
          <div className="mt-6">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab("in")}
                className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                  activeTab === "in"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Who&apos;s in ({inVoters.length})
              </button>
              <button
                onClick={() => setActiveTab("concerns")}
                className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                  activeTab === "concerns"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Concerns ({concernVoters.length})
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {activeTab === "in" ? (
                inVoters.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">
                    No one yet.
                  </p>
                ) : (
                  inVoters.map((voter, i) => (
                    <div key={voter.userId} className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-medium ${avatarColor(i)}`}
                      >
                        {getInitial(voter)}
                      </div>
                      <div>
                        <p className="text-sm text-gray-700">
                          {getDisplayName(voter)}
                        </p>
                        {voter.comment && (
                          <p className="text-xs text-gray-500 mt-0.5">{voter.comment}</p>
                        )}
                      </div>
                    </div>
                  ))
                )
              ) : concernVoters.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">
                  No one yet.
                </p>
              ) : (
                concernVoters.map((voter, i) => (
                  <div key={voter.userId} className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-medium ${avatarColor(i)}`}
                    >
                      {getInitial(voter)}
                    </div>
                    <div>
                      <p className="text-sm text-gray-700">
                        {getDisplayName(voter)}
                      </p>
                      {voter.comment && (
                        <p className="text-xs text-gray-500 mt-0.5">{voter.comment}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* What Alpha Feels Like */}
          <div className="mt-6 bg-gray-900 rounded-xl p-5 text-white">
            <p className="text-[10px] font-semibold tracking-widest text-gray-400 mb-2">
              WHAT ALPHA FEELS LIKE
            </p>
            <p className="text-[15px] leading-snug">
              Two hours of focused academics. Then the rest of the day building real things &mdash; businesses, robots, films, friendships.
            </p>
            <div className="flex gap-3 mt-4">
              <div className="flex-1 bg-gray-800 rounded-lg p-3">
                <p className="text-lg font-bold">2 hrs</p>
                <p className="text-[10px] text-gray-400">AI-powered academics</p>
              </div>
              <div className="flex-1 bg-gray-800 rounded-lg p-3">
                <p className="text-lg font-bold">2&times;</p>
                <p className="text-[10px] text-gray-400">the learning, measured</p>
              </div>
              <div className="flex-1 bg-gray-800 rounded-lg p-3">
                <p className="text-lg font-bold">100%</p>
                <p className="text-[10px] text-gray-400">of kids say they love school</p>
              </div>
            </div>
          </div>

          {/* Know a space that's not here? */}
          <a
            href="/suggest"
            className="mt-4 mb-2 block bg-gray-50 rounded-xl p-5 text-center hover:bg-gray-100 transition-colors"
          >
            <p className="font-semibold text-gray-900">Know a space that&apos;s not here?</p>
            <p className="text-sm text-gray-500 mt-1">We&apos;ll evaluate it within 24 hours.</p>
          </a>
        </div>
      </div>

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
