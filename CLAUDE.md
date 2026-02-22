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

## Session State (2026-02-06)

**Current branch:** `main`
**Deployed:** https://parentpicker.vercel.app
**Last deploy:** 2026-02-21 — parent UX polish + Street View popup

### Workstreams 1-10: DONE (merged to main)

### Workstream 11: Parent UX Polish — DONE

**What was built:**
- Red toggle removed — non-admin always sees all scored locations (including RED), no toggle needed
- SimpleRedToggle component removed entirely from LocationsList
- Rank numbers (#1, #2, etc.) shown before street address on left-panel cards
- Size labels with student counts: Micro (25), Micro2 (50-100), Growth (250), Flagship (1000)
- "Full Size" renamed to "Flagship" in size filter buttons
- "Detailed Info" blue hyperlink replaces (i) icon — opens score details in new tab
- Card V1/V2 system: parents always get V1, admins can toggle (button in admin panel)
  - V1 cards: 2-row layout (rank+address+vote, size|help|details) — no score icons
  - V2 cards: 3-row layout with sub-score icons, legend (? icon), and details
- HelpModal `card-compact` variant: text-only "I can help" (10px, no icon, no padding)
- Map popup V1 redesign (Zillow-style):
  - Google Street View image at top (640x320, from lat/lng via Static API)
  - Vote button overlaid top-right on image
  - Address + city/state below image
  - Bottom row: Size label | "I can help" | "Detailed Info"
  - Score-colored border (3px), min-w-[280px] max-w-[320px]
- Map popup V2: full scores layout with sub-score icons (admin only)

**Env var added:**
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY` — Google Street View Static API key (added to .env.local + Vercel)

**Key files modified:**
- `src/components/MapView.tsx` — V1/V2 popup, Street View image, VoteButton overlay
- `src/components/LocationCard.tsx` — CardContentV1/V2, rank prop, SizeLabel in V1
- `src/components/ScoreBadge.tsx` — SizeLabel with students, DetailedInfoLink, ScoreDetails
- `src/components/LocationsList.tsx` — removed SimpleRedToggle, rank, card version toggle
- `src/components/HelpModal.tsx` — card-compact variant
- `src/lib/votes.ts` — cardVersion state, removed red toggle for non-admin
- `src/app/page.tsx` — removed showRedLocations dependency

### Pending / Next steps
- **REBL scoring bug**: `overall_color` wrong for ~74% of scored rows — needs fix in REBL, then REBL re-writes to `pp_location_scores`
- REBL needs to score ~1,166 unscored locations and fill sub-score gaps (Price: 140 missing)
- DB trigger for parent suggestion → REBL scoring → email notification (not yet built)
- Vercel env vars already set: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ADMIN_EMAILS`, `NEXT_PUBLIC_ADMIN_EMAILS`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY`

## File Structure

# CLAUDE MUST REQUEST APPROVAL BEFORE WRITING INTO THIS FILE
