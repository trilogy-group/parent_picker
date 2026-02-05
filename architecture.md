# Parent Picker - Architecture

## Overview

This document describes the technical architecture of the Parent Picker application, including state management, data flow, and key integration points.

## State Management

**Zustand store** (`src/lib/votes.ts`) - Central state management for:
- `locations[]` - All location data loaded on mount
- `votedLocationIds` - Set of location IDs user has voted for
- `selectedLocationId` - Currently selected location on map
- `searchQuery` - Filter text for locations list
- `mapCenter` - Current map viewport center {lat, lng}
- `mapBounds` - Current map viewport bounds {north, south, east, west}
- `referencePoint` - Initial location for list sorting (set once, doesn't change)
- `flyToTarget` - Coordinate target for programmatic map navigation
- `previewLocation` - Temporary marker for suggested locations
- Optimistic updates with async DB sync for votes

## Data Flow

1. **Initial Load**: `page.tsx` calls `getLocations()` → stores in Zustand
2. **Offline Fallback**: If Supabase not configured, returns `mockLocations` (50 real locations)
3. **Geolocation**:
   - `MapView` requests user location
   - Calculates initial view via `getInitialMapView()` (defaults to Austin, TX if unavailable)
   - Sets `referencePoint` (user location or Austin) - **this never changes**
   - Flies to initial location with appropriate zoom
4. **Map Panning**: Map `onMove` updates `mapCenter` and `mapBounds` in Zustand
5. **List Sorting**: `LocationsList` subscribes to `mapBounds` + `referencePoint`, applies viewport-aware sorting
6. **Voting**: Optimistic local update → async Supabase insert (rollback on error)

## Key Files

- `src/lib/locations.ts` - Location fetching, geocoding, distance calculations
- `src/lib/votes.ts` - Zustand store with optimistic updates
- `src/lib/geocoding.ts` - Mapbox Geocoding API wrapper for search/suggest
- `src/components/MapView.tsx` - Mapbox GL map with markers, geolocation, fly-to
- `src/components/LocationsList.tsx` - List with search autocomplete, distance sorting

## Map Integration

- Uses `react-map-gl/mapbox` with dynamic import (SSR disabled)
- Map center tracking updates Zustand on every pan/zoom
- **Initial Location Strategy**:
  1. Try user geolocation (5s timeout)
  2. If user location found + nearby locations within 50mi → zoom to user (zoom level 10)
  3. Otherwise → default to Austin, TX (zoom level 10)
  4. Set reference point for list sorting (never changes after initial load)

## Viewport-Aware Sorting

Location list uses intelligent sorting based on map viewport visibility:

**Logic:**
1. **Visible locations** (on screen): sorted by votes descending
2. **Non-visible locations** (off screen): sorted by distance from **reference point** ascending
3. Visible locations always appear first in the list

**Key Detail:** Off-screen locations are sorted by distance from the **initial reference point** (user location or Austin), NOT from the current map center. This means the list order remains stable relative to where you started, even as you pan around.

**Benefits:**
- Users see highest-voted locations in their current view
- Off-screen locations stay sorted relative to initial location
- List doesn't chaotically reorder as you pan the map
- Best of both worlds: democratic voting + geographic relevance

**Visual Distinction:**
- Locations on-screen have a **blue left border**
- Locations off-screen have a **gray left border**
- Subtle, non-intrusive visual cue

**Implementation:**
- Map bounds tracked via `onMove` event → stored in Zustand
- `isInViewport()` checks if location is within bounds
- Haversine formula calculates distance from reference point for off-screen locations
- Falls back to vote-only sorting if map bounds unavailable
- `LocationCard` receives `isInViewport` prop for styling

## Authentication Flow

- Magic link authentication via Supabase Auth
- `AuthProvider.tsx` wraps app, provides session context
- Offline mode: voting allowed without auth (local-only, non-persistent)
- Online mode: voting requires sign-in, persists to Supabase `pp_votes` table

## Geocoding

- Mapbox Geocoding API for address search and validation
- `searchAddresses()` - Returns autocomplete suggestions (US only, addresses + POIs)
- `geocodeAddress()` - Converts full address to lat/lng coordinates
- Used in both search bar and suggest location modal
