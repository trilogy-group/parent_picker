"use client";

import { useEffect, useState, useRef } from "react";
import { ShieldCheck, Loader2, ArrowLeft, Check, X, Mail, ExternalLink, Clock, MapPin, HandHelping, AlertTriangle, RefreshCw, Bell, Trash2 } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { AdminLocation, LikedLocation, AdminAction } from "@/types";
import { AdminLocationCard } from "@/components/AdminLocationCard";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

type Tab = "suggestions" | "likes" | "history";

function ActionBadge({ action }: { action: string }) {
  switch (action) {
    case "approved":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
          <Check className="h-3 w-3" /> Approved
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
          <X className="h-3 w-3" /> Rejected
        </span>
      );
    case "help_requested":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
          <Mail className="h-3 w-3" /> Help Sent
        </span>
      );
    case "parent_help":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
          <HandHelping className="h-3 w-3" /> Parent Help
        </span>
      );
    case "scored_notified":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
          <Bell className="h-3 w-3" /> Scored
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
          {action}
        </span>
      );
  }
}

function HistoryCard({ action, token, onRetrySuccess, onDelete }: { action: AdminAction; token: string; onRetrySuccess: (id: string) => void; onDelete: (id: string) => void }) {
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const date = new Date(action.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const isAuto = action.admin_email === "system";

  const handleRetry = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(`/api/admin/history/${action.id}/retry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRetryError(data.failed?.join("; ") || data.error || "Retry failed");
      } else {
        onRetrySuccess(action.id);
      }
    } catch {
      setRetryError("Network error");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Card className={`p-0 ${action.email_failed ? "border-red-300" : ""}`}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ActionBadge action={action.action} />
            <span className="text-xs text-muted-foreground">
              {isAuto ? "Auto" : "Admin"}
            </span>
            {action.email_failed && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                <AlertTriangle className="h-3 w-3" /> Failed
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {date}
            </span>
            <button
              onClick={async () => {
                setDeleting(true);
                try {
                  const res = await fetch(`/api/admin/history/${action.id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (res.ok) onDelete(action.id);
                } finally {
                  setDeleting(false);
                }
              }}
              disabled={deleting}
              className="text-muted-foreground hover:text-red-600 transition-colors"
              title="Delete"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {action.address && (
          <div className="flex items-center gap-1 text-sm">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span>{action.address}, {action.city}, {action.state}</span>
            {action.overall_details_url && (
              <a
                href={action.overall_details_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 ml-1"
                title="View details"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}

        {action.recipient_emails.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <Mail className="h-3 w-3 inline mr-1" />
            Sent to: {action.recipient_emails.join(", ")}
          </div>
        )}

        {action.email_failed && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Retry Send
            </button>
            {retryError && (
              <span className="text-xs text-red-600">{retryError}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  // Start as not-loading if Supabase isn't configured (nothing to check)
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [isAdmin, setIsAdmin] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("suggestions");
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [likedLocations, setLikedLocations] = useState<LikedLocation[]>([]);
  const [history, setHistory] = useState<AdminAction[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const hasFetchedSuggestions = useRef(false);
  const hasFetchedLikes = useRef(false);
  const hasFetchedHistory = useRef(false);

  // Check auth on mount — all setState calls happen in the .then callback (async)
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        const email = session.user.email.toLowerCase();
        if (ADMIN_EMAILS.includes(email)) {
          setIsAdmin(true);
          setToken(session.access_token);
        }
      }
      setLoading(false);
    });
  }, []);

  // Fetch suggestions once admin is verified
  useEffect(() => {
    if (!isAdmin || !token || hasFetchedSuggestions.current) return;
    hasFetchedSuggestions.current = true;

    fetch("/api/admin/locations", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((data) => {
        setLocations(data);
      })
      .catch(() => {
        setFetchError("Failed to load pending locations");
      });
  }, [isAdmin, token]);

  // Fetch liked locations when switching to likes tab
  useEffect(() => {
    if (!isAdmin || !token || activeTab !== "likes" || hasFetchedLikes.current) return;
    hasFetchedLikes.current = true;

    fetch("/api/admin/likes", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((data) => {
        setLikedLocations(data);
      })
      .catch(() => {
        setFetchError("Failed to load liked locations");
      });
  }, [isAdmin, token, activeTab]);

  // Fetch history when switching to history tab
  useEffect(() => {
    if (!isAdmin || !token || activeTab !== "history" || hasFetchedHistory.current) return;
    hasFetchedHistory.current = true;

    fetch("/api/admin/history", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((data) => {
        setHistory(data);
      })
      .catch(() => {
        setFetchError("Failed to load history");
      });
  }, [isAdmin, token, activeTab]);

  const invalidateHistory = () => {
    hasFetchedHistory.current = false;
    setHistory([]);
  };

  const handleRemoveSuggestion = (id: string) => {
    setLocations((prev) => prev.filter((loc) => loc.id !== id));
    invalidateHistory();
  };

  const handleRemoveLike = (id: string) => {
    setLikedLocations((prev) => prev.filter((loc) => loc.id !== id));
    invalidateHistory();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-semibold">Access Denied</h1>
          <p className="text-muted-foreground">You don&apos;t have admin access to this page.</p>
          <Link href="/" className="text-primary hover:underline text-sm">
            Back to Parent Picker
          </Link>
        </div>
      </div>
    );
  }

  const tabCount = activeTab === "suggestions" ? locations.length
    : activeTab === "likes" ? likedLocations.length
    : history.length;
  const tabLabel = activeTab === "suggestions"
    ? `${tabCount} pending suggestion${tabCount !== 1 ? "s" : ""}`
    : activeTab === "likes"
    ? `${tabCount} liked location${tabCount !== 1 ? "s" : ""}`
    : `${tabCount} action${tabCount !== 1 ? "s" : ""}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">Admin Review Queue</h1>
              <p className="text-sm text-muted-foreground">{tabLabel}</p>
            </div>
          </div>
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium">
            Admin
          </span>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b">
        <div className="max-w-3xl mx-auto px-6 flex gap-0">
          <button
            onClick={() => setActiveTab("suggestions")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "suggestions"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Suggestions
            {locations.length > 0 && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                {locations.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("likes")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "likes"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Likes
            {likedLocations.length > 0 && (
              <span className="ml-2 text-xs bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full">
                {likedLocations.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            History
          </button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        {fetchError && (
          <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
            {fetchError}
          </div>
        )}

        {activeTab === "suggestions" && (
          <>
            {locations.length === 0 && !fetchError && (
              <div className="text-center py-12 text-muted-foreground">
                <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No pending locations to review</p>
                <p className="text-sm mt-1">New parent suggestions will appear here.</p>
              </div>
            )}

            {locations.map((loc) => (
              <AdminLocationCard
                key={loc.id}
                location={loc}
                token={token!}
                onRemove={handleRemoveSuggestion}
              />
            ))}
          </>
        )}

        {activeTab === "likes" && (
          <>
            {likedLocations.length === 0 && !fetchError && (
              <div className="text-center py-12 text-muted-foreground">
                <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No liked locations with votes</p>
                <p className="text-sm mt-1">Locations that parents vote on will appear here.</p>
              </div>
            )}

            {likedLocations.map((loc) => (
              <AdminLocationCard
                key={loc.id}
                location={loc}
                token={token!}
                onRemove={handleRemoveLike}
                mode="like"
              />
            ))}
          </>
        )}

        {activeTab === "history" && (
          <>
            {history.length === 0 && !fetchError && (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No actions yet</p>
                <p className="text-sm mt-1">Admin actions and parent help offers will appear here.</p>
              </div>
            )}

            {history.map((action) => (
              <HistoryCard
                key={action.id}
                action={action}
                token={token!}
                onRetrySuccess={(id) => {
                  setHistory((prev) =>
                    prev.map((a) => a.id === id ? { ...a, email_failed: false } : a)
                  );
                }}
                onDelete={(id) => {
                  setHistory((prev) => prev.filter((a) => a.id !== id));
                }}
              />
            ))}
          </>
        )}
      </main>
    </div>
  );
}
