"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVotesStore } from "@/lib/votes";
import { useShallow } from "zustand/react/shallow";
import { useAuth } from "./AuthProvider";
import { AltLocationCard } from "./AltLocationCard";
import LocationDetailView from "./LocationDetailView";
import { InviteModal } from "./InviteModal";
import { AuthButton } from "./AuthButton";
import { Location } from "@/types";
import { getDistanceMiles } from "@/lib/locations";
import { Eye } from "lucide-react";

const COLOR_RANK: Record<string, number> = { GREEN: 0, YELLOW: 1, AMBER: 2, RED: 3 };

function sortMostSupport(a: Location, b: Location): number {
  if (b.votes !== a.votes) return b.votes - a.votes;
  const aRank = COLOR_RANK[a.scores?.overallColor || ""] ?? 99;
  const bRank = COLOR_RANK[b.scores?.overallColor || ""] ?? 99;
  return aRank - bRank;
}

function sortMostViable(a: Location, b: Location): number {
  const aRank = COLOR_RANK[a.scores?.overallColor || ""] ?? 99;
  const bRank = COLOR_RANK[b.scores?.overallColor || ""] ?? 99;
  if (aRank !== bRank) return aRank - bRank;
  return b.votes - a.votes;
}

const PAGE_SIZE = 25;

export function AltPanel() {
  const {
    locations, filteredLocations, selectedLocationId, setSelectedLocation,
    voteIn, voteNotHere, removeVote, votedLocationIds, votedNotHereIds,
    mapBounds, sortMode, setSortMode,
    locationVoters, loadLocationVoters, zoomLevel,
    citySummaries, setFlyToTarget, userLocation,
    viewAsParent, setViewAsParent,
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
  })));

  const { user, session, isAdmin } = useAuth();
  const isAuthenticated = !!user;
  const router = useRouter();

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
    return entries[0][0];
  }, [zoomLevel, filteredLocations, locations]);

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
  }, [filteredLocations, mapBounds, sortMode, locations]);

  // Pagination — track extra pages loaded beyond first page
  const [extraPages, setExtraPages] = useState(0);
  // Reset extra pages when sort or bounds change
  const resetKey = `${sortMode}-${mapBounds?.north}-${mapBounds?.south}-${mapBounds?.east}-${mapBounds?.west}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (extraPages !== 0) setExtraPages(0);
  }
  const visibleLocations = sortedLocations.slice(0, (extraPages + 1) * PAGE_SIZE);

  // Load voter details for visible cards
  useEffect(() => {
    const ids = visibleLocations.map(l => l.id);
    if (ids.length > 0) loadLocationVoters(ids);
  }, [visibleLocations.map(l => l.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

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
              {viewAsParent ? "Parent view" : "View as parent"}
            </button>
          )}
        </div>
        <div className="flex justify-end mt-1">
          <AuthButton darkBg={false} />
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
          {/* Legend + Sort pills */}
          <div className="px-5 pb-2 pt-1 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-2">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Promising</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Viable</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Needs Work</span>
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
            {sortedLocations.length > visibleLocations.length && (
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
