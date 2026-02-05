# CLAUDE.md


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT:** This file is maintained by the user and should remain clean and focused. Always ask permission before making changes to CLAUDE.md, most of which will be denied.

## Project Overview

An interactive, consumer-facing website where parents can vote on and express preferences for potential Alpha micro school locations. The application helps gather community input.  A different AI agent (out of scope) will make site selection decisions and negotiate/finalize leases while keeping the interested parents informed in a positive manner.

## Key Context

- Scaling Alpha School (Stanford of K-12, www.alpha.school) and affiliates to hundreds/thousands of locations
  - Scale requires humans in the loop (other than distributed parents as described). 
  - Humans on central team and feedback / processing loops will not be allowed, design accordingly.
- Real estate expertise (sourcing, zoning, permitting) is hyper-local
- Excited prospective Alpha parents have most local expertise, network, and capability and this site should leverage this.
- Reference implementation: https://sportsacademy.school/map/facilities (used by 30k parents for facility voting)


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


**Key files:**
- `requirements.md` - Complete requirements specification (137 test cases)
- `tests/requirements.test.py` - Automated Playwright test suite (45 implemented tests)
- `feedback.md` - User feedback log with root cause analysis and corrective actions
- `architecture.md` - Technical architecture, commands, tech stack, and file structure

## Session State (2026-02-05)

**Current branch:** `main`
**Deployed:** https://parentpicker.vercel.app

### Workstream 1: Auth debugging

**Status:** Magic link redirect still broken — needs Supabase dashboard fix.

**Problem:** Magic link emails contain `redirect_to=https://locator.alpha.school` instead of our origin. Our code is correct (`src/lib/auth.ts:11` sends `emailRedirectTo: window.location.origin`), but Supabase ignores it because our URLs aren't properly allowlisted.

**Root cause:** Supabase project `mnxgkozrutvylzeogphh` is shared with `locator.alpha.school` (that's the Site URL). When our redirect URL isn't recognized in the allowlist, Supabase falls back to the Site URL.

**What was tried:**
- User says redirect URLs were added, but magic links still redirect to `locator.alpha.school`
- Likely issue: URLs need wildcard glob (`http://localhost:3000/**` not just `http://localhost:3000`) or there's a caching/propagation delay

**Fix needed (Supabase Dashboard → Auth → URL Configuration → Redirect URLs):**
1. Confirm both are present WITH wildcards: `http://localhost:3000/**` and `https://parentpicker.vercel.app/**`
2. If Site URL can't be changed (shared project), the redirect URLs allowlist is the only mechanism
3. After confirming, send a NEW magic link (old links have the old redirect baked in)

**After auth works:**
- Add auth gate to SuggestLocationModal ✅ (already implemented — shows SignInPrompt when not signed in)
- Configure Supabase env vars on Vercel for production
- Deploy with auth working

### Workstream 2: Moody's listing data integration

**Status:** Data extracted, schema understood. Not yet integrated.

**Data location:** `data/Moody_s Data/` (gitignored, ~1.3GB total)

| File | Records | Key Fields |
|------|---------|------------|
| `trilogy_property.csv` | 2.9M | lat/lng, address, city, state, zip, category (Retail/Office/Industrial), subcategory, building SF, lot acres, zoning, building class/floors |
| `trilogy_listings.csv` | 1.3M | Joins via `property_source_key` — space type, availability status, available date, space size SF, lease terms/pricing |
| `trilogy_property_performance_trend.csv` | 2.3M | Asking rent time series (monthly, per sqft by sector) |
| `trilogy_property_contacts.csv` | 444K | Broker name, role, company per listing |
| `trilogy_property_amenities.csv` | 10K | Property amenities |

**Key join:** `property_source_key` links property → listings → contacts. `property_source_id` is an alternate key.

**Schema updated:** `docs/schema-design.md` now has:
- `pp_locations` — one row per property/address (map-visible entity). Added `property_source_key`, `category`, `subcategory`, `building_sf`, `lot_acres`, `zoning`, `building_class`, `num_floors`, `zip`, `county`. `score` = best listing score.
- `pp_listings` (NEW) — multiple available spaces per property. Has `listed_space_key`, `space_size_sf`, `lease_rate_psf`, `availability_status`, `score`, `score_details`. Each listing scored independently; property shows best.
- `pp_locations_with_votes` view — rolls up vote count + best listing info (count, score, SF, rate) per property.

**Next steps for this workstream:**
- Define filtering criteria for micro school candidates (category, size, availability, etc.)
- Build ETL pipeline: filter Moody's CSVs → load into `pp_locations` + `pp_listings`
- Design scoring model (zoning, size, proximity to families, rent)
- Update app frontend types to include listing-derived fields

## File Structure

# CLAUDE MUST REQUEST APPROVAL BEFORE WRITING INTO THIS FILE
