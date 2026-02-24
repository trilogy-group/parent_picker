# Location Detail View — Design Draft (PAUSED)

**Status:** Paused — user wants to revisit list view first

## Summary

When a user clicks a location card in AltPanel, the left panel transitions from list view to a detail view for that location.

## Component: LocationDetailView.tsx

Replaces AltPanel content when `selectedLocationId` is set. Sections top-to-bottom:

1. **Back arrow** — returns to list view (clears selected location)
2. **Street View image** — Google Street View Static API using lat/lng + NEXT_PUBLIC_GOOGLE_MAPS_KEY
3. **Location name** (large) + status badge + size label
4. **Zoning description** — derived from score
5. **Vote section** — two states:
   - **Not voted**: "Picture your kid here." card with stats + "I'm in" / "Not here" buttons
   - **Voted**: Dark "You're in" progress bar showing "20 of 30" + launch description
6. **"Help us fill in the gaps"** — single comment textarea + submit → pp_contributions table
7. **Who's in / Concerns tabs** — tabbed voter list with avatar, name, timestamp, vote comment

## DB Changes

- `pp_contributions` (new): id, location_id, user_id, comment, created_at
- Update `get_location_voters` RPC to return comment + created_at from pp_votes

## Wiring

AltPanel checks selectedLocationId — if set, renders LocationDetailView instead of list. Back button calls setSelectedLocation(null).

## Status Badge Mapping

| Score | Badge | Color | Description |
|-------|-------|-------|-------------|
| GREEN | Promising | green | "No city approval needed — Alpha can move in as soon as families are in." |
| YELLOW | Viable | amber | "This location needs some work, but it's a real contender." |
| AMBER | Viable | amber | same |
| RED | Major Issues | red | "This location has significant hurdles — but parent support can change things." |
