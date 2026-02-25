"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

// Load Google Maps Places script once
let mapsScriptLoaded = false;
let mapsScriptLoading = false;
const mapsCallbacks: (() => void)[] = [];

function loadMapsScript(callback: () => void) {
  if (mapsScriptLoaded) { callback(); return; }
  mapsCallbacks.push(callback);
  if (mapsScriptLoading) return;
  mapsScriptLoading = true;

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) return;

  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
  script.async = true;
  script.onload = () => {
    mapsScriptLoaded = true;
    mapsCallbacks.forEach((cb) => cb());
    mapsCallbacks.length = 0;
  };
  document.head.appendChild(script);
}

export function ProfilePopover() {
  const { user, session, isLoading, isOfflineMode } = useAuth();
  const setUserLocation = useVotesStore((s) => s.setUserLocation);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Sign-in dialog state
  const [showSignIn, setShowSignIn] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  // Attach Places Autocomplete when popover opens
  const initAutocomplete = useCallback(() => {
    if (!addressInputRef.current || autocompleteRef.current) return;
    autocompleteRef.current = new google.maps.places.Autocomplete(addressInputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
    });
    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current?.getPlace();
      if (place?.formatted_address) {
        setAddress(place.formatted_address);
      }
    });
  }, []);

  useEffect(() => {
    if (!open) {
      autocompleteRef.current = null;
      return;
    }
    loadMapsScript(() => {
      // Small delay to ensure input is rendered
      setTimeout(initAutocomplete, 50);
    });
  }, [open, initAutocomplete]);

  // Load profile when popover opens
  useEffect(() => {
    if (!open || !session?.access_token) return;
    fetch("/api/profile", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.display_name) setName(data.display_name);
        if (data.home_address) setAddress(data.home_address);
      })
      .catch(() => {});
  }, [open, session?.access_token]);

  // Close on outside click (ignore clicks on Places autocomplete dropdown)
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest(".pac-container")) return;
      if (popoverRef.current && !popoverRef.current.contains(target)) {
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
        body: JSON.stringify({ display_name: name, home_address: address }),
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
              <input
                id="profile-address"
                ref={addressInputRef}
                type="text"
                placeholder="123 Main St, City, State"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="h-8 text-sm w-full rounded-md border border-input bg-transparent px-3 py-1 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
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
