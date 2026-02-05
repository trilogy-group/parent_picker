"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LocationCard } from "./LocationCard";
import { useVotesStore } from "@/lib/votes";
import { searchAddresses, GeocodingResult } from "@/lib/geocoding";
import { useAuth } from "./AuthProvider";

// Calculate distance between two points using Haversine formula
function getDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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
        {locations.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No locations found matching your search.
          </p>
        ) : (
          (() => {
            // Viewport-aware sorting logic:
            // 1. Locations visible on screen: sorted by votes (descending)
            // 2. Locations off-screen: sorted by distance from reference point (ascending)

            if (!mapBounds || !referencePoint) {
              // Fallback: sort by votes if no map bounds available
              return locations.sort((a, b) => b.votes - a.votes);
            }

            // Separate visible from non-visible locations
            const visible = locations.filter(loc => isInViewport(loc.lat, loc.lng, mapBounds));
            const nonVisible = locations.filter(loc => !isInViewport(loc.lat, loc.lng, mapBounds));

            // Sort visible by votes (descending)
            visible.sort((a, b) => b.votes - a.votes);

            // Sort non-visible by distance from reference point (ascending)
            nonVisible.sort((a, b) => {
              const distA = getDistanceMiles(referencePoint.lat, referencePoint.lng, a.lat, a.lng);
              const distB = getDistanceMiles(referencePoint.lat, referencePoint.lng, b.lat, b.lng);
              return distA - distB;
            });

            // Return visible first, then non-visible
            return [...visible, ...nonVisible];
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
        )}
      </div>
    </div>
  );
}
