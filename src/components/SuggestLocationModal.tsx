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
      setOpen(false);
      resetForm();
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
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-amber-400 hover:bg-amber-500 text-amber-950 font-semibold">
          <Plus className="h-4 w-4" />
          Suggest a Location
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" draggable position="top-right">
        <DialogHeader draggable>
          <DialogTitle>Suggest a New Location</DialogTitle>
          <DialogDescription>
            Know a great spot for a micro school? Share it with other parents.
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
      </DialogContent>
    </Dialog>
  );
}
