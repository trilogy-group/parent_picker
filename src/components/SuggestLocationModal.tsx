"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useVotesStore } from "@/lib/votes";
import { suggestLocation } from "@/lib/locations";
import { useAuth } from "./AuthProvider";
import { SignInPrompt } from "./SignInPrompt";

export function SuggestLocationModal() {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addLocation, setSelectedLocation, userId } = useVotesStore();
  const { user, isOfflineMode } = useAuth();

  // In offline mode, allow suggestions without auth (local-only)
  const canSuggest = isOfflineMode || !!user;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !city.trim() || !state.trim()) return;

    setIsSubmitting(true);
    try {
      const newLocation = await suggestLocation(address, city, state, notes, userId ?? undefined);
      addLocation(newLocation);
      setSelectedLocation(newLocation.id);
      setOpen(false);
      setAddress("");
      setCity("");
      setState("");
      setNotes("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-amber-400 hover:bg-amber-500 text-amber-950 font-semibold">
          <Plus className="h-4 w-4" />
          Suggest a Location
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {!canSuggest ? (
          <>
            <DialogHeader>
              <DialogTitle>Sign In Required</DialogTitle>
              <DialogDescription>
                Sign in to suggest a new school location.
              </DialogDescription>
            </DialogHeader>
            <SignInPrompt
              title="Sign in to suggest"
              description="Enter your email to receive a magic link. No password needed."
            />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Suggest a New Location</DialogTitle>
              <DialogDescription>
                Know a great spot for a micro school? Share it with other parents.
                {isOfflineMode && (
                  <span className="block mt-1 text-amber-600">
                    Demo mode: suggestions won&apos;t be saved permanently.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label htmlFor="address" className="text-sm font-medium">
                  Street Address
                </label>
                <Input
                  id="address"
                  placeholder="123 Main St"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label htmlFor="city" className="text-sm font-medium">
                    City
                  </label>
                  <Input
                    id="city"
                    placeholder="Austin"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="state" className="text-sm font-medium">
                    State
                  </label>
                  <Input
                    id="state"
                    placeholder="TX"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    maxLength={2}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="notes" className="text-sm font-medium">
                  Notes (optional)
                </label>
                <Input
                  id="notes"
                  placeholder="Why this location would be great..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
