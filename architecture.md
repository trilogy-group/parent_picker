# Parent Picker - Architecture

## Overview

This document describes the technical architecture of the Parent Picker application, including state management, data flow, tech stack, commands, and key integration points.

## Tech Stack

| Component | Choice | Notes |
|-----------|--------|-------|
| Framework | Next.js 15 (App Router) | TypeScript, src/ directory |
| Styling | Tailwind CSS + shadcn/ui | Button, Card, Dialog, Input components |
| Maps | Mapbox GL via react-map-gl/mapbox | Dynamic import (SSR disabled) |
| State | Zustand | Global state for locations, votes, selection |
| Database | Supabase | Falls back to mock data if not configured |
| Auth | Supabase Auth | Magic link sign-in |

## Commands

```bash
# Development
npm run dev          # Start dev server at localhost:3000

# Build & Production
npm run build        # Build for production
npm run start        # Start production server

# Deploy to Vercel (manual - not connected to GitHub)
npx vercel --prod

# Testing (requires dev server running on :3000)
npm test                                                        # Run full test suite (261 TCs, 178 automated, 28 skipped)
BASE_URL=http://localhost:3001 npm test                         # Override dev server URL

# Linting
npm run lint         # Run ESLint
```

## Environment Variables

Store in `.env.local`:
```
NEXT_PUBLIC_MAPBOX_TOKEN=        # Get from mapbox.com
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL (optional - falls back to mock data)
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key (optional - falls back to mock data)
```

**Offline/Demo Mode:** If Supabase env vars are missing, app runs with mock data and local-only voting. Shows "Demo Mode" badge in header.

## TDD Workflow

**Before making changes:**
1. Read the relevant requirement in `requirements.md`
2. Ensure the test case exists
3. Run the test suite to verify current state
4. Make changes
5. Run tests again to verify
6. If fails, go back to #4 until you get it right

**Adding new features:**
1. Add requirement to `requirements.md` with test cases
2. Add test implementation to `tests/requirements.test.py`
3. Run tests (should fail)
4. Implement feature
5. Run tests (should pass)

## Deployment

- **Hosting:** Vercel (https://parentpicker.vercel.app)
- **Deploy:** `npx vercel --prod` (manual - not connected to GitHub auto-deploy)

## Database Schema

See [`docs/schema-design.md`](docs/schema-design.md) for complete Supabase schema including:
- Tables: `pp_locations`, `pp_votes`, `pp_profiles`
- View: `pp_locations_with_votes`
- RLS policies
- SQL setup script and seed data

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

## File Structure

```
src/
├── app/
│   ├── layout.tsx      # Root layout with AuthProvider
│   ├── page.tsx        # Main page (full-screen map + overlay)
│   └── globals.css     # Tailwind + shadcn styles
├── components/
│   ├── Map.tsx         # Dynamic import wrapper
│   ├── MapView.tsx     # Mapbox GL map with markers
│   ├── LocationsList.tsx
│   ├── LocationCard.tsx
│   ├── VoteButton.tsx  # Vote button with auth check
│   ├── SuggestLocationModal.tsx
│   ├── AuthProvider.tsx # Session context + auth state
│   ├── AuthButton.tsx   # Sign in/out UI
│   ├── SignInPrompt.tsx # Reusable magic link form
│   └── ui/             # shadcn components
├── lib/
│   ├── supabase.ts     # Supabase client (null if not configured)
│   ├── auth.ts         # Auth helpers (magic link, sign out)
│   ├── locations.ts    # Fetch locations + suggest with geocoding
│   ├── votes.ts        # Zustand store with DB persistence
│   └── utils.ts        # Tailwind merge utility
└── types/
    └── index.ts        # TypeScript interfaces
```
