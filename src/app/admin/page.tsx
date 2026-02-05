"use client";

import { useEffect, useState, useRef } from "react";
import { ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { AdminLocation } from "@/types";
import { AdminLocationCard } from "@/components/AdminLocationCard";
import Link from "next/link";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export default function AdminPage() {
  // Start as not-loading if Supabase isn't configured (nothing to check)
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [isAdmin, setIsAdmin] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const hasFetched = useRef(false);

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

  // Fetch locations once admin is verified — use ref to prevent re-fetch
  useEffect(() => {
    if (!isAdmin || !token || hasFetched.current) return;
    hasFetched.current = true;

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

  const handleRemove = (id: string) => {
    setLocations((prev) => prev.filter((loc) => loc.id !== id));
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
              <p className="text-sm text-muted-foreground">
                {locations.length} pending location{locations.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium">
            Admin
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        {fetchError && (
          <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
            {fetchError}
          </div>
        )}

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
            onRemove={handleRemove}
          />
        ))}
      </main>
    </div>
  );
}
