# Simplify: Codebase Cleanup Backlog

Generated 2026-03-04. Fix when convenient — not blocking any feature work.

## Priority (do first)

### 1. N+1 in admin likes route
`src/app/api/admin/likes/route.ts:86-104`

Per-location score query + per-voter `getUserById` inside `Promise.all`. 50 locations × 20 voters = 1,050 auth API calls on a single page load. Fix: collect all unique user IDs and location IDs upfront, batch query `pp_profiles` + `pp_location_scores` with `.in()`, join in memory.

### 2. Delete 3 dead files
- `src/components/AdminHelpRequestCard.tsx` — never imported
- `src/components/SuggestLocationModal.tsx` — unused, suggest flow is `/suggest` page
- `src/app/api/admin/help-requests/route.ts` — Help Requests tab removed in WS12

### 3. `filteredLocations` memoization
- `AltPanel.tsx:111,134` — called twice in separate useMemos (double filter pass)
- `MapView.tsx:96` — called bare in render body, not memoized

It's a getter function, not a Zustand selector — bypasses reactivity. Consolidate into a single `useMemo` per component.

### 4. Bearer token extraction helper
4 non-admin API routes duplicate `authHeader?.startsWith("Bearer ")` / `.slice(7)` with inconsistent logic (`slice(7)` vs `replace`):
- `src/app/api/contributions/route.ts:22-26` (and again at 107-111)
- `src/app/api/help-request/route.ts:46-48`
- `src/app/api/invite/route.ts:10-14`
- `src/app/api/profile/route.ts:6-9`

Extract `extractBearerToken(request)` into `src/lib/auth.ts`.

### 5. Shared constants for subscore keys + LAUNCH_THRESHOLD
- `LAUNCH_THRESHOLD = 30` defined in both `LocationDetailView.tsx:13` and `AltLocationCard.tsx:16`
- Subscore keys/labels hardcoded in 5+ files (sort bitmask, popover options, RED breakdown, score mapping, mock data)
- `SubPriority` type defined in `sort.ts` but duplicated inline in `votes.ts` (lines 59, 94)

Create `src/lib/constants.ts` with shared exports. Export `SubPriority` from `sort.ts`.

---

## Code Reuse

### 6. Size tier label maps diverge
`src/lib/status.ts:8` uses lowercase keys (`micro`, `growth`); `src/components/ScoreBadge.tsx:106` uses title case (`Micro`, `Growth`) with different display text. Consolidate in `status.ts`.

### 7. ADMIN_EMAILS parsed 3x
`AuthProvider.tsx:24`, `admin/page.tsx:11`, `contributions/route.ts:129` — identical `.split(",").map(e => e.trim().toLowerCase())`. Export from a shared location.

### 8. Metro display name map inline in component
`AltPanel.tsx:100-106` — hardcoded city-to-metro mapping. Move to `src/lib/metros.ts`.

### 9. Score color hex map inline in Mapbox expression
`MapView.tsx:514-517` — GREEN/YELLOW/AMBER/RED hex values inline. Export `COLOR_HEX` from `status.ts`.

### 10. Score row mapping duplicated in admin routes
`admin/likes/route.ts:5-16`, `admin/locations/route.ts:9-14` — both define local `mapScores()`. Export `mapRowToScores` from `locations.ts` and reuse (HomeContent.tsx deep-link handler can also use it).

---

## Code Quality

### 11. Dead store state
`referencePoint` and `mapCenter` in `votes.ts:44,80` — written by MapView but never read back by any component. Write-only dead state.

### 12. `fetchNearby` vs `fetchNearbyForce` near-duplicate
`votes.ts:243-275` — 18 lines duplicated, only difference is bounds-containment check. Merge into `fetchNearby(bounds, { force?: boolean })`.

### 13. `effectiveAdmin`/`releasedOnly` computed 3x
`votes.ts:228,253,266` — identical 2-line computation in `loadCitySummaries`, `fetchNearby`, `fetchNearbyForce`. Extract helper.

### 14. Snake_case DB names leak into UI types
`AdminLocation`, `LikedLocation`, `AdminAction` in `types/index.ts` use snake_case fields (`suggested_by`, `vote_count`, `help_sent_at`, etc.) that propagate into `AdminLocationCard.tsx`. Admin-only concern but worth camelCasing for consistency.

### 15. Swallowed errors
`LocationDetailView.tsx:84,102` — `.catch(() => {})` on contributions and photos fetches. Silent failure with no user feedback.

### 16. `(row: any)` in admin history
`src/app/api/admin/history/route.ts:39` — untyped `.map()` callback. Should use a local interface.

### 17. `setDeepLinkTab` unused in AltPanel selector
`AltPanel.tsx:31,61` — imported into store selector but only called from HomeContent. Remove from AltPanel's selector.

---

## Efficiency

### 18. Render-phase setState for pagination reset
`AltPanel.tsx:176-181` — synchronous `setState` in render body causes extra re-render. Use `useEffect` or derive state.

### 19. `locationVoters` Map grows unbounded
`votes.ts:558-573` — accumulates voter data for every location ever viewed. No eviction. Add LRU cap or clear on location refetch.

### 20. Haversine called per card per render
`AltPanel.tsx:294,519` — `getDistanceMiles` called inline in JSX for each visible card. Precompute in the `sortedLocations` useMemo since `userLocation` rarely changes.

### 21. `METRO_DISPLAY` object recreated every render
`AltPanel.tsx:99-107` — constant object declared inside component body. Move to module level.

### 22. `visibleIdKey` string join on every render
`AltPanel.tsx:188` — creates array + ~900-char string unconditionally for effect dependency. Minor allocation.

### 23. `Map.tsx` thin wrapper
`src/components/Map.tsx` — 19-line file that only does `dynamic()` import of MapView. Could inline the dynamic import in `HomeContent.tsx`.

### 24. Admin page client-side auth check
`admin/page.tsx:196` — checks admin status in `useEffect` (flash of content possible). API routes properly use `verifyAdmin()` server-side.
