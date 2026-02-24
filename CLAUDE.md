# CLAUDE.md


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT:** This file is maintained by the user and should remain clean and focused. Always ask permission before making changes to CLAUDE.md, most of which will be denied.

## Project Overview

An interactive, consumer-facing website where parents can vote on and express preferences for potential Alpha micro school locations. The application helps gather community input.  A different AI agent (out of scope) will make site selection decisions and negotiate/finalize leases while keeping the interested parents informed in a positive manner.

## Key Context

**Read `docs/brainlift-location-selection.md` — it is critical context** for understanding Alpha's location strategy, scoring criteria (Enrollment Score, Wealth Score), zoning rules, size tiers, and parent override logic.

- Reference implementation: https://sportsacademy.school/map/facilities (used by 30k parents for facility voting)
- No humans on central team in the processing loop — design accordingly.

## Data Boundary

- This app ONLY interacts with `pp_*` tables. Never query or reference non-pp tables (e.g., `real_estate_listings`).
- **REBL (v3 lite)** populates core data into `pp_locations` and `pp_location_scores`. This app treats that data as read-only.
- This app may write: `pp_votes`, `pp_help_requests`, and INSERT parent suggestions into `pp_locations` (with `status: pending_review`). It may also update `pp_locations.status` (approve/reject).

## Test-Driven Development

- This project uses TDD. All requirements are documented in `requirements.md` with corresponding test cases.
- **Update `requirements.md` BEFORE implementing new features.** Add requirement sections and test cases first, then write the code and tests.
- Create a feedback.md to keep my feedback.  Understand the root cause for the feedback, and update requirements.md and correspending tests to keep issues like that from re-appearing.
- Before adding a requirement, ask yourself "will this require a human (other than parent) in the processing loop".  Redesign until the answer is "no."


## MVP Scope

Duplicate the Sports Academy facilities map functionality:
- Parents can view locations on a map by city
- Vote on existing locations from a location database (Supabase - stub for now)
- Suggest new locations

## Version 2.0 (Future - Do Not Build Yet)

- Pre-scored locations database (in Supabase)
  - Location information, specs, and simpler consumer-level scoring
- Low-scoring locations to prompt parent assistance (zoning help, contacts)
  - "I know you all voted for this property, but we can't get it zoned, do you anyone who can get it zoned. city hall? lawyer who has gotten approvals in the past?"
- Parent-suggested locations trigger scoring workflow (separate agent)
- Lease outreach, negotiation, and execution (separate agent)

**API Keys:**  API keys stored in .local.env

**Key Invariant:** Ship MVP before adding any v2 complexity.

## Deployment

**Vercel auto-deploy is broken** — Git integration has had issues connecting. Always deploy manually:
1. Build and test locally first (`npm run dev`)
2. When ready, deploy with `vercel --prod`


**Key files:**
- `requirements.md` - Complete requirements specification (184 test cases)
- `tests/requirements.test.py` - Automated Playwright test suite (45 implemented tests)
- `feedback.md` - User feedback log with root cause analysis and corrective actions
- `architecture.md` - Technical architecture, commands, tech stack, and file structure
- `docs/brainlift-location-selection.md` - Location selection brainlift (scoring, zoning, parent override)

## Session State (2026-02-22)

**Current branch:** `main`
**Deployed:** https://parentpicker.vercel.app
**Last deploy:** 2026-02-22 — Admin history tab + help email improvements

### Workstreams 1-11: DONE (merged to main)

### Workstream 12: Admin History Tab + Email Improvements — DONE

**What was built:**

**6 email templates** (see `src/lib/email.ts` + `src/components/AdminLocationCard.tsx`):
1. Scored Notification (auto — REBL webhook) — "Your location has been evaluated"
2. Approval (manual — admin approves suggestion) — "Your location is live!"
3. Rejection (manual — admin rejects suggestion) — "Thank you for your suggestion"
4. Voter Help Request (manual — admin asks voters for help) — "We need your help" + See How You Can Help button
5. Location-specific Help (immediate — parent clicks "I can help" on a card) — same layout as #4, links to `detailsUrl?tab=help`
6. Generic Help (immediate — parent clicks "I want to help" from panel, no location) — "Thank you for volunteering" + Browse Locations

**Email trigger logic:**
- #1 auto-sends when REBL scores a parent suggestion (webhook)
- #2/#3 manual from admin Suggestions tab
- #4 manual from admin Likes tab
- #5/#6 immediate when parent submits help form — logged to history automatically

**Admin History tab** (`pp_admin_actions` table):
- Lean append-only table: id, location_id, action, admin_email, recipient_emails, created_at
- No mutable data snapshots — JOINs to `pp_locations` and `pp_location_scores` for live data
- Action badges: green Approved, red Rejected, blue Help Sent, purple Parent Help
- Help Requests tab removed — parent help flows straight to History
- History cache invalidates when admin takes actions (approve/reject/send help)

**Likes tab improvements:**
- Shows actual voter emails (not just count)
- Filters out locations where all voters already emailed — only shows cards with new voters
- "Send to N New Voters" button when some already emailed
- Cards vanish immediately on successful send

**Email error handling:**
- `sendEmail()` returns `{ success, error }` instead of swallowing errors
- If email fails: card stays visible with red error banner, no history entry, retry available
- If email succeeds: card removed, history entry recorded

**Data cleanup:**
- Bulk-fixed `name` field: set `name = address` for ~18,754 mismatched records (name had raw upstream listing address with zip)

**DB changes:**
- Created `pp_admin_actions` table

**Key files modified:**
- `src/lib/email.ts` — `generateLocationHelpHtml()`, `generateGenericHelpHtml()`, `sendEmail()` returns `SendResult`
- `src/components/HelpModal.tsx` — added `locationId` prop
- `src/components/LocationCard.tsx` — passes `location.id` to HelpModal
- `src/components/MapView.tsx` — passes `selectedLocation.id` to HelpModal
- `src/components/AdminLocationCard.tsx` — email error handling, voter email display, new voter tracking
- `src/app/admin/page.tsx` — 3 tabs (Suggestions/Likes/History), history lazy fetch + invalidation
- `src/app/api/help-request/route.ts` — location-specific vs generic email, logs to history
- `src/app/api/admin/locations/[id]/approve/route.ts` — records admin action, email error surfacing
- `src/app/api/admin/locations/[id]/reject/route.ts` — records admin action, email error surfacing
- `src/app/api/admin/locations/[id]/notify-voters/route.ts` — records admin action, per-email error tracking
- `src/app/api/admin/history/route.ts` — NEW: GET history with nested JOIN through pp_locations
- `src/app/api/admin/likes/route.ts` — tracks already-sent emails, filters fully-emailed locations
- `src/types/index.ts` — `AdminAction` interface, `LikedLocation` help_sent fields

### Workstream 13: New UI (Location Detail View + Panel Redesign) — DONE

**What was built:**

**New UI toggle** — "Try new UI" / "Back to current" button visible to all users (desktop + mobile). Stores `showAltUI` in Zustand so MapView can conditionally show popup (old UI) or let AltPanel handle detail (new UI).

**LocationDetailView** (`src/components/LocationDetailView.tsx`) — shared detail component used by AltPanel (desktop) and `/location/[id]` (mobile):
- Street View hero image, location name, status badge, size tier, details link
- Vote section with 3 states: not voted (VOTE eyebrow + I'm in / Not here buttons), voted in (YOU'RE IN + progress bar + undo), concern noted (CONCERN NOTED + undo)
- "Not here" opens NotHereReasonModal for reason/comment before submitting
- CONTRIBUTE section: "Help us fill in the gaps" textarea, writes to `pp_votes.comment` (appends, no separate pp_contributions table)
- GET INVOLVED section (voted-in only): triggers HelpModal with location-specific guide
- Who's in / Concerns tabs with avatar + name + comment display

**AltPanel redesign** (`src/components/AltPanel.tsx`):
- Header: ALPHA SCHOOL eyebrow + metro name, AuthButton inline, "Choose where your kid goes to school"
- 3 action boxes at top (unified blue-50 card style with eyebrow labels): What Alpha Feels Like, Invite, Suggest
- Sort pills (Most support / Most viable) + location cards below
- City cards when zoomed out (< zoom 9), location cards when zoomed in
- Clicking card opens detail view in panel (desktop) or navigates to `/location/[id]` (mobile)

**Unified box styling** — all cards use consistent pattern:
- `bg-blue-50 rounded-xl p-5`
- Eyebrow: `text-[10px] font-semibold tracking-widest text-blue-600` ALL CAPS
- Body: `text-[15px] leading-snug text-gray-900`
- Action links: `text-sm font-semibold text-blue-600` with arrow (→)

**Vote comment flow:**
- "Fill in the gaps" contributions write directly to `pp_votes.comment` (appended with newline)
- `pp_contributions` table no longer used by the API
- `get_location_voters` RPC updated: `LEFT JOIN pp_profiles` + `LEFT JOIN auth.users` for resilience (handles users without pp_profiles row)
- `loadLocationVoters(ids, force?)` — force param bypasses deduplication cache for post-vote refresh

**AltLocationCard** (`src/components/AltLocationCard.tsx`):
- Vote buttons with undo support, NotHereReasonModal for concerns
- Avatar row + vote/concern counts (hidden when all zero)
- Sign-in prompt dialog for unauthenticated users

**Other changes:**
- `src/lib/status.ts` — shared `statusBadge()` (GREEN→Promising, YELLOW/AMBER→Viable, RED→Concerning) and `sizeTierLabel()` (Micro→"Micro (25 students)", etc.)
- `src/lib/votes.ts` — `showAltUI` store field, `voteNotHere` accepts comment, `removeVote` action, force-refresh voters after vote operations
- `src/components/MapView.tsx` — popup restored conditionally (only when `!showAltUI`), dot click sets `selectedLocationId` for AltPanel detail
- `src/components/AvatarRow.tsx` — avatar colors updated to blue/emerald/purple/orange (no dark gray)
- `src/components/InviteModal.tsx` — redesigned as blue-50 card with eyebrow label
- `src/components/HelpModal.tsx` — "card" variant trigger updated to arrow link style

**DB changes:**
- `get_location_voters` RPC: `LEFT JOIN` instead of `INNER JOIN`, `COALESCE` fallback chain for email
- Backfilled `pp_profiles` for users missing profile rows

### Pending / Next steps
- **REBL scoring bug**: `overall_color` wrong for ~74% of scored rows — needs fix in REBL
- REBL needs to score ~1,166 unscored locations and fill sub-score gaps (Price: 140 missing)
- **Resend domain switch** — add `alpha.school` domain in Resend dashboard, add DNS records (MX/SPF/DKIM), then update `FROM_EMAIL` in `src/lib/email.ts` to `real_estate@alpha.school` and remove `replyTo`
- Vercel env vars already set: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ADMIN_EMAILS`, `NEXT_PUBLIC_ADMIN_EMAILS`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY`

## File Structure

# CLAUDE MUST REQUEST APPROVAL BEFORE WRITING INTO THIS FILE
