"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LocationCard } from "./LocationCard";
import { useVotesStore } from "@/lib/votes";
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
    referencePoint,
    mapBounds,
    zoomLevel,
    citySummaries,
    fetchNearbyForce,
  } = useVotesStore();

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

    const results = await searchAddresses(query);
    setAddressSuggestions(results);
    setShowSuggestions(results.length > 0);
    setHighlightedIndex(-1);
  }, []);

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

  return (
    <div className="flex flex-col h-full">
      <div
        ref={containerRef}
        className="p-4 border-b bg-background sticky top-0 z-10"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search locations..."
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
        ) : (
          // Individual location cards mode (city zoom)
          locations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No locations found matching your search.
            </p>
          ) : (
            (() => {
              if (!referencePoint) {
                return locations.sort((a, b) => b.votes - a.votes);
              }

              if (mapBounds) {
                const visible = locations.filter(loc => isInViewport(loc.lat, loc.lng, mapBounds));
                const nonVisible = locations.filter(loc => !isInViewport(loc.lat, loc.lng, mapBounds));
                visible.sort((a, b) => b.votes - a.votes);
                nonVisible.sort((a, b) => {
                  const distA = getDistanceMiles(referencePoint.lat, referencePoint.lng, a.lat, a.lng);
                  const distB = getDistanceMiles(referencePoint.lat, referencePoint.lng, b.lat, b.lng);
                  return distA - distB;
                });
                return [...visible, ...nonVisible];
              }

              return locations.sort((a, b) => {
                const distA = getDistanceMiles(referencePoint.lat, referencePoint.lng, a.lat, a.lng);
                const distB = getDistanceMiles(referencePoint.lat, referencePoint.lng, b.lat, b.lng);
                return distA - distB;
              });
            })()
              .map((location) => {
                const isVisible = mapBounds ? isInViewport(location.lat, location.lng, mapBounds) : false;
                return (
                  <LocationCard
                    key={location.id}
                    location={location}
                    isSelected={selectedLocationId === location.id}
                    hasVoted={votedLocationIds.has(location.id)}
                    isAuthenticated={canVote}
                    isInViewport={isVisible}
                    onSelect={() => setSelectedLocation(location.id)}
                    onVote={() => vote(location.id)}
                    onUnvote={() => unvote(location.id)}
                  />
                );
              })
          )
        )}
      </div>
    </div>
  );
}
