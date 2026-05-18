-- 2026-05-18 Location overrides
--
-- A small pp-owned table that lets us override "headline" facts on a site
-- when REBL upstream data is stale or wrong. Each row is meant to be temporary:
-- delete it once REBL data is correct.
--
-- Two override fields to start:
--   capacity         → overrides the headline capacity number on the card
--   target_open_date → overrides the projected open date
--
-- The view + RPCs surface these as `capacity_override` and
-- `target_open_date_override`. The app prefers override > REBL DD > rebl3_sites.

CREATE TABLE IF NOT EXISTS pp_location_overrides (
  location_id            uuid PRIMARY KEY REFERENCES pp_locations(id) ON DELETE CASCADE,
  capacity               integer,  -- headline / Phase 1
  target_open_date       date,     -- headline / Phase 1
  max_cap_capacity       integer,  -- full buildout
  max_cap_proj_open_date date,     -- full buildout
  reason                 text,     -- why we overrode (so we know when to delete)
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pp_location_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "anyone can read overrides" ON pp_location_overrides FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- INSERT/UPDATE/DELETE via service role only (admin tools)

-- ============================================================================
-- View: surface override columns
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
    o.capacity AS capacity_override,
    o.target_open_date AS target_open_date_override,
    o.max_cap_capacity AS max_cap_capacity_override,
    o.max_cap_proj_open_date AS max_cap_date_override,
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
LEFT JOIN pp_location_overrides o ON o.location_id = l.id
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
-- RPCs — same additions
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
  capacity_override integer,
  target_open_date_override date,
  max_cap_capacity_override integer,
  max_cap_date_override date,
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
    o.capacity,
    o.target_open_date,
    o.max_cap_capacity,
    o.max_cap_proj_open_date,
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
  LEFT JOIN pp_location_overrides o ON o.location_id = l.id
  LEFT JOIN LATERAL (SELECT s.status, s.details FROM rebl3_status s WHERE s.site_id = l.rebl3_site_id AND s.system = 'leasing' ORDER BY s.updated_at DESC NULLS LAST LIMIT 1) leasing ON true
  LEFT JOIN LATERAL (SELECT s.status FROM rebl3_status s WHERE s.site_id = l.rebl3_site_id AND s.system = 'loi' ORDER BY s.updated_at DESC NULLS LAST LIMIT 1) loi ON true
  LEFT JOIN LATERAL (SELECT s.status FROM rebl3_status s WHERE s.site_id = l.rebl3_site_id AND s.system = 'strategy' ORDER BY s.updated_at DESC NULLS LAST LIMIT 1) strat ON true
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
  capacity_override integer,
  target_open_date_override date,
  max_cap_capacity_override integer,
  max_cap_date_override date,
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
    o.capacity,
    o.target_open_date,
    o.max_cap_capacity,
    o.max_cap_proj_open_date,
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
  LEFT JOIN pp_location_overrides o ON o.location_id = l.id
  LEFT JOIN LATERAL (SELECT s.status, s.details FROM rebl3_status s WHERE s.site_id = l.rebl3_site_id AND s.system = 'leasing' ORDER BY s.updated_at DESC NULLS LAST LIMIT 1) leasing ON true
  LEFT JOIN LATERAL (SELECT s.status FROM rebl3_status s WHERE s.site_id = l.rebl3_site_id AND s.system = 'loi' ORDER BY s.updated_at DESC NULLS LAST LIMIT 1) loi ON true
  LEFT JOIN LATERAL (SELECT s.status FROM rebl3_status s WHERE s.site_id = l.rebl3_site_id AND s.system = 'strategy' ORDER BY s.updated_at DESC NULLS LAST LIMIT 1) strat ON true
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
-- Palm Beach seed
-- ============================================================================

-- 353 Hiatt: Open campus, current enrollment ~26 (REBL capacity=135 is building max)
INSERT INTO pp_location_overrides (location_id, capacity, reason)
SELECT id, 26, 'Current enrollment; REBL capacity=135 is the building max'
FROM pp_locations
WHERE rebl3_site_id = '353-hiatt-dr-palm-beach-gardens-fl'
ON CONFLICT (location_id) DO UPDATE
  SET capacity = EXCLUDED.capacity, reason = EXCLUDED.reason, updated_at = now();

-- 10350 Riverside: spec target Aug 2026 Phase 1, full buildout to 150 students Jan 2027
INSERT INTO pp_location_overrides (location_id, target_open_date, max_cap_capacity, max_cap_proj_open_date, reason)
SELECT id, '2026-08-12'::date, 150, '2027-01-27'::date,
       'Spec target; REBL DD missing fast_open and max_cap data'
FROM pp_locations
WHERE rebl3_site_id = '10350-riverside-dr-palm-beach-gardens-fl'
ON CONFLICT (location_id) DO UPDATE
  SET target_open_date = EXCLUDED.target_open_date,
      max_cap_capacity = EXCLUDED.max_cap_capacity,
      max_cap_proj_open_date = EXCLUDED.max_cap_proj_open_date,
      reason = EXCLUDED.reason,
      updated_at = now();

-- Palm Beach Plan of Record (summer moves to Riverside; regulatory licensing approved)
INSERT INTO pp_plan_of_record (metro, narrative_override) VALUES
  ('Palm Beach', E'Upgrading from 353 Hiatt to 10350 Riverside by August 2026.\nRiverside opens with ~68 students in Phase 1 (August 2026) and scales to 150 students at full buildout (January 2027). The summer program will run at Riverside.\nLease signed, build-out underway, regulatory licensing approved.')
ON CONFLICT (metro) DO UPDATE SET narrative_override = EXCLUDED.narrative_override, last_curated_at = now();
