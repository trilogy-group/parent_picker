"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LocationCard } from "./LocationCard";
import { useVotesStore } from "@/lib/votes";

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
  } = useVotesStore();

  const locations = filteredLocations();

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-background sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {locations.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No locations found matching your search.
          </p>
        ) : (
          locations
            .sort((a, b) => b.votes - a.votes)
            .map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                isSelected={selectedLocationId === location.id}
                hasVoted={votedLocationIds.has(location.id)}
                onSelect={() => setSelectedLocation(location.id)}
                onVote={() => vote(location.id)}
                onUnvote={() => unvote(location.id)}
              />
            ))
        )}
      </div>
    </div>
  );
}
