-- 2026-05-18 REBL score overrides
--
-- Adds per-dimension and overall score overrides on pp_location_overrides.
-- Lets admins fix stale REBL judgments (e.g. zoning was marked YELLOW
-- upstream but Andy confirms approval is done -> override to GREEN).
--
-- View + RPCs apply COALESCE(override, REBL value) so card display
-- transparently prefers the override.

ALTER TABLE pp_location_overrides
  ADD COLUMN IF NOT EXISTS overall_color_override      text CHECK (overall_color_override      IN ('GREEN','YELLOW','AMBER','RED')),
  ADD COLUMN IF NOT EXISTS overall_score_override      integer,
  ADD COLUMN IF NOT EXISTS price_color_override        text CHECK (price_color_override        IN ('GREEN','YELLOW','AMBER','RED')),
  ADD COLUMN IF NOT EXISTS zoning_color_override       text CHECK (zoning_color_override       IN ('GREEN','YELLOW','AMBER','RED')),
  ADD COLUMN IF NOT EXISTS neighborhood_color_override text CHECK (neighborhood_color_override IN ('GREEN','YELLOW','AMBER','RED')),
  ADD COLUMN IF NOT EXISTS building_color_override     text CHECK (building_color_override     IN ('GREEN','YELLOW','AMBER','RED'));

-- Riverside: zoning approved per Andy's note.
UPDATE pp_locations SET zoning_cleared = true
  WHERE rebl3_site_id = '10350-riverside-dr-palm-beach-gardens-fl';

UPDATE pp_location_overrides
SET zoning_color_override   = 'GREEN',
    overall_color_override  = 'GREEN',
    overall_score_override  = 30,
    reason = COALESCE(reason || ' | ', '') || 'Zoning approved; REBL upstream shows YELLOW. Overall bumped to 30 to match all-GREEN profile.',
    updated_at = now()
WHERE location_id = (SELECT id FROM pp_locations WHERE rebl3_site_id = '10350-riverside-dr-palm-beach-gardens-fl');

-- View + RPCs recreated with COALESCE(override, REBL) on the 5 color columns
-- and overall_score. See MCP session for full DDL.
