"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { SCHOOL_TYPES } from "@/lib/school-types";
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
import { validateSuggestForm, hasErrors, sanitizeText, FormErrors } from "@/lib/validation";

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
  const [activeTab, setActiveTab] = useState(() => SCHOOL_TYPES.findIndex((t) => t.focus));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

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

  const revalidateIfNeeded = (overrides: Partial<{ address: string; city: string; state: string; notes: string }> = {}) => {
    if (!hasAttemptedSubmit) return;
    const newErrors = validateSuggestForm({
      address: overrides.address ?? address,
      city: overrides.city ?? city,
      state: overrides.state ?? state,
      notes: overrides.notes ?? notes,
    });
    setErrors(newErrors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    setSubmitError(null);

    const formErrors = validateSuggestForm({ address, city, state, notes });
    setErrors(formErrors);
    if (hasErrors(formErrors)) return;

    setIsSubmitting(true);
    try {
      let coords = coordinates;

      // If no coordinates from autocomplete, try to geocode the address
      if (!coords) {
        coords = await geocodeAddress(address, city, state);
      }

      const cleanAddress = sanitizeText(address);
      const cleanCity = sanitizeText(city);
      const cleanState = sanitizeText(state).toUpperCase();
      const schoolTypePrefix = `School type: ${SCHOOL_TYPES[activeTab].label}`;
      const cleanNotes = notes
        ? `${schoolTypePrefix}\n${sanitizeText(notes)}`
        : schoolTypePrefix;

      const newLocation = await suggestLocation(
        cleanAddress,
        cleanCity,
        cleanState,
        cleanNotes,
        coords,
        userId ?? undefined
      );
      addLocation(newLocation);
      setSelectedLocation(newLocation.id);
      setOpen(false);
      resetForm();
    } catch {
      setSubmitError("Something went wrong. Please try again.");
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
    setActiveTab(SCHOOL_TYPES.findIndex((t) => t.focus));
    setErrors({});
    setSubmitError(null);
    setHasAttemptedSubmit(false);
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
          Or Suggest New Location
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
            {/* School type tabs */}
            <div className="flex gap-1.5">
              {SCHOOL_TYPES.map((type, i) => (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => setActiveTab(i)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    activeTab === i
                      ? "bg-white shadow-sm border text-blue-700"
                      : "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
                  }`}
                >
                  {type.label}
                  {type.focus && (
                    <span className="text-[9px] font-bold bg-blue-600 text-white px-1 py-0.5 rounded uppercase tracking-wider leading-none">Focus</span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground italic">{SCHOOL_TYPES[activeTab].tagline}</p>

            {submitError && (
              <div data-testid="submit-error" className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                {submitError}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="address" className="text-sm font-medium">
                Street Address
              </label>
              <AddressAutocomplete
                id="address"
                placeholder="123 Main St"
                value={address}
                onChange={(v) => { setAddress(v); revalidateIfNeeded({ address: v }); }}
                onSelect={handleAddressSelect}
                required
              />
              {errors.address && <p data-testid="error-address" className="text-xs text-red-600 mt-1">{errors.address}</p>}
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
                  onChange={(e) => { setCity(e.target.value); revalidateIfNeeded({ city: e.target.value }); }}
                  required
                />
                {errors.city && <p data-testid="error-city" className="text-xs text-red-600 mt-1">{errors.city}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="state" className="text-sm font-medium">
                  State
                </label>
                <Input
                  id="state"
                  placeholder="TX"
                  value={state}
                  onChange={(e) => { const v = e.target.value.toUpperCase(); setState(v); revalidateIfNeeded({ state: v }); }}
                  maxLength={2}
                  required
                />
                {errors.state && <p data-testid="error-state" className="text-xs text-red-600 mt-1">{errors.state}</p>}
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
                onChange={(e) => { setNotes(e.target.value); revalidateIfNeeded({ notes: e.target.value }); }}
              />
              {errors.notes && <p data-testid="error-notes" className="text-xs text-red-600 mt-1">{errors.notes}</p>}
            </div>
            <div className="flex items-center justify-between pt-2">
              <Link
                href="/suggest"
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                onClick={() => handleOpenChange(false)}
              >
                <FileText className="w-3 h-3" />
                Detailed form with more info
              </Link>
              <div className="flex gap-3">
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
