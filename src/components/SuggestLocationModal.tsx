"use client";

import { useState } from "react";
import { Plus, CheckCircle2 } from "lucide-react";
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
import { AddressAutocomplete } from "./AddressAutocomplete";
import { GeocodingResult, geocodeAddress } from "@/lib/geocoding";
import { useAuth } from "./AuthProvider";
import { SignInPrompt } from "./SignInPrompt";

export function SuggestLocationModal() {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [notes, setNotes] = useState("");
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedAddress, setSubmittedAddress] = useState("");

  const { addLocation, setSelectedLocation, setPreviewLocation, userId } = useVotesStore();
  const { user, isOfflineMode } = useAuth();

  const handleAddressSelect = (result: GeocodingResult) => {
    setCity(result.city);
    setState(result.state);
    setCoordinates({ lat: result.lat, lng: result.lng });
    setPreviewLocation({ lat: result.lat, lng: result.lng, address: result.address });
  };

  // In offline mode, allow suggestions without auth (local-only)
  const canSuggest = isOfflineMode || !!user;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !city.trim() || !state.trim()) return;

    setIsSubmitting(true);
    try {
      let coords = coordinates;

      // If no coordinates from autocomplete, try to geocode the address
      if (!coords) {
        coords = await geocodeAddress(address, city, state);
      }

      const fullAddress = `${address}, ${city}, ${state}`;

      const newLocation = await suggestLocation(
        address,
        city,
        state,
        notes,
        coords,
        userId ?? undefined
      );
      addLocation(newLocation);
      setSelectedLocation(newLocation.id);
      setSubmittedAddress(fullAddress);
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setAddress("");
    setCity("");
    setState("");
    setNotes("");
    setCoordinates(null);
    setPreviewLocation(null);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setPreviewLocation(null);
      setSubmitted(false);
      setSubmittedAddress("");
      resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-amber-400 hover:bg-amber-500 text-amber-950 font-semibold">
          <Plus className="h-4 w-4" />
          Or Suggest New Location
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" draggable position="top-right">
        {submitted ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold mb-2">Location Submitted!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Thank you for suggesting <strong>{submittedAddress}</strong>.
            </p>
            <div className="bg-blue-50 rounded-lg p-4 text-left text-sm space-y-2 mb-4">
              <p className="font-medium text-blue-900">What happens next:</p>
              <ol className="text-blue-800 space-y-1.5 ml-4 list-decimal">
                <li>Our team will evaluate this location for school use</li>
                <li>We&apos;ll check zoning, neighborhood, pricing, and building suitability</li>
                <li>We&apos;ll email you the results with a detailed report</li>
              </ol>
              <p className="text-blue-700 text-xs mt-2 italic">
                Evaluation typically takes just minutes.
              </p>
            </div>
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          </div>
        ) : (
        <>
        <DialogHeader draggable>
          <DialogTitle>Suggest a New Location</DialogTitle>
          <DialogDescription>
            Know a great spot for a school? We can evaluate it in minutes and email you the results.
          </DialogDescription>
        </DialogHeader>
        {canSuggest ? (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label htmlFor="address" className="text-sm font-medium">
                Street Address
              </label>
              <AddressAutocomplete
                id="address"
                placeholder="123 Main St"
                value={address}
                onChange={setAddress}
                onSelect={handleAddressSelect}
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
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </form>
        ) : (
          <SignInPrompt
            title="Sign in to suggest"
            description="Sign in with your email to suggest new locations for micro schools."
          />
        )}
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
