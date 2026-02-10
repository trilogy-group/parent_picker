# Codebase Structure

**Analysis Date:** 2026-02-09

## Directory Layout

```
src/
├── app/                          # Next.js App Router pages & API routes
│   ├── layout.tsx                # Root layout (wraps with AuthProvider)
│   ├── page.tsx                  # Main app page (map + overlay panel)
│   ├── globals.css               # Tailwind + shadcn styles
│   ├── admin/
│   │   └── page.tsx              # Admin dashboard (pending suggestions, liked locations)
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts          # Supabase Auth callback (magic link)
│   └── api/
│       └── admin/
│           ├── locations/
│           │   ├── route.ts      # GET pending locations, POST create
│           │   └── [id]/
│           │       ├── approve/route.ts
│           │       ├── reject/route.ts
│           │       ├── sync-scores/route.ts
│           │       └── notify-voters/route.ts
│           └── likes/
│               └── route.ts      # GET top-voted locations
│
├── components/                   # React UI components
│   ├── Map.tsx                   # Dynamic import wrapper (SSR disabled)
│   ├── MapView.tsx               # Mapbox GL map with markers & popups
│   ├── LocationsList.tsx         # List of locations with filter panel
│   ├── LocationCard.tsx          # Single location card (votes, scores, address)
│   ├── ScoreBadge.tsx            # Score display (icon grid, legend, sizing)
│   ├── VoteButton.tsx            # Vote button with vote count
│   ├── SuggestLocationModal.tsx  # Modal to suggest new location
│   ├── AddressAutocomplete.tsx   # Address input with Mapbox suggestions
│   ├── AuthButton.tsx            # Sign in/out button
│   ├── AuthProvider.tsx          # Session context (useAuth hook)
│   ├── SignInPrompt.tsx          # Reusable magic link form
│   ├── AdminLocationCard.tsx     # Card for admin suggestion review
│   └── ui/                       # shadcn/ui components
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── button.tsx
│       └── input.tsx
│
├── lib/                          # Utilities & business logic
│   ├── votes.ts                  # Zustand store (state + actions)
│   ├── locations.ts              # Fetch locations, city summaries, distances
│   ├── geocoding.ts              # Mapbox Geocoding API wrapper
│   ├── address.ts                # Address parsing & formatting utilities
│   ├── metros.ts                 # Metro area consolidation logic
│   ├── supabase.ts               # Supabase client initialization
│   ├── supabase-admin.ts         # Admin Supabase client (service role)
│   ├── auth.ts                   # Magic link, sign-out, session helpers
│   ├── admin.ts                  # JWT verification for admin routes
│   ├── email.ts                  # Resend email service wrapper
│   └── utils.ts                  # Tailwind merge utility
│
└── types/                        # TypeScript interfaces
    └── index.ts                  # Location, LocationScores, AdminLocation, etc.
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router entry points (pages and API routes)
- Contains: Page components (page.tsx, layout.tsx), API route handlers
- Key files: `page.tsx` (main app), `admin/page.tsx` (admin dashboard), `api/admin/*` (admin APIs)

**`src/components/`:**
- Purpose: Reusable React components for UI rendering
- Contains: Client components (use "use client"), shadcn/ui wrappers
- Key files: `MapView.tsx` (Mapbox integration), `LocationsList.tsx` (list + filters), `LocationCard.tsx` (single location)

**`src/lib/`:**
- Purpose: Non-React utility functions and state management
- Contains: Zustand store, Supabase clients, data fetching, geocoding, address parsing
- Key files: `votes.ts` (central state), `locations.ts` (API calls), `geocoding.ts` (address search)

**`src/types/`:**
- Purpose: TypeScript interface definitions
- Contains: Location, LocationScores, AdminLocation, CitySummary, etc.
- Key files: `index.ts` (all interfaces)

## Key File Locations

**Entry Points:**
- `src/app/page.tsx` - Main application (map + locations list overlay)
- `src/app/admin/page.tsx` - Admin dashboard for suggestion review
- `src/app/layout.tsx` - Root layout with AuthProvider
- `src/app/api/admin/locations/route.ts` - Admin API for pending locations

**Configuration:**
- `src/app/globals.css` - Tailwind CSS imports and shadcn styling
- `.env.local` - Mapbox token, Supabase URL/key (not in git)
- `next.config.js` - Next.js configuration (if present)

**Core Logic:**
- `src/lib/votes.ts` - Zustand store (entire state machine: locations, filters, votes, map viewport)
- `src/lib/locations.ts` - Data fetching (getNearbyLocations, getCitySummaries, getDistanceMiles)
- `src/lib/geocoding.ts` - Mapbox Geocoding API (searchAddresses, geocodeAddress)
- `src/components/MapView.tsx` - Mapbox GL map rendering with markers/popups

**Testing:**
- `tests/requirements.test.py` - Playwright test suite (45+ test cases)

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g., `MapView.tsx`, `LocationCard.tsx`)
- Non-React utilities: `camelCase.ts` (e.g., `votes.ts`, `geocoding.ts`)
- API routes: `route.ts` in directory (e.g., `src/app/api/admin/locations/route.ts`)
- Tests: `filename.test.py` (Playwright in Python)

**Directories:**
- Feature directories: lowercase with slashes (e.g., `api/admin/locations/[id]/`)
- Component groups: plural when containing multiple items (e.g., `components/ui/`)

**Variables & Functions:**
- Functions: `camelCase` (e.g., `getNearbyLocations()`, `searchAddresses()`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `AUSTIN_CENTER`, `NEARBY_THRESHOLD_MILES`)
- React hooks: `use*` (e.g., `useVotesStore()`, `useAuth()`)
- State names: descriptive camelCase (e.g., `selectedLocationId`, `votedLocationIds`)

**Types & Interfaces:**
- Interfaces: `PascalCase` with optional suffix (e.g., `Location`, `LocationScores`, `MapBounds`)
- Enum-like constants: `camelCase` Arrays or Sets (e.g., `COLOR_OPTIONS`, `SIZE_OPTIONS`)

## Where to Add New Code

**New Feature (e.g., "Add location filters by school type"):**
- Primary code: `src/lib/votes.ts` (extend ScoreFilters type and filtering logic)
- Components: `src/components/LocationsList.tsx` (add filter UI)
- Types: Update `src/types/index.ts` if new data structure needed

**New Component/Module (e.g., "Parent testimonials sidebar"):**
- Implementation: `src/components/Testimonials.tsx`
- Hook usage: `useVotesStore()` or `useAuth()` if state needed
- Tests: Add Playwright test case in `tests/requirements.test.py`

**Utilities:**
- Shared helpers: `src/lib/utils.ts` or new file `src/lib/[domain].ts`
- Address parsing: `src/lib/address.ts` (already exists, add functions here)
- Geocoding wrappers: `src/lib/geocoding.ts` (already exists)

**Admin APIs:**
- New endpoint: `src/app/api/admin/[feature]/route.ts`
- Implementation: Use `verifyAdmin()` from `src/lib/admin.ts` for auth
- Service logic: Extract to `src/lib/admin.ts` if shared with multiple routes

**Styles:**
- Global styles: `src/app/globals.css`
- Component scoping: Use Tailwind className directly in component (no separate .css files)
- shadcn/ui overrides: Update in `src/app/globals.css` or component className

## Special Directories

**`src/components/ui/`:**
- Purpose: shadcn/ui component wrappers (pre-configured, re-exported)
- Generated: Yes (via `npx shadcn-ui@latest add [component]`)
- Committed: Yes (customized shadcn components checked into git)

**`node_modules/`:**
- Purpose: Installed dependencies (npm install)
- Generated: Yes (from package.json + package-lock.json)
- Committed: No (.gitignore)

**`.next/`:**
- Purpose: Next.js build output cache
- Generated: Yes (npm run build or dev server)
- Committed: No (.gitignore)

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes (by GSD mapping tools)
- Committed: Yes (tracked in git)

## File Size Reference

Key files by complexity (lines of code):
- `src/lib/votes.ts` - ~408 lines (Zustand store with filtering logic)
- `src/lib/locations.ts` - ~476 lines (data fetching, mock data, score mapping)
- `src/components/LocationsList.tsx` - ~346 lines (list + filter panel + sorting)
- `src/components/MapView.tsx` - ~315 lines (Mapbox GL integration)
- `src/components/AdminLocationCard.tsx` - ~381 lines (admin card with action buttons)

---

*Structure analysis: 2026-02-09*
