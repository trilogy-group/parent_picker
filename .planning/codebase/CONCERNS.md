# Codebase Concerns

**Analysis Date:** 2026-02-09

## Tech Debt

### REBL Scoring Bug (Critical)

**Issue:** `overall_color` field is wrong for ~74% of locations (1,026 of 1,044 scored locations)
- Files: `src/lib/locations.ts` lines 45-84 (mapRowToScores function), `src/app/api/admin/locations/route.ts` lines 5-32 (mapScores function)
- Impact: UI displays incorrect color indicators for most locations; REBL artifacts show correct colors but `pp_location_scores` has wrong values
- Current mitigation: Code uses fallback `colorFromScore(demo)` when DB value is null, but null case doesn't apply here since values are written but wrong
- Fix approach:
  1. REBL must fix its color calculation logic
  2. REBL re-writes corrected scores into `pp_location_scores`
  3. Verify 1,026 rows update correctly by spot-checking color values match score ranges

### Scoring Coverage Gaps

**Issue:** Significant unscored location backlog blocks MVP feature completeness
- Files: `pp_location_scores` table (populated by REBL)
- Impact: Parent filtering experience degraded; non-admin parents cannot see unscored locations; admin has visibility but can't promote them
- Current state:
  - 1,044 locations scored out of 2,210 total (47%)
  - 1,166 locations remain unscored
  - 734 already-scored locations missing Price sub-scores (especially 140 missing)
- Fix approach: REBL needs to batch-score remaining 1,166 locations and fill sub-score gaps for the 734 partial-scored rows

---

## Known Bugs

### Location Size Classification Data Incomplete

**Symptoms:** 1,026 of 1,044 scored locations have `size_classification` data; 18 rows missing
- Files: `pp_location_scores.size_classification` column
- Trigger: Locations written by REBL without size tier data
- Current impact: Minimal; filter defaults hide N/A sizes anyway, but coverage incomplete
- Workaround: Size filter defaults to `["Micro", "Micro2", "Growth", "Full Size"]` and filters via `isDefaultSize` logic in `src/lib/votes.ts` lines 365-368
- Fix: REBL should populate size_classification for all 1,026 scored rows

### React SSR/Hydration State Initialization (Fixed but documented)

**Symptoms:** Already fixed in MapView component but pattern is fragile across codebase
- Files: `src/components/MapView.tsx` lines 59-62 (correct pattern with `geoResolved` and `mapReady`)
- Issue: During SSR, `navigator` is undefined; initializing state to `true` prevents useEffect from transitioning it to correct value
- Current fix: Start `geoResolved = false`, let useEffect set it to `true`; add separate `mapReady` state triggered by `onLoad` callback
- Risk: Other components using `useState` with conditional logic based on undefined globals could have same issue
- Audit needed: Search for patterns like `useState(() => typeof navigator !== "undefined")` in other components

---

## Security Considerations

### Admin Authentication Token Handling

**Risk:** Bearer tokens passed through client-side code; exposure surface is larger than API-only approach
- Files: `src/lib/admin.ts` (token validation), `src/app/admin/page.tsx` (token storage in state), `src/components/AdminLocationCard.tsx` (token in request headers)
- Current mitigation:
  - Tokens are Supabase session tokens (time-limited, not persistent)
  - `verifyAdmin()` checks Bearer token against service role key in `src/lib/admin.ts` line 18
  - Email whitelist enforced via `ADMIN_EMAILS` env var (split/trim/lowercase on line 21-24)
- Weakness: Token lives in React component state (src/app/admin/page.tsx line 38), accessible to dev tools; token passed in Authorization header for each request without HTTPS-only or SameSite restrictions
- Recommendations:
  1. Use HTTP-only cookies instead of state-stored tokens (server sends after auth verification)
  2. Implement CSRF token rotation for admin endpoints
  3. Add rate limiting to `/api/admin/*` routes to prevent token brute-force

### Admin Endpoint Authorization Gaps

**Risk:** Multiple admin routes verify auth but could be bypassed or exploited
- Files: `src/app/api/admin/locations/route.ts`, `src/app/api/admin/locations/[id]/approve/route.ts`, `src/app/api/admin/locations/[id]/reject/route.ts`, `src/app/api/admin/locations/[id]/notify-voters/route.ts`
- Current protection: Each route calls `verifyAdmin()` on the Authorization header
- Gap: No rate limiting; no audit logging of admin actions (approve, reject, notify); no transaction rollback if operation fails mid-way
- Missing: Idempotency keys for approve/reject (repeated submission could double-count votes)
- Recommendations:
  1. Add request ID / idempotency key validation
  2. Log all admin mutations to audit table with timestamp, admin email, action, location_id, result
  3. Implement exponential backoff rate limiting (e.g., 10 requests/min per admin email)

### Data Validation for User Suggestions

**Risk:** User-submitted location data (`suggestLocation()`) lacks validation before write
- Files: `src/lib/locations.ts` lines 419-461 (suggestLocation function), `src/components/SuggestLocationModal.tsx` (form submission)
- Current validation: Client-side trim check (line 49 in SuggestLocationModal), but only checks non-empty
- Missing:
  - No max length enforcement on address/notes (could be 10MB string)
  - No geocoding validation (coordinates can be anywhere, even invalid lat/lng ranges)
  - No XSS escaping (stored as-is; could contain malicious HTML)
  - SQL injection risk if address/notes reach database (Supabase parameterization mitigates, but risky)
- Recommendations:
  1. Add max-length constraints: address 200 chars, city 100 chars, state 2 chars, notes 1000 chars
  2. Validate lat/lng are within -180..180, -90..90 ranges
  3. Sanitize text inputs (strip HTML tags, limit special chars)
  4. Implement captcha or rate limiting to prevent spam suggestions

---

## Performance Bottlenecks

### Map Rendering with 1,026+ Locations

**Problem:** `locationGeojson` in MapView renders all 1,026+ filtered locations as map dots every render
- Files: `src/components/MapView.tsx` lines 90-105 (locationGeojson memoization)
- Cause: GeoJSON features array regenerated on every `displayLocations` change; no spatial indexing
- Current state: Performance acceptable at zoom levels where clusters merge, but slow at zoom 10-14 (500m radius) with dozens of dots visible
- Impact: Map pan/zoom stutters at high zoom when many locations visible; CPU usage spikes during filter toggle
- Improvement path:
  1. Implement quadtree or H3 spatial indexing to pre-cluster locations at different zoom levels
  2. Use Mapbox native clustering via `cluster: true` on source layer instead of client-side aggregation
  3. Lazy-load GeoJSON incrementally (only render dots in current viewport bounds + 500m buffer)

### City Summaries Fetch Without Pagination

**Problem:** `loadCitySummaries()` fetches all city summaries in single query; no pagination
- Files: `src/lib/locations.ts` lines 287-330 (getCitySummaries function), `src/lib/votes.ts` lines 169-177 (loadCitySummaries action)
- Cause: `getNearbyLocations()` returns all results, aggregates into map, derives city summaries from full dataset
- Current data: ~55 metros/cities across TX, FL, CA; acceptable for now
- Risk: If expanded to 10+ states (1000+ cities), fetch becomes bottleneck; no caching between re-fetches
- Scaling limit: Query timeout likely at 5,000+ locations; Supabase free tier may reject after 10,000
- Improvement path:
  1. Add pagination: fetch locations in chunks (e.g., 500 per request)
  2. Cache city summaries in Zustand store with 5-min TTL to avoid redundant queries
  3. Implement server-side city summary view in Supabase (materialized view updated hourly)

### Vote Count Aggregation on Each Render

**Problem:** `totalVotes` computed on every render in `src/app/page.tsx` lines 24-26
- Files: `src/app/page.tsx` lines 24-26, `src/lib/votes.ts` (locations/citySummaries in store)
- Cause: `.reduce()` runs O(n) on full locations array even if data unchanged
- Impact: Negligible for current data size (1,026 locations), but antipattern for scaling
- Improvement: Memoize total votes in Zustand store, update only on data fetch/change, not on every render

---

## Fragile Areas

### Filter State Machine (Complex Logic)

**Files:** `src/lib/votes.ts` lines 321-407 (filteredLocations function)
- Why fragile:
  - Multi-stage filtering: released → score/size → color toggles → size tier logic
  - Non-admin mode has special-case behavior (always hide unscored, apply red toggle)
  - Admin "view as parent" mode changes filter logic entirely (lines 323)
  - `isDefaultSize` heuristic (line 365) uses Set.size comparison to detect default state — fragile if defaults change
  - Size filter values are stored as strings ["Micro", "Micro2", "Growth", "Full Size"] with manual match logic (lines 396-400)
- Safe modification:
  1. Add unit tests for each filter combination (current test suite is Playwright e2e, no unit tests for filter logic)
  2. Use enums for size tiers instead of strings to prevent typos
  3. Extract size tier matching into helper function with clear return type
  4. Document invariants: "default size state = all 4 non-reject sizes selected"
- Test coverage gaps: No isolated tests for filter logic; all coverage via e2e tests that depend on UI working

### MapView Coordinate/State Management

**Files:** `src/components/MapView.tsx` lines 16-160
- Why fragile:
  - 3 separate state vars: `userLocation`, `geoResolved`, `mapReady` (lines 59-62)
  - Geolocation async request (lines 113-133) races with map render
  - useEffect dependencies form DAG: `initialViewSet` depends on `geoResolved` AND `mapReady` AND `citySummaries.length` (line 137)
  - `mapRef.current` null checks in multiple places (lines 147) but no guard in zoom handlers
  - `selectedLocationRef` maintains separate ref from Zustand state (lines 65) — can desync
- Safe modification:
  1. Extract geolocation logic to custom hook (`useGeolocation()`) that manages all three state vars as one unit
  2. Add null check before `mapRef.current?.flyTo()` calls
  3. Delete `selectedLocationRef` — always read from `useVotesStore()` instead
  4. Add explicit dependency comments for each useEffect describing why each dependency is needed
- Test coverage gaps: No unit tests for MapView; geolocation behavior tested only via e2e (browser geolocation mocked)

### Zustand Store Filter Logic Coupling

**Files:** `src/lib/votes.ts` (useVotesStore), `src/components/LocationsList.tsx` (ScoreFilterPanel uses store)
- Why fragile:
  - Filter state spread across ScoreFilters object with 6 categories (lines 18-25), plus 4 boolean admin toggles (lines 46-51)
  - `toggleScoreFilter()` (lines 54) mutates Set directly; no validation
  - `clearScoreFilters()` (line 55) doesn't reset admin toggles; behavior inconsistent
  - `activeFilterCount()` counts only color filters, not admin toggles — misleading UI
- Safe modification:
  1. Create interface `FilterState` with explicit fields for each filter type
  2. Add validation in `toggleScoreFilter()`: reject invalid category/value combinations
  3. Distinguish between "color filters" and "admin override filters" in UI state
  4. Make `clearScoreFilters()` user-facing (only clears color), separate from internal reset
- Test coverage gaps: No unit tests for filter state transitions; tests only verify end result via e2e

---

## Scaling Limits

### Current Data Capacity

**Locations table:** 1,026 scored + 1,166 unscored = 2,192 total
- Limit hit at: ~10,000 rows (browser GeoJSON rendering bottleneck)
- Current bottleneck: `locationGeojson` array in MapView (lines 90-105)
- Action threshold: When locations > 5,000, implement spatial indexing (H3 or quadtree)

**City summaries:** ~55 metros across 3 states (TX, FL, CA)
- Limit hit at: ~1,000 city/metro combinations (pagination required)
- Current bottleneck: Single query fetch in `getCitySummaries()` (no pagination)
- Action threshold: When expanding to 10+ states, add pagination + caching

**Vote persistence:** All votes stored in Supabase via pp_votes table
- No scaling issue with Supabase, but query performance degrades with vote count > 100K
- Current state: ~2,000 total votes (50 locations × ~40 votes avg) — safe
- Action threshold: When votes > 50K, add indexing on (user_id, location_id) and partition by date

### Deployment Scaling

**Vercel:** Free tier concurrent function execution capped at 10
- Current impact: None (low traffic)
- Risk: If voting surge occurs during campaign, serverless function cold-starts may cause timeout
- Mitigation: Switch to paid Vercel tier (Pro or Enterprise) before high-traffic period

**Supabase:** Free tier has RLS policy execution overhead
- Current impact: Minimal (1,026 locations, 2,000 votes)
- Risk: At 10K+ locations or 100K+ votes, RLS evaluation time exceeds acceptable latency
- Scaling path: Profile RLS policies; consider denormalizing vote counts if SELECT latency > 500ms

---

## Dependencies at Risk

### Mapbox GL Dependency

**Risk:** Mapbox GL JS (react-map-gl) import not dynamic; blocks SSR
- Files: `src/components/MapView.tsx` (imported in getServerSideProps context if not careful)
- Current mitigation: `src/app/page.tsx` uses client component; MapView wrapped with dynamic import assumption
- Actual state: MapView IS a client component (`"use client"` on line 1), so no SSR issue currently
- Risk: Future refactoring to use server rendering could accidentally render MapView; would fail
- Recommendation: Keep MapView as client-only component; document in `CLAUDE.md` that this component cannot be server-rendered

### Supabase SDK Major Version

**Risk:** `@supabase/supabase-js` in package.json (version >= 2.0) has breaking changes in auth flow
- Files: `src/lib/supabase.ts`, `src/lib/supabase-admin.ts`
- Current protection: Lockfile pinned to specific version
- Risk: `npm install` in CI could bump to incompatible minor version
- Recommendation: Pin major + minor version in package.json (e.g., `"@supabase/supabase-js": "^2.43.0"` instead of `^2`)

### Radix UI Dialog Dependency (Event Handling Bug)

**Risk:** Radix Dialog's pointer event interception can block other interactions
- Files: Uses radix-ui/react-dialog (from shadcn Dialog component)
- Known issue: Dialog overlay intercepts all pointer events when `data-state="open"` — blocks map interactions
- Current workaround: Tests use `dismiss_dialogs()` helper to press Escape before other clicks
- Recommendation: Document in test suite that all dialogs must be dismissed before proceeding; consider adding auto-dismiss timeout for stale dialogs

---

## Missing Critical Features

### Audit Logging for Admin Actions

**Problem:** No audit trail for admin approvals, rejections, notifications
- Blocks: Enterprise compliance; cannot investigate "who changed what when"
- Files: Admin API routes lack logging
- Impact: Security gap; no way to rollback unauthorized admin actions
- Requisite: Add `pp_audit_log` table with columns: timestamp, admin_email, action, location_id, result, error_message
- Estimated effort: 4 hours (1h schema, 1.5h middleware logging, 1.5h audit dashboard)

### Rate Limiting on Public API

**Problem:** `/api/locations`, `/api/suggest` endpoints have no rate limiting
- Blocks: Production deployment (API abuse vector)
- Files: `src/app/api/admin/locations/route.ts` and related endpoints
- Impact: Someone could spam 1000 location suggestions in 1 minute
- Requisite: Implement rate limiting middleware (e.g., Upstash Redis) — 10 requests/min per IP, 100 requests/hour per user
- Estimated effort: 2-3 hours (1h middleware setup, 1-2h integration into routes)

### CAPTCHA for Location Suggestions

**Problem:** User suggestions have no bot protection
- Blocks: Production deployment (spam vector)
- Files: `src/components/SuggestLocationModal.tsx` (form submission)
- Impact: Without CAPTCHA, bot could create 10K fake locations/hour
- Requisite: Integrate hCaptcha or similar; verify on client and server
- Estimated effort: 3-4 hours (1h client integration, 1h server validation, 1-2h testing)

### Email Notifications Sent to Voters

**Problem:** Functionality exists (`/api/admin/locations/[id]/notify-voters`) but never tested end-to-end
- Blocks: Cannot verify email delivery works or content format is correct
- Files: `src/lib/email.ts` (sendEmail function), admin notify route
- Impact: If admins use notify feature, voters might not receive emails; no way to know
- Requisite: Add e2e test that submits suggestion, approves it, sends notification, verifies email was sent
- Estimated effort: 2 hours (1h test setup, 1h email backend mock/verification)

---

## Test Coverage Gaps

### Filter Logic Unit Tests

**What's not tested:** Filter state transitions and combinations in isolation
- Files: `src/lib/votes.ts` (useVotesStore filteredLocations function, lines 321-407)
- Risk: Filter bugs (e.g., AND/OR mixing, red toggle logic) found only via e2e tests
- Priority: HIGH — filter logic is central to MVP
- Approach: Create `src/lib/__tests__/votes.test.ts` with:
  - Test for each filter category (price, zoning, etc.)
  - Test combinations: color filter + size filter, admin + non-admin, released + unreleased
  - Test default state recognition (isDefaultSize heuristic)

### MapView Coordinate Sync Tests

**What's not tested:** Geolocation → initial map view → zoom state sync
- Files: `src/components/MapView.tsx` (useEffect chain lines 113-150)
- Risk: Race conditions or missed dependencies could cause map to not center on user or miss location data
- Priority: MEDIUM — affects UX but not voting functionality
- Approach: Create `src/components/__tests__/MapView.test.tsx`:
  - Mock geolocation, test that mapRef.current.flyTo is called with correct coords
  - Test that initialViewSet ref prevents duplicate flights
  - Test that zoom level triggers city vs. location layers

### Admin Authentication Tests

**What's not tested:** Admin token validation, email whitelist enforcement
- Files: `src/lib/admin.ts` (verifyAdmin function)
- Risk: Unauthorized user could be granted admin access if token validation is bypassed
- Priority: CRITICAL — security-critical code
- Approach: Create `src/lib/__tests__/admin.test.ts`:
  - Test valid token with whitelisted email → isAdmin = true
  - Test valid token with non-whitelisted email → isAdmin = false
  - Test missing Bearer prefix → isAdmin = false
  - Test expired/invalid token → isAdmin = false
  - Test ADMIN_EMAILS parsing (case-insensitive, trim, split)

### Location Suggestion Validation Tests

**What's not tested:** suggestLocation() input validation and sanitization
- Files: `src/lib/locations.ts` (suggestLocation function, lines 419-461)
- Risk: Malicious or oversized inputs bypass client validation and corrupt database
- Priority: MEDIUM — data quality issue, not immediate security, but blocks production
- Approach: Create `src/lib/__tests__/locations.test.ts`:
  - Test max-length constraints (address > 200 chars rejected)
  - Test invalid coordinates (lat > 90 rejected)
  - Test XSS payload in notes (HTML tags stripped or rejected)
  - Test empty/null values (required fields enforced)

### End-to-End Test Coverage

**Current state:** 45 implemented tests, 69 skipped (many skipped due to auth requirements)
- Files: `tests/requirements.test.py` (Playwright suite)
- Gaps:
  - Admin workflows (approve, reject, notify) have 0 e2e tests

  - Email notifications never verified
  - Filter combinations tested minimally (only basic toggles)
- Priority: MEDIUM — MVP works, but edge cases uncovered
- Approach: Remove skips for admin tests by mocking Supabase auth; add tests for notify workflow

---

*Concerns audit: 2026-02-09*
