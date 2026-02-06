-- Scalability Migration: 700 → 100k locations
-- Run in Supabase SQL Editor

-- ============================================================
-- 1a. Denormalize vote count onto pp_locations
-- ============================================================
ALTER TABLE pp_locations ADD COLUMN IF NOT EXISTS vote_count integer NOT NULL DEFAULT 0;

UPDATE pp_locations l
SET vote_count = (
  SELECT COUNT(*)::integer FROM pp_votes v WHERE v.location_id = l.id
);

-- ============================================================
-- 1b. Trigger to keep vote_count in sync on INSERT/DELETE
-- ============================================================
CREATE OR REPLACE FUNCTION pp_update_vote_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE pp_locations SET vote_count = vote_count + 1 WHERE id = NEW.location_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE pp_locations SET vote_count = vote_count - 1 WHERE id = OLD.location_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS pp_vote_count_trigger ON pp_votes;
CREATE TRIGGER pp_vote_count_trigger
  AFTER INSERT OR DELETE ON pp_votes
  FOR EACH ROW EXECUTE FUNCTION pp_update_vote_count();

-- ============================================================
-- 1c. Add lat/lng index for distance ordering
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pp_locations_lat_lng ON pp_locations (lat, lng);

-- ============================================================
-- 1d. City summary RPC (wide zoom — zoom < 9)
-- ============================================================
CREATE OR REPLACE FUNCTION get_location_cities()
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
  WHERE l.status = 'active'
  GROUP BY l.city, l.state;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- 1e. 500 nearest locations RPC (city zoom — zoom >= 9)
-- ============================================================
CREATE OR REPLACE FUNCTION get_nearby_locations(
  center_lat double precision,
  center_lng double precision,
  max_results integer DEFAULT 500
)
RETURNS TABLE (
  id uuid, name text, address text, city text, state text,
  lat double precision, lng double precision,
  vote_count integer, source text,
  overall_score numeric, overall_color text, overall_details_url text,
  demographics_score double precision, demographics_color text, demographics_details_url text,
  price_score double precision, price_color text, price_details_url text,
  zoning_score double precision, zoning_color text, zoning_details_url text,
  neighborhood_score double precision, neighborhood_color text, neighborhood_details_url text,
  building_score double precision, building_color text, building_details_url text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id, l.name, l.address, l.city, l.state,
    l.lat::double precision, l.lng::double precision,
    l.vote_count, l.source,
    s.overall_score, s.overall_color, s.overall_details_url,
    s.demographics_score, s.demographics_color, s.demographics_details_url,
    s.price_score, s.price_color, s.price_details_url,
    s.zoning_score, s.zoning_color, s.zoning_details_url,
    s.neighborhood_score, s.neighborhood_color, s.neighborhood_details_url,
    s.building_score, s.building_color, s.building_details_url
  FROM pp_locations l
  LEFT JOIN pp_location_scores s ON s.location_id = l.id
  WHERE l.status = 'active'
  ORDER BY (l.lat - center_lat)^2 + (l.lng - center_lng)^2
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- Verification queries (run after migration)
-- ============================================================
-- Check vote counts match:
-- SELECT id, vote_count, (SELECT count(*) FROM pp_votes WHERE location_id = pp_locations.id) as actual FROM pp_locations LIMIT 10;
--
-- Test city summaries:
-- SELECT * FROM get_location_cities();
--
-- Test nearby locations (Austin):
-- SELECT id, name, city, vote_count FROM get_nearby_locations(30.27, -97.74) LIMIT 5;
