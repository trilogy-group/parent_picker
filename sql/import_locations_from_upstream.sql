-- import_locations_from_upstream(city_names, state_code)
-- Imports new locations from real_estate_listings into pp_locations.
-- Skips addresses already in pp_locations. Calls sync_scores_from_listings() after.
-- Returns count of new rows inserted.
--
-- Usage:
--   SELECT import_locations_from_upstream(ARRAY['Boca Raton'], 'FL');
--   SELECT import_locations_from_upstream(ARRAY['New York'], 'NY');
--
-- NOTE: Uses `address` column (100% populated), NOT `property_standardized_address` (~11%).

CREATE OR REPLACE FUNCTION import_locations_from_upstream(
  city_names text[],
  state_code text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count integer;
BEGIN
  -- Insert distinct locations from real_estate_listings that don't already exist in pp_locations.
  -- DISTINCT ON (address) picks one row per unique address.
  WITH new_locations AS (
    INSERT INTO pp_locations (
      name,
      address,
      city,
      state,
      lat,
      lng,
      status,
      source
    )
    SELECT
      COALESCE(r.property_name, r.address),
      r.address,
      r.location_address_locality,
      r.location_address_region,
      r.location_geopoint_latitude,
      r.location_geopoint_longitude,
      'active',
      'upstream'
    FROM (
      SELECT DISTINCT ON (address)
        *
      FROM real_estate_listings
      WHERE location_address_locality = ANY(city_names)
        AND location_address_region = state_code
        AND location_geopoint_latitude IS NOT NULL
        AND location_geopoint_longitude IS NOT NULL
        AND address IS NOT NULL
      ORDER BY address, overall_score DESC NULLS LAST
    ) r
    WHERE NOT EXISTS (
      SELECT 1 FROM pp_locations p
      WHERE p.address = r.address
        AND p.city = r.location_address_locality
        AND p.state = r.location_address_region
    )
    RETURNING id
  )
  SELECT count(*) INTO inserted_count FROM new_locations;

  -- Sync scores for all locations (including newly imported ones)
  PERFORM sync_scores_from_listings();

  RETURN inserted_count;
END;
$$;
