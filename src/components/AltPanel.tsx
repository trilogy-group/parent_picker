"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useVotesStore } from "@/lib/votes";
import { useShallow } from "zustand/react/shallow";
import { useAuth } from "./AuthProvider";
import { AltLocationCard } from "./AltLocationCard";
import LocationDetailView from "./LocationDetailView";
import { ProfilePopover } from "./ProfilePopover";
import { getDistanceMiles } from "@/lib/locations";
import { findNearestMetro } from "@/lib/metros";
import { sortMostSupport, sortMostViable, sortMostViableWithPriority, makeSortNearest } from "@/lib/sort";
import type { Location } from "@/types";
import { Eye, Check, ChevronDown, Search, X, ChevronLeft, MapPin } from "lucide-react";
import { extractStreet } from "@/lib/address";
import { AvatarRow } from "./AvatarRow";
import { pointInIsochrone } from "@/lib/geo";

const PAGE_SIZE = 25;

export function AltPanel() {
  const {
    locations, filteredLocations, selectedLocationId, setSelectedLocation,
    voteIn, voteNotHere, removeVote, updateVoteComment, votedLocationIds, votedNotHereIds,
    mapBounds, sortMode, setSortMode,
    locationVoters, loadLocationVoters, zoomLevel,
    citySummaries, setFlyToTarget, userLocation, setZoomLevel, mapCenter,
    viewAsParent, setViewAsParent,
    showTopOnly, setShowTopOnly,
    altSizeFilter, setAltSizeFilter,
    viableSubPriority, setViableSubPriority,
    deepLinkTab, setDeepLinkTab,
    showDriveFilter, setShowDriveFilter, userIsochrone,
    driveTimeMinutes, setDriveTimeMinutes,
    showNoBlockers, setShowNoBlockers,
  } = useVotesStore(useShallow((s) => ({
    locations: s.locations,
    filteredLocations: s.filteredLocations,
    selectedLocationId: s.selectedLocationId,
    setSelectedLocation: s.setSelectedLocation,
    voteIn: s.voteIn,
    voteNotHere: s.voteNotHere,
    removeVote: s.removeVote,
    updateVoteComment: s.updateVoteComment,
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
    setZoomLevel: s.setZoomLevel,
    mapCenter: s.mapCenter,
    userLocation: s.userLocation,
    viewAsParent: s.viewAsParent,
    setViewAsParent: s.setViewAsParent,
    showTopOnly: s.showTopOnly,
    setShowTopOnly: s.setShowTopOnly,
    altSizeFilter: s.altSizeFilter,
    setAltSizeFilter: s.setAltSizeFilter,
    viableSubPriority: s.viableSubPriority,
    setViableSubPriority: s.setViableSubPriority,
    deepLinkTab: s.deepLinkTab,
    setDeepLinkTab: s.setDeepLinkTab,
    showDriveFilter: s.showDriveFilter,
    setShowDriveFilter: s.setShowDriveFilter,
    userIsochrone: s.userIsochrone,
    driveTimeMinutes: s.driveTimeMinutes,
    setDriveTimeMinutes: s.setDriveTimeMinutes,
    showNoBlockers: s.showNoBlockers,
    setShowNoBlockers: s.setShowNoBlockers,
  })));

  const { user, session, isAdmin } = useAuth();
  const isAuthenticated = !!user;
  const router = useRouter();
  const effectiveAdmin = isAdmin && !viewAsParent;

  // Subscore popover state
  const [showSubPopover, setShowSubPopover] = useState(false);
  const subPopoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showSubPopover) return;
    const handleClick = (e: MouseEvent) => {
      if (subPopoverRef.current && !subPopoverRef.current.contains(e.target as Node)) {
        setShowSubPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSubPopover]);

  // Size filter popover state
  const [showSizePopover, setShowSizePopover] = useState(false);
  const sizePopoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showSizePopover) return;
    const handleClick = (e: MouseEvent) => {
      if (sizePopoverRef.current && !sizePopoverRef.current.contains(e.target as Node)) {
        setShowSizePopover(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSizePopover]);

  // Drive time popover state
  const [showDrivePopover, setShowDrivePopover] = useState(false);
  const drivePopoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showDrivePopover) return;
    const handleClick = (e: MouseEvent) => {
      if (drivePopoverRef.current && !drivePopoverRef.current.contains(e.target as Node)) {
        setShowDrivePopover(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDrivePopover]);

  // Admin search state
  const [adminSearch, setAdminSearch] = useState("");

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

  // Determine metro name from map center (not from location counts, which skew toward high-volume metros)
  const METRO_DISPLAY: Record<string, string> = {
    "Phoenix": "Scottsdale",
  };

  const metroName = useMemo(() => {
    if (zoomLevel < 9 || !mapCenter) return null;
    const metro = findNearestMetro(mapCenter.lat, mapCenter.lng);
    if (!metro) return null;
    return METRO_DISPLAY[metro.name] || metro.name;
  }, [zoomLevel, mapCenter]);

  // City summaries sorted by location count (for zoomed-out view)
  const sortedCities = useMemo(() => {
    return [...citySummaries].sort((a, b) => b.locationCount - a.locationCount);
  }, [citySummaries]);

  const showCityCards = zoomLevel < 9;

  // Sort and filter locations in viewport
  const sortedLocations = useMemo(() => {
    const filtered = filteredLocations();
    if (!mapBounds) return filtered;
    const pool = filtered.filter(loc =>
      loc.lat <= mapBounds.north && loc.lat >= mapBounds.south &&
      loc.lng <= mapBounds.east && loc.lng >= mapBounds.west
    );
    let sortFn: (a: typeof pool[0], b: typeof pool[0]) => number;
    if (sortMode === 'nearest' && userLocation) {
      sortFn = makeSortNearest(userLocation.lat, userLocation.lng);
    } else if (sortMode === 'most_support') {
      sortFn = sortMostSupport;
    } else if (viableSubPriority && sortMode === 'most_viable') {
      sortFn = (a, b) => sortMostViableWithPriority(a, b, viableSubPriority);
    } else {
      sortFn = sortMostViable;
    }
    let sorted = [...pool].sort(sortFn);
    // Apply "Close to me" drive-time filter (promoted locations bypass)
    if (showDriveFilter && userIsochrone) {
      sorted = sorted.filter(loc => !!loc.feedbackDeadline || pointInIsochrone(loc.lat, loc.lng, userIsochrone));
    }
    // Deduplicate by ID (safety net against render-time race conditions)
    const seen = new Set<string>();
    return sorted.filter(loc => {
      if (seen.has(loc.id)) return false;
      seen.add(loc.id);
      return true;
    });
  }, [filteredLocations, mapBounds, sortMode, viableSubPriority, userLocation, locations, altSizeFilter, viewAsParent, showDriveFilter, userIsochrone, showNoBlockers]);

  // Apply admin search filter
  const searchFilteredLocations = useMemo(() => {
    if (!adminSearch.trim()) return sortedLocations;
    const q = adminSearch.toLowerCase().trim();
    return sortedLocations.filter(loc => {
      const text = `${loc.address} ${loc.city} ${loc.name || ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [sortedLocations, adminSearch]);

  const proposedLocations = useMemo(() => {
    return searchFilteredLocations.filter(loc => loc.proposed);
  }, [searchFilteredLocations]);

  const regularLocations = useMemo(() => {
    return searchFilteredLocations.filter(loc => !loc.proposed);
  }, [searchFilteredLocations]);

  const getDeadlineInfo = (loc: Location) => {
    if (!loc.feedbackDeadline) return null;
    const deadline = new Date(loc.feedbackDeadline);
    const now = new Date();
    const msLeft = deadline.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    const expired = msLeft <= 0;
    const dateStr = deadline.toLocaleDateString("en-US", { month: "long", day: "numeric" });
    let urgency: "green" | "amber" | "red" = "green";
    if (daysLeft <= 1) urgency = "red";
    else if (daysLeft <= 3) urgency = "amber";
    return { daysLeft, expired, dateStr, urgency };
  };

  const TOP_N = 10;

  // Pagination — track extra pages loaded beyond first page (only used in "show all" mode)
  const [extraPages, setExtraPages] = useState(0);
  // Reset extra pages when sort or bounds change
  const resetKey = `${sortMode}-${altSizeFilter}-${showDriveFilter}-${showNoBlockers}-${mapBounds?.north}-${mapBounds?.south}-${mapBounds?.east}-${mapBounds?.west}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (extraPages !== 0) setExtraPages(0);
  }
  const listLocations = proposedLocations.length > 0 ? regularLocations : searchFilteredLocations;
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
        onUpdateVoteComment={(comment) => updateVoteComment(selectedLocation.id, comment)}
        distanceMi={userLocation ? getDistanceMiles(userLocation.lat, userLocation.lng, selectedLocation.lat, selectedLocation.lng) : null}
        initialTab={deepLinkTab || undefined}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <p className="text-lg font-bold text-blue-600 tracking-wide">
            ALPHA SCHOOL
            {metroName && !showCityCards ? (
              <button
                onClick={() => setZoomLevel(4)}
                className="lg:pointer-events-none inline-flex items-center gap-0.5"
              >
                <ChevronLeft className="h-4 w-4 lg:hidden" />
                <span> &middot; {metroName.toUpperCase()}</span>
              </button>
            ) : metroName ? (
              <> &middot; {metroName.toUpperCase()}</>
            ) : null}
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
              onClick={() => setFlyToTarget({ lat: city.lat, lng: city.lng, zoom: 9 })}
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
          {proposedLocations.length > 0 && (
            <div className="px-5 pb-4">
              {proposedLocations.map((loc) => {
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
                    {/* Deadline-aware messaging */}
                    {(() => {
                      const dl = getDeadlineInfo(loc);
                      if (!dl) {
                        return (
                          <p className="text-[13px] text-gray-600 mt-3 leading-snug">
                            We&rsquo;re in late-stage talks for this space. Enough family support helps us finalize.
                          </p>
                        );
                      }
                      if (dl.expired) {
                        return (
                          <p className="text-[13px] text-gray-600 mt-3 leading-snug">
                            Voting closed &mdash; {loc.votes} {loc.votes === 1 ? "family" : "families"} in{loc.notHereVotes > 0 ? `, ${loc.notHereVotes} concern${loc.notHereVotes !== 1 ? "s" : ""}` : ""}.
                          </p>
                        );
                      }
                      return (
                        <>
                          <p className="text-[13px] text-gray-600 mt-3 leading-snug">
                            We&rsquo;re finalizing a lease for this space. Tell us if you&rsquo;re in &mdash; voting closes <strong>{dl.dateStr}</strong>.
                          </p>
                          <span className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                            dl.urgency === "red" ? "bg-red-100 text-red-700" :
                            dl.urgency === "amber" ? "bg-amber-100 text-amber-700" :
                            "bg-green-100 text-green-700"
                          }`}>
                            {dl.daysLeft <= 1 ? "Closes today!" : `${dl.daysLeft} days left`}
                          </span>
                        </>
                      );
                    })()}
                    {/* Avatars + count */}
                    {loc.votes > 0 && (
                      <div className="flex items-center gap-2 mt-3">
                        <AvatarRow voters={locationVoters.get(loc.id) || []} />
                        <span className="text-sm text-gray-600 font-medium">{loc.votes} in</span>
                      </div>
                    )}
                    {/* Concerns */}
                    {loc.notHereVotes > 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        {loc.notHereVotes} concern{loc.notHereVotes !== 1 ? "s" : ""}
                      </p>
                    )}
                    {/* Vote buttons — locked after deadline */}
                    {!getDeadlineInfo(loc)?.expired && (
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
                              I&apos;m good with this location
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
                    )}
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
              <span className="text-xs text-gray-500">Filter</span>
              <div className="relative" ref={sizePopoverRef}>
                <button
                  onClick={() => {
                    if (altSizeFilter === "all") {
                      setAltSizeFilter("micro");
                    } else {
                      setShowSizePopover(!showSizePopover);
                    }
                  }}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    altSizeFilter !== "all"
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {{ micro: "25-100 students", micro2: "100-200 students", growth: "200-500 students", full: "500+ students", all: "Size" }[altSizeFilter]}
                  {altSizeFilter !== "all" && (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
                {showSizePopover && altSizeFilter !== "all" && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
                    {([
                      { value: "micro" as const, label: "25-100 students", badge: "Focus" },
                      { value: "micro2" as const, label: "100-200 students" },
                      { value: "growth" as const, label: "200-500 students" },
                      { value: "full" as const, label: "500+ students" },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setAltSizeFilter(opt.value); setShowSizePopover(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 ${
                          altSizeFilter === opt.value ? 'text-blue-600 font-semibold' : 'text-gray-700'
                        }`}
                      >
                        {opt.label}
                        {opt.badge && (
                          <span className="text-[8px] font-bold text-white bg-amber-500 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            {opt.badge}
                          </span>
                        )}
                      </button>
                    ))}
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        onClick={() => { setAltSizeFilter("all"); setShowSizePopover(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50"
                      >
                        All
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {userLocation && (
                <div className="relative" ref={drivePopoverRef}>
                  <button
                    onClick={() => {
                      if (!showDriveFilter) {
                        setShowDriveFilter(true);
                      } else {
                        setShowDrivePopover(!showDrivePopover);
                      }
                    }}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      showDriveFilter
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <MapPin className="h-3 w-3" />
                    {showDriveFilter ? `${driveTimeMinutes} min` : 'Close to me'}
                    {showDriveFilter && (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                  {showDrivePopover && showDriveFilter && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[120px]">
                      {[10, 20, 30].map((mins) => (
                        <button
                          key={mins}
                          onClick={() => { setDriveTimeMinutes(mins); setShowDrivePopover(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                            driveTimeMinutes === mins ? 'text-violet-600 font-semibold' : 'text-gray-700'
                          }`}
                        >
                          {mins} minutes
                        </button>
                      ))}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                          onClick={() => { setShowDriveFilter(false); setShowDrivePopover(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50"
                        >
                          All
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => setShowNoBlockers(!showNoBlockers)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  showNoBlockers
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                No Blockers
              </button>
            </div>
          </div>
          <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Sort</span>
            <div className="relative" ref={subPopoverRef}>
              <button
                onClick={() => setShowSubPopover(!showSubPopover)}
                className="px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 bg-blue-600 text-white"
              >
                {sortMode === 'most_support' ? 'Popularity'
                  : viableSubPriority === 'zoning' ? 'Zoning approved'
                  : viableSubPriority === 'neighborhood' ? 'Demographics'
                  : 'Overall'}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showSubPopover && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
                  {([
                    { label: 'Overall', mode: 'most_viable' as const, sub: null },
                    { label: 'Popularity', mode: 'most_support' as const, sub: null },
                    { label: 'Zoning approved', mode: 'most_viable' as const, sub: 'zoning' as const },
                    { label: 'Demographics', mode: 'most_viable' as const, sub: 'neighborhood' as const },
                  ]).map((opt) => {
                    const isActive = sortMode === opt.mode && viableSubPriority === opt.sub;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => {
                          setSortMode(opt.mode);
                          setViableSubPriority(opt.sub);
                          setShowSubPopover(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                          isActive ? 'text-blue-600 font-semibold' : 'text-gray-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {/* Search + Show all row */}
          <div className="px-5 pb-3 flex items-center gap-2">
            <div className="flex items-center flex-1 gap-1 relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                placeholder="Search address..."
                className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 rounded-full focus:outline-none focus:border-blue-400"
              />
              {adminSearch && (
                <button
                  onClick={() => setAdminSearch("")}
                  className="absolute right-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => { setShowTopOnly(!showTopOnly); setExtraPages(0); }}
              className="ml-auto text-xs text-blue-600 font-medium hover:underline shrink-0"
            >
              {showTopOnly ? `Show all (${searchFilteredLocations.length})` : 'Top 10'}
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
                isProposed={false}
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
                onUpdateVoteComment={(comment) => updateVoteComment(loc.id, comment)}
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
