"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LocationCard } from "./LocationCard";
import { useVotesStore, ScoreFilterCategory } from "@/lib/votes";
import { useShallow } from "zustand/react/shallow";
import { searchAddresses, GeocodingResult } from "@/lib/geocoding";
import { getDistanceMiles } from "@/lib/locations";
import { useAuth } from "./AuthProvider";

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
  { key: "demographics", label: "Demographics" },
  { key: "price", label: "Price" },
  { key: "zoning", label: "Zoning" },
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
}

function ScoreFilterPanel({
  scoreFilters,
  toggleScoreFilter,
  clearScoreFilters,
  activeFilterCount,
  expanded,
  setExpanded,
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
                    {size === "Full Size" ? "Full" : size === "Red (Reject)" ? "Reject" : size}
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

export function LocationsList() {
  const {
    filteredLocations,
    selectedLocationId,
    setSelectedLocation,
    votedLocationIds,
    vote,
    unvote,
    searchQuery,
    setSearchQuery,
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
  } = useVotesStore(useShallow((s) => ({
    filteredLocations: s.filteredLocations,
    selectedLocationId: s.selectedLocationId,
    setSelectedLocation: s.setSelectedLocation,
    votedLocationIds: s.votedLocationIds,
    vote: s.vote,
    unvote: s.unvote,
    searchQuery: s.searchQuery,
    setSearchQuery: s.setSearchQuery,
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
  })));

  const [page, setPage] = useState(0);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);
  const [prevMapBounds, setPrevMapBounds] = useState(mapBounds);
  const [prevScoreFilters, setPrevScoreFilters] = useState(scoreFilters);
  const [addressSuggestions, setAddressSuggestions] = useState<
    GeocodingResult[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const locations = filteredLocations();
  const { user, isOfflineMode } = useAuth();

  // In offline mode, allow voting without auth (local-only)
  const canVote = isOfflineMode || !!user;

  const fetchAddressSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const results = await searchAddresses(query, mapCenter ?? undefined);
    setAddressSuggestions(results);
    setShowSuggestions(results.length > 0);
    setHighlightedIndex(-1);
  }, [mapCenter]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        fetchAddressSuggestions(value);
      }, 300);
    },
    [setSearchQuery, fetchAddressSuggestions]
  );

  const handleAddressSelect = useCallback(
    (result: GeocodingResult) => {
      setSearchQuery(result.address);
      setAddressSuggestions([]);
      setShowSuggestions(false);
      setFlyToTarget({ lat: result.lat, lng: result.lng });
    },
    [setSearchQuery, setFlyToTarget]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showSuggestions) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < addressSuggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Enter":
          e.preventDefault();
          if (
            highlightedIndex >= 0 &&
            highlightedIndex < addressSuggestions.length
          ) {
            handleAddressSelect(addressSuggestions[highlightedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setShowSuggestions(false);
          break;
      }
    },
    [showSuggestions, addressSuggestions, highlightedIndex, handleAddressSelect]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Reset pagination when search, map viewport, or filters change (render-time adjustment)
  if (searchQuery !== prevSearchQuery || mapBounds !== prevMapBounds || scoreFilters !== prevScoreFilters) {
    setPrevSearchQuery(searchQuery);
    setPrevMapBounds(mapBounds);
    setPrevScoreFilters(scoreFilters);
    setPage(0);
  }

  // Memoize sorted list to avoid redundant sort/filter on non-map re-renders
  const sorted = useMemo(() => {
    if (!mapBounds) return [...locations].sort((a, b) => b.votes - a.votes);

    const onScreen = locations.filter(loc => isInViewport(loc.lat, loc.lng, mapBounds));
    const offScreen = locations.filter(loc => !isInViewport(loc.lat, loc.lng, mapBounds));

    onScreen.sort((a, b) => b.votes - a.votes);

    if (mapCenter) {
      offScreen.sort((a, b) => {
        const distA = getDistanceMiles(mapCenter.lat, mapCenter.lng, a.lat, a.lng);
        const distB = getDistanceMiles(mapCenter.lat, mapCenter.lng, b.lat, b.lng);
        return distA - distB;
      });
    }

    return [...onScreen, ...offScreen];
  }, [locations, mapBounds, mapCenter]);

  const PAGE_SIZE = 25;
  const showCount = (page + 1) * PAGE_SIZE;
  const visible = sorted.slice(0, showCount);
  const hasMore = showCount < sorted.length;

  return (
    <div className="flex flex-col h-full">
      <div
        ref={containerRef}
        className="p-4 border-b bg-background sticky top-0 z-10"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Find location..."
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            className="pl-9"
          />
          {showSuggestions && addressSuggestions.length > 0 && (
            <div
              className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
              data-testid="search-autocomplete-dropdown"
            >
              {addressSuggestions.map((result, index) => (
                <button
                  key={`${result.lat}-${result.lng}`}
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                    index === highlightedIndex ? "bg-gray-100" : ""
                  }`}
                  onClick={() => handleAddressSelect(result)}
                  data-testid="search-autocomplete-option"
                >
                  <div className="font-medium">{result.address}</div>
                  <div className="text-gray-500 text-xs">
                    {result.city}, {result.state}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Score & Size Filters */}
        <ScoreFilterPanel
          scoreFilters={scoreFilters}
          toggleScoreFilter={toggleScoreFilter}
          clearScoreFilters={clearScoreFilters}
          activeFilterCount={activeFilterCount}
          expanded={filtersExpanded}
          setExpanded={setFiltersExpanded}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                    setFlyToTarget({ lat: city.lat, lng: city.lng });
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
            No locations found matching your search.
          </p>
        ) : (
          <>
            {visible.map((location) => {
              const inView = mapBounds ? isInViewport(location.lat, location.lng, mapBounds) : false;
              return (
                <LocationCard
                  key={location.id}
                  location={location}
                  isSelected={selectedLocationId === location.id}
                  hasVoted={votedLocationIds.has(location.id)}
                  isAuthenticated={canVote}
                  isInViewport={inView}
                  onSelect={() => setSelectedLocation(location.id)}
                  onVote={() => vote(location.id)}
                  onUnvote={() => unvote(location.id)}
                />
              );
            })}
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
