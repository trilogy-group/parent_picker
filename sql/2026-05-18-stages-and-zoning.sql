-- 2026-05-18 Stage rework + zoning column
--
-- New 6-stage taxonomy (parent-visible pipeline):
--   prospect          → not yet pursued (or pre-LOI activity)
--   diligence         → LOI signed (loi='done')
--   ready_to_commit   → loi='done' AND leasing='ready'
--   build_out         → leasing='done', school under construction
--   ready_to_open     → opened_at > now (CO issued, awaiting school year)
--   open              → opened_at <= now
--   moved_on          → killed / cut / process-exception
--
-- Stage is derived in `src/lib/sites/stage.ts`, not stored. This migration
-- only adds the zoning_cleared column needed by the build-out hurdle chips.

ALTER TABLE pp_locations
  ADD COLUMN IF NOT EXISTS zoning_cleared boolean;

-- View + RPCs recreated to surface zoning_cleared alongside regulatory_approved
-- and permits_acquired. See full DDL in MCP session.

-- Seed for Riverside: zoning pending (build-out site)
UPDATE pp_locations
SET zoning_cleared = false
WHERE rebl3_site_id = '10350-riverside-dr-palm-beach-gardens-fl';
