"use client";

import { create } from "zustand";
import { Location, CitySummary } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabase";
import { getCitySummaries, getNearbyLocations, getDistanceMiles } from "./locations";

interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface VotesState {
  locations: Location[];
  citySummaries: CitySummary[];
  lastFetchCenter: { lat: number; lng: number } | null;
  zoomLevel: number;
  votedLocationIds: Set<string>;
  selectedLocationId: string | null;
  searchQuery: string;
  flyToTarget: { lat: number; lng: number } | null;
  previewLocation: { lat: number; lng: number; address: string } | null;
  mapCenter: { lat: number; lng: number } | null;
  mapBounds: MapBounds | null;
  referencePoint: { lat: number; lng: number } | null;
  isLoading: boolean;
  userId: string | null;
  setLocations: (locations: Location[]) => void;
  addLocation: (location: Location) => void;
  vote: (locationId: string) => void;
  unvote: (locationId: string) => void;
  setSelectedLocation: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFlyToTarget: (coords: { lat: number; lng: number } | null) => void;
  setPreviewLocation: (preview: { lat: number; lng: number; address: string } | null) => void;
  setMapCenter: (coords: { lat: number; lng: number } | null) => void;
  setMapBounds: (bounds: MapBounds | null) => void;
  setReferencePoint: (coords: { lat: number; lng: number } | null) => void;
  setLoading: (loading: boolean) => void;
  setUserId: (id: string | null) => void;
  setZoomLevel: (zoom: number) => void;
  loadCitySummaries: () => Promise<void>;
  fetchNearby: (center: { lat: number; lng: number }) => Promise<void>;
  fetchNearbyForce: (center: { lat: number; lng: number }) => Promise<void>;
  loadUserVotes: (userId: string) => Promise<void>;
  clearUserVotes: () => void;
  filteredLocations: () => Location[];
}

export const useVotesStore = create<VotesState>((set, get) => ({
  locations: [],
  citySummaries: [],
  lastFetchCenter: null,
  zoomLevel: 4,
  votedLocationIds: new Set<string>(),
  selectedLocationId: null,
  searchQuery: "",
  flyToTarget: null,
  previewLocation: null,
  mapCenter: null,
  mapBounds: null,
  referencePoint: null,
  isLoading: true,
  userId: null,

  setLocations: (locations) => set({ locations, isLoading: false }),

  setLoading: (isLoading) => set({ isLoading }),

  setUserId: (userId) => set({ userId }),

  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),

  loadCitySummaries: async () => {
    const summaries = await getCitySummaries();
    set({ citySummaries: summaries, isLoading: false });
  },

  fetchNearby: async (center) => {
    const { lastFetchCenter } = get();
    if (lastFetchCenter) {
      const dist = getDistanceMiles(lastFetchCenter.lat, lastFetchCenter.lng, center.lat, center.lng);
      if (dist < 5) return;
    }
    const locations = await getNearbyLocations(center.lat, center.lng);
    set({ locations, lastFetchCenter: center });
  },

  fetchNearbyForce: async (center) => {
    const locations = await getNearbyLocations(center.lat, center.lng);
    set({ locations, lastFetchCenter: center });
  },

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

  setFlyToTarget: (coords) => set({ flyToTarget: coords }),

  setPreviewLocation: (preview) => set({ previewLocation: preview }),

  setMapCenter: (coords) => set({ mapCenter: coords }),

  setMapBounds: (bounds) => set({ mapBounds: bounds }),

  setReferencePoint: (coords) => set({ referencePoint: coords }),

  filteredLocations: () => {
    return get().locations;
  },
}));
