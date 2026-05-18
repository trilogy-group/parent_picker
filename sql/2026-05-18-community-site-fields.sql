-- 2026-05-18 Community Site fields
-- Spec: docs/data-model.md §7
--
-- Adds per-site fields to support the Community Site card spec across the
-- four S FL metros (Miami, Miami Beach, Palm Beach, Boca):
--   - opened_at              → Open / Ready stages
--   - upgrade_for_location_id → "We're upgrading from <X> to this site"
--   - regulatory_required / permits_required / summer_program → static hurdle flags
--   - backup_plan (per metro) → metro-level fallback text
--
-- Also extends pp_locations_with_votes + the two RPCs to surface both REBL DD
-- blocks (fast_open AND max_cap) so the card can show both phases when present.

-- ============================================================================
-- 1. pp_locations: new columns
-- ============================================================================
ALTER TABLE pp_locations
  ADD COLUMN IF NOT EXISTS opened_at               timestamptz,
  ADD COLUMN IF NOT EXISTS upgrade_for_location_id uuid REFERENCES pp_locations(id),
  ADD COLUMN IF NOT EXISTS regulatory_required     boolean,
  ADD COLUMN IF NOT EXISTS permits_required        boolean,
  ADD COLUMN IF NOT EXISTS summer_program          boolean;

CREATE INDEX IF NOT EXISTS idx_pp_locations_upgrade_for
  ON pp_locations(upgrade_for_location_id)
  WHERE upgrade_for_location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pp_locations_opened_at
  ON pp_locations(opened_at)
  WHERE opened_at IS NOT NULL;

-- ============================================================================
-- 2. pp_plan_of_record: metro backup plan text
-- ============================================================================
ALTER TABLE pp_plan_of_record
  ADD COLUMN IF NOT EXISTS backup_plan text;

-- ============================================================================
-- 3. pp_locations_with_votes — add new pp_locations columns + max_cap block
-- DROP first because column list and order change.
-- ============================================================================
DROP VIEW IF EXISTS public.pp_locations_with_votes;
CREATE VIEW public.pp_locations_with_votes AS
SELECT l.id,
    COALESCE(l.name, r.address) AS name,
    COALESCE(r.address, l.address) AS address,
    COALESCE(r.city, l.city) AS city,
    COALESCE(r.state, l.state) AS state,
    COALESCE(r.zip, l.zip) AS zip,
    COALESCE(r.lat, l.lat::double precision) AS lat,
    COALESCE(r.lng, l.lng::double precision) AS lng,
    l.status,
    l.source,
    l.notes,
    l.suggested_by,
    l.created_at,
    l.updated_at,
    l.vote_count AS votes,
    l.not_here_count,
    pp_judgment_color(r.overall) AS overall_color,
    r.overall_score AS overall_score,
    CASE WHEN r.site_id IS NOT NULL THEN 'https://rebl3.vercel.app/site/' || r.site_id ELSE NULL END AS overall_details_url,
    pp_judgment_color(r.dim_cost) AS price_color,
    pp_judgment_color(r.dim_zoning) AS zoning_color,
    pp_judgment_color(r.dim_neighborhood) AS neighborhood_color,
    pp_judgment_color(r.dim_building) AS building_color,
    r.school_size_category AS size_classification,
    r.capacity AS capacity,
    l.proposed,
    l.rebl3_site_id AS property_source_key,
    l.is_bridge,
    l.feedback_deadline,
    l.opened_at,
    l.upgrade_for_location_id,
    l.regulatory_required,
    l.permits_required,
    l.summer_program,
    leasing.status AS leasing_status,
    leasing.details AS leasing_details,
    loi.status AS loi_status,
    strat.status AS strategy_status,
    dd.fast_open_capacity AS dd_fast_open_capacity,
    dd.fast_open_proj_open_date AS dd_fast_open_proj_open_date,
    dd.max_cap_capacity AS dd_max_cap_capacity,
    dd.max_cap_proj_open_date AS dd_max_cap_proj_open_date
FROM pp_locations l
LEFT JOIN rebl3_sites r ON r.site_id = l.rebl3_site_id
LEFT JOIN LATERAL (
  SELECT s.status, s.details FROM rebl3_status s
  WHERE s.site_id = l.rebl3_site_id AND s.system = 'leasing'
  ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
) leasing ON true
LEFT JOIN LATERAL (
  SELECT s.status FROM rebl3_status s
  WHERE s.site_id = l.rebl3_site_id AND s.system = 'loi'
  ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
) loi ON true
LEFT JOIN LATERAL (
  SELECT s.status FROM rebl3_status s
  WHERE s.site_id = l.rebl3_site_id AND s.system = 'strategy'
  ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
) strat ON true
LEFT JOIN LATERAL (
  SELECT
    NULLIF(s.details->'fast_open'->>'capacity','')::int            AS fast_open_capacity,
    NULLIF(s.details->'fast_open'->>'proj_open_date','')::date     AS fast_open_proj_open_date,
    NULLIF(s.details->'max_cap'->>'capacity','')::int              AS max_cap_capacity,
    NULLIF(s.details->'max_cap'->>'proj_open_date','')::date       AS max_cap_proj_open_date
  FROM rebl3_status s
  WHERE s.site_id = l.rebl3_site_id AND s.system = 'due-diligence'
  ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
) dd ON true
WHERE l.status = 'active';

-- ============================================================================
-- 4. get_locations_in_bounds — same field additions
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_locations_in_bounds(double precision, double precision, double precision, double precision, boolean);
CREATE OR REPLACE FUNCTION public.get_locations_in_bounds(
  min_lat double precision, max_lat double precision,
  min_lng double precision, max_lng double precision,
  released_only boolean DEFAULT false
)
RETURNS TABLE(
  id uuid, name text, address text, city text, state text, zip text,
  lat double precision, lng double precision,
  vote_count integer, not_here_count integer,
  source text, released boolean,
  overall_color text, overall_score integer, overall_details_url text,
  price_color text, zoning_color text, neighborhood_color text, play_area_color text, building_color text,
  school_size_category text, capacity integer,
  proposed boolean, property_source_key text, feedback_deadline timestamp with time zone,
  is_bridge boolean,
  opened_at timestamp with time zone,
  upgrade_for_location_id uuid,
  regulatory_required boolean,
  permits_required boolean,
  summer_program boolean,
  leasing_status text, leasing_details jsonb, loi_status text, strategy_status text,
  dd_fast_open_capacity integer, dd_fast_open_proj_open_date date,
  dd_max_cap_capacity integer, dd_max_cap_proj_open_date date
)
LANGUAGE plpgsql AS $function$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    COALESCE(l.name, r.address)::text,
    COALESCE(r.address, l.address)::text,
    COALESCE(r.city, l.city)::text,
    COALESCE(r.state, l.state)::text,
    COALESCE(r.zip, l.zip)::text,
    COALESCE(r.lat, l.lat::double precision),
    COALESCE(r.lng, l.lng::double precision),
    l.vote_count, l.not_here_count,
    l.source, l.released,
    pp_judgment_color(r.overall),
    r.overall_score,
    CASE WHEN r.site_id IS NOT NULL THEN 'https://rebl3.vercel.app/site/' || r.site_id ELSE NULL END,
    pp_judgment_color(r.dim_cost),
    pp_judgment_color(r.dim_zoning),
    pp_judgment_color(r.dim_neighborhood),
    pp_judgment_color(r.sub_play),
    pp_judgment_color(r.dim_building),
    r.school_size_category,
    r.capacity,
    l.proposed,
    l.rebl3_site_id,
    l.feedback_deadline,
    l.is_bridge,
    l.opened_at,
    l.upgrade_for_location_id,
    l.regulatory_required,
    l.permits_required,
    l.summer_program,
    leasing.status::text,
    leasing.details,
    loi.status::text,
    strat.status::text,
    dd.fast_open_capacity,
    dd.fast_open_proj_open_date,
    dd.max_cap_capacity,
    dd.max_cap_proj_open_date
  FROM pp_locations l
  LEFT JOIN rebl3_sites r ON r.site_id = l.rebl3_site_id
  LEFT JOIN LATERAL (
    SELECT s.status, s.details FROM rebl3_status s
    WHERE s.site_id = l.rebl3_site_id AND s.system = 'leasing'
    ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
  ) leasing ON true
  LEFT JOIN LATERAL (
    SELECT s.status FROM rebl3_status s
    WHERE s.site_id = l.rebl3_site_id AND s.system = 'loi'
    ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
  ) loi ON true
  LEFT JOIN LATERAL (
    SELECT s.status FROM rebl3_status s
    WHERE s.site_id = l.rebl3_site_id AND s.system = 'strategy'
    ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
  ) strat ON true
  LEFT JOIN LATERAL (
    SELECT
      NULLIF(s.details->'fast_open'->>'capacity','')::int        AS fast_open_capacity,
      NULLIF(s.details->'fast_open'->>'proj_open_date','')::date AS fast_open_proj_open_date,
      NULLIF(s.details->'max_cap'->>'capacity','')::int          AS max_cap_capacity,
      NULLIF(s.details->'max_cap'->>'proj_open_date','')::date   AS max_cap_proj_open_date
    FROM rebl3_status s
    WHERE s.site_id = l.rebl3_site_id AND s.system = 'due-diligence'
    ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
  ) dd ON true
  WHERE l.status = 'active'
    AND (NOT released_only OR l.released = true OR l.proposed = true)
    AND COALESCE(r.lat, l.lat::double precision) BETWEEN min_lat AND max_lat
    AND COALESCE(r.lng, l.lng::double precision) BETWEEN min_lng AND max_lng;
END;
$function$;

-- ============================================================================
-- 5. get_nearby_locations — same field additions
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_nearby_locations(double precision, double precision, integer, boolean);
CREATE OR REPLACE FUNCTION public.get_nearby_locations(
  center_lat double precision, center_lng double precision,
  max_results integer DEFAULT 50,
  released_only boolean DEFAULT false
)
RETURNS TABLE(
  id uuid, name text, address text, city text, state text, zip text,
  lat double precision, lng double precision,
  vote_count integer, not_here_count integer,
  source text, released boolean,
  overall_color text, overall_score integer, overall_details_url text,
  price_color text, zoning_color text, neighborhood_color text, play_area_color text, building_color text,
  school_size_category text, capacity integer,
  property_source_key text, feedback_deadline timestamp with time zone,
  is_bridge boolean,
  opened_at timestamp with time zone,
  upgrade_for_location_id uuid,
  regulatory_required boolean,
  permits_required boolean,
  summer_program boolean,
  leasing_status text, leasing_details jsonb, loi_status text, strategy_status text,
  dd_fast_open_capacity integer, dd_fast_open_proj_open_date date,
  dd_max_cap_capacity integer, dd_max_cap_proj_open_date date
)
LANGUAGE plpgsql AS $function$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    COALESCE(l.name, r.address)::text,
    COALESCE(r.address, l.address)::text,
    COALESCE(r.city, l.city)::text,
    COALESCE(r.state, l.state)::text,
    COALESCE(r.zip, l.zip)::text,
    COALESCE(r.lat, l.lat::double precision),
    COALESCE(r.lng, l.lng::double precision),
    l.vote_count, l.not_here_count,
    l.source, l.released,
    pp_judgment_color(r.overall),
    r.overall_score,
    CASE WHEN r.site_id IS NOT NULL THEN 'https://rebl3.vercel.app/site/' || r.site_id ELSE NULL END,
    pp_judgment_color(r.dim_cost),
    pp_judgment_color(r.dim_zoning),
    pp_judgment_color(r.dim_neighborhood),
    pp_judgment_color(r.sub_play),
    pp_judgment_color(r.dim_building),
    r.school_size_category,
    r.capacity,
    l.rebl3_site_id,
    l.feedback_deadline,
    l.is_bridge,
    l.opened_at,
    l.upgrade_for_location_id,
    l.regulatory_required,
    l.permits_required,
    l.summer_program,
    leasing.status::text,
    leasing.details,
    loi.status::text,
    strat.status::text,
    dd.fast_open_capacity,
    dd.fast_open_proj_open_date,
    dd.max_cap_capacity,
    dd.max_cap_proj_open_date
  FROM pp_locations l
  LEFT JOIN rebl3_sites r ON r.site_id = l.rebl3_site_id
  LEFT JOIN LATERAL (
    SELECT s.status, s.details FROM rebl3_status s
    WHERE s.site_id = l.rebl3_site_id AND s.system = 'leasing'
    ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
  ) leasing ON true
  LEFT JOIN LATERAL (
    SELECT s.status FROM rebl3_status s
    WHERE s.site_id = l.rebl3_site_id AND s.system = 'loi'
    ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
  ) loi ON true
  LEFT JOIN LATERAL (
    SELECT s.status FROM rebl3_status s
    WHERE s.site_id = l.rebl3_site_id AND s.system = 'strategy'
    ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
  ) strat ON true
  LEFT JOIN LATERAL (
    SELECT
      NULLIF(s.details->'fast_open'->>'capacity','')::int        AS fast_open_capacity,
      NULLIF(s.details->'fast_open'->>'proj_open_date','')::date AS fast_open_proj_open_date,
      NULLIF(s.details->'max_cap'->>'capacity','')::int          AS max_cap_capacity,
      NULLIF(s.details->'max_cap'->>'proj_open_date','')::date   AS max_cap_proj_open_date
    FROM rebl3_status s
    WHERE s.site_id = l.rebl3_site_id AND s.system = 'due-diligence'
    ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
  ) dd ON true
  WHERE l.status = 'active'
    AND (NOT released_only OR l.released = true)
  ORDER BY (COALESCE(r.lat, l.lat::double precision) - center_lat)^2
         + (COALESCE(r.lng, l.lng::double precision) - center_lng)^2
  LIMIT max_results;
END;
$function$;

-- ============================================================================
-- 6. Backfill — 4 S FL metros (per docs/data-model.md §7.6)
-- Run after the DDL above completes. Idempotent.
-- ============================================================================

-- Open campuses (Alpha opens mid-August)
UPDATE pp_locations SET opened_at = '2024-08-12'::timestamptz
  WHERE rebl3_site_id = '8000-sw-56th-st-miami-fl' AND opened_at IS NULL;

UPDATE pp_locations SET opened_at = '2025-08-12'::timestamptz
  WHERE rebl3_site_id = '353-hiatt-dr-palm-beach-gardens-fl' AND opened_at IS NULL;

-- Upgrade pairs
UPDATE pp_locations SET upgrade_for_location_id =
    (SELECT id FROM pp_locations WHERE rebl3_site_id = '8000-sw-56th-st-miami-fl')
  WHERE rebl3_site_id = '3301-grand-ave-miami-fl'
    AND upgrade_for_location_id IS NULL;

UPDATE pp_locations SET upgrade_for_location_id =
    (SELECT id FROM pp_locations WHERE rebl3_site_id = '353-hiatt-dr-palm-beach-gardens-fl')
  WHERE rebl3_site_id = '10350-riverside-dr-palm-beach-gardens-fl'
    AND upgrade_for_location_id IS NULL;

-- Hurdle flags (true=yes, false=no; NULL = unknown / TBD)
UPDATE pp_locations
  SET regulatory_required = true, permits_required = false
  WHERE rebl3_site_id = '3301-grand-ave-miami-fl';

UPDATE pp_locations
  SET regulatory_required = true, summer_program = true
  WHERE rebl3_site_id = '10350-riverside-dr-palm-beach-gardens-fl';

UPDATE pp_locations
  SET regulatory_required = true
  WHERE rebl3_site_id = '2200-nw-5th-ave-boca-raton-fl';

-- Metro backup plans. Keyed by display name (matches `ACTIVE_METROS.displayName`
-- and how `metroName` flows through the panel + PoR API). Spec defines backups
-- for Miami Beach and Boca; Miami and Palm Beach have an Open campus so no backup
-- needed yet.
INSERT INTO pp_plan_of_record (metro, backup_plan) VALUES
  ('Miami Beach', 'Miami, Boca, or Palm Beach — or temporary homeschool in a licensed hotel space in Miami Beach.'),
  ('Boca Raton',  'Miami, Miami Beach, or Palm Beach — or temporary homeschool in a licensed hotel space in Boca.')
ON CONFLICT (metro) DO UPDATE SET backup_plan = EXCLUDED.backup_plan;

-- Note: pp_locations.region is no longer used for metro mapping (see
-- src/lib/active-metros.ts — metros are derived from lat/lng radius). No
-- region UPDATE is needed for the 4-metro split.
