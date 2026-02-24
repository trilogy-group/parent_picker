# Location Detail View + AltPanel Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a location detail view (panel on desktop, full page on mobile), prompt for reason on "Not here" votes, and fix AltPanel header/zoom issues.

**Architecture:** Shared `LocationDetailView` component rendered inline in AltPanel (desktop) or as a `/location/[id]` page route (mobile). New `NotHereReasonModal` using existing shadcn Dialog pattern. DB additions: `comment` column on `pp_votes`, new `pp_contributions` table.

**Tech Stack:** Next.js 15, React 18, Zustand, Supabase, Tailwind, shadcn Dialog, Google Street View Static API, Mapbox GL

---

### Task 1: AltPanel Header — Move Auth Inline + No-Wrap Heading

**Files:**
- Modify: `src/components/AltPanel.tsx` (lines 103-124)

**Step 1: Update header layout**

Move AuthButton to the same row as the ALPHA SCHOOL badge. Keep heading on its own line with `whitespace-nowrap` and smaller text to prevent wrapping.

Current (lines 103-124):
```tsx
<div className="px-5 pt-5 pb-4">
  {metroName && (
    <p className="text-xs font-semibold text-blue-600 tracking-wide mb-1">
      ALPHA SCHOOL &middot; {metroName.toUpperCase()}
    </p>
  )}
  <div className="flex items-start justify-between gap-3">
    <h1 className="text-[22px] font-bold text-gray-900 leading-tight">
      Choose where your kid goes to school.
    </h1>
    <div className="shrink-0 pt-1">
      <AuthButton darkBg={false} />
    </div>
  </div>
```

Replace with:
```tsx
<div className="px-5 pt-5 pb-4">
  <div className="flex items-center justify-between mb-1">
    <p className="text-xs font-semibold text-blue-600 tracking-wide">
      ALPHA SCHOOL{metroName ? <> &middot; {metroName.toUpperCase()}</> : null}
    </p>
    <AuthButton darkBg={false} />
  </div>
  <h1 className="text-[20px] font-bold text-gray-900 leading-tight whitespace-nowrap">
    Choose where your kid goes to school.
  </h1>
```

Key changes:
- "ALPHA SCHOOL" always renders (no conditional wrapper) — city appended only when `metroName` exists
- AuthButton sits in the same `flex` row as the badge
- Heading drops to `text-[20px]` + `whitespace-nowrap`

**Step 2: Verify**

Run: `npm run dev` → open localhost:3000 → check:
- Header shows "ALPHA SCHOOL" when zoomed out, "ALPHA SCHOOL · HOUSTON" when zoomed in
- Auth button is on the same line as the badge, right-aligned
- Heading does not wrap

**Step 3: Commit**

```bash
git add src/components/AltPanel.tsx
git commit -m "fix: inline auth button, no-wrap heading, always show ALPHA SCHOOL"
```

---

### Task 2: AltPanel Zoomed-Out State — Show City Cards Always

**Files:**
- Modify: `src/components/AltPanel.tsx` (lines 59-72, and wherever city cards are conditionally hidden)

**Step 1: Understand current gating**

`metroName` is computed only when `zoomLevel >= 9`. The city cards display is driven by `filteredLocations()` which depends on `mapBounds`. When zoomed out, the map shows city clusters (dots) via MapView's `showCities = zoomLevel < 9` logic.

The AltPanel currently shows location cards based on `filteredLocations()`. When zoomed out, `filteredLocations()` returns locations in viewport — which may be all locations or a large subset. City cards (the clickable city-level summary cards) may not exist as a separate component in AltPanel — need to verify.

**Step 2: Check what "city cards" means in context**

Read `src/components/AltPanel.tsx` to find if there are city-level summary cards or if the user means the location cards grouped by city. If city cards don't exist yet as a component, the task may be: when zoomed out, show a list of cities with location counts that zoom the map when clicked.

> **Note to implementer:** Clarify with the codebase what "city cards" currently looks like. The MapView shows city clusters when `zoomLevel < 9`. AltPanel may need to show matching city summary cards that, when clicked, zoom the map to that city. If this component doesn't exist, create a simple `CityCard` that shows city name + location count + click-to-zoom.

**Step 3: Implement city card list for zoomed-out state**

In AltPanel, when `zoomLevel < 9` (no metro detected), instead of showing individual location cards, show a list of cities derived from `locations`:

```tsx
// Compute city summaries from all locations
const citySummaries = useMemo(() => {
  const cityMap = new Map<string, { city: string; state: string; count: number; lat: number; lng: number }>();
  locations.forEach(loc => {
    const key = `${loc.city}-${loc.state}`;
    if (!cityMap.has(key)) {
      cityMap.set(key, { city: loc.city, state: loc.state, count: 0, lat: loc.lat, lng: loc.lng });
    }
    cityMap.get(key)!.count++;
  });
  return Array.from(cityMap.values()).sort((a, b) => b.count - a.count);
}, [locations]);
```

Render city cards when `zoomLevel < 9`:
```tsx
{zoomLevel < 9 ? (
  <div className="px-4 space-y-2">
    {citySummaries.map(city => (
      <button
        key={`${city.city}-${city.state}`}
        onClick={() => {
          setMapCenter({ lat: city.lat, lng: city.lng });
          // Zustand action to zoom to city level
        }}
        className="w-full p-4 bg-white rounded-xl border border-gray-200 text-left hover:border-blue-300 transition-colors"
      >
        <p className="font-semibold text-gray-900">{city.city}, {city.state}</p>
        <p className="text-sm text-gray-500">{city.count} locations</p>
      </button>
    ))}
  </div>
) : (
  // existing location card list
)}
```

**Step 4: Add setZoomLevel or flyTo action if needed**

Check if the Zustand store has a way to programmatically zoom the map. If not, add a `flyTo` action that MapView listens to. The MapView component likely has a `mapRef` — the store can expose a `flyToTarget` that MapView watches:

```ts
// In votes.ts store
flyToTarget: { lat: number; lng: number; zoom: number } | null,
flyTo: (lat, lng, zoom) => set({ flyToTarget: { lat, lng, zoom } }),
clearFlyTo: () => set({ flyToTarget: null }),
```

MapView watches `flyToTarget` in a useEffect and calls `mapRef.current?.flyTo()`.

**Step 5: Verify**

Run: `npm run dev` → zoom out on map → AltPanel should show city cards with counts. Click a city → map zooms to that city, AltPanel switches to location cards.

**Step 6: Commit**

```bash
git add src/components/AltPanel.tsx src/lib/votes.ts src/components/MapView.tsx
git commit -m "feat: show city cards in AltPanel when zoomed out"
```

---

### Task 3: Add `comment` Column to `pp_votes`

**Files:**
- Modify: Supabase DB (via MCP or SQL)

**Step 1: Add column**

```sql
ALTER TABLE pp_votes ADD COLUMN comment text;
```

Run via Supabase MCP: `mcp__supabase__execute_sql`

**Step 2: Verify**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'pp_votes' ORDER BY ordinal_position;
```

Confirm `comment` column exists with type `text`.

**Step 3: No commit needed** (DB-only change)

---

### Task 4: "Not Here" Reason Modal

**Files:**
- Create: `src/components/NotHereReasonModal.tsx`
- Modify: `src/components/AltLocationCard.tsx` (lines 48-58, 115-126)
- Modify: `src/lib/votes.ts` (`voteNotHere` action)

**Step 1: Create NotHereReasonModal**

Follow the existing pattern from `HelpModal.tsx` — shadcn Dialog with local state.

```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NotHereReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationName: string;
  onSubmit: (reason: string) => void;
}

export default function NotHereReasonModal({
  open,
  onOpenChange,
  locationName,
  onSubmit,
}: NotHereReasonModalProps) {
  const [reason, setReason] = useState("");

  function handleSubmit() {
    onSubmit(reason.trim());
    setReason("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>What concerns you about this location?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500">
          Your feedback helps other parents and our team evaluate {locationName}.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Traffic is bad during school hours, flood zone, no sidewalks..."
          className="w-full min-h-[100px] rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => { setReason(""); onOpenChange(false); }}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            Submit
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Note: "Skip" submits the vote with no comment. "Submit" submits with the reason.

**Step 2: Update voteNotHere in store**

In `src/lib/votes.ts`, update `voteNotHere` to accept an optional `comment` parameter:

Current signature: `voteNotHere: (locationId: string) => void`

New signature: `voteNotHere: (locationId: string, comment?: string) => void`

In the upsert call, add `comment` to the row:
```ts
supabase.from("pp_votes")
  .upsert(
    { location_id: locationId, user_id: state.userId, vote_type: 'not_here', comment: comment || null },
    { onConflict: 'location_id,user_id' }
  )
```

**Step 3: Wire modal into AltLocationCard**

In `src/components/AltLocationCard.tsx`:

1. Add state: `const [notHereModalOpen, setNotHereModalOpen] = useState(false);`
2. Change the "Not here" click handler to open the modal instead of calling `onVoteNotHere()` directly
3. Add a new prop: `onVoteNotHere` becomes `onVoteNotHere: (comment?: string) => void`
4. Render `NotHereReasonModal` at the bottom of the component
5. On modal submit OR skip: call `onVoteNotHere(reason)` which flows through to the store

**Step 4: Update AltPanel to pass comment through**

In `src/components/AltPanel.tsx`, update the `onVoteNotHere` callback:
```tsx
onVoteNotHere={(comment) => voteNotHere(loc.id, comment)}
```

**Step 5: Verify**

Run: `npm run dev` → click "Not here" on a card → modal appears → type a reason → submit → vote registers. Also test "Skip" → vote registers with no comment.

**Step 6: Commit**

```bash
git add src/components/NotHereReasonModal.tsx src/components/AltLocationCard.tsx src/lib/votes.ts src/components/AltPanel.tsx
git commit -m "feat: prompt for reason when voting 'Not here'"
```

---

### Task 5: Update Status Badges

**Files:**
- Modify: `src/components/AltLocationCard.tsx` (lines 20-25)

**Step 1: Update badge labels**

Current:
```ts
function statusBadge(overallColor: string | null | undefined) {
  if (overallColor === "GREEN") return { label: "Ready to go", className: "text-green-700" };
  if (overallColor === "YELLOW" || overallColor === "AMBER") return { label: "Needs work", className: "text-amber-600" };
  if (overallColor === "RED") return { label: "Challenging", className: "text-red-600" };
  return null;
}
```

Replace with:
```ts
function statusBadge(overallColor: string | null | undefined) {
  if (overallColor === "GREEN") return { label: "Promising", className: "text-green-700" };
  if (overallColor === "YELLOW" || overallColor === "AMBER") return { label: "Viable", className: "text-amber-600" };
  if (overallColor === "RED") return { label: "Concerning", className: "text-red-600" };
  return null;
}
```

**Step 2: Extract to shared utility**

Since the detail view will need the same mapping, extract to a shared helper. Create or add to an existing utils file:

```ts
// src/lib/status.ts
export function statusBadge(overallColor: string | null | undefined) {
  if (overallColor === "GREEN") return { label: "Promising", className: "text-green-700", bgClassName: "bg-green-50" };
  if (overallColor === "YELLOW" || overallColor === "AMBER") return { label: "Viable", className: "text-amber-600", bgClassName: "bg-amber-50" };
  if (overallColor === "RED") return { label: "Concerning", className: "text-red-600", bgClassName: "bg-red-50" };
  return null;
}

export function sizeTierLabel(sizeClassification: string | null | undefined): string | null {
  if (!sizeClassification) return null;
  const tiers: Record<string, string> = {
    micro: "Micro (25 students)",
    small: "Small (50 students)",
    medium: "Medium (100 students)",
    large: "Large (200 students)",
  };
  return tiers[sizeClassification.toLowerCase()] || sizeClassification;
}
```

Update `AltLocationCard.tsx` to import from `@/lib/status`.

**Step 3: Verify**

Run: `npm run dev` → check cards show "Promising" / "Viable" / "Concerning".

**Step 4: Commit**

```bash
git add src/lib/status.ts src/components/AltLocationCard.tsx
git commit -m "feat: update status badges, extract shared status utilities"
```

---

### Task 6: LocationDetailView Component (Shared)

**Files:**
- Create: `src/components/LocationDetailView.tsx`

**Step 1: Build the component**

This component is used by both desktop (inline in AltPanel) and mobile (standalone page). It accepts props for the location data and callbacks.

```tsx
"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Location, VoterInfo } from "@/types";
import { statusBadge, sizeTierLabel } from "@/lib/status";
import NotHereReasonModal from "./NotHereReasonModal";

const LAUNCH_THRESHOLD = 30;
const STREET_VIEW_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

interface LocationDetailViewProps {
  location: Location;
  voters: VoterInfo[];
  hasVotedIn: boolean;
  hasVotedNotHere: boolean;
  isAuthenticated: boolean;
  onBack: () => void;
  onVoteIn: () => void;
  onVoteNotHere: (comment?: string) => void;
}

export default function LocationDetailView({
  location,
  voters,
  hasVotedIn,
  hasVotedNotHere,
  isAuthenticated,
  onBack,
  onVoteIn,
  onVoteNotHere,
}: LocationDetailViewProps) {
  const [activeTab, setActiveTab] = useState<"in" | "concerns">("in");
  const [notHereModalOpen, setNotHereModalOpen] = useState(false);
  const [contribution, setContribution] = useState("");
  const [contributionSubmitted, setContributionSubmitted] = useState(false);

  const badge = statusBadge(location.scores?.overallColor);
  const sizeLabel = sizeTierLabel(location.scores?.sizeClassification);
  const streetViewUrl = STREET_VIEW_KEY
    ? `https://maps.googleapis.com/maps/api/streetview?size=800x300&location=${location.lat},${location.lng}&key=${STREET_VIEW_KEY}`
    : null;

  const inVoters = voters.filter(v => v.voteType === "in");
  const concernVoters = voters.filter(v => v.voteType === "not_here");
  const voteCount = location.votes || 0;
  const remaining = Math.max(0, LAUNCH_THRESHOLD - voteCount);

  function handleNotHere() {
    if (!isAuthenticated) return; // parent handles auth gating
    setNotHereModalOpen(true);
  }

  async function handleContributionSubmit() {
    if (!contribution.trim()) return;
    // POST to /api/contributions
    const res = await fetch("/api/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: location.id, comment: contribution.trim() }),
    });
    if (res.ok) {
      setContributionSubmitted(true);
      setContribution("");
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* 1. Back arrow */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-3 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to locations
      </button>

      {/* 2. Street View hero */}
      {streetViewUrl && (
        <img
          src={streetViewUrl}
          alt={`Street view of ${location.name}`}
          className="w-full h-48 object-cover"
        />
      )}

      <div className="px-5 py-4 space-y-5">
        {/* 3. Name + badge + size */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">{location.name}</h2>
          <p className="text-sm text-gray-500">{location.address}, {location.city}, {location.state}</p>
          <div className="flex items-center gap-2 mt-2">
            {badge && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.bgClassName} ${badge.className}`}>
                {badge.label}
              </span>
            )}
            {sizeLabel && (
              <span className="text-xs text-gray-500 font-medium">{sizeLabel}</span>
            )}
          </div>
        </div>

        {/* 4. Vote section */}
        {hasVotedIn ? (
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">You&rsquo;re in!</p>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all"
                style={{ width: `${Math.min(100, (voteCount / LAUNCH_THRESHOLD) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {voteCount} of {LAUNCH_THRESHOLD} families
              {remaining > 0
                ? ` — ${remaining} more to launch`
                : " — ready to launch!"}
            </p>
          </div>
        ) : (
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-base font-semibold text-gray-900 mb-1">Picture your kid here.</p>
            <p className="text-sm text-gray-500 mb-3">
              {voteCount} {voteCount === 1 ? "family" : "families"} interested
              {remaining > 0 && ` — ${remaining} more to launch`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onVoteIn}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                I&rsquo;m in
              </button>
              <button
                onClick={handleNotHere}
                disabled={hasVotedNotHere}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Not here
              </button>
            </div>
          </div>
        )}

        {/* 5. Contributions */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Help us fill in the gaps</h3>
          {contributionSubmitted ? (
            <p className="text-sm text-green-600">Thanks for sharing!</p>
          ) : (
            <>
              <textarea
                value={contribution}
                onChange={(e) => setContribution(e.target.value)}
                placeholder="Know something about this location? Zoning info, neighborhood details, anything helps..."
                className="w-full min-h-[80px] rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
              />
              <button
                onClick={handleContributionSubmit}
                disabled={!contribution.trim()}
                className="mt-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Share
              </button>
            </>
          )}
        </div>

        {/* 6. Who's in / Concerns tabs */}
        <div>
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("in")}
              className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "in"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Who&rsquo;s in ({inVoters.length})
            </button>
            <button
              onClick={() => setActiveTab("concerns")}
              className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "concerns"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Concerns ({concernVoters.length})
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {(activeTab === "in" ? inVoters : concernVoters).map((voter) => (
              <div key={voter.userId} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                  {(voter.displayName || voter.email || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{voter.displayName || voter.email}</p>
                  {voter.comment && (
                    <p className="text-xs text-gray-500">{voter.comment}</p>
                  )}
                </div>
              </div>
            ))}
            {(activeTab === "in" ? inVoters : concernVoters).length === 0 && (
              <p className="text-sm text-gray-400 py-2">No one yet.</p>
            )}
          </div>
        </div>
      </div>

      <NotHereReasonModal
        open={notHereModalOpen}
        onOpenChange={setNotHereModalOpen}
        locationName={location.name}
        onSubmit={(reason) => onVoteNotHere(reason)}
      />
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `npm run dev` — no import errors. Component not wired yet, just verify build succeeds.

**Step 3: Commit**

```bash
git add src/components/LocationDetailView.tsx
git commit -m "feat: add LocationDetailView component"
```

---

### Task 7: Desktop Wiring — AltPanel Shows Detail View

**Files:**
- Modify: `src/components/AltPanel.tsx`
- Modify: `src/lib/votes.ts` (add `loadLocationVoters` call on selection)

**Step 1: Wire LocationDetailView into AltPanel**

In `src/components/AltPanel.tsx`, when `selectedLocationId` is set and a matching location exists, render `LocationDetailView` instead of the list.

At the top of the component's return, before the header:
```tsx
const selectedLocation = selectedLocationId
  ? locations.find(l => l.id === selectedLocationId) || filteredLocations().find(l => l.id === selectedLocationId)
  : null;

if (selectedLocation) {
  const voters = locationVoters.get(selectedLocation.id) || [];
  return (
    <LocationDetailView
      location={selectedLocation}
      voters={voters}
      hasVotedIn={votedLocationIds.has(selectedLocation.id)}
      hasVotedNotHere={votedNotHereIds.has(selectedLocation.id)}
      isAuthenticated={isAuthenticated}
      onBack={() => setSelectedLocation(null)}
      onVoteIn={() => voteIn(selectedLocation.id)}
      onVoteNotHere={(comment) => voteNotHere(selectedLocation.id, comment)}
    />
  );
}
```

**Step 2: Load voters on selection**

In the store or in AltPanel, when `selectedLocationId` changes, call `loadLocationVoters(id)` so the voter list is available:

```tsx
useEffect(() => {
  if (selectedLocationId) {
    loadLocationVoters([selectedLocationId]);
  }
}, [selectedLocationId, loadLocationVoters]);
```

**Step 3: Verify**

Run: `npm run dev` → click a location card → panel replaces with detail view → click back arrow → returns to list.

**Step 4: Commit**

```bash
git add src/components/AltPanel.tsx
git commit -m "feat: wire LocationDetailView into AltPanel for desktop"
```

---

### Task 8: Mobile Route — `/location/[id]`

**Files:**
- Create: `src/app/location/[id]/page.tsx`
- Modify: `src/components/AltLocationCard.tsx` (add mobile navigation)

**Step 1: Create the page route**

Follow the async params pattern from the existing `/api/locations/[id]/route.ts`:

```tsx
"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LocationDetailView from "@/components/LocationDetailView";
import { useVotesStore } from "@/lib/votes";
import { useAuth } from "@/components/AuthProvider";
import { Location, VoterInfo } from "@/types";

export default function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const {
    locations, votedLocationIds, votedNotHereIds,
    voteIn, voteNotHere, loadLocationVoters, locationVoters,
  } = useVotesStore();

  const location = locations.find(l => l.id === id);
  const voters = locationVoters.get(id) || [];

  useEffect(() => {
    if (id) loadLocationVoters([id]);
  }, [id, loadLocationVoters]);

  if (!location) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Loading location...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white">
      <LocationDetailView
        location={location}
        voters={voters}
        hasVotedIn={votedLocationIds.has(id)}
        hasVotedNotHere={votedNotHereIds.has(id)}
        isAuthenticated={isAuthenticated}
        onBack={() => router.back()}
        onVoteIn={() => voteIn(id)}
        onVoteNotHere={(comment) => voteNotHere(id, comment)}
      />
    </div>
  );
}
```

**Step 2: Add mobile navigation to card click**

In `src/components/AltLocationCard.tsx`, update the card click handler. Add a prop `onNavigate?: () => void` for mobile. In AltPanel, detect mobile (`window.innerWidth < 1024`) and pass `router.push(`/location/${loc.id}`)` as `onNavigate`.

Alternatively, handle in AltPanel:
```tsx
onSelect={() => {
  setSelectedLocation(loc.id);
  if (window.innerWidth < 1024) {
    router.push(`/location/${loc.id}`);
  }
}}
```

**Step 3: Verify**

Run: `npm run dev` → resize browser to mobile width → click a card → navigates to `/location/[id]` → back button works.

**Step 4: Commit**

```bash
git add src/app/location/[id]/page.tsx src/components/AltPanel.tsx
git commit -m "feat: add /location/[id] page route for mobile detail view"
```

---

### Task 9: `pp_contributions` Table + API Route

**Files:**
- Supabase DB (via MCP)
- Create: `src/app/api/contributions/route.ts`

**Step 1: Create the table**

```sql
CREATE TABLE pp_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES pp_locations(id),
  user_id uuid REFERENCES auth.users(id),
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pp_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert contributions"
  ON pp_contributions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can read own contributions"
  ON pp_contributions FOR SELECT
  USING (user_id = auth.uid());
```

Run via `mcp__supabase__execute_sql`.

**Step 2: Create API route**

Follow the pattern from `src/app/api/help-request/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const { locationId, comment } = await request.json();

  if (!locationId || !comment?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Extract user from auth header
  let userId: string | null = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data } = await supabase.auth.getUser(token);
    userId = data.user?.id || null;
  }

  const { error } = await supabase.from("pp_contributions").insert({
    location_id: locationId,
    user_id: userId,
    comment: comment.trim(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

**Step 3: Update LocationDetailView to send auth token**

In the `handleContributionSubmit` function, include the session token:
```tsx
const session = useAuth().session; // add to props or use hook

const res = await fetch("/api/contributions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  },
  body: JSON.stringify({ locationId: location.id, comment: contribution.trim() }),
});
```

**Step 4: Verify**

Run: `npm run dev` → open detail view → type a contribution → submit → success message appears. Check Supabase for the row.

**Step 5: Commit**

```bash
git add src/app/api/contributions/route.ts src/components/LocationDetailView.tsx
git commit -m "feat: add pp_contributions table and API route"
```

---

### Task 10: Update `get_location_voters` RPC

**Files:**
- Supabase DB (via MCP)
- Modify: `src/types/index.ts` (`VoterInfo` type)
- Modify: `src/lib/votes.ts` (where RPC response is parsed)

**Step 1: Update RPC to return comment + created_at**

```sql
CREATE OR REPLACE FUNCTION get_location_voters(location_ids uuid[])
RETURNS TABLE(
  location_id uuid,
  user_id uuid,
  vote_type text,
  display_name text,
  email text,
  comment text,
  created_at timestamptz
) AS $$
  SELECT v.location_id, v.user_id, v.vote_type, p.display_name, p.email, v.comment, v.created_at
  FROM pp_votes v
  JOIN pp_profiles p ON p.id = v.user_id
  WHERE v.location_id = ANY(location_ids)
  ORDER BY v.created_at ASC;
$$ LANGUAGE sql SECURITY DEFINER;
```

Run via `mcp__supabase__execute_sql`.

**Step 2: Update VoterInfo type**

In `src/types/index.ts`:
```ts
export interface VoterInfo {
  userId: string;
  voteType: "in" | "not_here";
  displayName: string | null;
  email: string | null;
  comment: string | null;    // NEW
  createdAt: string | null;  // NEW
}
```

**Step 3: Update store parsing**

In `src/lib/votes.ts`, wherever the RPC response is mapped to `VoterInfo`, add the new fields:
```ts
comment: row.comment || null,
createdAt: row.created_at || null,
```

**Step 4: Verify**

Run: `npm run dev` → vote "Not here" with a reason → open detail view → Concerns tab shows the voter with their comment.

**Step 5: Commit**

```bash
git add src/types/index.ts src/lib/votes.ts
git commit -m "feat: include comment and created_at in voter data"
```

---

### Task 11: Final Integration + Visual QA

**Files:**
- Various (fixes found during QA)

**Step 1: Test all flows end-to-end**

1. Desktop: Click card → detail view loads with Street View, badge, size, vote buttons → vote "I'm in" → progress bar appears → back to list
2. Desktop: Click card → vote "Not here" → reason modal → submit → Concerns tab shows your concern
3. Desktop: Zoomed out → city cards visible → click city → zooms in → location cards appear
4. Mobile: Click card → navigates to `/location/[id]` → full page detail → back button works
5. Header: "ALPHA SCHOOL" shows when zoomed out, "ALPHA SCHOOL · HOUSTON" when zoomed in, auth button inline
6. Heading: "Choose where your kid goes to school." does not wrap
7. Contributions: Type a comment → submit → "Thanks" message

**Step 2: Fix any issues found**

Address visual or functional bugs.

**Step 3: Final commit**

```bash
git commit -m "fix: integration fixes from QA"
```

**Step 4: Deploy**

```bash
vercel --prod
```
