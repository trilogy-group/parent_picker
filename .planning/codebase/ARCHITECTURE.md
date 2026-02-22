# Architecture

**Analysis Date:** 2026-02-09

## Pattern Overview

**Overall:** Client-server with centralized state management and Supabase integration.

**Key Characteristics:**
- Next.js 15 App Router (TypeScript, SSR-safe)
- Zustand for global state (locations, votes, filters, map viewport)
- Mapbox GL for geographic visualization
- Supabase for authentication and persistence (optional - app falls back to offline mock data)
- Optimistic updates for votes (immediate local feedback, async DB sync)
- Admin-only API routes protected by JWT token verification

## Layers

**Presentation (Client-Side Components):**
- Purpose: Render user interfaces for parent voting, location browsing, admin management
- Location: `src/components/`
- Contains: React components (LocationsList, MapView, LocationCard, ScoreBadge, VoteButton, etc.)
- Depends on: Zustand store, AuthProvider context, Mapbox GL, shadcn/ui
- Used by: Page.tsx (main app page), AdminPage.tsx (admin dashboard)

**State Management (Zustand Store):**
- Purpose: Single source of truth for locations, votes, filters, map viewport, user selection
- Location: `src/lib/votes.ts`
- Contains: VotesStore with locations[], votedLocationIds, scoreFilters, mapBounds, selectedLocationId, etc.
- Depends on: Supabase client, location fetching functions (getCitySummaries, getNearbyLocations)
- Used by: All presentation components (via useVotesStore hook)

**Authentication & Authorization:**
- Purpose: Magic link sign-in, admin verification, session management
- Location: `src/components/AuthProvider.tsx`, `src/lib/auth.ts`, `src/lib/admin.ts`
- Contains: Supabase Auth integration, admin email check via NEXT_PUBLIC_ADMIN_EMAILS
- Depends on: Supabase Auth client
- Used by: Layout, all auth-gated features (voting, admin page)

**Data Fetching (Location & Geocoding):**
- Purpose: Load locations from Supabase or mock data, geocode addresses, calculate distances
- Location: `src/lib/locations.ts`, `src/lib/geocoding.ts`, `src/lib/address.ts`
- Contains: getNearbyLocations(), getCitySummaries(), searchAddresses(), geocodeAddress(), getDistanceMiles()
- Depends on: Supabase client, Mapbox Geocoding API
- Used by: Zustand store (fetchNearby, loadCitySummaries), SuggestLocationModal, AddressAutocomplete

**API Routes (Server-Side):**
- Purpose: Admin-only operations (fetch pending suggestions, approve/reject, notify voters, sync scores)
- Location: `src/app/api/admin/`
- Contains: GET/POST routes for locations, likes, rejections, approvals, email notifications
- Depends on: Supabase Admin client, email service (Resend), JWT verification
- Used by: AdminPage.tsx (client-side fetch calls)

**Mapping (Mapbox GL):**
- Purpose: Display locations on an interactive map with city bubbles at zoom-out
- Location: `src/components/MapView.tsx`, `src/components/Map.tsx`
- Contains: Marker clusters (cities at zoom < 9, individual locations at zoom >= 9), popups, geolocation
- Depends on: react-map-gl, Mapbox GL CSS
- Used by: Main page layout

## Data Flow

**1. Initial Load (App Startup):**
- `page.tsx` mounts → calls `loadCitySummaries()` and `setReferencePoint(AUSTIN_CENTER)`
- Zustand store fetches city summaries from Supabase (or mock data if offline)
- `MapView` mounts → requests user geolocation (5s timeout)
- Once geolocation resolved or timeout, calculate initial map view (zoom 10 to user location or Austin)
- Store `referencePoint` in Zustand (never changes after init)

**2. List & Map Synchronization:**
- Map `onMove` event → updates `mapCenter` and `mapBounds` in Zustand
- `LocationsList` component subscribes to `mapBounds` + `referencePoint`
- List computes `filteredLocations()` which applies:
  - Score/size filters (AND across categories, OR within)
  - Viewport sorting: on-screen locations (by votes desc) then off-screen (by distance from referencePoint asc)
  - Admin filters (released/unreleased, show unscored, view as parent)

**3. Voting Flow:**
- User clicks vote on LocationCard → `VoteButton.onVote()` called
- If unauthenticated → show "Sign in to vote" dialog (Supabase-only, not in offline mode)
- Zustand `vote()` action:
  1. Optimistic update: increment votes, add to votedLocationIds
  2. If Supabase configured + user logged in: async insert to `pp_votes` table
  3. On DB error: rollback optimistic update
- Vote count reflects immediately in card and map popup

**4. Suggest Location Flow:**
- User opens `SuggestLocationModal` → types address
- `AddressAutocomplete` calls `searchAddresses()` (Mapbox API) → shows suggestions
- User selects address → `geocodeAddress()` converts to lat/lng
- User submits → API POST to `/api/suggest` (creates pending location in pp_locations with status='pending_review')
- If Supabase not configured: stores locally (non-persistent)

**5. Admin Workflow:**
- Admin visits `/admin` → verifies token from Supabase Auth
- Admin page fetches from `/api/admin/locations` (GET) → lists pending suggestions
- Admin clicks Approve/Reject → POST to `/api/admin/locations/{id}/approve` or `/reject`
- Approve: updates status to 'approved', optionally notifies suggestor
- Reject: updates status to 'rejected'
**6. Filter & Metro Consolidation:**
- Parent user toggles filter (e.g., "Price: GREEN") → toggleScoreFilter() updates Zustand
- Both map dots and location list re-render via `filteredLocations()`
- City summaries update via `loadCitySummaries()` which calls `consolidateToMetros()` to group cities into metro areas

**State Management:**
- `locations[]` - all location objects with lat/lng, votes, scores
- `votedLocationIds` - Set of location IDs user has voted for (persisted in DB if logged in)
- `selectedLocationId` - currently selected location (used for map popup + card highlight)
- `scoreFilters` - nested Sets per category (overall, price, zoning, neighborhood, building, size)
- `mapBounds` - viewport bounds for viewport-aware sorting (north, south, east, west)
- `referencePoint` - initial user location or Austin (set once, immutable during session)
- `zoomLevel` - current map zoom (triggers city summaries vs individual locations)
- `showRedLocations`, `showUnscored` - parent/admin toggles for filtering
- `releasedFilter` - admin filter (all/released/unreleased)
- `isAdmin`, `viewAsParent` - role and preview mode

## Key Abstractions

**Location Abstraction:**
- Purpose: Represents a potential school site with voting and score metadata
- Examples: `src/types/index.ts` (Location, LocationScores, SubScore)
- Pattern: Immutable interface with optional fields (scores?, suggested?, released?). Scores deserialized from Supabase with color derivation (null → derived from numeric score).

**Score Abstraction:**
- Purpose: Encapsulate location evaluation across 5 dimensions (demographics, price, zoning, neighborhood, building)
- Examples: `src/lib/locations.ts` (mapRowToScores, colorFromScore)
- Pattern: Color-coded (GREEN ≥0.75, YELLOW ≥0.5, AMBER ≥0.25, RED <0.25) with optional URLs to detailed scoring artifacts

**Filter Abstraction:**
- Purpose: Compose location visibility rules across map and list
- Examples: `src/lib/votes.ts` (ScoreFilters, filteredLocations() method)
- Pattern: Nested Sets (per category) with AND logic across categories and OR within. Default size filter maps to "show all" logic.

**Metro Consolidation:**
- Purpose: Group cities into metro areas at high zoom levels to reduce clutter
- Examples: `src/lib/metros.ts` (consolidateToMetros)
- Pattern: Predefined metro definitions (Austin TX, Bay Area CA, Florida metros) that aggregate city summaries

## Entry Points

**Main Application Page:**
- Location: `src/app/page.tsx`
- Triggers: GET / (browser navigation)
- Responsibilities: Root layout for map + overlay panel (desktop/mobile). Initializes reference point, loads city summaries. Routes to Map, LocationsList, and SuggestLocationModal.

**Admin Page:**
- Location: `src/app/admin/page.tsx`
- Triggers: GET /admin (admin user navigation)
- Responsibilities: Auth check via Supabase token. Fetch and display pending suggestions, liked locations. Provide UI for approval/rejection.

**Root Layout:**
- Location: `src/app/layout.tsx`
- Triggers: All pages
- Responsibilities: Wraps children in AuthProvider context. Provides session state to entire app.

**API Routes (Admin):**
- GET `/api/admin/locations` - Fetch pending suggestions
- GET `/api/admin/likes` - Fetch top-voted locations
- POST `/api/admin/locations/{id}/approve` - Approve suggestion
- POST `/api/admin/locations/{id}/reject` - Reject suggestion
- POST `/api/admin/locations/{id}/notify-voters` - Send email to suggestor/voters


**Auth Callback:**
- Location: `src/app/auth/callback/route.ts`
- Triggers: POST from Supabase Auth magic link
- Responsibilities: Exchange callback code for session, redirect to home

## Error Handling

**Strategy:** Graceful degradation with offline fallback.

**Patterns:**
- Supabase client is null if not configured → app runs with mock data, local-only voting
- Vote operations: optimistic update with rollback on error
- API routes: JWT verification via `verifyAdmin()`, return 401 if unauthorized
- Geocoding: return empty array on API error, show no suggestions
- Auth: catch sign-in errors and display in prompt (e.g., "Invalid email")
- Geolocation: 5s timeout, fallback to Austin if unavailable or user denies

## Cross-Cutting Concerns

**Logging:** Console.error for critical failures (failed votes, failed geocoding, auth errors). No structured logging framework.

**Validation:**
- Email validation in sign-in form (basic regex check)
- Address validation via Mapbox Geocoding (if no results, suggest "Address not found")
- Admin email check via NEXT_PUBLIC_ADMIN_EMAILS environment variable

**Authentication:**
- Supabase Magic Link (OTP via email)
- JWT token in Authorization header for admin API routes
- Session stored in localStorage by Supabase client (auto-restored on page reload)

**Authorization:**
- Non-admins can view only "released" locations (unless toggling "Help with Red")
- Admins can toggle between released/unreleased/all
- Admin-only pages check token before fetching data
- Vote creation requires either logged-in user (Supabase) or offline mode (local-only)

---

*Architecture analysis: 2026-02-09*
