# CLAUDE.md


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT:** This file is maintained by the user and should remain clean and focused. Always ask permission before making changes to CLAUDE.md, most of which will be denied.

## Project Overview

An interactive, consumer-facing website where parents can vote on and express preferences for potential Alpha micro school locations. The application helps gather community input.  A different AI agent (out of scope) will make site selection decisions and negotiate/finalize leases while keeping the interested parents informed in a positive manner.

## Key Context

**Read `docs/brainlift-location-selection.md` — it is critical context** for understanding Alpha's location strategy, scoring criteria (Enrollment Score, Wealth Score), zoning rules, size tiers, and parent override logic.

- Reference implementation: https://sportsacademy.school/map/facilities (used by 30k parents for facility voting)
- No humans on central team in the processing loop — design accordingly.

## Terminology

- **App tables** (`pp_*`): Tables owned by this app — `pp_locations`, `pp_votes`, `pp_location_scores`, etc. We control the schema and write to them.
- **Upstream tables**: Tables populated by other agents/pipelines outside this repo — `real_estate_listings`, etc. We read from them but never write to them. Scores and report URLs originate here and get synced into app tables via `sync_scores_from_listings()`.

## Test-Driven Development

- This project uses TDD. All requirements are documented in `requirements.md` with corresponding test cases.  
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
- `sql/import_locations_from_upstream.sql` - SQL function to import from upstream

## Session State (2026-02-05)

**Current branch:** `admin-likes-tab`
**Deployed:** https://parentpicker.vercel.app (does NOT include likes tab yet)
**Last deploy:** 2026-02-05 — admin workflow + pagination fix
**Branch commits:**
- `2be534e` — Admin likes tab + TODO system + voter email notifications
- `3099f4b` — Remove fabricated colorFromOverall fallback

### Workstreams 1-6: DONE (see git history)

### Workstream 7: Admin Likes Tab — DONE (on branch, not deployed)

**What was built:**
- Suggestions | Likes tab toggle on `/admin` page
- Likes tab: active locations with votes, sorted by vote count DESC
- Pull scores + send informational emails to all voters of a location
- Emails include score tables + TODO action items for RED sub-scores
- TODO generator: zoning (CUP/rezone), demographics (M1-M3), pricing (P1-P3b)
- New API routes: `GET /api/admin/likes`, `POST /api/admin/locations/[id]/notify-voters`
- Score sync returns upstream metrics + metro info for TODO generation

**Key new files:**
- `src/app/api/admin/likes/route.ts` — likes endpoint
- `src/app/api/admin/locations/[id]/notify-voters/route.ts` — voter email endpoint
- `src/lib/email-todos.ts` — email HTML with score tables + TODO sections
- `src/lib/todo-generator.ts` — generates actionable TODOs from RED scores
- `src/types/index.ts` — added `LikedLocation` type

### Workstream 8: Overall color fix — DONE (on branch)

**What was fixed:**
- Removed `colorFromOverall()` fallback that fabricated colors from numeric overall score
- Overall color logic is: RED if any subscore is 0 or size out of bounds, GREEN if all GREEN, else YELLOW
- This is computed **upstream** by the scoring agent — our code just passes it through
- When upstream color is null, we show neutral gray (not a made-up color)

**Upstream bug found:** `overall_color` in `real_estate_listings` is wrong for ~74% of scored rows. The scoring agent's own artifact pages show correct colors but it writes wrong values to the DB. Needs upstream fix.

### Location counts (1,900 active)

| Metro | Locations |
|-------|-----------|
| New York, NY | 760 |
| Brooklyn, NY | 218 |
| Boca Raton, FL | 105 |
| West Palm Beach, FL | 100 |
| Austin, TX | 49 |
| Dallas, TX | 33 |
| All others | 635 |

### Pending / Next steps
- Merge `admin-likes-tab` branch to main and deploy
- **Upstream scoring agent bug**: `overall_color` wrong for ~74% of rows — agent artifacts show correct color but DB has wrong value. Needs fix in scoring agent, then re-sync: `SELECT sync_scores_from_listings();`
- Scoring agent needs to score 1,166 unscored locations in `real_estate_listings`
- Fill sub-score gaps (especially Price: 140 missing) for the 734 already-scored locations
- Vercel env vars already set: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ADMIN_EMAILS`, `NEXT_PUBLIC_ADMIN_EMAILS`

## SQL Functions (in Supabase)

- `sync_scores_from_listings()` — bulk sync all scores from upstream
- `sync_scores_for_address(target_address)` — single-address score sync (used by admin pull-scores)
- `import_locations_from_upstream(city_names[], state_code)` — import locations from upstream by city/state

## File Structure

# CLAUDE MUST REQUEST APPROVAL BEFORE WRITING INTO THIS FILE
