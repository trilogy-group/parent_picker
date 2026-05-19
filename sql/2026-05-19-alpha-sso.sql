-- Alpha Community SSO: capture which Alpha community/cohort the parent belongs to,
-- plus their Alpha-side user id for future cross-referencing.
-- Filled (blanks-only) by /api/auth/alpha-sso on token exchange.
alter table pp_profiles
  add column if not exists alpha_user_profile_id text,
  add column if not exists alpha_community text,
  add column if not exists alpha_enrollment_status text;

-- alpha_enrollment_status is one of: 'enrolled', 'committed', or null
-- (per Alpha's get-real-estate-info response contract).
