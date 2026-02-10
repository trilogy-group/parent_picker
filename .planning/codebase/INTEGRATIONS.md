# External Integrations

**Analysis Date:** 2026-02-09

## APIs & External Services

**Mapbox:**
- Geocoding API - Converts address strings to lat/lng coordinates for suggested locations
  - SDK/Client: `mapbox-gl` 3.18.1 + `react-map-gl` 8.1.0
  - Auth: `NEXT_PUBLIC_MAPBOX_TOKEN` (public token)
  - Usage: `src/lib/locations.ts` - `geocodeAddress()` function for location suggestions

**Mapbox Vector Tiles:**
- Map rendering (base maps, layers, interactivity)
  - Consumed via `MapView.tsx` component
  - Endpoint: `https://api.mapbox.com/...`

**Resend (Email Delivery):**
- Transactional email for location approval/rejection notifications
  - SDK/Client: `resend` 6.9.1
  - Auth: `RESEND_API_KEY` (server-only)
  - From: `Alpha Schools <alpha_school@resend.dev>`
  - Reply-to: `real_estate@alpha.school`
  - Usage: `src/lib/email.ts` - `sendEmail()` for admin workflows

## Data Storage

**Databases:**
- Supabase PostgreSQL (primary)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` (public URL), `SUPABASE_SERVICE_ROLE_KEY` (server-only for admin ops)
  - Client: `@supabase/supabase-js` 2.94.1 (anon key) and service role client (admin ops)
  - Tables owned by this app:
    - `pp_locations` - Submitted and managed locations (name, address, city, state, lat, lng, status, source, suggested_by, created_at)
    - `pp_votes` - Parent votes (user_id, location_id, timestamp)
    - `pp_location_scores` - Scoring from upstream agent (location_id, overall_score, demographics_score, price_score, zoning_score, neighborhood_score, building_score, and corresponding color/URL fields, size_classification)
    - `pp_profiles` - Parent profiles (minimal, currently unused)
  - Views:
    - `pp_locations_with_votes` - Join locations with vote counts and scores
  - RPC functions:
    - `get_location_cities()` - Aggregate cities by released status and filters
    - `get_nearby_locations()` - Spatial query for locations within radius
    - `sync_scores_from_listings()` - Bulk sync from upstream `real_estate_listings` table
    - `sync_scores_for_address()` - Single-address score sync triggered by admin UI
  - Upstream tables (read-only):
    - `real_estate_listings` - Populated by external scoring agent, contains scores and size classification that get synced into `pp_location_scores`

**File Storage:**
- None - Local filesystem or CDN URLs only (artifact links embedded in score data from upstream)

**Caching:**
- None detected - Direct database queries, client-side Zustand store for UI state

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built on Postgres)
  - Implementation: Magic link sign-in via email
  - Code: `src/lib/auth.ts` - `signInWithMagicLink()`, `signOut()`, `getSession()`, `getUser()`
  - Magic link redirect: `${window.location.origin}/` (app root)
  - Session storage: Browser-based via Supabase client
  - Admin authorization: Bearer token in `Authorization` header, validated against `ADMIN_EMAILS` list in `src/lib/admin.ts`

**Admin Authorization:**
- Email whitelist-based
  - Env: `ADMIN_EMAILS` (server-side), `NEXT_PUBLIC_ADMIN_EMAILS` (client-side for UI state)
  - Validation: `verifyAdmin()` in `src/lib/admin.ts` checks token against email list

## Monitoring & Observability

**Error Tracking:**
- None detected - Errors logged to console only

**Logs:**
- Browser console (client-side)
- Node.js console output (server-side)
- No centralized logging service configured

## CI/CD & Deployment

**Hosting:**
- Vercel (https://parentpicker.vercel.app)
- Manual deployment: `npx vercel --prod` (GitHub auto-deploy broken, git integration issues)
- Environment variables set in Vercel dashboard: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ADMIN_EMAILS`, `NEXT_PUBLIC_ADMIN_EMAILS`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**CI Pipeline:**
- None - Manual testing via Playwright test suite before deployment

## Environment Configuration

**Required env vars (must be set for full functionality):**
- `NEXT_PUBLIC_MAPBOX_TOKEN` - Mapbox geocoding and map rendering
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key for client-side queries
- `SUPABASE_SERVICE_ROLE_KEY` - Admin operations (voting persistence, score syncing, location approval)
- `RESEND_API_KEY` - Email delivery for admin notifications
- `ADMIN_EMAILS` - Comma-separated list for server-side admin auth
- `NEXT_PUBLIC_ADMIN_EMAILS` - Comma-separated list for client-side admin UI visibility

**Optional env vars:**
- If `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` missing: App runs in offline mode with mock data

**Secrets location:**
- Development: `.env.local` (in `.gitignore`, never committed)
- Production: Vercel environment variables (dashboard)
- Supabase CLI token: macOS Keychain (`supabase` service key)

## Webhooks & Callbacks

**Incoming:**
- None - App does not expose public webhooks

**Outgoing:**
- Resend email delivery - Asynchronous, no webhook confirmation required
- Mapbox geocoding - Synchronous HTTP request, returns coordinates

## Data Flow Integration Points

**Location Suggestion → Approval Workflow:**
1. Parent submits address via `SuggestLocationModal` → `suggestLocation()` in `src/lib/locations.ts`
2. Address geocoded via Mapbox API → lat/lng stored
3. Location inserted into `pp_locations` (status: `pending_review`)
4. Admin reviews at `/admin` page via `GET /api/admin/locations`
5. Admin approves → `POST /api/admin/locations/[id]/approve` calls Resend email + sets status to `approved`
6. Location now queryable by parents as released location

**Vote Persistence:**
1. Parent clicks vote button → `vote()` in Zustand store (optimistic UI update)
2. If logged in and Supabase configured → INSERT into `pp_votes` table
3. On failure → rollback optimistic update, log error

**Score Sync:**
1. Admin triggers `POST /api/admin/locations/[id]/sync-scores`
2. Calls RPC `sync_scores_for_address()` → queries `real_estate_listings`, upserts into `pp_location_scores`
3. Bulk sync via manual `SELECT sync_scores_from_listings()` (documented in architecture.md)

**Filter + Display Pipeline:**
1. Page renders → Zustand `loadCitySummaries()` and `fetchNearbyForce()` (if user has location permission)
2. `getCitySummaries()` calls RPC or returns mock data
3. `getNearbyLocations()` calls RPC with center, limit, released filter
4. Client-side `filteredLocations()` applies score/size filters, red-location toggle, admin filters
5. Map renders via `MapView` component, list via `LocationsList` component

---

*Integration audit: 2026-02-09*
