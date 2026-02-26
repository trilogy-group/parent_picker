"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVotesStore } from "@/lib/votes";
import { useShallow } from "zustand/react/shallow";
import { useAuth } from "./AuthProvider";
import { AltLocationCard } from "./AltLocationCard";
import LocationDetailView from "./LocationDetailView";
import { InviteModal } from "./InviteModal";
import { ProfilePopover } from "./ProfilePopover";
import { getDistanceMiles } from "@/lib/locations";
import { sortMostSupport, sortMostViable } from "@/lib/sort";
import { Eye, Check } from "lucide-react";
import { extractStreet } from "@/lib/address";

const PAGE_SIZE = 25;

export function AltPanel() {
  const {
    locations, filteredLocations, selectedLocationId, setSelectedLocation,
    voteIn, voteNotHere, removeVote, votedLocationIds, votedNotHereIds,
    mapBounds, sortMode, setSortMode,
    locationVoters, loadLocationVoters, zoomLevel,
    citySummaries, setFlyToTarget, userLocation,
    viewAsParent, setViewAsParent,
    showTopOnly, setShowTopOnly,
    altSizeFilter, setAltSizeFilter,
  } = useVotesStore(useShallow((s) => ({
    locations: s.locations,
    filteredLocations: s.filteredLocations,
    selectedLocationId: s.selectedLocationId,
    setSelectedLocation: s.setSelectedLocation,
    voteIn: s.voteIn,
    voteNotHere: s.voteNotHere,
    removeVote: s.removeVote,
    votedLocationIds: s.votedLocationIds,
    votedNotHereIds: s.votedNotHereIds,
    mapBounds: s.mapBounds,
    sortMode: s.sortMode,
    setSortMode: s.setSortMode,
    locationVoters: s.locationVoters,
    loadLocationVoters: s.loadLocationVoters,
    zoomLevel: s.zoomLevel,
    citySummaries: s.citySummaries,
    setFlyToTarget: s.setFlyToTarget,
    userLocation: s.userLocation,
    viewAsParent: s.viewAsParent,
    setViewAsParent: s.setViewAsParent,
    showTopOnly: s.showTopOnly,
    setShowTopOnly: s.setShowTopOnly,
    altSizeFilter: s.altSizeFilter,
    setAltSizeFilter: s.setAltSizeFilter,
  })));

  const { user, session, isAdmin } = useAuth();
  const isAuthenticated = !!user;
  const router = useRouter();

  const [proposedStyle, setProposedStyle] = useState<"hero" | "pinned">("hero");

  // Find selected location for detail view
  const selectedLocation = selectedLocationId
    ? locations.find(l => l.id === selectedLocationId)
    : null;

  // Load voters when location selected (for detail view)
  useEffect(() => {
    if (selectedLocationId) {
      loadLocationVoters([selectedLocationId]);
    }
  }, [selectedLocationId, loadLocationVoters]);

  // Determine metro name when zoomed in
  const METRO_DISPLAY: Record<string, string> = {
    "Irvine": "Orange County",
    "Santa Ana": "Orange County",
    "Anaheim": "Orange County",
    "Costa Mesa": "Orange County",
    "Newport Beach": "Orange County",
    "Stamford": "Greenwich",
    "Phoenix": "Scottsdale",
  };

  const metroName = useMemo(() => {
    if (zoomLevel < 9) return null;
    const filtered = filteredLocations();
    if (filtered.length === 0) return null;
    const cityCount: Record<string, number> = {};
    for (const loc of filtered) {
      const key = loc.city;
      cityCount[key] = (cityCount[key] || 0) + 1;
    }
    const entries = Object.entries(cityCount);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    const topCity = entries[0][0];
    return METRO_DISPLAY[topCity] || topCity;
  }, [zoomLevel, filteredLocations, locations, altSizeFilter]);

  // City summaries sorted by location count (for zoomed-out view)
  const sortedCities = useMemo(() => {
    return [...citySummaries].sort((a, b) => b.locationCount - a.locationCount);
  }, [citySummaries]);

  const showCityCards = zoomLevel < 9;

  // Sort and filter locations in viewport
  const sortedLocations = useMemo(() => {
    const filtered = filteredLocations();
    if (!mapBounds) return filtered;
    const inView = filtered.filter(loc =>
      loc.lat <= mapBounds.north && loc.lat >= mapBounds.south &&
      loc.lng <= mapBounds.east && loc.lng >= mapBounds.west
    );
    const sortFn = sortMode === 'most_support' ? sortMostSupport : sortMostViable;
    return [...inView].sort(sortFn);
  }, [filteredLocations, mapBounds, sortMode, locations, altSizeFilter]);

  const proposedLocations = useMemo(() => {
    return sortedLocations.filter(loc => loc.proposed);
  }, [sortedLocations]);

  const regularLocations = useMemo(() => {
    return sortedLocations.filter(loc => !loc.proposed);
  }, [sortedLocations]);

  const TOP_N = 10;

  // Pagination — track extra pages loaded beyond first page (only used in "show all" mode)
  const [extraPages, setExtraPages] = useState(0);
  // Reset extra pages when sort or bounds change
  const resetKey = `${sortMode}-${altSizeFilter}-${mapBounds?.north}-${mapBounds?.south}-${mapBounds?.east}-${mapBounds?.west}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (extraPages !== 0) setExtraPages(0);
  }
  const listLocations = proposedStyle === "hero" ? regularLocations : sortedLocations;
  const visibleLocations = showTopOnly
    ? listLocations.slice(0, TOP_N)
    : listLocations.slice(0, (extraPages + 1) * PAGE_SIZE);

  // Load voter details for visible cards
  const visibleIdKey = visibleLocations.map(l => l.id).join(',');
  useEffect(() => {
    const ids = visibleLocations.map(l => l.id);
    if (ids.length > 0) loadLocationVoters(ids);
  }, [visibleIdKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Desktop: render detail view when a location is selected
  if (selectedLocation) {
    const voters = locationVoters.get(selectedLocation.id) || [];
    return (
      <LocationDetailView
        location={selectedLocation}
        voters={voters}
        hasVotedIn={votedLocationIds.has(selectedLocation.id)}
        hasVotedNotHere={votedNotHereIds.has(selectedLocation.id)}
        isAuthenticated={isAuthenticated}
        session={session}
        onBack={() => setSelectedLocation(null)}
        onVoteIn={() => voteIn(selectedLocation.id)}
        onVoteNotHere={(comment) => voteNotHere(selectedLocation.id, comment)}
        onRemoveVote={() => removeVote(selectedLocation.id)}
        onContributionSubmitted={() => loadLocationVoters([selectedLocation.id], true)}
        distanceMi={userLocation ? getDistanceMiles(userLocation.lat, userLocation.lng, selectedLocation.lat, selectedLocation.lng) : null}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <p className="text-lg font-bold text-blue-600 tracking-wide">
            ALPHA SCHOOL{metroName ? <> &middot; {metroName.toUpperCase()}</> : null}
          </p>
          {isAdmin && (
            <button
              onClick={() => setViewAsParent(!viewAsParent)}
              className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md transition-colors shrink-0 ${
                viewAsParent
                  ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              <Eye className="h-3 w-3" />
              {viewAsParent ? "Parent" : "Admin"}
            </button>
          )}
        </div>
        <div className="flex justify-end mt-1">
          <ProfilePopover />
        </div>
        <div className="bg-blue-50 rounded-xl p-4 mt-2">
          <p className="text-sm font-semibold text-blue-600">Choose where your kid goes to school.</p>
          <p className="text-[13px] leading-snug text-gray-500 mt-0.5">
            Here are locations we&rsquo;re considering along with community opinions. Tell us if you like a location. Share what you know. Enough families, and it happens.
          </p>
        </div>
      </div>

      {/* Action boxes */}
      <div className="px-5 mb-4 space-y-3">
        {/* Invite someone */}
        <InviteModal />

        {/* Suggest a location */}
        <a
          href="/suggest"
          className="block bg-blue-50 rounded-xl p-4 hover:bg-blue-100/60 transition-colors"
        >
          <p className="text-sm font-semibold text-blue-600">Suggest a location &rarr;</p>
          <p className="text-[13px] leading-snug text-gray-500 mt-0.5">Know a space that&apos;s not here? We&apos;ll evaluate it within 24 hours.</p>
        </a>
      </div>

      {/* Admin A/B toggle for proposed style */}
      {isAdmin && !showCityCards && proposedLocations.length > 0 && (
        <div className="px-5 pb-2">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-gray-400">Proposed style:</span>
            <button
              onClick={() => setProposedStyle("hero")}
              className={`px-2 py-0.5 rounded ${proposedStyle === "hero" ? "bg-indigo-100 text-indigo-700 font-medium" : "text-gray-500 hover:text-gray-700"}`}
            >
              A: Hero
            </button>
            <button
              onClick={() => setProposedStyle("pinned")}
              className={`px-2 py-0.5 rounded ${proposedStyle === "pinned" ? "bg-indigo-100 text-indigo-700 font-medium" : "text-gray-500 hover:text-gray-700"}`}
            >
              B: Pinned
            </button>
          </div>
        </div>
      )}

      {showCityCards ? (
        /* Zoomed-out: city summary cards */
        <div className="px-4 py-2 space-y-2">
          {sortedCities.map((city) => (
            <button
              key={`${city.city}-${city.state}`}
              onClick={() => setFlyToTarget({ lat: city.lat, lng: city.lng, zoom: 11 })}
              className="w-full p-4 bg-white rounded-xl border border-gray-200 text-left hover:border-blue-300 transition-colors"
            >
              <p className="font-semibold text-gray-900">{city.city}, {city.state}</p>
              <p className="text-sm text-gray-500">
                {city.locationCount} {city.locationCount === 1 ? 'location' : 'locations'}
              </p>
            </button>
          ))}
          {sortedCities.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">
              Loading cities&hellip;
            </p>
          )}
        </div>
      ) : (
        /* Zoomed-in: location cards with sort pills */
        <>
          {/* Hero section for proposed locations (Approach A) */}
          {proposedStyle === "hero" && proposedLocations.length > 0 && (
            <div className="px-5 pb-4">
              {proposedLocations.map((loc) => {
                const LAUNCH_THRESHOLD = 30;
                const pct = Math.min(100, (loc.votes / LAUNCH_THRESHOLD) * 100);
                const remaining = Math.max(0, LAUNCH_THRESHOLD - loc.votes);
                const hasVoted = votedLocationIds.has(loc.id);
                const dist = userLocation ? getDistanceMiles(userLocation.lat, userLocation.lng, loc.lat, loc.lng) : null;
                return (
                  <div
                    key={loc.id}
                    onClick={() => {
                      setSelectedLocation(loc.id);
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        router.push(`/location/${loc.id}`);
                      }
                    }}
                    className="border-2 border-indigo-300 bg-indigo-50/50 rounded-xl p-5 cursor-pointer hover:shadow-lg transition-all"
                  >
                    <span className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase">Proposed Location</span>
                    <h3 className="text-lg font-bold text-gray-900 mt-1">
                      {extractStreet(loc.address, loc.city)}
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {loc.city}, {loc.state}
                      {dist != null ? ` · ${dist.toFixed(1)} mi` : ''}
                    </p>
                    <p className="text-[13px] text-gray-600 mt-3 leading-snug">
                      We&rsquo;re in late-stage talks for this space. Enough family support helps us finalize.
                    </p>
                    {/* Progress bar — only show when there are votes */}
                    {loc.votes > 0 && (
                      <div className="mt-3">
                        <div className="w-full bg-indigo-100 rounded-full h-5 relative overflow-hidden">
                          <div className="bg-indigo-600 h-5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-gray-700">
                            {loc.votes} in &middot; {remaining} to go
                          </span>
                          <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
                            <span className="flex items-center justify-center text-[11px] font-medium text-white h-full whitespace-nowrap" style={{ width: `${10000 / pct}%` }}>
                              {loc.votes} in &middot; {remaining} to go
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Vote buttons */}
                    <div className="flex gap-2 mt-4">
                      {hasVoted ? (
                        <div className="flex items-center gap-1.5 text-sm text-gray-700 font-medium py-2">
                          <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                          You&apos;re in
                          <button onClick={(e) => { e.stopPropagation(); removeVote(loc.id); }} className="ml-2 text-xs text-gray-400 hover:text-gray-600 underline">undo</button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); voteIn(loc.id); }}
                            className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                          >
                            I&apos;d choose this location
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); }}
                            className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Not for me
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-3 mt-4 mb-1">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">Also in this area</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            </div>
          )}

          {/* Legend + Size filter + Sort pills */}
          <div className="px-5 pb-2 pt-1 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-2">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Promising</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Viable</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Needs Work</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500">Size</span>
              <span className="relative">
                <button
                  onClick={() => setAltSizeFilter("micro")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    altSizeFilter === "micro"
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Micro
                  <span className={`ml-1 text-[10px] ${altSizeFilter === "micro" ? 'text-blue-200' : 'text-gray-400'}`}>(25-50)</span>
                </button>
                <span className="absolute -top-2 -right-1 text-[8px] font-bold text-white bg-amber-500 px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                  Focus
                </span>
              </span>
              <button
                onClick={() => setAltSizeFilter("all")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  altSizeFilter === "all"
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All sizes
              </button>
            </div>
          </div>
          <div className="px-5 pb-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort</span>
            {(['most_support', 'most_viable'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  sortMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {mode === 'most_support' ? 'Most support' : 'Most viable'}
              </button>
            ))}
            <button
              onClick={() => { setShowTopOnly(!showTopOnly); setExtraPages(0); }}
              className="ml-auto text-xs text-blue-600 font-medium hover:underline"
            >
              {showTopOnly ? `Show all (${listLocations.length})` : 'Top 10'}
            </button>
          </div>

          {/* Location cards */}
          <div className="px-5 pb-5 space-y-3">
            {visibleLocations.map((loc) => (
              <AltLocationCard
                key={loc.id}
                location={loc}
                voters={locationVoters.get(loc.id) || []}
                hasVotedIn={votedLocationIds.has(loc.id)}
                hasVotedNotHere={votedNotHereIds.has(loc.id)}
                isAuthenticated={isAuthenticated}
                isSelected={false}
                isProposed={proposedStyle === "pinned" && loc.proposed === true}
                distanceMi={userLocation ? getDistanceMiles(userLocation.lat, userLocation.lng, loc.lat, loc.lng) : null}
                onSelect={() => {
                  setSelectedLocation(loc.id);
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                    router.push(`/location/${loc.id}`);
                  }
                }}
                onVoteIn={() => voteIn(loc.id)}
                onVoteNotHere={(comment) => voteNotHere(loc.id, comment)}
                onRemoveVote={() => removeVote(loc.id)}
              />
            ))}
            {!showTopOnly && listLocations.length > visibleLocations.length && (
              <button
                onClick={() => setExtraPages(p => p + 1)}
                className="w-full py-2 text-sm text-blue-600 font-medium hover:underline"
              >
                Show more locations
              </button>
            )}
            {visibleLocations.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">
                No locations in this area yet. Zoom out or search a different city.
              </p>
            )}

          </div>
        </>
      )}
    </div>
  );
}
