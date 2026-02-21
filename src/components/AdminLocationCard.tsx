"use client";

import { useState } from "react";
import { MapPin, User, Calendar, Check, X, Loader2, Mail, Eye, EyeOff, Heart, Send, RefreshCw, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "./ScoreBadge";
import { AdminLocation, LikedLocation, LocationScores } from "@/types";
import { parseSchoolType } from "@/lib/school-types";

interface AdminLocationCardProps {
  location: AdminLocation | LikedLocation;
  token: string;
  onRemove: (id: string) => void;
  mode?: "suggestion" | "like";
}

function generateApprovalHtml(loc: AdminLocation, scores?: LocationScores): string {
  const artifactLink = scores?.overallDetailsUrl
    ? `<p><a href="${scores.overallDetailsUrl}">View Summary Report</a></p>`
    : "";
  return `
    <h2>Great news!</h2>
    <p>Your suggested location <strong>${loc.name}</strong> at ${loc.address}, ${loc.city}, ${loc.state} has been evaluated and is now live on the Parent Picker map.</p>
    ${artifactLink}
    <p><a href="https://parentpicker.vercel.app">View on Parent Picker</a></p>
    <p>Share the link with other parents to rally votes for this location!</p>
  `;
}

function generateRejectionHtml(loc: AdminLocation): string {
  return `
    <h2>Thank you for your suggestion</h2>
    <p>We reviewed <strong>${loc.name}</strong> at ${loc.address}, ${loc.city}, ${loc.state} but unfortunately it doesn't meet our current criteria for a micro school location.</p>
    <p>We appreciate your help in finding great locations! Feel free to suggest other spots you think would work well.</p>
    <p><a href="https://parentpicker.vercel.app">Suggest another location</a></p>
  `;
}

function generateVoterUpdateHtml(loc: AdminLocation | LikedLocation, scores?: LocationScores): string {
  const artifactLink = scores?.overallDetailsUrl
    ? `<p><a href="${scores.overallDetailsUrl}">View Summary Report</a></p>`
    : "";
  return `
    <h2>Location Update</h2>
    <p>The location you liked at <strong>${loc.address}</strong>, ${loc.city}, ${loc.state} has been evaluated.</p>
    ${artifactLink}
    <p><a href="https://parentpicker.vercel.app">View on Parent Picker</a></p>
    <p>Share the link with other parents to rally votes for this location!</p>
  `;
}

export function AdminLocationCard({ location, token, onRemove, mode = "suggestion" }: AdminLocationCardProps) {
  const isLikeMode = mode === "like";
  const likedLocation = isLikeMode ? (location as LikedLocation) : null;

  const scores = location.scores;
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailPreview, setEmailPreview] = useState<"approve" | "reject" | "liker" | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [sent, setSent] = useState(false);

  const hasScores = !!scores;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Build email HTML based on mode
  const approvalHtml = generateApprovalHtml(location, scores);
  const rejectionHtml = generateRejectionHtml(location);
  const voterHtml = generateVoterUpdateHtml(location, scores);

  const handlePreviewEmail = () => {
    setEmailPreview(isLikeMode ? "liker" : "approve");
    setShowPreview(true);
  };

  const handleApprove = async (e: React.MouseEvent) => {
    e.preventDefault();
    setApproving(true);
    try {
      const res = await fetch(`/api/admin/locations/${location.id}/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          emailHtml: approvalHtml,
          emailSubject: "Your suggested location is now live!",
        }),
      });
      if (res.ok) {
        onRemove(location.id);
      } else {
        const data = await res.json().catch(() => ({}));
        console.error("Approve failed:", data);
      }
    } catch (err) {
      console.error("Approve error:", err);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (e: React.MouseEvent) => {
    e.preventDefault();
    setRejecting(true);
    try {
      const res = await fetch(`/api/admin/locations/${location.id}/reject`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          emailHtml: rejectionHtml,
          emailSubject: "Update on your suggested location",
        }),
      });
      if (res.ok) {
        onRemove(location.id);
      } else {
        const data = await res.json().catch(() => ({}));
        console.error("Reject failed:", data);
      }
    } catch (err) {
      console.error("Reject error:", err);
    } finally {
      setRejecting(false);
    }
  };

  const handleNotifyVoters = async () => {
    if (!likedLocation) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/locations/${location.id}/notify-voters`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          emailHtml: voterHtml,
          emailSubject: "Update on a location you liked",
          voterEmails: likedLocation.voter_emails,
        }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        console.error("Notify failed:", data);
      }
    } catch (err) {
      console.error("Notify error:", err);
    } finally {
      setSending(false);
    }
  };

  const createdDate = new Date(location.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const currentPreviewHtml = isLikeMode
    ? voterHtml
    : emailPreview === "reject"
    ? rejectionHtml
    : approvalHtml;

  const previewLabel = isLikeMode
    ? "Voter Update"
    : emailPreview === "approve"
    ? "Approval"
    : "Rejection";

  return (
    <Card className="p-0">
      <CardContent className="p-5 space-y-3">
        {/* Location info */}
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base">{location.name}</h3>
            {isLikeMode && likedLocation && (
              <span className="flex items-center gap-1 text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-medium">
                <Heart className="h-3 w-3" />
                {likedLocation.vote_count} vote{likedLocation.vote_count !== 1 ? "s" : ""}
              </span>
            )}
            {scores?.overallDetailsUrl && (
              <a
                href={scores.overallDetailsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-blue-600"
                title="View summary report"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-1 mt-1 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-sm">{location.address}, {location.city}, {location.state}</span>
          </div>
        </div>

        {/* Suggestor info (suggestion mode) or voter info (like mode) */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {!isLikeMode && location.suggestor_email && (
            <div className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              <span>{location.suggestor_email}</span>
            </div>
          )}
          {isLikeMode && likedLocation && likedLocation.voter_emails.length > 0 && (
            <div className="flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" />
              <span>{likedLocation.voter_emails.length} voter{likedLocation.voter_emails.length !== 1 ? "s" : ""}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{createdDate}</span>
          </div>
        </div>

        {/* School type badge + Notes */}
        {(() => {
          const { schoolType, remainingNotes } = parseSchoolType(location.notes);
          const badgeColors: Record<string, string> = {
            Micro: "bg-blue-100 text-blue-700",
            Growth: "bg-purple-100 text-purple-700",
            Flagship: "bg-amber-100 text-amber-700",
          };
          return (
            <>
              {schoolType && (
                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${badgeColors[schoolType] || "bg-gray-100 text-gray-700"}`}>
                  {schoolType}
                </span>
              )}
              {remainingNotes && (
                <p className="text-sm text-muted-foreground bg-muted/50 rounded px-3 py-2 italic">
                  &ldquo;{remainingNotes}&rdquo;
                </p>
              )}
            </>
          );
        })()}

        {/* Scores */}
        <div>
          <ScoreBadge scores={scores} />
          {!hasScores && (
            <p className="text-xs text-amber-600 mt-1">Scores still processing...</p>
          )}
        </div>

        {/* Email preview */}
        {emailPreview && (
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-muted/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">
                  Email preview ({previewLabel})
                  {!isLikeMode && location.suggestor_email && (
                    <span className="text-muted-foreground"> → {location.suggestor_email}</span>
                  )}
                  {isLikeMode && likedLocation && (
                    <span className="text-muted-foreground"> → {likedLocation.voter_emails.length} voter{likedLocation.voter_emails.length !== 1 ? "s" : ""}</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {!isLikeMode && (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => setEmailPreview(emailPreview === "approve" ? "reject" : "approve")}
                    title="Toggle approve/reject preview"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
            </div>
            {showPreview && (
              <div
                className="px-4 py-3 text-sm bg-white max-h-64 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: currentPreviewHtml }}
              />
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePreviewEmail}
            disabled={!hasScores}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview Email
          </Button>

          {isLikeMode ? (
            <Button
              size="sm"
              onClick={handleNotifyVoters}
              disabled={sending || sent || !hasScores}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : sent ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {sent ? "Sent" : `Send to ${likedLocation?.voter_emails.length || 0} Voter${(likedLocation?.voter_emails.length || 0) !== 1 ? "s" : ""}`}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={approving || rejecting || !hasScores}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Approve & Send
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => {
                  if (!emailPreview || emailPreview !== "reject") {
                    setEmailPreview("reject");
                    setShowPreview(true);
                    return;
                  }
                  handleReject(e);
                }}
                disabled={approving || rejecting || !hasScores}
              >
                {rejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                {emailPreview === "reject" ? "Reject & Send" : "Reject"}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
