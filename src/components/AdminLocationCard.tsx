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
  const mapUrl = `https://parentpicker.vercel.app/?location=${loc.id}`;
  const detailsLink = scores?.overallDetailsUrl
    ? `&nbsp;&nbsp;<a href="${scores.overallDetailsUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View Full Score Details</a>`
    : "";
  return `
    <h2>Great news — your location is live!</h2>
    <p><strong>${loc.address}</strong>, ${loc.city}, ${loc.state} is now published on the Parent Picker map and visible to all parents.</p>
    <div style="margin-top:24px;">
      <a href="${mapUrl}" style="display:inline-block;padding:12px 24px;background:#22c55e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View on Map</a>
      ${detailsLink}
    </div>
    <p style="margin-top:20px;">Share this link with other parents to rally votes for this location!</p>
  `;
}

function generateRejectionHtml(loc: AdminLocation): string {
  return `
    <h2>Thank you for your suggestion</h2>
    <p>We reviewed <strong>${loc.address}</strong>, ${loc.city}, ${loc.state} but unfortunately it doesn't meet our current criteria for a micro school location.</p>
    <p>We appreciate your help in finding great locations! Feel free to suggest other spots you think would work well.</p>
    <p style="margin-top:24px;"><a href="https://parentpicker.vercel.app/suggest" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Suggest Another Location</a></p>
  `;
}

function generateHelpRequestHtml(loc: AdminLocation | LikedLocation, scores?: LocationScores): string {
  const mapUrl = `https://parentpicker.vercel.app/?location=${loc.id}`;
  const helpUrl = scores?.overallDetailsUrl
    ? `${scores.overallDetailsUrl}${scores.overallDetailsUrl.includes("?") ? "&" : "?"}tab=help`
    : null;
  const helpLink = helpUrl
    ? `<a href="${helpUrl}" style="display:inline-block;padding:12px 24px;background:#22c55e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">See How You Can Help</a>&nbsp;&nbsp;`
    : "";
  return `
    <h2>We need your help with a location you care about</h2>
    <p>You voted for <strong>${loc.address}</strong>, ${loc.city}, ${loc.state} — and we're making progress! Parents have 100x the local knowledge we do, and your involvement makes a real difference.</p>
    <div style="margin-top:24px;">
      ${helpLink}<a href="${mapUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View on Map</a>
    </div>
    <p style="margin-top:20px;font-size:13px;color:#666;">Know the landlord? Have a zoning contact? Even small connections help us move faster. Click above to see specific ways you can help.</p>
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
  const [sendError, setSendError] = useState<string | null>(null);

  const hasScores = !!scores;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Build email HTML based on mode
  const approvalHtml = generateApprovalHtml(location, scores);
  const rejectionHtml = generateRejectionHtml(location);
  const helpHtml = generateHelpRequestHtml(location, scores);

  const handlePreviewEmail = () => {
    setEmailPreview(isLikeMode ? "liker" : "approve");
    setShowPreview(true);
  };

  const handleApprove = async (e: React.MouseEvent) => {
    e.preventDefault();
    setApproving(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/admin/locations/${location.id}/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          emailHtml: approvalHtml,
          emailSubject: "Your suggested location is now live!",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.emailFailed) {
          setSendError(`Approved but email failed: ${data.emailFailed}`);
        } else {
          onRemove(location.id);
        }
      } else {
        setSendError(data.error || "Approve failed");
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Approve error");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (e: React.MouseEvent) => {
    e.preventDefault();
    setRejecting(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/admin/locations/${location.id}/reject`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          emailHtml: rejectionHtml,
          emailSubject: "Update on your suggested location",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.emailFailed) {
          setSendError(`Rejected but email failed: ${data.emailFailed}`);
        } else {
          onRemove(location.id);
        }
      } else {
        setSendError(data.error || "Reject failed");
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Reject error");
    } finally {
      setRejecting(false);
    }
  };

  const alreadySent = likedLocation?.help_sent_at != null;
  const newVoters = likedLocation?.new_voter_emails || [];
  const targetEmails = alreadySent ? newVoters : (likedLocation?.voter_emails || []);

  const handleNotifyVoters = async () => {
    if (!likedLocation || targetEmails.length === 0) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/admin/locations/${location.id}/notify-voters`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          emailHtml: helpHtml,
          emailSubject: `Help us bring Alpha to ${location.city} — here's how`,
          voterEmails: targetEmails,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.failed?.length > 0) {
          setSendError(`Failed: ${data.failed.join("; ")}`);
        }
        if (data.sent > 0) {
          setSent(true);
          // Remove card if all target emails succeeded
          if (!data.failed?.length) {
            onRemove(location.id);
          }
        } else {
          setSendError(data.failed?.join("; ") || "All emails failed");
        }
      } else {
        setSendError(data.error || "Send failed");
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
    ? helpHtml
    : emailPreview === "reject"
    ? rejectionHtml
    : approvalHtml;

  const previewLabel = isLikeMode
    ? "Help Request"
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
            {location.status === "pending_scoring" && (
              <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                <Loader2 className="h-3 w-3 animate-spin" />
                Scoring...
              </span>
            )}
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
              <span>{likedLocation.voter_emails.join(", ")}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{createdDate}</span>
          </div>
        </div>

        {/* Voter comments (like mode) */}
        {isLikeMode && likedLocation?.voter_comments?.some(vc => vc.comment) && (
          <div className="space-y-1 bg-muted/30 rounded px-3 py-2">
            {likedLocation.voter_comments.filter(vc => vc.comment).map((vc, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium text-muted-foreground">{vc.email}</span>
                <span className="italic ml-1">&mdash; &ldquo;{vc.comment}&rdquo;</span>
              </div>
            ))}
          </div>
        )}

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
            <>
              {alreadySent && (
                <span className="text-xs text-green-600 font-medium">
                  <Check className="h-3 w-3 inline" /> Sent {new Date(likedLocation!.help_sent_at!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
              <Button
                size="sm"
                onClick={handleNotifyVoters}
                disabled={sending || sent || !hasScores || targetEmails.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : sent ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {sent
                  ? "Sent"
                  : alreadySent && newVoters.length > 0
                  ? `Send to ${newVoters.length} New Voter${newVoters.length !== 1 ? "s" : ""}`
                  : alreadySent
                  ? "No New Voters"
                  : `Ask ${targetEmails.length} Voter${targetEmails.length !== 1 ? "s" : ""} for Help`
                }
              </Button>
            </>
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

        {sendError && (
          <div className="bg-red-50 text-red-700 rounded px-3 py-2 text-xs">
            {sendError}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
