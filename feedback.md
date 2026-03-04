# Feedback Log

This file tracks user feedback, root cause analysis, and resulting changes to requirements and tests to prevent recurring issues.

## Format

For each feedback item:
- **Date**: When the feedback was received
- **Feedback**: What the user reported
- **Root Cause**: Why the issue occurred
- **Action Taken**: Changes made to requirements.md and tests
- **Status**: Resolved / In Progress / Blocked

---

## Feedback Items

### FB-1: Mobile — Initial US zoom not wide enough (2026-02-21)

- **Feedback**: On mobile, when user's location has no nearby cities, the US-wide zoom isn't zoomed out enough to see all city bubbles.
- **Root Cause**: `US_ZOOM = 4` was designed for desktop viewport width. Mobile's narrow viewport (~375px) shows much less map area at the same zoom level.
- **Action Taken**: Reduced initial zoom by 0.5 on mobile (`window.innerWidth < 1024`) in both `initialViewState` and `getInitialMapView` flyTo. Desktop unchanged.
- **Status**: Resolved

### FB-2: Mobile — "How you can help" bullets missing (2026-02-21)

- **Feedback**: The blue explanation bullets (suggest, vote, connect) from the desktop panel are nowhere on mobile.
- **Root Cause**: Mobile collapsed view only had title/votes/auth/buttons — the 3 bullet points explaining how parents can help were never added.
- **Action Taken**: Added the 3 bullet points to the mobile collapsed view (styled for white background: `text-gray-500` with amber bullets).
- **Status**: Resolved

### FB-3: City cards appear/disappear after admin toggle (2026-03-04)

- **Feedback**: On initial load, only 2 metro cards show (Orange County, Greenwich). After toggling admin mode and back to parent, extra small cities appear (Los Angeles 3, Riverside 1).
- **Root Cause**: Likely a timing issue. `loadCitySummaries` fires on initial load before `isAdmin` resolves from auth, fetching with non-admin filters. Admin toggle triggers a refetch that picks up additional cities. When toggling back, the refetched data includes cities that weren't in the original load. Small cities (LA, Riverside) may have locations that don't consolidate into existing metros.
- **Action Taken**: Noted for fix. Need to ensure initial city summaries fetch waits for auth state to settle, or re-consolidate after admin state changes.
- **Status**: Open
