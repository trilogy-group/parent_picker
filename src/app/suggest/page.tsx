"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Building2, TreePine, DollarSign, Clock, School, Rocket, Crown } from "lucide-react";
import { SCHOOL_TYPES, CriteriaSection } from "@/lib/school-types";
import { FileUpload } from "@/components/FileUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { GeocodingResult } from "@/lib/geocoding";
import { suggestLocation } from "@/lib/locations";
import { useVotesStore } from "@/lib/votes";
import { useAuth } from "@/components/AuthProvider";
import { SignInPrompt } from "@/components/SignInPrompt";
import { validateSuggestForm, hasErrors, sanitizeText, FormErrors } from "@/lib/validation";

function SuggestPageInner() {
  const searchParams = useSearchParams();
  const standalone = searchParams.get("standalone") === "true";
  const { addLocation, setSelectedLocation, userId, showAltUI } = useVotesStore();
  const backHref = showAltUI ? "/" : "/oldUI";
  const { user, isOfflineMode } = useAuth();
  const canSuggest = isOfflineMode || !!user;

  // Required
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  // Optional details
  const [sqft, setSqft] = useState("");
  const [askingRent, setAskingRent] = useState("");
  const [zoningStatus, setZoningStatus] = useState<"" | "allowed" | "needs_cup" | "prohibited" | "not_sure">("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState<{ name: string; url: string }[]>([]);

  const [activeTab, setActiveTab] = useState(() => SCHOOL_TYPES.findIndex((t) => t.focus));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedAddress, setSubmittedAddress] = useState("");

  // Validation
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const handleAddressSelect = (result: GeocodingResult) => {
    setCity(result.city);
    setState(result.state);
    setCoordinates({ lat: result.lat, lng: result.lng });
  };

  const revalidateIfNeeded = (overrides: Partial<{ address: string; city: string; state: string; sqft: string; notes: string }> = {}) => {
    if (!hasAttemptedSubmit) return;
    const newErrors = validateSuggestForm({
      address: overrides.address ?? address,
      city: overrides.city ?? city,
      state: overrides.state ?? state,
      sqft: overrides.sqft ?? sqft,
      notes: overrides.notes ?? generalNotes,
    });
    setErrors(newErrors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    setSubmitError(null);

    const formErrors = validateSuggestForm({ address, city, state, sqft, notes: generalNotes });
    setErrors(formErrors);
    if (hasErrors(formErrors)) return;

    setIsSubmitting(true);
    try {
      // Sanitize all text fields before building notes
      const cleanAddress = sanitizeText(address);
      const cleanCity = sanitizeText(city);
      const cleanState = sanitizeText(state).toUpperCase();

      const detailLines: string[] = [];
      if (sqft) detailLines.push(`Square footage: ${sanitizeText(sqft)}`);
      if (askingRent) detailLines.push(`Asking rent: ${sanitizeText(askingRent)}`);
      if (zoningStatus && zoningStatus !== "not_sure") {
        const zoningLabels: Record<string, string> = { allowed: "School allowed", needs_cup: "Needs approval (CUP)", prohibited: "Prohibited" };
        detailLines.push(`Zoning: ${zoningLabels[zoningStatus]}`);
      }
      if (generalNotes) detailLines.push(`Notes: ${sanitizeText(generalNotes)}`);
      if (attachmentUrls.length > 0) {
        detailLines.push(`Attachments:\n${attachmentUrls.map((a) => `  - ${a.name}: ${a.url}`).join("\n")}`);
      }

      const schoolTypePrefix = `School type: ${SCHOOL_TYPES[activeTab].label}`;
      detailLines.unshift(schoolTypePrefix);
      const fullNotes = detailLines.join("\n") || undefined;
      const fullAddress = `${cleanAddress}, ${cleanCity}, ${cleanState}`;

      const newLocation = await suggestLocation(
        cleanAddress,
        cleanCity,
        cleanState,
        fullNotes,
        coordinates,
        userId ?? undefined
      );
      addLocation(newLocation);
      setSelectedLocation(newLocation.id);
      setSubmittedAddress(fullAddress);
      setSubmitted(true);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Location Submitted!</h2>
          <p className="text-muted-foreground mb-6">
            Thank you for suggesting <strong>{submittedAddress}</strong>.
          </p>
          <div className="bg-blue-50 rounded-lg p-4 text-left text-sm space-y-2 mb-6">
            <p className="font-medium text-blue-900">What happens next:</p>
            <ol className="text-blue-800 space-y-1.5 ml-4 list-decimal">
              <li>We evaluate this location for school use — typically in minutes</li>
              <li>We check zoning, neighborhood, pricing, and building suitability</li>
              <li>We email you the results with a detailed report</li>
            </ol>
          </div>
          <div className="flex gap-3 justify-center">
            {!standalone && (
              <Link href={backHref}>
                <Button>Back to Map</Button>
              </Link>
            )}
            <Button variant="outline" onClick={() => { setSubmitted(false); setAddress(""); setCity(""); setState(""); setCoordinates(null); setErrors({}); setHasAttemptedSubmit(false); setSubmitError(null); }}>
              Suggest Another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {!standalone && (
            <Link href={backHref} className="inline-flex items-center gap-1.5 text-blue-200 hover:text-white text-sm mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Map
            </Link>
          )}
          <h1 className="text-2xl font-bold mb-2">Suggest a Location for Alpha School</h1>
          <p className="text-blue-100">
            You know your neighborhood better than we do. We can evaluate any location in minutes and email you a detailed report.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* School Type Tabs */}
        {(() => {
          const tabIcons = [School, Rocket, Crown];
          const tabColors = [
            { bg: "bg-blue-600", bgLight: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", ring: "ring-blue-300", badge: "bg-blue-600" },
            { bg: "bg-purple-600", bgLight: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", ring: "ring-purple-300", badge: "bg-purple-600" },
            { bg: "bg-amber-600", bgLight: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", ring: "ring-amber-300", badge: "bg-amber-600" },
          ];
          const colors = tabColors[activeTab];
          return (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b">
                <h2 className="font-bold text-lg">What type of school are you suggesting for?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Don&apos;t worry about matching every item — submit anything promising and we&apos;ll evaluate it.
                </p>
              </div>

              {/* Tab buttons */}
              <div className="grid grid-cols-3 gap-3 px-6 pt-5 pb-2">
                {SCHOOL_TYPES.map((type, i) => {
                  const TabIcon = tabIcons[i];
                  const tc = tabColors[i];
                  const isActive = activeTab === i;
                  return (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => setActiveTab(i)}
                      className={`relative flex flex-col items-center gap-1.5 px-4 py-4 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? `${tc.bgLight} ${tc.border} border-2 ${tc.text} shadow-sm ring-2 ${tc.ring}/30`
                          : "bg-gray-50 border-2 border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? tc.bg : "bg-gray-200"}`}>
                        <TabIcon className={`w-5 h-5 ${isActive ? "text-white" : "text-gray-500"}`} />
                      </div>
                      <span className="text-base">{type.label}</span>
                      <span className={`text-xs font-normal ${isActive ? tc.text : "text-gray-400"}`}>{type.students}</span>
                      {type.focus && (
                        <span className={`absolute -top-2 -right-1 text-[10px] font-bold text-white px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm ${tc.badge}`}>
                          Focus
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="p-6 space-y-6">
                <div className={`rounded-lg px-4 py-3 ${colors.bgLight} ${colors.border} border`}>
                  <p className={`text-sm font-medium ${colors.text}`}>{SCHOOL_TYPES[activeTab].tagline}</p>
                </div>

                {SCHOOL_TYPES[activeTab].criteria.map((section: CriteriaSection) => {
                  const SectionIcon = section.icon === "building" ? Building2 : section.icon === "tree" ? TreePine : DollarSign;
                  const iconColor = section.icon === "building" ? "text-blue-600" : section.icon === "tree" ? "text-green-600" : "text-amber-600";
                  const iconBg = section.icon === "building" ? "bg-blue-50" : section.icon === "tree" ? "bg-green-50" : "bg-amber-50";
                  return (
                    <div key={section.heading}>
                      <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                        <span className={`w-6 h-6 rounded-md ${iconBg} flex items-center justify-center`}>
                          <SectionIcon className={`w-3.5 h-3.5 ${iconColor}`} />
                        </span>
                        {section.heading}
                      </h3>
                      <div className="grid gap-2 text-sm text-muted-foreground ml-8">
                        {section.items.map((item) => (
                          <div key={item.label} className="flex gap-3">
                            <span className="font-medium text-foreground w-36 shrink-0">{item.label}</span>
                            <span>{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center gap-2 text-sm">
                  <span className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                  </span>
                  <span className="font-semibold">Timeline:</span>
                  <span className="text-muted-foreground">{SCHOOL_TYPES[activeTab].timeline}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Submission Form */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Submit a Location
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Only the address is required — everything else is optional but helps us evaluate faster.
            </p>
          </div>

          {canSuggest ? (
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Submit error banner */}
              {submitError && (
                <div data-testid="submit-error" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                  {submitError}
                </div>
              )}

              {/* Section: Address (required) */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-blue-600 uppercase tracking-wider">Address *</h3>
                <div className="space-y-2">
                  <label htmlFor="suggest-address" className="text-sm font-medium">Street Address</label>
                  <AddressAutocomplete
                    id="suggest-address"
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
                    <label htmlFor="suggest-city" className="text-sm font-medium">City</label>
                    <Input id="suggest-city" placeholder="Austin" value={city} onChange={(e) => { setCity(e.target.value); revalidateIfNeeded({ city: e.target.value }); }} required />
                    {errors.city && <p data-testid="error-city" className="text-xs text-red-600 mt-1">{errors.city}</p>}
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="suggest-state" className="text-sm font-medium">State</label>
                    <Input id="suggest-state" placeholder="TX" value={state} onChange={(e) => { const v = e.target.value.toUpperCase(); setState(v); revalidateIfNeeded({ state: v }); }} maxLength={2} required />
                    {errors.state && <p data-testid="error-state" className="text-xs text-red-600 mt-1">{errors.state}</p>}
                  </div>
                </div>
              </div>

              <hr />

              {/* Optional details — flat, no section headers */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="suggest-sqft" className="text-sm font-medium">Approx. Sq Ft</label>
                  <Input id="suggest-sqft" placeholder="e.g. 3,500" value={sqft} onChange={(e) => { setSqft(e.target.value); revalidateIfNeeded({ sqft: e.target.value }); }} />
                  {errors.sqft && <p data-testid="error-sqft" className="text-xs text-red-600 mt-1">{errors.sqft}</p>}
                </div>
                <div className="space-y-2">
                  <label htmlFor="suggest-rent" className="text-sm font-medium">Asking Rent</label>
                  <Input id="suggest-rent" placeholder="e.g. $15/sq ft or $4,500/mo" value={askingRent} onChange={(e) => setAskingRent(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Zoning Status</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "not_sure", label: "Not sure" },
                    { value: "allowed", label: "School allowed" },
                    { value: "needs_cup", label: "Needs approval (CUP)" },
                    { value: "prohibited", label: "Prohibited" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setZoningStatus(zoningStatus === opt.value ? "" : opt.value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        zoningStatus === opt.value
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="suggest-notes" className="text-sm font-medium">Notes</label>
                <textarea
                  id="suggest-notes"
                  placeholder="Anything else — why this would be great, links to listing, neighborhood info, etc."
                  value={generalNotes}
                  onChange={(e) => { setGeneralNotes(e.target.value); revalidateIfNeeded({ notes: e.target.value }); }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  rows={3}
                />
                {errors.notes && <p data-testid="error-notes" className="text-xs text-red-600 mt-1">{errors.notes}</p>}
              </div>

              <FileUpload
                userId={userId}
                onFilesChange={(files) => setAttachmentUrls(files.map((f) => ({ name: f.name, url: f.url })))}
              />

              {/* Submit */}
              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-xs text-muted-foreground">* Only address is required</p>
                <div className="flex gap-3">
                  <Link href={backHref}>
                    <Button variant="outline" type="button">Cancel</Button>
                  </Link>
                  <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                    {isSubmitting ? "Submitting..." : "Submit Location"}
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            <div className="p-6">
              <SignInPrompt
                title="Sign in to suggest a location"
                description="Enter your email to receive a magic link. No password needed."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SuggestPage() {
  return (
    <Suspense>
      <SuggestPageInner />
    </Suspense>
  );
}
