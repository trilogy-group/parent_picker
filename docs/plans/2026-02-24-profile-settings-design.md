# Profile Settings Popover — Design

## Summary
Simple profile popover behind a gear icon in the AltPanel header. Parents can set their name and home address. Saved address geocoded to lat/lng and used for distance calculations instead of browser geolocation.

## UI
- Gear icon replaces "email + Sign Out" in AltPanel header (logged-in state)
- Click opens popover with:
  - Display name (text input)
  - Home address (text input with Google Places Autocomplete)
  - Save button
  - Logout link at bottom
- Logged-out state: unchanged (sign-in flow as today)

## DB Changes
Add 4 columns to `pp_profiles`:
- `display_name text`
- `home_address text`
- `home_lat double precision`
- `home_lng double precision`

RLS: users can read/update their own row.

## API
- `GET /api/profile` — fetch current user's profile (name, address, lat/lng)
- `PUT /api/profile` — update name + address, geocode address server-side, save lat/lng

Server-side geocoding keeps the Google API key off the client.

## Client Behavior
- On auth load: fetch profile; if home_lat/home_lng exist, call `setUserLocation()` in votes store (overrides browser geolocation)
- No saved address: fall back to browser geolocation as today
- Google Places Autocomplete on address input for easy entry

## Components
- `ProfilePopover` — gear icon + popover with form fields
- Replaces `AuthButton` in AltPanel header when logged in
