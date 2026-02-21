"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, X, Eye } from "lucide-react";
import { LocationCard } from "./LocationCard";
import { useVotesStore, ScoreFilterCategory, ReleasedFilter } from "@/lib/votes";
import { useShallow } from "zustand/react/shallow";
import { getDistanceMiles } from "@/lib/locations";
import { useAuth } from "./AuthProvider";
import { Location } from "@/types";

// Score-based sort: GREEN first, then YELLOW (most green subscores first), then AMBER, then RED, then unscored
const COLOR_RANK: Record<string, number> = { GREEN: 0, YELLOW: 1, AMBER: 2, RED: 3 };

function countGreenSubscores(loc: Location): number {
  if (!loc.scores) return 0;
  let count = 0;
  for (const key of ["neighborhood", "zoning", "building", "price"] as const) {
    if (loc.scores[key]?.color === "GREEN") count++;
  }
  return count;
}

function scoreSort(a: Location, b: Location): number {
  const aColor = a.scores?.overallColor || "";
  const bColor = b.scores?.overallColor || "";
  const aRank = COLOR_RANK[aColor] ?? 99;
  const bRank = COLOR_RANK[bColor] ?? 99;
  if (aRank !== bRank) return aRank - bRank;
  // Within same overall color, sort by green subscore count descending
  return countGreenSubscores(b) - countGreenSubscores(a);
}

// Check if a location is within viewport bounds
function isInViewport(
  lat: number,
  lng: number,
  bounds: { north: number; south: number; east: number; west: number }
): boolean {
  return lat <= bounds.north && lat >= bounds.south && lng <= bounds.east && lng >= bounds.west;
}

const COLOR_OPTIONS = ["GREEN", "YELLOW", "RED"] as const;
const COLOR_DISPLAY: Record<string, { bg: string; bgActive: string; ring: string; label: string }> = {
  GREEN: { bg: "bg-green-100", bgActive: "bg-green-500", ring: "ring-green-400", label: "G" },
  YELLOW: { bg: "bg-yellow-100", bgActive: "bg-yellow-400", ring: "ring-yellow-400", label: "Y" },
  RED: { bg: "bg-red-100", bgActive: "bg-red-500", ring: "ring-red-400", label: "R" },
};

const SIZE_OPTIONS = ["Micro", "Micro2", "Growth", "Full Size", "Red (Reject)"] as const;

const SCORE_CATEGORIES: { key: ScoreFilterCategory; label: string }[] = [
  { key: "overall", label: "Overall" },
  { key: "price", label: "Price" },
  { key: "zoning", label: "Regulatory" },
  { key: "neighborhood", label: "Neighborhood" },
  { key: "building", label: "Building" },
];

interface ScoreFilterPanelProps {
  scoreFilters: import("@/lib/votes").ScoreFilters;
  toggleScoreFilter: (category: ScoreFilterCategory, value: string) => void;
  clearScoreFilters: () => void;
  activeFilterCount: () => number;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  releasedFilter: ReleasedFilter;
  setReleasedFilter: (filter: ReleasedFilter) => void;
  showUnscored: boolean;
  setShowUnscored: (show: boolean) => void;
}

function ScoreFilterPanel({
  scoreFilters,
  toggleScoreFilter,
  clearScoreFilters,
  activeFilterCount,
  expanded,
  setExpanded,
  releasedFilter,
  setReleasedFilter,
  showUnscored,
  setShowUnscored,
}: ScoreFilterPanelProps) {
  const count = activeFilterCount();

  return (
    <div className="mt-2">
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        <span className="font-medium">Filters</span>
        {count > 0 && (
          <span className="bg-blue-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {count}
          </span>
        )}
        {count > 0 && (
          <button
            type="button"
            className="ml-auto text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
            onClick={(e) => { e.stopPropagation(); clearScoreFilters(); }}
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {/* Released filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground w-[72px] shrink-0">Released</span>
            <div className="flex gap-1">
              {(["all", "released", "unreleased"] as ReleasedFilter[]).map((val) => {
                const active = releasedFilter === val;
                return (
                  <button
                    key={val}
                    type="button"
                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${
                      active
                        ? "bg-blue-500 text-white ring-2 ring-blue-400 ring-offset-1"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    onClick={() => setReleasedFilter(val)}
                  >
                    {val === "all" ? "All" : val === "released" ? "Released" : "Unreleased"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Unscored toggle */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground w-[72px] shrink-0">Unscored</span>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <div
                className={`relative w-7 h-4 rounded-full transition-colors ${
                  showUnscored ? "bg-blue-500" : "bg-gray-300"
                }`}
                onClick={() => setShowUnscored(!showUnscored)}
              >
                <div
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                    showUnscored ? "translate-x-[13px]" : "translate-x-0.5"
                  }`}
                />
              </div>
              <span className="text-[9px] text-muted-foreground">
                {showUnscored ? "Showing" : "Hidden"}
              </span>
            </label>
          </div>

          {/* Color score categories */}
          {SCORE_CATEGORIES.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-muted-foreground w-[72px] shrink-0">{label}</span>
              <div className="flex gap-1">
                {COLOR_OPTIONS.map((color) => {
                  const active = scoreFilters[key].has(color);
                  const d = COLOR_DISPLAY[color];
                  return (
                    <button
                      key={color}
                      type="button"
                      title={`${color} ${label}`}
                      className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center transition-all ${
                        active
                          ? `${d.bgActive} text-white ring-2 ${d.ring} ring-offset-1`
                          : `${d.bg} text-gray-500 hover:ring-1 ${d.ring}`
                      }`}
                      onClick={() => toggleScoreFilter(key, color)}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Size filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground w-10 shrink-0">Size</span>
            <div className="flex gap-1 flex-wrap">
              {SIZE_OPTIONS.map((size) => {
                const active = scoreFilters.size.has(size);
                const isReject = size === "Red (Reject)";
                return (
                  <button
                    key={size}
                    type="button"
                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${
                      active
                        ? isReject
                          ? "bg-red-500 text-white ring-2 ring-red-400 ring-offset-1"
                          : "bg-blue-500 text-white ring-2 ring-blue-400 ring-offset-1"
                        : isReject
                          ? "bg-red-50 text-red-400 hover:bg-red-100"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    onClick={() => toggleScoreFilter("size", size)}
                  >
                    {size === "Full Size" ? "Full" : size === "Red (Reject)" ? "N/A" : size}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SimpleRedToggleProps {
  showRedLocations: boolean;
  setShowRedLocations: (show: boolean) => void;
}

function SimpleRedToggle({ showRedLocations, setShowRedLocations }: SimpleRedToggleProps) {
  return (
    <div className="mt-2">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div
          className={`relative w-8 h-[18px] rounded-full transition-colors ${
            showRedLocations ? "bg-red-500" : "bg-gray-300"
          }`}
          onClick={() => setShowRedLocations(!showRedLocations)}
        >
          <div
            className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
              showRedLocations ? "translate-x-[15px]" : "translate-x-0.5"
            }`}
          />
        </div>
        <span
          className="text-xs text-muted-foreground"
          onClick={() => setShowRedLocations(!showRedLocations)}
        >
          I want to help! Show me red locations too.
        </span>
      </label>
    </div>
  );
}

function ViewAsParentToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`mt-2 flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md transition-colors ${
        active
          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
    >
      <Eye className="h-3 w-3" />
      {active ? "Viewing as parent — tap to exit" : "View as parent"}
    </button>
  );
}

export function LocationsList() {
  const {
    filteredLocations,
    selectedLocationId,
    setSelectedLocation,
    votedLocationIds,
    vote,
    unvote,
    setFlyToTarget,
    mapCenter,
    mapBounds,
    zoomLevel,
    citySummaries,
    fetchNearbyForce,
    scoreFilters,
    toggleScoreFilter,
    clearScoreFilters,
    activeFilterCount,
    showRedLocations,
    setShowRedLocations,
    releasedFilter,
    setReleasedFilter,
    viewAsParent,
    setViewAsParent,
    showUnscored,
    setShowUnscored,
  } = useVotesStore(useShallow((s) => ({
    filteredLocations: s.filteredLocations,
    selectedLocationId: s.selectedLocationId,
    setSelectedLocation: s.setSelectedLocation,
    votedLocationIds: s.votedLocationIds,
    vote: s.vote,
    unvote: s.unvote,
    setFlyToTarget: s.setFlyToTarget,
    mapCenter: s.mapCenter,
    mapBounds: s.mapBounds,
    zoomLevel: s.zoomLevel,
    citySummaries: s.citySummaries,
    fetchNearbyForce: s.fetchNearbyForce,
    scoreFilters: s.scoreFilters,
    toggleScoreFilter: s.toggleScoreFilter,
    clearScoreFilters: s.clearScoreFilters,
    activeFilterCount: s.activeFilterCount,
    showRedLocations: s.showRedLocations,
    setShowRedLocations: s.setShowRedLocations,
    releasedFilter: s.releasedFilter,
    setReleasedFilter: s.setReleasedFilter,
    viewAsParent: s.viewAsParent,
    setViewAsParent: s.setViewAsParent,
    showUnscored: s.showUnscored,
    setShowUnscored: s.setShowUnscored,
    locations: s.locations,
  })));

  const [page, setPage] = useState(0);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [prevMapBounds, setPrevMapBounds] = useState(mapBounds);
  const [prevScoreFilters, setPrevScoreFilters] = useState(scoreFilters);

  const locations = filteredLocations();
  const { user, isOfflineMode, isAdmin } = useAuth();

  // In offline mode, allow voting without auth (local-only)
  const canVote = isOfflineMode || !!user;

  // Reset pagination when map viewport or filters change (render-time adjustment)
  if (mapBounds !== prevMapBounds || scoreFilters !== prevScoreFilters) {
    setPrevMapBounds(mapBounds);
    setPrevScoreFilters(scoreFilters);
    setPage(0);
  }

  // Memoize sorted list: on-screen only, votes desc then distance asc
  const sorted = useMemo(() => {
    if (!mapBounds) return [...locations].sort((a, b) => {
      const s = scoreSort(a, b);
      if (s !== 0) return s;
      if (b.votes !== a.votes) return b.votes - a.votes;
      if (mapCenter) {
        return getDistanceMiles(mapCenter.lat, mapCenter.lng, a.lat, a.lng)
          - getDistanceMiles(mapCenter.lat, mapCenter.lng, b.lat, b.lng);
      }
      return 0;
    });

    const onScreen = locations.filter(loc => isInViewport(loc.lat, loc.lng, mapBounds));

    onScreen.sort((a, b) => {
      const s = scoreSort(a, b);
      if (s !== 0) return s;
      if (b.votes !== a.votes) return b.votes - a.votes;
      if (mapCenter) {
        return getDistanceMiles(mapCenter.lat, mapCenter.lng, a.lat, a.lng)
          - getDistanceMiles(mapCenter.lat, mapCenter.lng, b.lat, b.lng);
      }
      return 0;
    });

    return onScreen;
  }, [locations, mapBounds, mapCenter]);

  const PAGE_SIZE = 25;
  const showCount = (page + 1) * PAGE_SIZE;
  const visible = sorted.slice(0, showCount);
  const hasMore = showCount < sorted.length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-2 border-b bg-background sticky top-0 z-10">
        {isAdmin && !viewAsParent ? (
          <>
            <ScoreFilterPanel
              scoreFilters={scoreFilters}
              toggleScoreFilter={toggleScoreFilter}
              clearScoreFilters={clearScoreFilters}
              activeFilterCount={activeFilterCount}
              expanded={filtersExpanded}
              setExpanded={setFiltersExpanded}
              releasedFilter={releasedFilter}
              setReleasedFilter={setReleasedFilter}
              showUnscored={showUnscored}
              setShowUnscored={setShowUnscored}
            />
            <ViewAsParentToggle active={false} onToggle={() => setViewAsParent(true)} />
          </>
        ) : isAdmin && viewAsParent ? (
          <>
            <SimpleRedToggle
              showRedLocations={showRedLocations}
              setShowRedLocations={setShowRedLocations}
            />
            <ViewAsParentToggle active={true} onToggle={() => setViewAsParent(false)} />
          </>
        ) : (
          <SimpleRedToggle
            showRedLocations={showRedLocations}
            setShowRedLocations={setShowRedLocations}
          />
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {zoomLevel < 9 ? (
          // City list mode (wide zoom)
          citySummaries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Loading cities...
            </p>
          ) : (
            [...citySummaries]
              .sort((a, b) => b.totalVotes - a.totalVotes)
              .map((city) => (
                <button
                  key={`${city.city}-${city.state}`}
                  type="button"
                  data-testid="city-card"
                  className="w-full text-left p-3 rounded-lg border bg-white hover:bg-blue-50 hover:border-blue-200 transition-colors"
                  onClick={() => {
                    setFlyToTarget({ lat: city.lat, lng: city.lng, zoom: 10 });
                    fetchNearbyForce({ lat: city.lat, lng: city.lng });
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{city.city}, {city.state}</p>
                      <p className="text-xs text-muted-foreground">
                        {city.locationCount} location{city.locationCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-blue-600">{city.totalVotes}</p>
                      <p className="text-xs text-muted-foreground">votes</p>
                    </div>
                  </div>
                </button>
              ))
          )
        ) : locations.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No locations found in this area matching your filters.
          </p>
        ) : (
          <>
            {visible.map((location) => (
                <LocationCard
                  key={location.id}
                  location={location}
                  isSelected={selectedLocationId === location.id}
                  hasVoted={votedLocationIds.has(location.id)}
                  isAuthenticated={canVote}

                  onSelect={() => setSelectedLocation(location.id)}
                  onVote={(comment?: string) => vote(location.id, comment)}
                  onUnvote={() => unvote(location.id)}
                />
            ))}
            <p data-testid="location-count" className="text-center text-xs text-muted-foreground pt-2">
              Showing {Math.min(showCount, sorted.length)} of {sorted.length} locations
            </p>
            {hasMore && (
              <button
                type="button"
                data-testid="pagination-next"
                onClick={() => setPage((p) => p + 1)}
                className="w-full py-2 text-sm font-medium text-primary hover:underline"
              >
                Next
              </button>
            )}
          </>

        )}
      </div>
    </div>
  );
}
