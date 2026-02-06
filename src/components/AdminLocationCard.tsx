"use client";

import { useState } from "react";
import { MapPin, User, Calendar, RefreshCw, Check, X, Loader2, Mail, Eye, EyeOff, Heart, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "./ScoreBadge";
import { AdminLocation, LikedLocation, LocationScores, UpstreamMetrics, MetroInfo, LocationTodo } from "@/types";
import { generateTodos } from "@/lib/todo-generator";
import { generateTodoApprovalHtml, generateLikerEmailHtml } from "@/lib/email-todos";

interface AdminLocationCardProps {
  location: AdminLocation | LikedLocation;
  token: string;
  onRemove: (id: string) => void;
  mode?: "suggestion" | "like";
}

interface EmailScoreInfo {
  overall: number | null;
  demographics: number | null;
  price: number | null;
  zoning: number | null;
  neighborhood: number | null;
  building: number | null;
}

// Map raw score row from sync-scores API to LocationScores
function mapSyncScores(s: Record<string, unknown>): LocationScores | undefined {
  if (!s || s.overall_score == null) return undefined;
  const colorFromScore = (v: number | null) => {
    if (v === null) return null;
    if (v >= 0.75) return "GREEN";
    if (v >= 0.5) return "YELLOW";
    if (v >= 0.25) return "AMBER";
    return "RED";
  };
  const overall = Number(s.overall_score);
  const demo = s.demographics_score != null ? Number(s.demographics_score) : null;
  const price = s.price_score != null ? Number(s.price_score) : null;
  const zoning = s.zoning_score != null ? Number(s.zoning_score) : null;
  const nbhd = s.neighborhood_score != null ? Number(s.neighborhood_score) : null;
  const bldg = s.building_score != null ? Number(s.building_score) : null;
  return {
    overall,
    overallColor: (s.overall_color as string) || null,
    overallDetailsUrl: (s.overall_details_url as string) || null,
    demographics: { score: demo, color: (s.demographics_color as string) || colorFromScore(demo), detailsUrl: (s.demographics_details_url as string) || null },
    price: { score: price, color: (s.price_color as string) || colorFromScore(price), detailsUrl: (s.price_details_url as string) || null },
    zoning: { score: zoning, color: (s.zoning_color as string) || colorFromScore(zoning), detailsUrl: (s.zoning_details_url as string) || null },
    neighborhood: { score: nbhd, color: (s.neighborhood_color as string) || colorFromScore(nbhd), detailsUrl: (s.neighborhood_details_url as string) || null },
    building: { score: bldg, color: (s.building_color as string) || colorFromScore(bldg), detailsUrl: (s.building_details_url as string) || null },
    sizeClassification: (s.size_classification as string) || null,
  };
}

function scoresToEmailScores(scores?: LocationScores): EmailScoreInfo | undefined {
  if (!scores || scores.overall == null) return undefined;
  return {
    overall: scores.overall,
    demographics: scores.demographics.score,
    price: scores.price.score,
    zoning: scores.zoning.score,
    neighborhood: scores.neighborhood.score,
    building: scores.building.score,
  };
}

function scoreRow(label: string, score: number | null, isOverall: boolean = false): string {
  if (score === null) return "";
  const pct = isOverall ? score : Math.round(score * 100);
  const color = pct >= 75 ? "#22c55e" : pct >= 50 ? "#eab308" : pct >= 25 ? "#f59e0b" : "#ef4444";
  return `<tr><td style="padding:4px 8px;font-size:14px;">${label}</td><td style="padding:4px 8px;font-size:14px;font-weight:bold;color:${color};">${pct}</td></tr>`;
}

function generatePlainApprovalHtml(loc: AdminLocation, scores?: EmailScoreInfo): string {
  let scoreSection = "";
  if (scores?.overall != null) {
    scoreSection = `
      <h3 style="margin-top:20px;">Location Scores</h3>
      <table style="border-collapse:collapse;">
        ${scoreRow("Overall", scores.overall, true)}
        ${scoreRow("Demographics", scores.demographics)}
        ${scoreRow("Price", scores.price)}
        ${scoreRow("Zoning", scores.zoning)}
        ${scoreRow("Neighborhood", scores.neighborhood)}
        ${scoreRow("Building", scores.building)}
      </table>
    `;
  }
  return `
    <h2>Great news!</h2>
    <p>Your suggested location <strong>${loc.name}</strong> at ${loc.address}, ${loc.city}, ${loc.state} has been approved and is now live on the Parent Picker map.</p>
    ${scoreSection}
    <p>Share the link with other parents to rally votes for this location!</p>
    <p><a href="https://parentpicker.vercel.app">View on Parent Picker</a></p>
  `;
}

function generateRejectionHtml(loc: AdminLocation, scores?: EmailScoreInfo): string {
  let scoreSection = "";
  if (scores?.overall != null) {
    scoreSection = `
      <h3 style="margin-top:20px;">Location Scores</h3>
      <table style="border-collapse:collapse;">
        ${scoreRow("Overall", scores.overall, true)}
        ${scoreRow("Demographics", scores.demographics)}
        ${scoreRow("Price", scores.price)}
        ${scoreRow("Zoning", scores.zoning)}
        ${scoreRow("Neighborhood", scores.neighborhood)}
        ${scoreRow("Building", scores.building)}
      </table>
      <p style="font-size:13px;color:#666;">These scores help us evaluate whether a location meets the requirements for a micro school.</p>
    `;
  }
  return `
    <h2>Thank you for your suggestion</h2>
    <p>We reviewed <strong>${loc.name}</strong> at ${loc.address}, ${loc.city}, ${loc.state} but unfortunately it doesn't meet our current criteria for a micro school location.</p>
    ${scoreSection}
    <p>We appreciate your help in finding great locations! Feel free to suggest other spots you think would work well.</p>
    <p><a href="https://parentpicker.vercel.app">Suggest another location</a></p>
  `;
}

function hasRedScores(scores?: LocationScores): boolean {
  if (!scores) return false;
  return (
    scores.zoning.color === "RED" ||
    scores.demographics.color === "RED" ||
    scores.price.color === "RED"
  );
}

export function AdminLocationCard({ location, token, onRemove, mode = "suggestion" }: AdminLocationCardProps) {
  const isLikeMode = mode === "like";
  const likedLocation = isLikeMode ? (location as LikedLocation) : null;

  const [scores, setScores] = useState<LocationScores | undefined>(location.scores);
  const [syncing, setSyncing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [emailPreview, setEmailPreview] = useState<"approve" | "reject" | "liker" | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [, setUpstreamMetrics] = useState<UpstreamMetrics | null>(null);
  const [, setMetroInfo] = useState<MetroInfo | null>(null);
  const [todos, setTodos] = useState<LocationTodo[]>([]);
  const [sent, setSent] = useState(false);

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const emailScores = scoresToEmailScores(scores);

  // Build email HTML based on mode
  const approvalHtml =
    todos.length > 0
      ? generateTodoApprovalHtml(location, emailScores, todos)
      : generatePlainApprovalHtml(location, emailScores);
  const rejectionHtml = generateRejectionHtml(location, emailScores);
  const likerHtml = generateLikerEmailHtml(location, emailScores, todos);

  const handleSyncScores = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`/api/admin/locations/${location.id}/sync-scores`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (res.ok) {
        if (data.scores) {
          const mapped = mapSyncScores(data.scores);
          setScores(mapped);
          setSyncMessage(`Synced (${data.synced} row${data.synced !== 1 ? "s" : ""})`);

          // Store upstream metrics and metro info
          const um: UpstreamMetrics | null = data.upstreamMetrics || null;
          const mi: MetroInfo | null = data.metroInfo || null;
          setUpstreamMetrics(um);
          setMetroInfo(mi);

          // Generate TODOs if we have RED scores + upstream data
          if (mapped && hasRedScores(mapped) && um && mi) {
            const generated = generateTodos(mapped, um, mi);
            setTodos(generated);
            if (generated.length > 0) {
              setSyncMessage(
                `Synced (${data.synced} row${data.synced !== 1 ? "s" : ""}) — ${generated.length} TODO${generated.length !== 1 ? "s" : ""} generated`
              );
            }
          } else {
            setTodos([]);
          }

          // Auto-show email preview after scores are pulled
          setEmailPreview(isLikeMode ? "liker" : "approve");
          setShowPreview(true);
        } else {
          setSyncMessage("No scores found in upstream data");
        }
      } else {
        setSyncMessage(data.error || "Sync failed");
      }
    } catch {
      setSyncMessage("Network error");
    } finally {
      setSyncing(false);
    }
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
          emailSubject: todos.length > 0
            ? "Your location is approved — action items inside"
            : "Your suggested location is now live!",
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
          emailHtml: likerHtml,
          emailSubject: todos.length > 0
            ? "Location update — action items inside"
            : "Update on a location you liked",
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
    ? likerHtml
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

        {/* Notes */}
        {location.notes && (
          <p className="text-sm text-muted-foreground bg-muted/50 rounded px-3 py-2 italic">
            &ldquo;{location.notes}&rdquo;
          </p>
        )}

        {/* Scores */}
        <div>
          <ScoreBadge scores={scores} />
          {!scores && (
            <p className="text-xs text-muted-foreground mt-1">No scores yet — pull scores first</p>
          )}
          {syncMessage && (
            <p className="text-xs text-muted-foreground mt-1">{syncMessage}</p>
          )}
        </div>

        {/* TODO summary badges */}
        {todos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {todos.map((todo) => (
              <span
                key={todo.type}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  todo.type === "zoning"
                    ? "bg-red-100 text-red-700"
                    : todo.type === "demographics"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-orange-100 text-orange-700"
                }`}
              >
                {todo.scenario}: {todo.title.split(":")[0]}
              </span>
            ))}
          </div>
        )}

        {/* Email preview */}
        {emailPreview && (
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-muted/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">
                  Email preview ({previewLabel})
                  {!isLikeMode && emailPreview === "approve" && todos.length > 0 && (
                    <span className="text-orange-600"> + {todos.length} TODO{todos.length !== 1 ? "s" : ""}</span>
                  )}
                  {isLikeMode && todos.length > 0 && (
                    <span className="text-orange-600"> + {todos.length} TODO{todos.length !== 1 ? "s" : ""}</span>
                  )}
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
            onClick={handleSyncScores}
            disabled={syncing}
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Pull Scores
          </Button>

          {isLikeMode ? (
            <Button
              size="sm"
              onClick={handleNotifyVoters}
              disabled={sending || sent || !scores}
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
                disabled={approving || rejecting}
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
                disabled={approving || rejecting}
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
