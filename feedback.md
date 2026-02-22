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
