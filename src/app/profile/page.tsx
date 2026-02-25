"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Loader2, Check, LogOut } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { signOut } from "@/lib/auth";
import { useVotesStore } from "@/lib/votes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

interface Suggestion {
  description: string;
  place_id: string;
}

export default function ProfilePage() {
  const { user, session, isLoading } = useAuth();
  const setUserLocation = useVotesStore((s) => s.setUserLocation);
  const router = useRouter();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Autocomplete
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load profile
  useEffect(() => {
    if (!session?.access_token) return;
    fetch("/api/profile", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.display_name) setName(data.display_name);
        if (data.home_address) setAddress(data.home_address);
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, [session?.access_token]);

  const fetchSuggestions = (input: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (input.length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places-autocomplete?input=${encodeURIComponent(input)}`);
        const data = await res.json();
        if (data.predictions?.length) {
          setSuggestions(data.predictions);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch {
        setSuggestions([]);
      }
    }, 300);
  };

  const selectSuggestion = (s: Suggestion) => {
    setAddress(s.description);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSave = async () => {
    if (!session?.access_token) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ display_name: name, home_address: address }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      const data = await res.json();
      if (data.home_lat && data.home_lng) {
        setUserLocation({ lat: data.home_lat, lng: data.home_lng }, "profile");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (isLoading || loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    router.push("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Profile</h1>
        </div>

        {/* Email (read-only) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Email</p>
          <p className="text-sm text-gray-700">{user.email}</p>
        </div>

        {/* Editable fields */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label htmlFor="profile-name" className="text-xs font-medium text-gray-600 block mb-1.5">
              Name
            </label>
            <Input
              id="profile-name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-sm"
            />
          </div>

          <div>
            <label htmlFor="profile-address" className="text-xs font-medium text-gray-600 block mb-1.5">
              Home address
            </label>
            <div className="relative">
              <Input
                id="profile-address"
                type="text"
                placeholder="123 Main St, City, State"
                value={address}
                onChange={(e) => { setAddress(e.target.value); fetchSuggestions(e.target.value); }}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                autoComplete="off"
                className="text-sm"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.place_id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                      onClick={() => selectSuggestion(s)}
                    >
                      {s.description}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">Used for distance to locations</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                Saved
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors mt-6 mx-auto"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
