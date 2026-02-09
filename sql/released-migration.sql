-- Released Location Migration
-- Adds `released` column to pp_locations to control public visibility
-- Run in Supabase SQL Editor

-- ============================================================
-- 1. Add released column
-- ============================================================
ALTER TABLE pp_locations ADD COLUMN IF NOT EXISTS released boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. Release Austin area locations
-- ============================================================
UPDATE pp_locations SET released = true
WHERE state = 'TX' AND city IN (
  'Austin', 'Round Rock', 'Cedar Park', 'Georgetown', 'Pflugerville',
  'Leander', 'Kyle', 'Buda', 'San Marcos', 'Lakeway', 'Bee Cave',
  'West Lake Hills', 'Dripping Springs', 'Manor', 'Hutto'
);

-- ============================================================
-- 3. Release Palo Alto / Silicon Valley area locations
-- ============================================================
UPDATE pp_locations SET released = true
WHERE state = 'CA' AND city IN (
  'Palo Alto', 'Menlo Park', 'Mountain View', 'Sunnyvale', 'Cupertino',
  'Los Altos', 'Los Altos Hills', 'Stanford', 'Redwood City', 'Atherton',
  'Woodside', 'Portola Valley', 'East Palo Alto', 'San Carlos', 'Belmont',
  'Foster City', 'San Mateo', 'Santa Clara', 'San Jose', 'Milpitas',
  'Fremont', 'Campbell', 'Saratoga', 'Los Gatos'
);

-- ============================================================
-- 4. Release Boca Raton / Palm Beach area locations
-- ============================================================
UPDATE pp_locations SET released = true
WHERE state = 'FL' AND city IN (
  'Boca Raton', 'West Palm Beach', 'Palm Beach', 'Palm Beach Gardens',
  'Jupiter', 'Delray Beach', 'Boynton Beach', 'Lake Worth Beach',
  'Lake Worth', 'Riviera Beach', 'North Palm Beach', 'Lantana',
  'Greenacres', 'Palm Springs', 'Royal Palm Beach', 'Wellington',
  'Tequesta', 'Juno Beach', 'Singer Island', 'Palm Beach Shores',
  'Highland Beach', 'Gulf Stream'
);

-- ============================================================
-- 5. Update get_location_cities() to support released_only filter
-- ============================================================
CREATE OR REPLACE FUNCTION get_location_cities(
  released_only boolean DEFAULT false,
  exclude_red boolean DEFAULT false
)
RETURNS TABLE (
  city text, state text,
  lat double precision, lng double precision,
  location_count integer, total_votes integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.city, l.state,
    AVG(l.lat)::double precision, AVG(l.lng)::double precision,
    COUNT(*)::integer, SUM(l.vote_count)::integer
  FROM pp_locations l
  LEFT JOIN pp_location_scores s ON s.location_id = l.id
  WHERE l.status = 'active'
    AND (NOT released_only OR l.released = true)
    AND (NOT exclude_red OR (
      COALESCE(s.overall_color, '') != 'RED'
      AND COALESCE(s.size_classification, '') != 'Red (Reject)'
    ))
  GROUP BY l.city, l.state;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- 6. Update get_nearby_locations() to return released field
--    and support released_only filter
-- ============================================================
CREATE OR REPLACE FUNCTION get_nearby_locations(
  center_lat double precision,
  center_lng double precision,
  max_results integer DEFAULT 500,
  released_only boolean DEFAULT false
)
RETURNS TABLE (
  id uuid, name text, address text, city text, state text,
  lat double precision, lng double precision,
  vote_count integer, source text, released boolean,
  overall_score numeric, overall_color text, overall_details_url text,
  demographics_score double precision, demographics_color text, demographics_details_url text,
  price_score double precision, price_color text, price_details_url text,
  zoning_score double precision, zoning_color text, zoning_details_url text,
  neighborhood_score double precision, neighborhood_color text, neighborhood_details_url text,
  building_score double precision, building_color text, building_details_url text,
  size_classification text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id, l.name, l.address, l.city, l.state,
    l.lat::double precision, l.lng::double precision,
    l.vote_count, l.source, l.released,
    s.overall_score, s.overall_color, s.overall_details_url,
    s.demographics_score, s.demographics_color, s.demographics_details_url,
    s.price_score, s.price_color, s.price_details_url,
    s.zoning_score, s.zoning_color, s.zoning_details_url,
    s.neighborhood_score, s.neighborhood_color, s.neighborhood_details_url,
    s.building_score, s.building_color, s.building_details_url,
    s.size_classification
  FROM pp_locations l
  LEFT JOIN pp_location_scores s ON s.location_id = l.id
  WHERE l.status = 'active'
    AND (NOT released_only OR l.released = true)
  ORDER BY (l.lat - center_lat)^2 + (l.lng - center_lng)^2
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- Verification queries
-- ============================================================
-- Check released counts:
-- SELECT released, COUNT(*) FROM pp_locations WHERE status = 'active' GROUP BY released;
--
-- Check released by metro:
-- SELECT city, state, COUNT(*) FROM pp_locations WHERE released = true GROUP BY city, state ORDER BY COUNT(*) DESC;
--
-- Test filtered city summaries:
-- SELECT * FROM get_location_cities(true);
--
-- Test filtered nearby:
-- SELECT id, name, city, released FROM get_nearby_locations(30.27, -97.74, 10, true);
