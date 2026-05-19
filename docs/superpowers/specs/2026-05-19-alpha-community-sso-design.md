# Alpha Community SSO — Design Spec

**Date:** 2026-05-19
**Status:** Approved (pending review)
**Driver:** Guy Harel (Alpha Community)
**Scope:** v1 — 4 Miami-area communities (Miami, Miami Beach, Palm Beach, Boca Raton). Globally enabled (trust the token).

## Goal

When a parent on `community.alpha.school` clicks through to `real-estate.alpha.school?token=<JWT>`, sign them in automatically and drop them in the right metro view. Zero email-OTP friction. The integration goes live on Alpha's side tomorrow morning (2026-05-20).

## Contract (provided by Alpha)

JWT signed ES256, verified via JWKS at `https://mstzpwibigesyzugwzcu.supabase.co/functions/v1/users/jwks.json`. Audience: `real-estate.alpha.school`. Claims:

```ts
interface AlphaUserClaims {
  sub: string;
  aud: string;          // 'real-estate.alpha.school'
  email: string;
  lat: number | null;
  lon: number | null;
  zip: string | null;
  city: string | null;
  community: string;
  enrollment_status: 'enrolled' | 'committed' | null;
}
```

Token arrives as `?token=eyJ...` on any URL. Format of the `community` string is not specified by Alpha — we resolve defensively (see "Community resolution" below).

## Architecture

Five units of work. Each isolates one concern.

### 1. `src/lib/verify-alpha-token.ts`

Thin JWT verifier per Guy's integration guide.

- Exports `verifyAlphaToken(token: string): Promise<AlphaUserClaims>`.
- Uses `jose` (`createRemoteJWKSet`, `jwtVerify`).
- Asserts `algorithms: ['ES256']`, `audience: 'real-estate.alpha.school'`.
- Throws on invalid signature / expired / wrong audience / unreachable JWKS — callers must wrap in try/catch.
- **Lazy JWKS init**: do NOT construct `new URL(process.env.ALPHA_JWKS_URL!)` at module load (would crash the route if env is missing). Instead, build the `createRemoteJWKSet` instance on first call to `verifyAlphaToken`, throw a clear `Error('ALPHA_JWKS_URL not configured')` if the env var is missing, and memoize the instance for subsequent calls.

No state beyond the memoized JWKS instance and what `createRemoteJWKSet` caches internally (default 10-min cache with key-rotation tolerance).

### 2. `src/lib/alpha-community.ts`

Community claim → active metro slug. Pure function, no I/O.

```ts
export function resolveCommunityToMetro(
  community: string | null | undefined,
  lat: number | null,
  lon: number | null
): ActiveMetro | null
```

Resolution order:

1. **Substring match on community** (case-insensitive, trimmed). Check more-specific first to avoid prefix collisions:
   - `includes("miami beach")` → `miami-beach`
   - `includes("boca")` → `boca`
   - `includes("palm beach")` → `palm-beach`
   - `includes("miami")` → `miami`
2. **Fallback to lat/lon** — if no substring match and both `lat` and `lon` are non-null, call `findActiveMetro(lat, lon)` and return whatever it resolves to (any active metro, not just Miami markets — we trust the token globally).
3. **Else `null`** — sign-in still succeeds, just no metro fly-to.

Unit-tested with the four expected community strings (plus odd casings, whitespace, and unknown-with-coords fallback).

### 3. `src/app/api/auth/alpha-sso/route.ts`

POST endpoint. Verifies the token server-side, upserts the profile, and bridges to a Supabase magic link.

**Request body:** `{ token: string }`
**Response (200):** `{ email: string; token_hash: string; metroSlug: string | null }`
**Response (401):** `{ error: 'invalid_token' }` — body unverified or claims rejected.
**Response (500):** `{ error: 'sso_failed' }` — admin SDK or DB error.

Logic:

1. `verifyAlphaToken(token)` — throws → 401.
2. `supabaseAdmin.auth.admin.listUsers` to find existing auth user by email, or `admin.createUser({email, email_confirm: true})` to provision. Capture `user.id`.
3. `pp_profiles` **fill-blanks upsert** keyed on `id`:
   - Always insert (`id`, `email`) if row absent.
   - For existing row, update only columns currently NULL:
     - `display_name` ← email prefix (`email.split('@')[0]`)
     - `home_lat` ← `claims.lat` (if non-null)
     - `home_lng` ← `claims.lon` (if non-null)
     - `home_address` ← compose from `city + state-or-zip` if both non-null (best-effort, no geocoding)
     - `alpha_community` ← `claims.community`
     - `alpha_enrollment_status` ← `claims.enrollment_status`
   - Implementation: one row read followed by one row update using JavaScript `??` on each field (`existing.home_lat ?? claims.lat`), so we write all columns at once and only fill what's currently null. Single round-trip, easy to read.
4. `supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email })` — extract `properties.hashed_token`.
5. `resolveCommunityToMetro(community, lat, lon)` → `metroSlug` (or null).
6. Return `{ email, token_hash, metroSlug }`.

Never logs raw JWT or hashed_token. Logs structured errors only.

### 4. `src/components/HomeContent.tsx` — `AlphaTokenHandler`

New client component, sibling to existing `DeepLinkHandler`. Wrapped in `<Suspense>` like its sibling.

```ts
useEffect(() => {
  const token = new URLSearchParams(window.location.search).get('token');
  if (!token) return;
  // Bail if it looks like our existing magic-link callback param (defensive: 
  // Supabase callbacks use `token_hash`, not `token` — but we guard anyway).
  if (token.length < 100) return; // JWTs are always larger; skip cleanly.

  let cancelled = false;

  (async () => {
    const res = await fetch('/api/auth/alpha-sso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (cancelled) return;

    // Strip ?token= regardless of success so it doesn't persist in URL.
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    window.history.replaceState({}, '', url.toString());

    if (!res.ok) {
      console.error('Alpha SSO failed', res.status);
      return;
    }
    const { token_hash, metroSlug } = await res.json();

    // NOTE: Supabase has historically been inconsistent between 'email' and
    // 'magiclink' for this `type` field. Confirm against the installed
    // @supabase/supabase-js version during implementation; current docs use
    // 'email' for magic-link verification.
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: 'email',
    });
    if (error) {
      console.error('verifyOtp failed', error);
      return;
    }

    if (metroSlug) {
      const metro = getActiveMetroBySlug(metroSlug);
      if (metro) {
        setFlyToTarget({ lat: metro.lat, lng: metro.lng, zoom: metro.defaultZoom });
      }
    }
  })();

  return () => { cancelled = true; };
}, []);
```

Runs on every route that mounts `HomeContent` — currently `/` (legacy), `/redesign`, and `/miami`. The handler fires wherever the user lands, so the integration works no matter which URL Alpha targets. AuthProvider's existing `onAuthStateChange` listener will detect the new session and refresh the profile.

**Recommended landing URL for Alpha:** `https://real-estate.alpha.school/miami?token=...` — this drops Miami parents straight into the curated redesign experience. If Alpha sends them to `/` instead, the integration still works but they get the legacy UI. We'll suggest `/miami` to Guy when confirming community claim strings.

### 5. DB migration — `sql/2026-05-19-alpha-sso.sql`

```sql
alter table pp_profiles
  add column if not exists alpha_community text,
  add column if not exists alpha_enrollment_status text;
```

No index needed at v1 volumes. Add an index later if admin queries filter on these columns.

## Data flow

```
community.alpha.school
    ↓  (button click → 302)
real-estate.alpha.school/?token=eyJ...
    ↓  (HomeContent mounts; AlphaTokenHandler detects ?token=)
POST /api/auth/alpha-sso { token }
    ↓  (server)
verifyAlphaToken(token)                ← ES256 + audience + expiry, JWKS-verified
upsert auth.users by email             ← admin.createUser if missing
fill-blanks pp_profiles                ← update only NULL columns
admin.generateLink({type:'magiclink', email})
    ↓
return { email, token_hash, metroSlug }
    ↓  (client)
supabase.auth.verifyOtp({token_hash, type:'email'})    ← localStorage session
    ↓
strip ?token= via history.replaceState
setFlyToTarget(metro.lat, metro.lng, metro.defaultZoom)  ← if metroSlug
```

## Environment

- `ALPHA_JWKS_URL` — `https://mstzpwibigesyzugwzcu.supabase.co/functions/v1/users/jwks.json`
- Add to `.env.local` and Vercel (Production + Preview + Development scopes).

Existing `SUPABASE_SERVICE_ROLE_KEY` is reused for the admin SDK; no new credentials.

## Security

- Signature, audience, and expiry checked server-side by `jose`. Client never sees an unverified claim.
- `hashed_token` is single-use and short-lived (~1 hour by default for Supabase magic links). It's returned to the client only because we need to complete the localStorage session handshake there. The attack surface is equivalent to a magic link Alpha could have emailed the user directly.
- We do NOT trust any field for authorization decisions. Claims only populate display/UX; authorization continues to come from the resulting Supabase session.
- Raw JWT and `hashed_token` never logged.

## Error handling

| Failure                                  | User sees           | Server logs               |
|------------------------------------------|---------------------|---------------------------|
| `?token=` missing                        | Normal anon UI      | Nothing                   |
| JWT invalid / expired / wrong audience   | Normal anon UI      | `console.error` 401       |
| JWKS endpoint unreachable                | Normal anon UI      | `console.error` 503       |
| Admin SDK / DB error                     | Normal anon UI      | `console.error` 500       |
| `verifyOtp` fails client-side            | Normal anon UI      | `console.error` (client)  |
| `community` unknown + no `lat`/`lon`     | Sign-in succeeds, no fly-to | None (expected case) |

In every error case, `?token=` is stripped from the URL so a refresh doesn't retry endlessly with a stale token.

## Testing

**Unit (Vitest):**
- `verifyAlphaToken` — valid token round-trip (with a locally-mounted JWKS mock), expired token, wrong audience, malformed token.
- `resolveCommunityToMetro` — exact match for each of the 4 expected strings, mixed casing/whitespace, unknown community with lat/lon fallback, unknown community without coords (→ null), null/undefined community.

**Manual end-to-end (after merge, before Alpha goes live):**
- Visit `/?token=<test JWT from Guy>` → verify session established, profile populated, map flown to correct metro, URL bar shows `/` (no `?token=`).
- Refresh the page → still signed in (localStorage persistence), no re-verification needed.
- Sign out → drop back to anon, no Alpha claims leaked.
- Existing profile with `display_name` already set → `display_name` preserved (fill-blanks check works).
- Invalid token → silently anon, URL cleaned.

**Skipped at v1:** Playwright e2e for the SSO flow (depends on access to a test token signer). Add in a follow-up if Guy provides a way to mint test JWTs.

## Open questions / follow-ups

- **Exact `community` string values from Alpha.** v1 handles this defensively (substring match + lat/lon fallback). After Guy confirms the strings (and once we see real tokens in logs), tighten the matcher to exact-equality if useful.
- **Landing URL.** Recommend `/miami` to Guy when we ping for community strings — better UX than `/`.
- **Test JWT for end-to-end verification.** Ask Guy for a test-signed token (or staging JWKS) we can hit before the integration flips live tomorrow morning.

## Out of scope (v1)

- Sign-out → sign back in flow (works automatically; nothing custom needed).
- Account merging if an Alpha user's email differs from an existing pp_profile email. Each unique email = separate Supabase user.
- Targeting / filtering admin UI by `alpha_community` or `alpha_enrollment_status`. Columns exist; UI comes later if needed.
- Other (non-Miami) communities. The integration accepts them globally, but only the 4 Miami slugs have curated mappings; everyone else falls back to lat/lon nearest-metro.
- Server-rendered token verification at the page level. Client-side handler is simpler and matches the pp project's existing client-rendered home page.
