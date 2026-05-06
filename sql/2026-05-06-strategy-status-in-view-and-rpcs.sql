-- 2026-05-06: Expose rebl3_status[system='strategy'] to the panel/UI.
--
-- Why: REBL signals "killed" via strategy='kill', but the panel-side stage
-- derivation only sees leasing/loi. A site like Southgate (loi=done,
-- leasing=ready, strategy=kill) was rendering as engaged AI when it should
-- be moved_on. This migration adds strategy_status to the view + both
-- bounding/nearby RPCs so the client can derive moved_on from strategy=kill.

-- View
CREATE OR REPLACE VIEW public.pp_locations_with_votes AS
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
    CASE
        WHEN r.site_id IS NOT NULL THEN 'https://rebl3.vercel.app/site/'::text || r.site_id
        ELSE NULL::text
    END AS overall_details_url,
    pp_judgment_color(r.dim_cost) AS price_color,
    pp_judgment_color(r.dim_zoning) AS zoning_color,
    pp_judgment_color(r.dim_neighborhood) AS neighborhood_color,
    pp_judgment_color(r.dim_building) AS building_color,
    r.school_size_category AS size_classification,
    l.proposed,
    l.rebl3_site_id AS property_source_key,
    l.is_bridge,
    l.feedback_deadline,
    leasing_status.status AS leasing_status,
    leasing_status.details AS leasing_details,
    loi_status.status AS loi_status,
    strategy_status.status AS strategy_status
FROM pp_locations l
LEFT JOIN rebl3_sites r ON r.site_id = l.rebl3_site_id
LEFT JOIN LATERAL (
    SELECT s.status, s.details
    FROM rebl3_status s
    WHERE s.site_id = l.rebl3_site_id AND s.system = 'leasing'::text
    ORDER BY s.updated_at DESC NULLS LAST
    LIMIT 1
) leasing_status ON true
LEFT JOIN LATERAL (
    SELECT s.status
    FROM rebl3_status s
    WHERE s.site_id = l.rebl3_site_id AND s.system = 'loi'::text
    ORDER BY s.updated_at DESC NULLS LAST
    LIMIT 1
) loi_status ON true
LEFT JOIN LATERAL (
    SELECT s.status
    FROM rebl3_status s
    WHERE s.site_id = l.rebl3_site_id AND s.system = 'strategy'::text
    ORDER BY s.updated_at DESC NULLS LAST
    LIMIT 1
) strategy_status ON true
WHERE l.status = 'active'::text;

-- get_locations_in_bounds — DROP+CREATE because return type changes
DROP FUNCTION IF EXISTS public.get_locations_in_bounds(double precision, double precision, double precision, double precision, boolean);

CREATE OR REPLACE FUNCTION public.get_locations_in_bounds(
    min_lat double precision,
    max_lat double precision,
    min_lng double precision,
    max_lng double precision,
    released_only boolean DEFAULT false
) RETURNS TABLE(
    id uuid,
    name text,
    address text,
    city text,
    state text,
    zip text,
    lat double precision,
    lng double precision,
    vote_count integer,
    not_here_count integer,
    source text,
    released boolean,
    overall_color text,
    overall_details_url text,
    price_color text,
    zoning_color text,
    neighborhood_color text,
    play_area_color text,
    building_color text,
    school_size_category text,
    capacity integer,
    proposed boolean,
    property_source_key text,
    feedback_deadline timestamp with time zone,
    is_bridge boolean,
    leasing_status text,
    leasing_details jsonb,
    loi_status text,
    strategy_status text
)
LANGUAGE plpgsql
AS $function$
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
        strategy.status::text
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
    ) strategy ON true
    WHERE l.status = 'active'
        AND (NOT released_only OR l.released = true OR l.proposed = true)
        AND COALESCE(r.lat, l.lat::double precision) BETWEEN min_lat AND max_lat
        AND COALESCE(r.lng, l.lng::double precision) BETWEEN min_lng AND max_lng;
END;
$function$;

-- get_nearby_locations — DROP+CREATE because return type changes
DROP FUNCTION IF EXISTS public.get_nearby_locations(double precision, double precision, integer, boolean);

CREATE OR REPLACE FUNCTION public.get_nearby_locations(
    center_lat double precision,
    center_lng double precision,
    max_results integer DEFAULT 50,
    released_only boolean DEFAULT false
) RETURNS TABLE(
    id uuid,
    name text,
    address text,
    city text,
    state text,
    zip text,
    lat double precision,
    lng double precision,
    vote_count integer,
    not_here_count integer,
    source text,
    released boolean,
    overall_color text,
    overall_details_url text,
    price_color text,
    zoning_color text,
    neighborhood_color text,
    play_area_color text,
    building_color text,
    school_size_category text,
    capacity integer,
    property_source_key text,
    feedback_deadline timestamp with time zone,
    is_bridge boolean,
    leasing_status text,
    leasing_details jsonb,
    loi_status text,
    strategy_status text
)
LANGUAGE plpgsql
AS $function$
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
        strategy.status::text
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
    ) strategy ON true
    WHERE l.status = 'active'
        AND (NOT released_only OR l.released = true)
    ORDER BY (COALESCE(r.lat, l.lat::double precision) - center_lat)^2
        + (COALESCE(r.lng, l.lng::double precision) - center_lng)^2
    LIMIT max_results;
END;
$function$;
