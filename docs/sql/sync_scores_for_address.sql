-- sync_scores_for_address: Scoped version of sync_scores_from_listings() for a single address.
-- Call via: SELECT * FROM sync_scores_for_address('401 Congress Avenue');
-- Returns: TABLE with sync count + raw upstream metrics from real_estate_listings.
-- Returns empty result set if no match found (sync count = 0).
--
-- Uses pg_trgm similarity matching to handle abbreviation differences
-- (e.g. "Avenue" vs "Ave.") and different address formats between
-- pp_locations (street only) and real_estate_listings (street + city + state + zip).

CREATE OR REPLACE FUNCTION sync_scores_for_address(target_address text)
RETURNS TABLE (
  synced_count integer,
  enrollment_score double precision,
  wealth_score double precision,
  relative_enrollment_score double precision,
  relative_wealth_score double precision,
  lease_asking_rent_general_price_average_amount numeric,
  lease_asking_rent_general_price_period text,
  space_size_available numeric,
  size_classification text,
  zoning_code text,
  lot_zoning text,
  location_county text,
  location_city text,
  location_state text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _synced_count integer := 0;
  loc_city text;
  loc_state text;
  search_text text;
  matched_listing record;
BEGIN
  -- Get city/state for the location to build a full search string
  SELECT city, state INTO loc_city, loc_state
  FROM pp_locations WHERE address = target_address LIMIT 1;

  -- Build full search text: "401 Congress Avenue Austin TX"
  search_text := target_address || ' ' || COALESCE(loc_city, '') || ' ' || COALESCE(loc_state, '');

  -- Find the best matching listing
  SELECT r.* INTO matched_listing
  FROM real_estate_listings r
  WHERE similarity(r.address, search_text) > 0.3
  ORDER BY similarity(r.address, search_text) DESC, r.overall_score DESC NULLS LAST
  LIMIT 1;

  -- If no match, return empty
  IF matched_listing IS NULL THEN
    RETURN;
  END IF;

  -- Sync scores into pp_location_scores (same as before)
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
    matched_listing.overall_score, matched_listing.overall_color, matched_listing.overall_details_url,
    matched_listing.demographics_score, matched_listing.demographics_color, matched_listing.demographics_score_details_url,
    matched_listing.price_score, matched_listing.price_color, matched_listing.price_score_details_url,
    matched_listing.zoning_score, matched_listing.zoning_color, matched_listing.zoning_score_details_url,
    matched_listing.neighborhood_score, matched_listing.neighborhood_color, matched_listing.neighborhood_score_details_url,
    matched_listing.building_score, matched_listing.building_color, matched_listing.building_score_details_url
  FROM pp_locations loc
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

  GET DIAGNOSTICS _synced_count = ROW_COUNT;

  -- Return sync count + raw upstream metrics
  RETURN QUERY SELECT
    _synced_count,
    matched_listing.enrollment_score,
    matched_listing.wealth_score,
    matched_listing.relative_enrollment_score,
    matched_listing.relative_wealth_score,
    matched_listing.lease_asking_rent_general_price_average_amount,
    matched_listing.lease_asking_rent_general_price_period,
    matched_listing.space_size_available,
    matched_listing.size_classification,
    matched_listing.zoning_code,
    matched_listing.lot_zoning,
    matched_listing.location_county,
    matched_listing.location_address_locality,
    matched_listing.location_address_region;
END;
$$;
