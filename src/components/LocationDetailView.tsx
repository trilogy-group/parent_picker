"use client";

import { useState, useEffect } from "react";
import { Location, VoterInfo } from "@/types";
import { statusBadge, sizeTierLabel } from "@/lib/status";
import { extractStreet } from "@/lib/address";
import { HelpModal } from "./HelpModal";
import { SignInPrompt } from "./SignInPrompt";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ArrowLeft, ExternalLink, ChevronLeft, ChevronRight, FileText, Plus, Minus, X } from "lucide-react";
import { useAuth } from "./AuthProvider";

const LAUNCH_THRESHOLD = 30;

interface Contribution {
  id: string;
  userId: string;
  displayName: string;
  comment: string;
  createdAt: string;
}

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
  onContributionSubmitted?: () => void;
  onUpdateVoteComment?: (comment: string) => void;
  distanceMi?: number | null;
  initialTab?: "in" | "concerns" | "other";
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
  onContributionSubmitted,
  onUpdateVoteComment,
  distanceMi,
  initialTab,
}: LocationDetailViewProps) {
  const [showSignIn, setShowSignIn] = useState(false);
  const [activeTab, setActiveTab] = useState<"in" | "concerns" | "other">(initialTab || "in");
  const [heroMode, setHeroMode] = useState<"photos" | "street" | "map">("map");
  const [streetViewAvailable, setStreetViewAvailable] = useState<boolean | null>(null);
  const [contribution, setContribution] = useState("");
  const [contributionSubmitted, setContributionSubmitted] = useState(false);
  const [contributionSubmitting, setContributionSubmitting] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [brochureUrl, setBrochureUrl] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [mapZoom, setMapZoom] = useState(15);
  // Inline vote comment
  const [voteComment, setVoteComment] = useState("");
  const [voteCommentSaving, setVoteCommentSaving] = useState(false);
  const [voteCommentSaved, setVoteCommentSaved] = useState(false);
  // Contributions
  const [contributions, setContributions] = useState<Contribution[]>([]);

  const { isAdmin } = useAuth();
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  // Fetch contributions for this location
  useEffect(() => {
    fetch(`/api/contributions?locationId=${location.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.contributions) setContributions(data.contributions);
      })
      .catch(() => {});
  }, [location.id]);

  // Fetch photos and brochure for proposed locations
  useEffect(() => {
    if (!location.proposed) return;
    setPhotos([]);
    setBrochureUrl(null);
    setPhotoIndex(0);
    fetch(`/api/locations/${location.id}/photos`)
      .then(res => res.json())
      .then(data => {
        if (data.photos?.length) {
          setPhotos(data.photos);
          setHeroMode("photos");
        }
        if (data.brochureUrl) setBrochureUrl(data.brochureUrl);
      })
      .catch(() => {});
  }, [location.id, location.proposed]);

  // Check if street view is available for this location
  useEffect(() => {
    if (!mapsKey) return;
    setStreetViewAvailable(null);
    setHeroMode("map");
    fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?location=${location.lat},${location.lng}&key=${mapsKey}`)
      .then(res => res.json())
      .then(data => {
        const available = data.status === "OK";
        setStreetViewAvailable(available);
        if (available) setHeroMode("street");
      })
      .catch(() => {
        setStreetViewAvailable(false);
        setHeroMode("map");
      });
  }, [location.id, location.lat, location.lng, mapsKey]);

  const badge = statusBadge(location.scores?.overallColor);
  const sizeLabel = sizeTierLabel(location.scores?.sizeClassification);
  const remaining = Math.max(0, LAUNCH_THRESHOLD - location.votes);

  const inVoters = voters.filter((v) => v.voteType === "in");
  const concernVoters = voters.filter((v) => v.voteType === "not_here");

  const handleVoteIn = () => {
    if (!isAuthenticated) { setShowSignIn(true); return; }
    onVoteIn();
  };

  const handleVoteNotHere = () => {
    if (!isAuthenticated) { setShowSignIn(true); return; }
    onVoteNotHere();
  };

  const handleSaveVoteComment = async () => {
    if (!voteComment.trim() || !onUpdateVoteComment) return;
    setVoteCommentSaving(true);
    onUpdateVoteComment(voteComment.trim());
    setVoteCommentSaving(false);
    setVoteCommentSaved(true);
    setTimeout(() => setVoteCommentSaved(false), 2000);
  };

  const handleContributionSubmit = async () => {
    if (!contribution.trim()) return;
    if (!isAuthenticated) { setShowSignIn(true); return; }
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
      const result = await res.json();
      setContribution("");
      onContributionSubmitted?.();
      // Append to local contributions list
      setContributions(prev => [...prev, {
        id: result.id,
        userId: session ? "self" : "",
        displayName: "You",
        comment: contribution.trim(),
        createdAt: result.created_at || new Date().toISOString(),
      }]);
      setContributionSubmitted(true);
      setTimeout(() => setContributionSubmitted(false), 2000);
    } catch (err) {
      console.error("Failed to submit contribution:", err);
    } finally {
      setContributionSubmitting(false);
    }
  };

  const handleDeleteContribution = async (id: string) => {
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    const res = await fetch(`/api/contributions?id=${id}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) {
      setContributions(prev => prev.filter(c => c.id !== id));
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
    return voter.email.split("@")[0];
  }

  function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
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

  // Inline vote comment textarea (shown after voting)
  const renderVoteComment = (placeholder: string) => (
    <div className="mt-3">
      {voteCommentSaved ? (
        <p className="text-sm text-green-600">Saved!</p>
      ) : (
        <>
          <textarea
            value={voteComment}
            onChange={(e) => setVoteComment(e.target.value)}
            placeholder={placeholder}
            className="w-full min-h-[60px] rounded-lg border border-blue-100 bg-white p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
          />
          {voteComment.trim() && (
            <button
              onClick={handleSaveVoteComment}
              disabled={voteCommentSaving}
              className="mt-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {voteCommentSaving ? "Saving..." : "Save"}
            </button>
          )}
        </>
      )}
    </div>
  );

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

        {/* 2. Hero image — photo carousel, street view, or map with toggle */}
        {(photos.length > 0 || mapsKey) ? (
          <div className={`w-full ${heroMode === "photos" ? "h-56" : "h-48"} bg-gray-100 relative overflow-hidden`}>
            {heroMode === "photos" ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photos[photoIndex]}
                  alt={`${extractStreet(location.address, location.city)} photo ${photoIndex + 1}`}
                  className="w-full h-full object-cover"
                />
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={() => setPhotoIndex((photoIndex - 1 + photos.length) % photos.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setPhotoIndex((photoIndex + 1) % photos.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {photos.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setPhotoIndex(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${i === photoIndex ? "bg-white" : "bg-white/50"}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroMode === "street"
                    ? `https://maps.googleapis.com/maps/api/streetview?size=800x300&location=${location.lat},${location.lng}&key=${mapsKey}`
                    : `https://maps.googleapis.com/maps/api/staticmap?center=${location.lat},${location.lng}&zoom=${mapZoom}&size=800x300&markers=color:blue%7C${location.lat},${location.lng}&key=${mapsKey}`
                  }
                  alt={heroMode === "street"
                    ? `Street view of ${extractStreet(location.address, location.city)}`
                    : `Map of ${extractStreet(location.address, location.city)}`
                  }
                  className="w-full h-full object-cover"
                />
                {heroMode === "map" && (
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <button
                      onClick={() => setMapZoom(z => Math.min(z + 1, 20))}
                      className="bg-white/90 backdrop-blur hover:bg-white shadow-sm rounded-md w-7 h-7 flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-4 h-4 text-gray-700" />
                    </button>
                    <button
                      onClick={() => setMapZoom(z => Math.max(z - 1, 5))}
                      className="bg-white/90 backdrop-blur hover:bg-white shadow-sm rounded-md w-7 h-7 flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-4 h-4 text-gray-700" />
                    </button>
                  </div>
                )}
              </>
            )}
            {/* Toggle button — always exactly 2 options: photos/street + map */}
            {mapsKey && (() => {
              const hasPhotos = photos.length > 0;
              const otherMode = hasPhotos ? "photos" : (streetViewAvailable ? "street" : null);
              if (!otherMode) return null;
              const showToggle = heroMode === "map" ? otherMode : "map";
              const label = showToggle === "photos" ? "Photos" : showToggle === "street" ? "Street View" : "Map";
              return (
                <button
                  onClick={() => setHeroMode(showToggle as "photos" | "street" | "map")}
                  className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2.5 py-1 rounded-md text-xs font-medium text-gray-700 hover:bg-white shadow-sm transition-colors"
                >
                  {label}
                </button>
              );
            })()}
            {location.proposed && (
              <span className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full">
                PROPOSED
              </span>
            )}
          </div>
        ) : null}

        <div className="px-4 pb-8">
          {/* 3. Location name + status badge + size tier */}
          <div className="mt-4">
            <h2 className="text-xl font-bold text-gray-900">
              {extractStreet(location.address, location.city)}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {location.address}, {location.city}, {location.state}
            </p>
            {(badge || sizeLabel) && (
              <div className="flex items-center gap-2 mt-2">
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
              </div>
            )}
            {distanceMi != null && (
              <div className="mt-1">
                <span className="text-xs text-gray-400">{distanceMi.toFixed(1)} mi from you</span>
              </div>
            )}
            {/* Red subscore breakdown */}
            {location.scores?.overallColor === "RED" && (() => {
              const issues: string[] = [];
              if (location.scores?.zoning?.color === "RED") issues.push("Zoning");
              if (location.scores?.price?.color === "RED") issues.push("Price");
              if (location.scores?.neighborhood?.color === "RED") issues.push("Neighborhood");
              if (location.scores?.building?.color === "RED") issues.push("Building");
              return issues.length > 0 ? (
                <p className="text-xs text-red-500 mt-1.5">
                  Issues: {issues.join(", ")}
                </p>
              ) : null;
            })()}
          </div>

          {/* Brochure link for proposed locations */}
          {brochureUrl && (
            <a
              href={brochureUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <FileText className="w-4 h-4" />
              View property brochure
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* Details link box */}
          {location.scores?.overallDetailsUrl && (
            <a
              href={location.scores.overallDetailsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-4 bg-blue-50 rounded-xl p-4 hover:bg-blue-100/60 transition-colors"
            >
              <p className="text-sm font-semibold text-blue-600 inline-flex items-center gap-1.5">
                View full location details <ExternalLink className="w-3.5 h-3.5" />
              </p>
              <p className="text-[13px] leading-snug text-gray-500 mt-0.5">Zoning info, neighborhood data, and more.</p>
            </a>
          )}

          {/* 4. Vote section */}
          <div className="mt-5">
            {hasVotedIn ? (
              /* Already voted in */
              <div className="bg-blue-50 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold tracking-widest text-blue-600">YOU&apos;RE IN</p>
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
                  <div className="w-full bg-blue-100 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (location.votes / LAUNCH_THRESHOLD) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-[15px] leading-snug text-gray-900 mt-2">
                    {location.votes} of {LAUNCH_THRESHOLD} families
                    {remaining > 0
                      ? ` \u2014 ${remaining} more to launch`
                      : " \u2014 ready to launch!"}
                  </p>
                </div>
                {renderVoteComment("Why this location? (optional)")}
              </div>
            ) : hasVotedNotHere ? (
              /* Already voted not here */
              <div className="bg-blue-50 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold tracking-widest text-blue-600">CONCERN NOTED</p>
                  {onRemoveVote && (
                    <button
                      onClick={onRemoveVote}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      undo
                    </button>
                  )}
                </div>
                {renderVoteComment("Tell us why (optional)")}
              </div>
            ) : (
              /* Not voted */
              <div className="bg-blue-50 rounded-xl p-5">
                <p className="text-[10px] font-semibold tracking-widest text-blue-600 mb-2">VOTE</p>
                <p className="text-[15px] leading-snug text-gray-900">
                  Picture your kid here.
                  {location.votes > 0
                    ? <> {location.votes} {location.votes === 1 ? "family is" : "families are"} in. At {LAUNCH_THRESHOLD}, Alpha moves forward and begins lease negotiation.</>
                    : <> At {LAUNCH_THRESHOLD} families, Alpha moves forward and begins lease negotiation.</>
                  }
                </p>
                {location.notHereVotes > 0 && (
                  <p className="text-sm text-amber-600 mt-1">
                    {location.notHereVotes} concern{location.notHereVotes !== 1 ? "s" : ""}
                  </p>
                )}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleVoteIn}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors bg-blue-600 text-white hover:bg-blue-700"
                  >
                    I&apos;d choose this location
                  </button>
                  <button
                    onClick={handleVoteNotHere}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors border border-gray-300 text-gray-700 hover:bg-white"
                  >
                    Not for me
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 5. Contribute — always visible */}
          <div className="mt-6 bg-blue-50 rounded-xl p-5">
            <p className="text-[10px] font-semibold tracking-widest text-blue-600 mb-2">CONTRIBUTE</p>
            <p className="text-[15px] leading-snug text-gray-900">Help us fill in the gaps.</p>
            {contributionSubmitted && (
              <p className="text-sm text-green-600 mt-2">
                Saved!
              </p>
            )}
            <textarea
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              placeholder="Know something about this area? Zoning issues, traffic, nearby schools..."
              className="w-full mt-3 min-h-[80px] rounded-lg border border-blue-100 bg-white p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
            />
            <button
              onClick={handleContributionSubmit}
              disabled={!contribution.trim() || contributionSubmitting}
              className="mt-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {contributionSubmitting ? "Saving..." : "Submit"}
            </button>
          </div>

          {/* 6. Help box — only when voted in */}
          {hasVotedIn && (
            <div className="mt-6 bg-blue-50 rounded-xl p-5">
              <p className="text-[10px] font-semibold tracking-widest text-blue-600 mb-2">GET INVOLVED</p>
              <p className="text-[15px] leading-snug text-gray-900">Want to dig in and help make this location happen? We&apos;ll send you a guide.</p>
              <div className="mt-3">
                <HelpModal
                  variant="card"
                  locationId={location.id}
                  locationName={location.name}
                  locationAddress={`${location.address}, ${location.city}, ${location.state}`}
                />
              </div>
            </div>
          )}

          {/* 7. Who's in / Concerns / Other tabs */}
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
              <button
                onClick={() => setActiveTab("other")}
                className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                  activeTab === "other"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Other ({contributions.length})
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
              ) : activeTab === "concerns" ? (
                concernVoters.length === 0 ? (
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
                )
              ) : (
                /* Other tab — contributions */
                contributions.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">
                    No contributions yet.
                  </p>
                ) : (
                  contributions.map((c, i) => (
                    <div key={c.id} className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-medium ${avatarColor(i)}`}
                      >
                        {c.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-700 font-medium">{c.displayName}</p>
                          <span className="text-xs text-gray-400">{timeAgo(c.createdAt)}</span>
                          {(c.displayName === "You" || isAdmin) && (
                            <button
                              onClick={() => handleDeleteContribution(c.id)}
                              className="ml-auto text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{c.comment}</p>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>

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
    </>
  );
}
