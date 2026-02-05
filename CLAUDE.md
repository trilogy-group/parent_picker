# CLAUDE.md


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT:** This file is maintained by the user and should remain clean and focused. Always ask permission before making changes to CLAUDE.md, most of which will be denied.

## Project Overview

An interactive, consumer-facing website where parents can vote on and express preferences for potential Alpha micro school locations. The application helps gather community input.  A different AI agent (out of scope) will make site selection decisions and negotiate/finalize leases while keeping the interested parents informed in a positive manner.

## Key Context

**Read `docs/brainlift-location-selection.md` — it is critical context** for understanding Alpha's location strategy, scoring criteria (Enrollment Score, Wealth Score), zoning rules, size tiers, and parent override logic.

- Reference implementation: https://sportsacademy.school/map/facilities (used by 30k parents for facility voting)
- No humans on central team in the processing loop — design accordingly.

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
- `requirements.md` - Complete requirements specification (137 test cases)
- `tests/requirements.test.py` - Automated Playwright test suite (45 implemented tests)
- `feedback.md` - User feedback log with root cause analysis and corrective actions
- `architecture.md` - Technical architecture, commands, tech stack, and file structure
- `docs/brainlift-location-selection.md` - Location selection brainlift (scoring, zoning, parent override)

## Session State (2026-02-05)

**Current branch:** `main`
**Deployed:** https://parentpicker.vercel.app
**Last commit:** `4f4b31d` — Add score display on location cards and map markers
**Needs Vercel deploy:** Yes — run `vercel --prod`

### Workstream 1: Auth + suggest location — DONE

### Workstream 2: Moody's listing data — DONE (ETL + scoring by separate agent)

### Workstream 3: Score display — DONE

**What was built:**
- `pp_location_scores` table (1:1 with `pp_locations`, FK cascade delete)
- `sync_scores_from_listings()` SQL function — picks best overall_score per address from `real_estate_listings`, UPSERTs into `pp_location_scores`. Re-runnable.
- 681 locations synced, 14 active locations have no scores
- `pp_locations_with_votes` view updated to LEFT JOIN scores (18 score columns)
- Old `score` column dropped from `pp_locations`
- `ScoreBadge` component: overall score circle + 5 sub-score pills (Demographics, Price, Zoning, Neighborhood, Building) with external-link icons for report URLs
- Score badges shown on LocationCard and map popup
- Map markers colored by overall score (green/yellow/amber/red)
- Mock data (50 locations) gets deterministic dummy scores via seeded PRNG

**Known gaps (TODO in requirements.md):**
- Price: 114 missing scores, 196 missing report URLs
- Neighborhood: 49 missing scores, 112 missing URLs
- Building: 30 missing scores, 66 missing URLs
- 8 zoning URLs are empty strings in source data
- These need to be filled by the scoring agent, then re-sync via `SELECT sync_scores_from_listings();`

### Pending / Next steps
- Deploy to Vercel (need `vercel --prod` or set up auto-deploy)
- Set up Vercel Git integration for auto-deploy on push
- Fill missing scores in `real_estate_listings` (scoring agent, out of scope)
- See `requirements.md` "Out of Scope (v2)" for remaining backlog

## File Structure

# CLAUDE MUST REQUEST APPROVAL BEFORE WRITING INTO THIS FILE
