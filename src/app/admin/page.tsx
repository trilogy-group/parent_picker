"use client";

import { useEffect, useState, useRef } from "react";
import { ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { AdminLocation, LikedLocation } from "@/types";
import { AdminLocationCard } from "@/components/AdminLocationCard";
import Link from "next/link";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

type Tab = "suggestions" | "likes";

export default function AdminPage() {
  // Start as not-loading if Supabase isn't configured (nothing to check)
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [isAdmin, setIsAdmin] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("suggestions");
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [likedLocations, setLikedLocations] = useState<LikedLocation[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const hasFetchedSuggestions = useRef(false);
  const hasFetchedLikes = useRef(false);

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

  const handleRemoveSuggestion = (id: string) => {
    setLocations((prev) => prev.filter((loc) => loc.id !== id));
  };

  const handleRemoveLike = (id: string) => {
    setLikedLocations((prev) => prev.filter((loc) => loc.id !== id));
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

  const tabCount = activeTab === "suggestions" ? locations.length : likedLocations.length;
  const tabLabel = activeTab === "suggestions"
    ? `${tabCount} pending suggestion${tabCount !== 1 ? "s" : ""}`
    : `${tabCount} liked location${tabCount !== 1 ? "s" : ""}`;

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
      </main>
    </div>
  );
}
