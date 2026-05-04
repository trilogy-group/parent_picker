-- 2026-05-04 Parent Feedback Redesign — Phase 1 schema
-- Spec: docs/superpowers/specs/2026-05-04-parent-feedback-redesign-design.md

-- 1. Bridge flag on pp_locations
ALTER TABLE pp_locations
  ADD COLUMN IF NOT EXISTS is_bridge boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pp_locations_is_bridge ON pp_locations(is_bridge) WHERE is_bridge = true;

-- 2. pp_site_champions
CREATE TABLE IF NOT EXISTS pp_site_champions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES pp_locations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('lead','supporter')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  passed_to_user_id uuid REFERENCES auth.users(id),
  UNIQUE (site_id, user_id, claimed_at)
);
CREATE INDEX IF NOT EXISTS idx_pp_site_champions_site ON pp_site_champions(site_id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pp_site_champions_user ON pp_site_champions(user_id) WHERE released_at IS NULL;

-- Partial unique: only one active lead per site
CREATE UNIQUE INDEX IF NOT EXISTS idx_pp_site_champions_one_active_lead
  ON pp_site_champions(site_id)
  WHERE role = 'lead' AND released_at IS NULL;

ALTER TABLE pp_site_champions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "anyone can read champions" ON pp_site_champions
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "users can insert their own championship" ON pp_site_champions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "users can update their own championship" ON pp_site_champions
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. pp_site_problems
CREATE TABLE IF NOT EXISTS pp_site_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES pp_locations(id) ON DELETE CASCADE,
  metro text NOT NULL,
  title text NOT NULL,
  description text,
  deadline date,
  pivot_trigger boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','unresolvable')),
  outcome_text text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_pp_site_problems_site ON pp_site_problems(site_id) WHERE status IN ('open','in_progress');
CREATE INDEX IF NOT EXISTS idx_pp_site_problems_metro ON pp_site_problems(metro) WHERE status IN ('open','in_progress');
CREATE INDEX IF NOT EXISTS idx_pp_site_problems_pivot ON pp_site_problems(metro) WHERE pivot_trigger = true AND status IN ('open','in_progress');

ALTER TABLE pp_site_problems ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "anyone can read problems" ON pp_site_problems
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- INSERT/UPDATE only via service role (admin routes); no row-level write policy

-- 4. pp_problem_owners
CREATE TABLE IF NOT EXISTS pp_problem_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid NOT NULL REFERENCES pp_site_problems(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pp_problem_owners_one_active
  ON pp_problem_owners(problem_id)
  WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pp_problem_owners_user ON pp_problem_owners(user_id) WHERE released_at IS NULL;

ALTER TABLE pp_problem_owners ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "anyone can read owners" ON pp_problem_owners
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "users can claim ownership" ON pp_problem_owners
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "users can release their own ownership" ON pp_problem_owners
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. pp_problem_updates
CREATE TABLE IF NOT EXISTS pp_problem_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid NOT NULL REFERENCES pp_site_problems(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pp_problem_updates_problem ON pp_problem_updates(problem_id, created_at DESC);

ALTER TABLE pp_problem_updates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "anyone can read updates" ON pp_problem_updates
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "users can post their own updates" ON pp_problem_updates
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. pp_plan_of_record
CREATE TABLE IF NOT EXISTS pp_plan_of_record (
  metro text PRIMARY KEY,
  narrative_template_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  pivot_conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  narrative_override text,
  last_curated_at timestamptz NOT NULL DEFAULT now(),
  last_curated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE pp_plan_of_record ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "anyone can read plan" ON pp_plan_of_record
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- INSERT/UPDATE only via service role (admin routes)

-- ============================================================
-- View + RPC updates: expose is_bridge, leasing/loi status, and
-- leasing details to the location fetchers used by the panel/map.
-- ============================================================

-- 7. pp_locations_with_votes — add is_bridge + leasing/loi/leasing_details
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
    CASE WHEN r.site_id IS NOT NULL THEN 'https://rebl3.vercel.app/site/' || r.site_id ELSE NULL END AS overall_details_url,
    pp_judgment_color(r.dim_cost) AS price_color,
    pp_judgment_color(r.dim_zoning) AS zoning_color,
    pp_judgment_color(r.dim_neighborhood) AS neighborhood_color,
    pp_judgment_color(r.dim_building) AS building_color,
    r.school_size_category AS size_classification,
    l.proposed,
    l.rebl3_site_id AS property_source_key,
    l.is_bridge,
    l.feedback_deadline,
    leasing.status AS leasing_status,
    leasing.details AS leasing_details,
    loi.status AS loi_status
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
WHERE l.status = 'active';

-- 8. get_locations_in_bounds — return new columns
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
  overall_color text, overall_details_url text,
  price_color text, zoning_color text, neighborhood_color text, play_area_color text, building_color text,
  school_size_category text, capacity integer,
  proposed boolean, property_source_key text, feedback_deadline timestamp with time zone,
  is_bridge boolean, leasing_status text, leasing_details jsonb, loi_status text
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
    loi.status::text
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
  WHERE l.status = 'active'
    AND (NOT released_only OR l.released = true OR l.proposed = true)
    AND COALESCE(r.lat, l.lat::double precision) BETWEEN min_lat AND max_lat
    AND COALESCE(r.lng, l.lng::double precision) BETWEEN min_lng AND max_lng;
END;
$function$;

-- 9. get_nearby_locations — return new columns
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
  overall_color text, overall_details_url text,
  price_color text, zoning_color text, neighborhood_color text, play_area_color text, building_color text,
  school_size_category text, capacity integer,
  property_source_key text, feedback_deadline timestamp with time zone,
  is_bridge boolean, leasing_status text, leasing_details jsonb, loi_status text
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
    loi.status::text
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
  WHERE l.status = 'active'
    AND (NOT released_only OR l.released = true)
  ORDER BY (COALESCE(r.lat, l.lat::double precision) - center_lat)^2
         + (COALESCE(r.lng, l.lng::double precision) - center_lng)^2
  LIMIT max_results;
END;
$function$;
