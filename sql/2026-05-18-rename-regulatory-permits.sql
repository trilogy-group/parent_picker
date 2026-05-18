-- 2026-05-18 Rename regulatory_required → regulatory_approved
--                permits_required    → permits_acquired
--
-- The original columns used "required" semantics ("does this site need
-- regulatory approval / permits?") but the actual spec semantic Andy meant
-- is "is regulatory approval / permits done?" — yes/no/unknown.
--
-- Values are preserved across the rename. For the 4 S FL spec sites:
--   - "Regulatory: yes" → regulatory_approved=true (done)
--   - "Permits: no"     → permits_acquired=false (in progress)
--   - "?"               → null (unknown)

ALTER TABLE pp_locations RENAME COLUMN regulatory_required TO regulatory_approved;
ALTER TABLE pp_locations RENAME COLUMN permits_required    TO permits_acquired;

-- View + RPCs are recreated with the new column names — see
-- the full DDL in this session's MCP calls.

-- Update Riverside max_cap date to first-of-month convention (we treat
-- target_open_date and max_cap_proj_open_date as month-precision; the day
-- is just a placeholder).
UPDATE pp_location_overrides
SET max_cap_proj_open_date = '2027-01-01'::date, updated_at = now()
WHERE location_id = (SELECT id FROM pp_locations WHERE rebl3_site_id = '10350-riverside-dr-palm-beach-gardens-fl');
