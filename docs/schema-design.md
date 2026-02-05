# Parent Picker - Supabase Schema Design

## Overview

Database schema for persistent storage of locations, votes, and user-suggested locations. Designed for Supabase (Postgres).

**Namespace:** All tables prefixed with `pp_` to coexist with existing Stratos/RE tables in the same project.

**Existing tables (read-only access potential):**
- `real_estate_listings` — scored RE listings (could surface high-scoring ones)
- `enrollment_score_cache`, `wealth_score_cache` — demographic scoring data
- `alpha_schools` — existing Alpha locations

---

## Tables

### 1. `pp_locations`

Pre-scored locations sourced by the real estate team, plus parent-suggested locations pending review.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique identifier |
| `name` | `text` | NOT NULL | Display name (e.g., "Downtown Austin Campus") |
| `address` | `text` | NOT NULL | Street address |
| `city` | `text` | NOT NULL | City |
| `state` | `text` | NOT NULL | 2-letter state code |
| `lat` | `numeric(10,7)` | NOT NULL | Latitude |
| `lng` | `numeric(10,7)` | NOT NULL | Longitude |
| `status` | `text` | NOT NULL, default `'active'` | `active`, `pending_review`, `rejected`, `archived` |
| `source` | `text` | NOT NULL, default `'internal'` | `internal` (RE team) or `parent_suggested` |
| `score` | `integer` | NULL | Location score (0-100), NULL if not yet scored |
| `notes` | `text` | NULL | Internal notes or parent submission notes |
| `suggested_by` | `uuid` | FK → auth.users, NULL | User who suggested (NULL for internal) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Last update timestamp |

**Indexes:**
- `idx_pp_locations_status` on `(status)` — filter active locations
- `idx_pp_locations_city_state` on `(city, state)` — geographic filtering

---

### 2. `pp_votes`

One row per user-location vote. Prevents duplicate votes and enables analytics.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique identifier |
| `location_id` | `uuid` | FK → pp_locations, NOT NULL | Location voted for |
| `user_id` | `uuid` | FK → auth.users, NOT NULL | User who voted |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Vote timestamp |

**Constraints:**
- `pp_unique_vote` UNIQUE on `(location_id, user_id)` — one vote per user per location

**Indexes:**
- `idx_pp_votes_location` on `(location_id)` — count votes per location
- `idx_pp_votes_user` on `(user_id)` — get user's votes

---

### 3. `pp_profiles` (extends Supabase auth.users)

Public user profile data for Parent Picker. Auto-created on signup via trigger.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, FK → auth.users | User ID (matches auth.users) |
| `email` | `text` | NOT NULL | User email (denormalized for convenience) |
| `display_name` | `text` | NULL | Optional display name |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Profile creation |

---

## Views

### `pp_locations_with_votes`

Computed view joining locations with vote counts. Used by the frontend.

```sql
CREATE VIEW pp_locations_with_votes AS
SELECT
  l.*,
  COALESCE(COUNT(v.id), 0)::integer AS votes
FROM pp_locations l
LEFT JOIN pp_votes v ON v.location_id = l.id
WHERE l.status = 'active'
GROUP BY l.id;
```

---

## Row-Level Security (RLS)

### `pp_locations`
| Policy | Rule |
|--------|------|
| Select | Anyone can read `status = 'active'` locations |
| Insert | Authenticated users can insert with `source = 'parent_suggested'`, `status = 'pending_review'` |
| Update/Delete | None (admin only via service role) |

### `pp_votes`
| Policy | Rule |
|--------|------|
| Select | Users can read their own votes |
| Insert | Authenticated users can insert where `user_id = auth.uid()` |
| Delete | Users can delete their own votes (unvote) |

### `pp_profiles`
| Policy | Rule |
|--------|------|
| Select | Anyone can read |
| Update | Users can update their own profile |

---

## Authentication

Using existing Supabase Auth setup (shared `auth.users` table with Stratos app):
- **Magic link (email)** — passwordless, low friction
- Optional: Google OAuth for faster signup

No anonymous voting — auth required to:
1. Prevent ballot stuffing
2. Enable "my votes" feature
3. Track who suggested locations

**Note:** Users who already have accounts in the Stratos app will be able to use the same login for Parent Picker.

---

## Migration Path

### Phase 1: Read-only locations
1. Create `pp_locations` table
2. Seed with current mock data
3. Update `getLocations()` to query Supabase
4. No auth required yet — votes still in-memory

### Phase 2: Persistent votes
1. Create `pp_votes` table + `pp_profiles` table
2. Add Supabase Auth (magic link) — shares auth.users with existing app
3. Update voting to persist to DB
4. Add "my votes" indicator

### Phase 3: Parent suggestions
1. Enable insert RLS on `pp_locations`
2. Update `suggestLocation()` to insert to DB
3. Add geocoding (Mapbox API) for suggested addresses
4. Admin review workflow (manual or Supabase dashboard)

### Phase 4: Scoring integration (future)
1. Add scoring workflow trigger (could leverage existing `enrollment_score_cache`, `wealth_score_cache`)
2. Surface low-score locations for parent help
3. Admin tools for location management

---

## Open Questions

1. **Anonymous browsing?** — Should unauthenticated users see locations/votes, just not vote themselves? (Recommend: yes)

2. **Vote visibility?** — Should users see who else voted, or just counts? (Recommend: counts only)

3. **Geocoding provider?** — Mapbox (already have token) or Supabase's PostGIS + external geocoder?

4. **Scoring system?** — What triggers scoring? What's the 0-100 scale based on? Could leverage existing `enrollment_score_cache` and `wealth_score_cache` tables.

5. **Cross-app data?** — Should Parent Picker surface high-scoring locations from `real_estate_listings`? Or keep data completely separate?

---

## SQL Setup Script

```sql
-- Enable UUID extension (likely already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Locations table
CREATE TABLE pp_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  lat numeric(10,7) NOT NULL,
  lng numeric(10,7) NOT NULL,
  status text NOT NULL DEFAULT 'active',
  source text NOT NULL DEFAULT 'internal',
  score integer,
  notes text,
  suggested_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Votes table
CREATE TABLE pp_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES pp_locations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pp_unique_vote UNIQUE(location_id, user_id)
);

-- Profiles table
CREATE TABLE pp_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_pp_locations_status ON pp_locations(status);
CREATE INDEX idx_pp_locations_city_state ON pp_locations(city, state);
CREATE INDEX idx_pp_votes_location ON pp_votes(location_id);
CREATE INDEX idx_pp_votes_user ON pp_votes(user_id);

-- View
CREATE VIEW pp_locations_with_votes AS
SELECT
  l.*,
  COALESCE(COUNT(v.id), 0)::integer AS votes
FROM pp_locations l
LEFT JOIN pp_votes v ON v.location_id = l.id
WHERE l.status = 'active'
GROUP BY l.id;

-- Auto-create profile on signup (pp-specific trigger)
CREATE OR REPLACE FUNCTION pp_handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO pp_profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER pp_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION pp_handle_new_user();

-- RLS
ALTER TABLE pp_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pp_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pp_profiles ENABLE ROW LEVEL SECURITY;

-- Locations policies
CREATE POLICY "pp_anyone_can_view_active_locations"
  ON pp_locations FOR SELECT
  USING (status = 'active');

CREATE POLICY "pp_authenticated_users_can_suggest"
  ON pp_locations FOR INSERT
  TO authenticated
  WITH CHECK (source = 'parent_suggested' AND status = 'pending_review');

-- Votes policies
CREATE POLICY "pp_users_can_view_own_votes"
  ON pp_votes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "pp_users_can_insert_own_votes"
  ON pp_votes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "pp_users_can_delete_own_votes"
  ON pp_votes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Profiles policies
CREATE POLICY "pp_anyone_can_view_profiles"
  ON pp_profiles FOR SELECT
  USING (true);

CREATE POLICY "pp_users_can_update_own_profile"
  ON pp_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());
```

---

## Seed Data

```sql
INSERT INTO pp_locations (name, address, city, state, lat, lng, status, source) VALUES
  ('Downtown Austin Campus', '401 Congress Ave', 'Austin', 'TX', 30.2672, -97.7431, 'active', 'internal'),
  ('Westlake Hills Location', '3425 Bee Cave Rd', 'Austin', 'TX', 30.2969, -97.8014, 'active', 'internal'),
  ('Round Rock Site', '201 E Main St', 'Round Rock', 'TX', 30.5083, -97.6789, 'active', 'internal'),
  ('Cedar Park Campus', '500 Discovery Blvd', 'Cedar Park', 'TX', 30.5052, -97.8203, 'active', 'internal'),
  ('South Congress Location', '1619 S Congress Ave', 'Austin', 'TX', 30.2449, -97.7494, 'active', 'internal'),
  ('Mueller Development', '4550 Mueller Blvd', 'Austin', 'TX', 30.2984, -97.7048, 'active', 'internal'),
  ('Lakeway Center', '103 Main St', 'Lakeway', 'TX', 30.3628, -97.9797, 'active', 'internal'),
  ('Pflugerville Campus', '201 E Pecan St', 'Pflugerville', 'TX', 30.4394, -97.6201, 'active', 'internal');
```
