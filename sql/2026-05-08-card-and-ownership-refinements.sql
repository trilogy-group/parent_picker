-- 2026-05-08 Card & Ownership Refinements
-- Spec: docs/superpowers/specs/2026-05-08-card-and-ownership-refinements-design.md

-- 1. New columns on pp_site_problems
ALTER TABLE pp_site_problems
  ADD COLUMN IF NOT EXISTS parent_ownable  boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category        text         NOT NULL DEFAULT 'other'
    CHECK (category IN ('zoning','licensing','other')),
  ADD COLUMN IF NOT EXISTS severity        text         NOT NULL DEFAULT 'M'
    CHECK (severity IN ('H','M','L')),
  ADD COLUMN IF NOT EXISTS source_ref      jsonb,
  ADD COLUMN IF NOT EXISTS admin_edited_at timestamptz;

-- Lookup index for the regulatory-sync upsert key.
-- source_ref shape for regulatory-synced rows:
--   {"system":"regulatory","site_id":"<rebl3 site_id>","name":"<issue name>"}
CREATE INDEX IF NOT EXISTS idx_pp_site_problems_source_ref_name
  ON pp_site_problems ((source_ref->>'name'))
  WHERE source_ref IS NOT NULL;

-- Help the card chip query that filters parent-ownable + open per site.
CREATE INDEX IF NOT EXISTS idx_pp_site_problems_site_ownable
  ON pp_site_problems(site_id, severity)
  WHERE parent_ownable = true AND status IN ('open','in_progress');

-- 2. pp_locations_with_votes — add capacity, overall_score, dd_fast_open_*
-- DROP first (instead of CREATE OR REPLACE) because column order changes from prior migration.
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
    leasing.status AS leasing_status,
    leasing.details AS leasing_details,
    loi.status AS loi_status,
    dd.fast_open_capacity AS dd_fast_open_capacity,
    dd.fast_open_proj_open_date AS dd_fast_open_proj_open_date
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
  SELECT
    NULLIF(s.details->'fast_open'->>'capacity','')::int        AS fast_open_capacity,
    NULLIF(s.details->'fast_open'->>'proj_open_date','')::date AS fast_open_proj_open_date
  FROM rebl3_status s
  WHERE s.site_id = l.rebl3_site_id AND s.system = 'due-diligence'
  ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
) dd ON true
WHERE l.status = 'active';

-- 3. get_locations_in_bounds — add overall_score + dd fast_open fields
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
  is_bridge boolean, leasing_status text, leasing_details jsonb, loi_status text,
  dd_fast_open_capacity integer, dd_fast_open_proj_open_date date
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
    leasing.status::text,
    leasing.details,
    loi.status::text,
    dd.fast_open_capacity,
    dd.fast_open_proj_open_date
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
    SELECT
      NULLIF(s.details->'fast_open'->>'capacity','')::int        AS fast_open_capacity,
      NULLIF(s.details->'fast_open'->>'proj_open_date','')::date AS fast_open_proj_open_date
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

-- 4. get_nearby_locations — same field additions
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
  is_bridge boolean, leasing_status text, leasing_details jsonb, loi_status text,
  dd_fast_open_capacity integer, dd_fast_open_proj_open_date date
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
    leasing.status::text,
    leasing.details,
    loi.status::text,
    dd.fast_open_capacity,
    dd.fast_open_proj_open_date
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
    SELECT
      NULLIF(s.details->'fast_open'->>'capacity','')::int        AS fast_open_capacity,
      NULLIF(s.details->'fast_open'->>'proj_open_date','')::date AS fast_open_proj_open_date
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
