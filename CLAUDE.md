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
- `sql/import_locations_from_upstream.sql` - SQL function to import from upstream

## Session State (2026-02-06)

**Current branch:** `main`
**Deployed:** https://parentpicker.vercel.app
**Last deploy:** 2026-02-06 — score display redesign (4 subscores, color-only, card shading, no expand/collapse)

### Workstreams 1-8: DONE (merged to main)

### Workstream 9: Score & Size Filters — DONE

**What was built:**
- Collapsible filter panel in left panel (full category names: Demographics, Price, Regulatory, Neighborhood, Building)
- Color chip toggles (G/Y/R) for 6 categories + size tier buttons (Micro, Micro2, Growth, Full Size, N/A)
- AND across categories, OR within; Red (Reject) excluded by default, 4 non-reject sizes selected by default
- Search bar removed — filters only
- Filters cascade to map (via `filteredLocations()` in Zustand store)
- `size_classification` added to `pp_location_scores` table, synced from upstream (normalized)

### Workstream 10: Card & Score Display Polish — DONE

**What was built:**
- 4 subscores only: Neighborhood (MapPin), Regulatory (Landmark), Building (Building2), Price (DollarSign) — demographics removed
- Colors only, no numeric scores — overall shown as card background tint (green/yellow/amber/red)
- Card shading: `overallCardBg` maps GREEN→bg-green-50, YELLOW→bg-yellow-50, etc.
- ArtifactLink (external link icon) only for overall score details URL
- SizeLabel moved to header row (left of ArtifactLink and vote button)
- Sub-scores always visible (no expand/collapse toggle)
- Score legend popup (? icon) — icons only, no color thresholds
- Map popup matches card layout: name + size + artifact link, address, sub-scores row
- Card whitespace fix: overrode shadcn Card's built-in `gap-6` with `gap-0`
- Icon alignment fix: `<div flex h-4>` with `[&>svg]:block` instead of `<span inline-flex>`
- Removed blue left border (isInViewport indicator) — all on-screen locations shown
- Suggest button moved below "How It Works", label: "+ Or Suggest New Location"
- Map popup dismiss: click dot again, click map, or close button

**DB changes:**
- `pp_location_scores.size_classification` column added
- `sync_scores_from_listings()` now syncs size_classification with normalization
- `get_nearby_locations()` returns `size_classification`
- `pp_locations_with_votes` view includes `size_classification`
- 1,026 of 1,044 scored locations have size data (628 Micro, 151 Reject, 130 Micro2, 87 Growth, 28 Full)

**Key files modified:**
- `src/components/ScoreBadge.tsx` — ScoreCell, SubScoresRow, ArtifactLink, SizeLabel, ScoreDetails, ScoreLegend, overallCardBg
- `src/components/LocationCard.tsx` — card shading via overallCardBg, SizeLabel+ArtifactLink in header, gap-0
- `src/components/MapView.tsx` — popup shading via overallCardBg, ArtifactLink+SizeLabel+ScoreDetails
- `src/components/LocationsList.tsx` — ScoreFilterPanel (no demographics), tighter list spacing
- `src/lib/votes.ts` — ScoreFilters (no demographics), filter state, filteredLocations() logic
- `src/types/index.ts` — sizeClassification on LocationScores
- `src/components/AuthButton.tsx` — compact sign-in/sign-out styling
- `src/app/page.tsx` — header layout, suggest button moved

### Pending / Next steps
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
