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

**Current branch:** `main`
**Deployed:** https://parentpicker.vercel.app
**Last deploy:** 2026-02-05 — includes admin workflow + pagination fix
**Last commit:** `23fe488` (uncommitted: admin workflow + pagination fix)

### Workstream 1: Auth + suggest location — DONE
### Workstream 2: Moody's listing data — DONE (ETL + scoring by separate agent)
### Workstream 3: Score display — DONE
### Workstream 4: Admin review workflow — DONE

**What was built:**
- `/admin` page — review queue for parent-suggested locations
- API routes: GET/approve/reject/sync-scores at `/api/admin/locations`
- Server-side admin auth via `ADMIN_EMAILS` allowlist + service role client
- Email notifications via Resend (approval + rejection with score tables)
- Client-side email preview before sending (toggle approve/reject, show/hide)
- `sync_scores_for_address()` SQL function with pg_trgm fuzzy matching
- Admin emails: `andy.price@trilogy.com`, `neeraj.gupta@trilogy.com`
- Requirements Section 17 (23 test cases)

**Key files:**
- `src/app/admin/page.tsx` — admin review queue page
- `src/components/AdminLocationCard.tsx` — card with pull-scores/approve/reject workflow
- `src/app/api/admin/locations/` — API routes (GET, approve, reject, sync-scores)
- `src/lib/supabase-admin.ts` — service role client
- `src/lib/admin.ts` — admin auth verification
- `src/lib/email.ts` — Resend email service
- `docs/sql/sync_scores_for_address.sql` — SQL function source

### Workstream 5: Upstream import fix — DONE

**What was fixed:**
- `import_locations_from_upstream()` was using `property_standardized_address` (~11% populated) instead of `address` (100% populated)
- Fixed function now uses `address` column — matches `sync_scores_from_listings()` behavior
- `/import-upstream` skill created (supports address, city, and "all" modes)

### Workstream 6: Pagination fix — DONE

**What was fixed:**
- Supabase PostgREST enforces 1000-row max per request (ignores client `.limit()`)
- `getLocations()` now paginates with `.range()` to fetch all 1900 locations
- Without this, parent-suggested locations with 0 votes were cut off past row 1000

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

### Score coverage (734 of 1,900 scored — 39%)

1,166 locations have no scores at all (all newly imported `upstream` source — `overall_score` is NULL in `real_estate_listings` for these). Scoring agent needs to run on them.

**Among the 734 scored locations:**

| Sub-score | Missing Score | Missing Report URL |
|-----------|--------------|-------------------|
| Overall | 0 | 70 |
| Demographics | 6 | 17 |
| Price | **140** | **222** |
| Zoning | 3 | 59 |
| Neighborhood | 50 | 114 |
| Building | 33 | 69 |

To re-sync after scoring agent fills gaps: `SELECT sync_scores_from_listings();`

### Uncommitted changes

All admin workflow files + pagination fix are deployed to Vercel but **not committed to git**. Files:
- New: `src/app/admin/`, `src/app/api/`, `src/components/AdminLocationCard.tsx`, `src/lib/admin.ts`, `src/lib/email.ts`, `src/lib/supabase-admin.ts`, `docs/sql/`, `sql/`
- Modified: `src/lib/locations.ts` (pagination), `src/types/index.ts` (AdminLocation), `requirements.md` (Section 17), `package.json` (resend dep)

### Pending / Next steps
- Commit all uncommitted changes to git
- Scoring agent needs to score 1,166 unscored locations in `real_estate_listings`
- Fill sub-score gaps (especially Price: 140 missing) for the 734 already-scored locations
- Vercel env vars already set: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ADMIN_EMAILS`, `NEXT_PUBLIC_ADMIN_EMAILS`
- See `requirements.md` "Out of Scope (v2)" for remaining backlog

## SQL Functions (in Supabase)

- `sync_scores_from_listings()` — bulk sync all scores from upstream
- `sync_scores_for_address(target_address)` — single-address score sync (used by admin pull-scores)
- `import_locations_from_upstream(city_names[], state_code)` — import locations from upstream by city/state

## File Structure

# CLAUDE MUST REQUEST APPROVAL BEFORE WRITING INTO THIS FILE
