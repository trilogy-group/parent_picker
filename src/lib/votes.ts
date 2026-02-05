"use client";

import { create } from "zustand";
import { Location } from "@/types";
import { mockLocations } from "./locations";

interface VotesState {
  locations: Location[];
  votedLocationIds: Set<string>;
  selectedLocationId: string | null;
  searchQuery: string;
  flyToTarget: { lat: number; lng: number } | null;
  previewLocation: { lat: number; lng: number; address: string } | null;
  setLocations: (locations: Location[]) => void;
  addLocation: (location: Location) => void;
  vote: (locationId: string) => void;
  unvote: (locationId: string) => void;
  setSelectedLocation: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFlyToTarget: (coords: { lat: number; lng: number } | null) => void;
  setPreviewLocation: (preview: { lat: number; lng: number; address: string } | null) => void;
  filteredLocations: () => Location[];
}

export const useVotesStore = create<VotesState>((set, get) => ({
  locations: mockLocations,
  votedLocationIds: new Set<string>(),
  selectedLocationId: null,
  searchQuery: "",
  flyToTarget: null,
  previewLocation: null,

  setLocations: (locations) => set({ locations }),

  addLocation: (location) =>
    set((state) => ({
      locations: [...state.locations, location],
    })),

  vote: (locationId) =>
    set((state) => {
      if (state.votedLocationIds.has(locationId)) return state;
      return {
        locations: state.locations.map((loc) =>
          loc.id === locationId ? { ...loc, votes: loc.votes + 1 } : loc
        ),
        votedLocationIds: new Set([...state.votedLocationIds, locationId]),
      };
    }),

  unvote: (locationId) =>
    set((state) => {
      if (!state.votedLocationIds.has(locationId)) return state;
      const newVotedIds = new Set(state.votedLocationIds);
      newVotedIds.delete(locationId);
      return {
        locations: state.locations.map((loc) =>
          loc.id === locationId ? { ...loc, votes: Math.max(0, loc.votes - 1) } : loc
        ),
        votedLocationIds: newVotedIds,
      };
    }),

  setSelectedLocation: (id) => set({ selectedLocationId: id }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setFlyToTarget: (coords) => set({ flyToTarget: coords }),

  setPreviewLocation: (preview) => set({ previewLocation: preview }),

  filteredLocations: () => {
    const { locations, searchQuery } = get();
    if (!searchQuery.trim()) return locations;
    const query = searchQuery.toLowerCase();
    return locations.filter(
      (loc) =>
        loc.name.toLowerCase().includes(query) ||
        loc.address.toLowerCase().includes(query) ||
        loc.city.toLowerCase().includes(query)
    );
  },
}));
