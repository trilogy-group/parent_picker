# Alternative Left Panel UI Design

**Date:** 2026-02-24
**Branch:** `alt-ui`

## Summary

Replace the parent-facing left panel with a new design focused on community engagement: "I'm in" / "Not here" voting, voter avatars, invite-a-family, and a launch threshold of 30 families per location. Admin UI stays unchanged.

## DB Changes

### pp_votes — add `vote_type` column
- `'in'` (default) — replaces current heart vote
- `'not_here'` — negative signal
- Migrate existing rows to `vote_type = 'in'`
- Unique constraint: one vote per user per location (upsert on re-vote)

### pp_invites — new table
- `id` (uuid), `inviter_id` (uuid, FK auth.users), `invitee_email` (text), `created_at` (timestamptz)
- Used to track invite-a-family emails

### pp_profiles — use existing auth user_metadata for initials
- Pull display name from Supabase auth `raw_user_meta_data` or email prefix as fallback

## New Components

### AltPanel.tsx — full left panel
- Metro header at top when zoomed into a metro (e.g., "ALPHA SCHOOL · ORANGE COUNTY")
- Hero: "Choose where your kid goes to school." + "Say 'I'm in.' Share what you know. Enough families, and it happens."
- "What Alpha Feels Like" dark card — static stats (2 hrs, 2x, 100%)
- "Invite a family" button → InviteModal
- Sort toggle pills: "Most support" (default) | "Most viable"
- Scrollable list of AltLocationCard components

### AltLocationCard.tsx — location card
- Location name + distance from map center
- Status badge: "Ready to go" (GREEN), "Needs work" (YELLOW/AMBER), "Challenging" (RED)
- AvatarRow: up to 4 voter initials + overflow
- Stats: "20 in · 1 concern · 10 more to launch"
- Vote UI:
  - Not voted: "I'm in" (filled dark button) + "Not here" (outline)
  - Voted in: "You're in" checkmark
  - Auth required if not signed in

### InviteModal.tsx — email capture
- Single email input + send button
- POST /api/invite → Resend email: "{Name} invited you to help choose a school location"
- Inserts pp_invites row

### AvatarRow.tsx — voter initials circles
- Shows up to 4 circular avatars with initials
- "+N" overflow indicator

## Sort Logic

- **Most support**: `in` votes DESC, then score color as tiebreaker
- **Most viable**: score color (GREEN > YELLOW > AMBER > RED > unscored), then `in` votes

## Launch Threshold

`Math.max(0, 30 - inVoteCount)` — "10 more to launch"

## API Changes

- `POST /api/invite` — new route, sends welcome email, inserts pp_invites
- Existing vote API updated to accept `vote_type` param
- Vote queries updated to return `in` and `not_here` counts separately

## Scope Boundaries

- Admin UI unchanged (old LocationsList/LocationCard)
- Map component unchanged
- Panel swap: admins see existing UI, parents see AltPanel
- No "Closest to you" sort (requires user geolocation — later)
- No "unanswered questions" feature (deferred)
