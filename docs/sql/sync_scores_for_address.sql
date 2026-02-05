-- sync_scores_for_address: Scoped version of sync_scores_from_listings() for a single address.
-- Call via: SELECT sync_scores_for_address('401 Congress Avenue');
-- Returns: count of rows synced (0 or 1)
--
-- Uses pg_trgm similarity matching to handle abbreviation differences
-- (e.g. "Avenue" vs "Ave.") and different address formats between
-- pp_locations (street only) and real_estate_listings (street + city + state + zip).

CREATE OR REPLACE FUNCTION sync_scores_for_address(target_address text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  synced_count integer := 0;
  loc_city text;
  loc_state text;
  search_text text;
BEGIN
  -- Get city/state for the location to build a full search string
  SELECT city, state INTO loc_city, loc_state
  FROM pp_locations WHERE address = target_address LIMIT 1;

  -- Build full search text: "401 Congress Avenue Austin TX"
  search_text := target_address || ' ' || COALESCE(loc_city, '') || ' ' || COALESCE(loc_state, '');

  INSERT INTO pp_location_scores (
    location_id,
    overall_score, overall_color, overall_details_url,
    demographics_score, demographics_color, demographics_details_url,
    price_score, price_color, price_details_url,
    zoning_score, zoning_color, zoning_details_url,
    neighborhood_score, neighborhood_color, neighborhood_details_url,
    building_score, building_color, building_details_url
  )
  SELECT
    loc.id,
    rel.overall_score, rel.overall_color, rel.overall_details_url,
    rel.demographics_score, rel.demographics_color, rel.demographics_score_details_url,
    rel.price_score, rel.price_color, rel.price_score_details_url,
    rel.zoning_score, rel.zoning_color, rel.zoning_score_details_url,
    rel.neighborhood_score, rel.neighborhood_color, rel.neighborhood_score_details_url,
    rel.building_score, rel.building_color, rel.building_score_details_url
  FROM pp_locations loc
  JOIN LATERAL (
    SELECT *
    FROM real_estate_listings r
    WHERE similarity(r.address, search_text) > 0.3
    ORDER BY similarity(r.address, search_text) DESC, r.overall_score DESC NULLS LAST
    LIMIT 1
  ) rel ON true
  WHERE loc.address = target_address
  ON CONFLICT (location_id) DO UPDATE SET
    overall_score = EXCLUDED.overall_score,
    overall_color = EXCLUDED.overall_color,
    overall_details_url = EXCLUDED.overall_details_url,
    demographics_score = EXCLUDED.demographics_score,
    demographics_color = EXCLUDED.demographics_color,
    demographics_details_url = EXCLUDED.demographics_details_url,
    price_score = EXCLUDED.price_score,
    price_color = EXCLUDED.price_color,
    price_details_url = EXCLUDED.price_details_url,
    zoning_score = EXCLUDED.zoning_score,
    zoning_color = EXCLUDED.zoning_color,
    zoning_details_url = EXCLUDED.zoning_details_url,
    neighborhood_score = EXCLUDED.neighborhood_score,
    neighborhood_color = EXCLUDED.neighborhood_color,
    neighborhood_details_url = EXCLUDED.neighborhood_details_url,
    building_score = EXCLUDED.building_score,
    building_color = EXCLUDED.building_color,
    building_details_url = EXCLUDED.building_details_url;

  GET DIAGNOSTICS synced_count = ROW_COUNT;
  RETURN synced_count;
END;
$$;
