# Codebase Concerns

**Last reviewed:** 2026-02-22

## REBL Scoring Gap: Missing Size Classification

**Issue:** 1,198 of 18,971 scored locations (6.3%) have no `size_classification` in `pp_location_scores`
- **Impact:** These locations don't show a size label in the UI; size filter may hide or mishandle them
- **Source:** REBL writes scores without size tier data for some locations
- **Fix:** REBL should populate `size_classification` for all scored rows
