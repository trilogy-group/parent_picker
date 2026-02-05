"use client";

import { create } from "zustand";
import { Location } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabase";

interface VotesState {
  locations: Location[];
  votedLocationIds: Set<string>;
  selectedLocationId: string | null;
  searchQuery: string;
  isLoading: boolean;
  userId: string | null;
  setLocations: (locations: Location[]) => void;
  addLocation: (location: Location) => void;
  vote: (locationId: string) => void;
  unvote: (locationId: string) => void;
  setSelectedLocation: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setUserId: (id: string | null) => void;
  loadUserVotes: (userId: string) => Promise<void>;
  clearUserVotes: () => void;
  filteredLocations: () => Location[];
}

export const useVotesStore = create<VotesState>((set, get) => ({
  locations: [],
  votedLocationIds: new Set<string>(),
  selectedLocationId: null,
  searchQuery: "",
  isLoading: true,
  userId: null,

  setLocations: (locations) => set({ locations, isLoading: false }),

  setLoading: (isLoading) => set({ isLoading }),

  setUserId: (userId) => set({ userId }),

  loadUserVotes: async (userId: string) => {
    // Skip if Supabase is not configured
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from("pp_votes")
        .select("location_id")
        .eq("user_id", userId);

      if (error) {
        console.error("Error loading user votes:", error);
        return;
      }

      const votedIds = new Set(data.map((v) => v.location_id));
      set({ votedLocationIds: votedIds });
    } catch (error) {
      console.error("Failed to load user votes:", error);
    }
  },

  clearUserVotes: () => set({ votedLocationIds: new Set<string>() }),

  addLocation: (location) =>
    set((state) => ({
      locations: [...state.locations, location],
    })),

  vote: (locationId) => {
    const state = get();
    if (state.votedLocationIds.has(locationId)) return;

    // Optimistic update
    set({
      locations: state.locations.map((loc) =>
        loc.id === locationId ? { ...loc, votes: loc.votes + 1 } : loc
      ),
      votedLocationIds: new Set([...state.votedLocationIds, locationId]),
    });

    // Persist to database if logged in and Supabase is configured
    if (state.userId && isSupabaseConfigured && supabase) {
      supabase
        .from("pp_votes")
        .insert({ location_id: locationId, user_id: state.userId })
        .then(({ error }) => {
          if (error) {
            console.error("Error persisting vote:", error);
            // Rollback on error
            set({
              locations: get().locations.map((loc) =>
                loc.id === locationId ? { ...loc, votes: loc.votes - 1 } : loc
              ),
              votedLocationIds: new Set(
                [...get().votedLocationIds].filter((id) => id !== locationId)
              ),
            });
          }
        });
    }
  },

  unvote: (locationId) => {
    const state = get();
    if (!state.votedLocationIds.has(locationId)) return;

    const newVotedIds = new Set(state.votedLocationIds);
    newVotedIds.delete(locationId);

    // Optimistic update
    set({
      locations: state.locations.map((loc) =>
        loc.id === locationId ? { ...loc, votes: Math.max(0, loc.votes - 1) } : loc
      ),
      votedLocationIds: newVotedIds,
    });

    // Persist to database if logged in and Supabase is configured
    if (state.userId && isSupabaseConfigured && supabase) {
      supabase
        .from("pp_votes")
        .delete()
        .eq("location_id", locationId)
        .eq("user_id", state.userId)
        .then(({ error }) => {
          if (error) {
            console.error("Error removing vote:", error);
            // Rollback on error
            set({
              locations: get().locations.map((loc) =>
                loc.id === locationId ? { ...loc, votes: loc.votes + 1 } : loc
              ),
              votedLocationIds: new Set([...get().votedLocationIds, locationId]),
            });
          }
        });
    }
  },

  setSelectedLocation: (id) => set({ selectedLocationId: id }),

  setSearchQuery: (query) => set({ searchQuery: query }),

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
