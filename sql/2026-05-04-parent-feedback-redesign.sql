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
