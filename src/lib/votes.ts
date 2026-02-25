"use client";

import { create } from "zustand";
import { Location, CitySummary, VoterInfo, VoteType } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabase";
import { getCitySummaries, getNearbyLocations, getLocationsInBounds, getDistanceMiles } from "./locations";
import { consolidateToMetros } from "./metros";

interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export type ScoreFilterCategory = "overall" | "price" | "zoning" | "neighborhood" | "building" | "size";

export interface ScoreFilters {
  overall: Set<string>;
  price: Set<string>;
  zoning: Set<string>;
  neighborhood: Set<string>;
  building: Set<string>;
  size: Set<string>;
}

export type ReleasedFilter = "all" | "released" | "unreleased";

interface VotesState {
  locations: Location[];
  citySummaries: CitySummary[];
  lastFetchBounds: MapBounds | null;
  zoomLevel: number;
  votedLocationIds: Set<string>;
  votedNotHereIds: Set<string>;
  locationVoters: Map<string, VoterInfo[]>;
  sortMode: 'most_support' | 'most_viable';
  selectedLocationId: string | null;
  searchQuery: string;
  flyToTarget: { lat: number; lng: number; zoom?: number } | null;
  previewLocation: { lat: number; lng: number; address: string } | null;
  mapCenter: { lat: number; lng: number } | null;
  mapBounds: MapBounds | null;
  referencePoint: { lat: number; lng: number } | null;
  scoreFilters: ScoreFilters;
  isLoading: boolean;
  userId: string | null;

  // Admin vs non-admin filter state
  isAdmin: boolean;
  viewAsParent: boolean;           // Admin toggle: preview parent experience
  showRedLocations: boolean;       // Non-admin toggle: "I want to help!"
  showUnscored: boolean;           // Admin toggle: show locations without scores
  releasedFilter: ReleasedFilter;  // Admin: all/released/unreleased
  cardVersion: "v1" | "v2";       // Admin toggle: card layout version (parents always v1)
  showAltUI: boolean;              // Admin toggle: new UI vs old UI
  userLocation: { lat: number; lng: number } | null;  // Browser geolocation or saved profile
  userLocationSource: "geo" | "profile" | null;       // Where userLocation came from

  setLocations: (locations: Location[]) => void;
  toggleScoreFilter: (category: ScoreFilterCategory, value: string) => void;
  clearScoreFilters: () => void;
  activeFilterCount: () => number;
  addLocation: (location: Location) => void;
  vote: (locationId: string, comment?: string) => void;
  unvote: (locationId: string) => void;
  voteIn: (locationId: string) => void;
  voteNotHere: (locationId: string, comment?: string) => void;
  removeVote: (locationId: string) => void;
  setSortMode: (mode: 'most_support' | 'most_viable') => void;
  loadLocationVoters: (locationIds: string[], force?: boolean) => Promise<void>;
  setSelectedLocation: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFlyToTarget: (coords: { lat: number; lng: number; zoom?: number } | null) => void;
  setPreviewLocation: (preview: { lat: number; lng: number; address: string } | null) => void;
  setMapCenter: (coords: { lat: number; lng: number } | null) => void;
  setMapBounds: (bounds: MapBounds | null) => void;
  setReferencePoint: (coords: { lat: number; lng: number } | null) => void;
  setLoading: (loading: boolean) => void;
  setUserId: (id: string | null) => void;
  setZoomLevel: (zoom: number) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setViewAsParent: (viewAsParent: boolean) => void;
  setShowRedLocations: (show: boolean) => void;
  setShowUnscored: (show: boolean) => void;
  setReleasedFilter: (filter: ReleasedFilter) => void;
  setCardVersion: (version: "v1" | "v2") => void;
  setShowAltUI: (show: boolean) => void;
  setUserLocation: (coords: { lat: number; lng: number } | null, source?: "geo" | "profile") => void;
  loadCitySummaries: () => Promise<void>;
  fetchNearby: (bounds: MapBounds) => Promise<void>;
  fetchNearbyForce: (bounds: MapBounds) => Promise<void>;
  loadUserVotes: (userId: string) => Promise<void>;
  clearUserVotes: () => void;
  filteredLocations: () => Location[];
}

export const useVotesStore = create<VotesState>((set, get) => ({
  locations: [],
  citySummaries: [],
  lastFetchBounds: null,
  zoomLevel: 4,
  votedLocationIds: new Set<string>(),
  votedNotHereIds: new Set<string>(),
  locationVoters: new Map(),
  sortMode: 'most_support' as const,
  selectedLocationId: null,
  searchQuery: "",
  flyToTarget: null,
  previewLocation: null,
  mapCenter: null,
  mapBounds: null,
  referencePoint: null,
  scoreFilters: {
    overall: new Set<string>(),
    price: new Set<string>(),
    zoning: new Set<string>(),
    neighborhood: new Set<string>(),
    building: new Set<string>(),
    size: new Set<string>(["Micro", "Micro2", "Growth", "Full Size"]),
  },
  isLoading: true,
  userId: null,
  isAdmin: false,
  viewAsParent: false,
  showRedLocations: false,
  showUnscored: false,
  releasedFilter: "all",
  cardVersion: "v1",
  showAltUI: typeof window !== "undefined" && localStorage.getItem("showAltUI") === "true",
  userLocation: null,
  userLocationSource: null,

  toggleScoreFilter: (category, value) => {
    const filters = get().scoreFilters;
    const current = new Set(filters[category]);
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    set({ scoreFilters: { ...filters, [category]: current } });
  },

  clearScoreFilters: () => {
    set({
      scoreFilters: {
        overall: new Set<string>(),
        price: new Set<string>(),
        zoning: new Set<string>(),
        neighborhood: new Set<string>(),
        building: new Set<string>(),
        size: new Set<string>(["Micro", "Micro2", "Growth", "Full Size"]),
      },
    });
  },

  activeFilterCount: () => {
    const f = get().scoreFilters;
    const DEFAULT_SIZES = new Set(["Micro", "Micro2", "Growth", "Full Size"]);
    let count = 0;
    for (const key of Object.keys(f) as ScoreFilterCategory[]) {
      if (key === "size") {
        // Don't count default size selections as active filters
        const isDefault = f.size.size === DEFAULT_SIZES.size && [...f.size].every(v => DEFAULT_SIZES.has(v));
        if (!isDefault) count += f.size.size;
      } else {
        count += f[key].size;
      }
    }
    return count;
  },

  setLocations: (locations) => set({ locations, isLoading: false }),

  setLoading: (isLoading) => set({ isLoading }),

  setUserId: (userId) => set({ userId }),

  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),

  setIsAdmin: (isAdmin) => set({ isAdmin }),

  setViewAsParent: (viewAsParent) => set({ viewAsParent }),

  setShowRedLocations: (showRedLocations) => set({ showRedLocations }),

  setShowUnscored: (showUnscored) => set({ showUnscored }),

  setReleasedFilter: (releasedFilter) => set({ releasedFilter }),

  setCardVersion: (cardVersion) => set({ cardVersion }),

  setShowAltUI: (showAltUI) => {
    if (typeof window !== "undefined") localStorage.setItem("showAltUI", String(showAltUI));
    set({ showAltUI });
  },

  setUserLocation: (userLocation, source) => set({ userLocation, userLocationSource: source || null }),

  loadCitySummaries: async () => {
    const { isAdmin, viewAsParent, releasedFilter, showUnscored } = get();
    const effectiveAdmin = isAdmin && !viewAsParent;
    // Non-admins (or view-as-parent): always released only. Admins: based on filter.
    const releasedOnly = !effectiveAdmin ? true : releasedFilter === "released" ? true : releasedFilter === "unreleased" ? false : undefined;
    // Always include RED in counts (parents see all scored locations)
    const excludeRed = false;
    // Parents always exclude unscored; admins based on toggle
    const excludeUnscored = !effectiveAdmin || !showUnscored;
    const rawSummaries = await getCitySummaries(releasedOnly, excludeRed, excludeUnscored);
    // Consolidate to metro-level bubbles
    const summaries = consolidateToMetros(rawSummaries);
    set({ citySummaries: summaries, isLoading: false });
  },

  fetchNearby: async (bounds) => {
    const { lastFetchBounds, isAdmin, viewAsParent, releasedFilter, selectedLocationId, locations: prev } = get();
    // Skip if the new bounds are fully contained within the last fetched bounds
    if (lastFetchBounds &&
        bounds.north <= lastFetchBounds.north &&
        bounds.south >= lastFetchBounds.south &&
        bounds.east <= lastFetchBounds.east &&
        bounds.west >= lastFetchBounds.west) {
      return;
    }
    const effectiveAdmin = isAdmin && !viewAsParent;
    const releasedOnly = !effectiveAdmin ? true : releasedFilter === "released" ? true : releasedFilter === "unreleased" ? false : undefined;
    const fetched = await getLocationsInBounds(bounds, releasedOnly);
    // Preserve the deep-linked / selected location if it wasn't in the fetch results
    if (selectedLocationId && !fetched.some((l) => l.id === selectedLocationId)) {
      const kept = prev.find((l) => l.id === selectedLocationId);
      if (kept) fetched.push(kept);
    }
    set({ locations: fetched, lastFetchBounds: bounds });
  },

  fetchNearbyForce: async (bounds) => {
    const { isAdmin, viewAsParent, releasedFilter, selectedLocationId, locations: prev } = get();
    const effectiveAdmin = isAdmin && !viewAsParent;
    const releasedOnly = !effectiveAdmin ? true : releasedFilter === "released" ? true : releasedFilter === "unreleased" ? false : undefined;
    const fetched = await getLocationsInBounds(bounds, releasedOnly);
    // Preserve the deep-linked / selected location if it wasn't in the fetch results
    if (selectedLocationId && !fetched.some((l) => l.id === selectedLocationId)) {
      const kept = prev.find((l) => l.id === selectedLocationId);
      if (kept) fetched.push(kept);
    }
    set({ locations: fetched, lastFetchBounds: bounds });
  },

  loadUserVotes: async (userId: string) => {
    // Skip if Supabase is not configured
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from("pp_votes")
        .select("location_id, vote_type")
        .eq("user_id", userId);

      if (error) {
        console.error("Error loading user votes:", error);
        return;
      }

      type VoteRow = { location_id: string; vote_type: string | null };
      const inIds = new Set(data.filter((v: VoteRow) => v.vote_type !== 'not_here').map((v: VoteRow) => v.location_id));
      const notHereIds = new Set(data.filter((v: VoteRow) => v.vote_type === 'not_here').map((v: VoteRow) => v.location_id));
      set({ votedLocationIds: inIds, votedNotHereIds: notHereIds });
    } catch (error) {
      console.error("Failed to load user votes:", error);
    }
  },

  clearUserVotes: () => set({ votedLocationIds: new Set<string>(), votedNotHereIds: new Set<string>() }),

  addLocation: (location) =>
    set((state) => ({
      locations: [...state.locations, location],
    })),

  vote: (locationId, comment?) => {
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
      const row: Record<string, string> = { location_id: locationId, user_id: state.userId };
      if (comment) row.comment = comment;
      supabase
        .from("pp_votes")
        .insert(row)
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

  voteIn: (locationId) => {
    const state = get();
    const wasNotHere = state.votedNotHereIds.has(locationId);
    const alreadyIn = state.votedLocationIds.has(locationId);
    if (alreadyIn) return;

    // Optimistic update
    const newInIds = new Set([...state.votedLocationIds, locationId]);
    const newNotHereIds = new Set(state.votedNotHereIds);
    newNotHereIds.delete(locationId);
    set({
      locations: state.locations.map(loc =>
        loc.id === locationId ? {
          ...loc,
          votes: loc.votes + 1,
          notHereVotes: wasNotHere ? loc.notHereVotes - 1 : loc.notHereVotes,
        } : loc
      ),
      votedLocationIds: newInIds,
      votedNotHereIds: newNotHereIds,
    });

    if (state.userId && isSupabaseConfigured && supabase) {
      supabase
        .from("pp_votes")
        .upsert(
          { location_id: locationId, user_id: state.userId, vote_type: 'in' },
          { onConflict: 'location_id,user_id' }
        )
        .then(({ error }) => {
          if (error) {
            console.error("Error persisting vote:", error);
            // Rollback
            const s = get();
            const rollbackIn = new Set(s.votedLocationIds);
            rollbackIn.delete(locationId);
            const rollbackNotHere = wasNotHere ? new Set([...s.votedNotHereIds, locationId]) : s.votedNotHereIds;
            set({
              locations: s.locations.map(loc =>
                loc.id === locationId ? {
                  ...loc,
                  votes: loc.votes - 1,
                  notHereVotes: wasNotHere ? loc.notHereVotes + 1 : loc.notHereVotes,
                } : loc
              ),
              votedLocationIds: rollbackIn,
              votedNotHereIds: rollbackNotHere,
            });
          } else {
            // Refresh voter list so Who's in / Concerns tabs update
            get().loadLocationVoters([locationId], true);
          }
        });
    }
  },

  voteNotHere: (locationId, comment?) => {
    const state = get();
    const wasIn = state.votedLocationIds.has(locationId);
    const alreadyNotHere = state.votedNotHereIds.has(locationId);
    if (alreadyNotHere) return;

    const newNotHereIds = new Set([...state.votedNotHereIds, locationId]);
    const newInIds = new Set(state.votedLocationIds);
    newInIds.delete(locationId);
    set({
      locations: state.locations.map(loc =>
        loc.id === locationId ? {
          ...loc,
          notHereVotes: loc.notHereVotes + 1,
          votes: wasIn ? loc.votes - 1 : loc.votes,
        } : loc
      ),
      votedLocationIds: newInIds,
      votedNotHereIds: newNotHereIds,
    });

    if (state.userId && isSupabaseConfigured && supabase) {
      supabase
        .from("pp_votes")
        .upsert(
          { location_id: locationId, user_id: state.userId, vote_type: 'not_here', comment: comment || null },
          { onConflict: 'location_id,user_id' }
        )
        .then(({ error }) => {
          if (error) {
            console.error("Error persisting vote:", error);
            const s = get();
            const rollbackNotHere = new Set(s.votedNotHereIds);
            rollbackNotHere.delete(locationId);
            const rollbackIn = wasIn ? new Set([...s.votedLocationIds, locationId]) : s.votedLocationIds;
            set({
              locations: s.locations.map(loc =>
                loc.id === locationId ? {
                  ...loc,
                  notHereVotes: loc.notHereVotes - 1,
                  votes: wasIn ? loc.votes + 1 : loc.votes,
                } : loc
              ),
              votedLocationIds: rollbackIn,
              votedNotHereIds: rollbackNotHere,
            });
          } else {
            get().loadLocationVoters([locationId], true);
          }
        });
    }
  },

  removeVote: (locationId) => {
    const state = get();
    const wasIn = state.votedLocationIds.has(locationId);
    const wasNotHere = state.votedNotHereIds.has(locationId);
    if (!wasIn && !wasNotHere) return;

    const newInIds = new Set(state.votedLocationIds);
    newInIds.delete(locationId);
    const newNotHereIds = new Set(state.votedNotHereIds);
    newNotHereIds.delete(locationId);
    set({
      locations: state.locations.map(loc =>
        loc.id === locationId ? {
          ...loc,
          votes: wasIn ? loc.votes - 1 : loc.votes,
          notHereVotes: wasNotHere ? loc.notHereVotes - 1 : loc.notHereVotes,
        } : loc
      ),
      votedLocationIds: newInIds,
      votedNotHereIds: newNotHereIds,
    });

    if (state.userId && isSupabaseConfigured && supabase) {
      supabase
        .from("pp_votes")
        .delete()
        .eq("location_id", locationId)
        .eq("user_id", state.userId)
        .then(({ error }) => {
          if (error) {
            console.error("Error removing vote:", error);
            // Rollback
            const s = get();
            set({
              locations: s.locations.map(loc =>
                loc.id === locationId ? {
                  ...loc,
                  votes: wasIn ? loc.votes + 1 : loc.votes,
                  notHereVotes: wasNotHere ? loc.notHereVotes + 1 : loc.notHereVotes,
                } : loc
              ),
              votedLocationIds: wasIn ? new Set([...s.votedLocationIds, locationId]) : s.votedLocationIds,
              votedNotHereIds: wasNotHere ? new Set([...s.votedNotHereIds, locationId]) : s.votedNotHereIds,
            });
          } else {
            get().loadLocationVoters([locationId], true);
          }
        });
    }
  },

  setSortMode: (sortMode) => set({ sortMode }),

  loadLocationVoters: async (locationIds, force) => {
    if (!isSupabaseConfigured || !supabase || locationIds.length === 0) return;
    // Deduplicate: skip if we already have data for all these IDs (unless force refresh)
    if (!force) {
      const existing = get().locationVoters;
      const needsFetch = locationIds.some(id => !existing.has(id));
      if (!needsFetch) return;
    }
    try {
      const { data, error } = await supabase.rpc('get_location_voters', {
        location_ids: locationIds,
      });
      if (error) { console.error("Error loading voters:", error); return; }
      // Merge into existing map (don't replace)
      const merged = new Map(get().locationVoters);
      // Clear entries for fetched IDs (they'll be rebuilt from fresh data)
      for (const id of locationIds) merged.set(id, []);
      for (const row of data || []) {
        const list = merged.get(row.location_id) || [];
        list.push({
          userId: row.user_id,
          voteType: row.vote_type as VoteType,
          displayName: row.display_name,
          email: row.email,
          comment: row.comment || null,
          createdAt: row.created_at || null,
        });
        merged.set(row.location_id, list);
      }
      set({ locationVoters: merged });
    } catch (error) {
      console.error("Failed to load voters:", error);
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
    const { locations, scoreFilters, isAdmin, viewAsParent, showUnscored, releasedFilter, selectedLocationId } = get();
    const effectiveAdmin = isAdmin && !viewAsParent;

    // Deep-linked / selected location always passes through filters
    const ensureSelected = (result: typeof locations) => {
      if (!selectedLocationId || result.some((l) => l.id === selectedLocationId)) return result;
      const sel = locations.find((l) => l.id === selectedLocationId);
      return sel ? [...result, sel] : result;
    };

    // Step 1: Apply released filter (belt-and-suspenders; server already filters)
    let filtered = locations;
    if (!effectiveAdmin) {
      // Non-admins (or view-as-parent): only released locations
      filtered = filtered.filter((loc) => loc.released === true);
    } else if (releasedFilter === "released") {
      filtered = filtered.filter((loc) => loc.released === true);
    } else if (releasedFilter === "unreleased") {
      filtered = filtered.filter((loc) => loc.released !== true);
    }

    // Step 2: Apply score/size filters based on admin status
    if (!effectiveAdmin) {
      // Non-admin: always hide unscored, show all scored (including RED)
      return ensureSelected(filtered.filter((loc) => loc.scores?.overallColor != null));
    }

    // Admin: hide unscored unless toggled on
    if (!showUnscored) {
      filtered = filtered.filter((loc) => loc.scores?.overallColor != null);
    }

    // Admin (effective): full filter logic
    const anyColorFilter = scoreFilters.overall.size > 0 ||
      scoreFilters.price.size > 0 ||
      scoreFilters.zoning.size > 0 ||
      scoreFilters.neighborhood.size > 0 ||
      scoreFilters.building.size > 0;
    // Default size selections don't count as an active filter
    const DEFAULT_SIZES = new Set(["Micro", "Micro2", "Growth", "Full Size"]);
    const isDefaultSize = scoreFilters.size.size === DEFAULT_SIZES.size &&
      [...scoreFilters.size].every(v => DEFAULT_SIZES.has(v));
    const anySizeFilter = scoreFilters.size.size > 0 && !isDefaultSize;
    const anyFilter = anyColorFilter || anySizeFilter;

    if (!anyFilter) {
      // Default: exclude Red (Reject) size locations
      return ensureSelected(filtered.filter((loc) => {
        const size = loc.scores?.sizeClassification;
        return size !== "Red (Reject)";
      }));
    }

    return ensureSelected(filtered.filter((loc) => {
      const scores = loc.scores;

      // Color filter categories: location must match each active category
      const colorCategories: { filter: Set<string>; getColor: () => string | null | undefined }[] = [
        { filter: scoreFilters.overall, getColor: () => scores?.overallColor },
        { filter: scoreFilters.price, getColor: () => scores?.price.color },
        { filter: scoreFilters.zoning, getColor: () => scores?.zoning.color },
        { filter: scoreFilters.neighborhood, getColor: () => scores?.neighborhood.color },
        { filter: scoreFilters.building, getColor: () => scores?.building.color },
      ];

      for (const cat of colorCategories) {
        if (cat.filter.size > 0) {
          const color = cat.getColor();
          if (!color || !cat.filter.has(color)) return false;
        }
      }

      // Size filter: OR within size selections
      if (anySizeFilter) {
        const size = scores?.sizeClassification;
        if (!size || !scoreFilters.size.has(size)) return false;
      } else {
        // No size filter active but other filters are: exclude Red (Reject)
        const size = scores?.sizeClassification;
        if (size === "Red (Reject)") return false;
      }

      return true;
    }));
  },
}));
