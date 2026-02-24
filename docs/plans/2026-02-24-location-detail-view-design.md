# Location Detail View + AltPanel Fixes — Design

**Status:** Approved
**Date:** 2026-02-24

## Overview

Three workstreams: (A) location detail view, (B) "Not here" reason prompt, (C) AltPanel header/zoom fixes.

## A. Location Detail View

### Navigation Model

- **Desktop:** Clicking a card replaces the left panel content with the detail view. Back arrow returns to list.
- **Mobile:** Clicking a card navigates to `/location/[id]` as a standalone page. Back button returns to map.
- Both share the same `LocationDetailView` component.

### Sections (top to bottom)

1. **Back arrow** — returns to list (desktop: clears selectedLocationId, mobile: router.back)
2. **Street View hero image** — Google Street View Static API using lat/lng + NEXT_PUBLIC_GOOGLE_MAPS_KEY, full-width
3. **Location name** (large) + status badge + size tier label
4. **Vote section** — two states:
   - **Not voted:** "Picture your kid here." + stats + "I'm in" / "Not here" buttons
   - **Voted:** "You're in" progress bar showing "20 of 30" + launch description
5. **"Help us fill in the gaps"** — single comment textarea + submit → `pp_contributions` table
6. **Who's in / Concerns tabs** — tabbed voter list with avatar, name, timestamp, vote comment

### Status Badge Mapping

| Score  | Badge      | Color |
|--------|------------|-------|
| GREEN  | Promising  | green |
| YELLOW | Viable     | amber |
| AMBER  | Viable     | amber |
| RED    | Concerning | red   |

### Size Tier Labels

Display tier name + student count, no square footage. Examples: "Micro (25 students)", "Small (50 students)", "Medium (100 students)".

### Styling

Use the existing light color palette throughout (white backgrounds, gray text, blue accents). No dark theme.

### DB Changes

- `pp_contributions` (new): id, location_id, user_id, comment, created_at
- Update `get_location_voters` RPC to return comment + created_at from `pp_votes`

## B. "Not Here" Reason Prompt

When a parent clicks "Not here" (on main page cards OR detail view), show a prompt/modal asking for their concern before the vote submits. The reason is stored as a comment on the `pp_votes` record (existing `comment` column or new `reason` column).

This surfaces in the "Concerns" tab of the detail view's Who's in / Concerns section.

## C. AltPanel Header + Zoom Fixes

### Top Row

Move AuthButton inline with the "ALPHA SCHOOL · CITY" badge — same row, auth button on the right.

### Heading

"Choose where your kid goes to school." must not wrap. Adjust text size or container to keep it single-line.

### Zoomed Out State

When zoomed out (no single metro detected):
- Header shows "ALPHA SCHOOL" (no city name)
- City cards still display so parents can pick a city
- Currently the header hides when no metro — change to always show

## Wiring

### Desktop

AltPanel checks `selectedLocationId`. If set and a location is selected, render `LocationDetailView` instead of the list. Back button calls `setSelectedLocation(null)`.

### Mobile

Card click navigates to `/location/[id]`. That route renders `LocationDetailView` as a full page. Fetches location data by ID on mount.

### Shared Component

`LocationDetailView` accepts a `location` prop + callbacks. Platform-specific wiring (panel vs page) handled by the parent.
