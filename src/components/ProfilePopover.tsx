"use client";

import { useState, useEffect, useRef } from "react";
import { Settings, LogIn, LogOut, Loader2, Check } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { signInWithMagicLink, signOut } from "@/lib/auth";
import { useVotesStore } from "@/lib/votes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Suggestion {
  description: string;
  place_id: string;
}

export function ProfilePopover() {
  const { user, session, isLoading, isOfflineMode } = useAuth();
  const setUserLocation = useVotesStore((s) => s.setUserLocation);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  // Autocomplete suggestions state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickingRef = useRef(false);

  // Sign-in dialog state
  const [showSignIn, setShowSignIn] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  // Fetch address suggestions via server-side proxy
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
    pickingRef.current = true;
    if (addressInputRef.current) {
      addressInputRef.current.value = s.description;
      addressInputRef.current.focus();
    }
    setSuggestions([]);
    setShowSuggestions(false);
    setTimeout(() => { pickingRef.current = false; }, 0);
  };

  // Load profile when popover opens
  useEffect(() => {
    if (!open || !session?.access_token) return;
    fetch("/api/profile", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.display_name) setName(data.display_name);
        if (data.home_address && addressInputRef.current) {
          addressInputRef.current.value = data.home_address;
        }
      })
      .catch(() => {});
  }, [open, session?.access_token]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

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
        body: JSON.stringify({ display_name: name, home_address: addressInputRef.current?.value || "" }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      const data = await res.json();
      if (data.home_lat && data.home_lng) {
        setUserLocation({ lat: data.home_lat, lng: data.home_lng });
      }
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setOpen(false);
      }, 1000);
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail.trim()) return;
    setIsSubmitting(true);
    setSignInError(null);
    const { error } = await signInWithMagicLink(signInEmail);
    if (error) {
      setSignInError(error.message);
      setIsSubmitting(false);
    } else {
      setEmailSent(true);
      setIsSubmitting(false);
    }
  };

  const handleCloseSignIn = () => {
    setShowSignIn(false);
    setSignInEmail("");
    setEmailSent(false);
    setSignInError(null);
  };

  if (isOfflineMode) {
    return (
      <span className="text-xs px-2 py-1 rounded text-gray-600 bg-gray-100">
        Demo Mode
      </span>
    );
  }

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
  }

  // Logged out: show sign-in button + dialog
  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowSignIn(true)}
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
        >
          <LogIn className="h-3.5 w-3.5" />
          Sign In
        </button>

        <Dialog open={showSignIn} onOpenChange={handleCloseSignIn}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Sign In to Vote</DialogTitle>
              <DialogDescription>
                Enter your email to receive a magic link. No password needed.
              </DialogDescription>
            </DialogHeader>

            {emailSent ? (
              <div className="py-6 text-center">
                <div className="text-4xl mb-4">📧</div>
                <h3 className="font-semibold text-lg mb-2">Check your email</h3>
                <p className="text-muted-foreground text-sm">
                  We sent a magic link to <strong>{signInEmail}</strong>
                </p>
                <p className="text-muted-foreground text-xs mt-2">
                  Click the link in the email to sign in
                </p>
                <Button variant="ghost" className="mt-4" onClick={handleCloseSignIn}>
                  Close
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label htmlFor="signin-email" className="text-sm font-medium">
                    Email Address
                  </label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="parent@example.com"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    required
                  />
                </div>
                {signInError && <p className="text-sm text-red-600">{signInError}</p>}
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={handleCloseSignIn}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Magic Link"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Logged in: gear icon + popover
  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
        aria-label="Profile settings"
      >
        <span className="truncate max-w-[160px]">{user.email}</span>
        <Settings className="h-3.5 w-3.5 shrink-0" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-50">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Profile</p>

          <div className="space-y-3">
            <div>
              <label htmlFor="profile-name" className="text-xs font-medium text-gray-600 block mb-1">
                Name
              </label>
              <Input
                id="profile-name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div>
              <label htmlFor="profile-address" className="text-xs font-medium text-gray-600 block mb-1">
                Home address
              </label>
              <div className="relative">
                <input
                  id="profile-address"
                  ref={addressInputRef}
                  type="text"
                  placeholder="123 Main St, City, State"
                  onChange={(e) => fetchSuggestions(e.target.value)}
                  onBlur={() => setTimeout(() => { if (!pickingRef.current) setShowSuggestions(false); }, 150)}
                  autoComplete="off"
                  className="h-8 text-sm w-full rounded-md border border-input bg-transparent px-3 py-1 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] max-h-48 overflow-y-auto">
                    {suggestions.map((s) => (
                      <button
                        key={s.place_id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                        onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                      >
                        {s.description}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Used for distance to locations</p>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="w-full"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : saved ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Saved
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>

          <div className="border-t border-gray-100 mt-3 pt-3">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors w-full"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
