# Alpha Community SSO — Design Spec

**Date:** 2026-05-19
**Status:** Approved (pending review)
**Driver:** Guy Harel (Alpha Community)
**Scope:** v1 — 4 Miami-area communities (Miami, Miami Beach, Palm Beach, Boca Raton). Globally enabled (trust the token).

## Goal

When a parent on `community.alpha.school` clicks through to `real-estate.alpha.school?token=<JWT>`, sign them in automatically and drop them in the right metro view. Zero email-OTP friction. The integration goes live on Alpha's side tomorrow morning (2026-05-20).

## Contract (provided by Alpha)

**Revised 2026-05-19 PM** after Guy ran a security audit. We **do not decode the JWT ourselves** — we exchange it with Alpha for structured user info.

**Exchange endpoint:**

```
POST https://mstzpwibigesyzugwzcu.supabase.co/functions/v1/users/get-real-estate-info
Body: { "token": "<the token from the URL>" }
```

**Success (200):**

```ts
interface AlphaUserInfo {
  user_profile_id: string;
  email: string;
  name: string;
  community: string;
  lat: number | null;
  lon: number | null;
  city: string | null;
  zip: string | null;
  enrollment_status: 'enrolled' | 'committed' | null;
}
```

**Error (401):** `{ error: "<code>", message: "<human-readable>" }` with one of these codes:

| Code                 | Meaning                                                |
|----------------------|--------------------------------------------------------|
| `token_expired`      | Token TTL (1h) elapsed; user should re-click the CTA   |
| `invalid_signature`  | Token tampered or signed by a different key            |
| `invalid_key`        | Token `kid` doesn't match the server's signing key     |
| `invalid_audience`   | Token minted for a different service                   |
| `invalid_claims`     | Token missing required fields                          |
| `invalid_token`      | Malformed (not a valid JWT)                            |

**Token TTL:** 1 hour. Persist user info to `pp_profiles` after first exchange — don't re-hit the exchange endpoint on every request.

Token arrives as `?token=eyJ...` on any URL. Format of the `community` string is not specified by Alpha — we resolve defensively (see "Community resolution" below).

## Architecture

Five units of work. Each isolates one concern.

### 1. `src/lib/exchange-alpha-token.ts`

Thin wrapper around Alpha's exchange endpoint.

- Exports `exchangeAlphaToken(token: string): Promise<AlphaUserInfo>`.
- POSTs `{ token }` to `${ALPHA_FUNCTIONS_URL}/users/get-real-estate-info`.
- On non-200: throws `Error` whose `message` includes Alpha's error `code` (e.g. `'token_expired'`) and HTTP status — callers wrap in try/catch and log the code so we can distinguish "user's token expired" from "something is broken".
- On network failure: re-throws the underlying error.
- Throws a clear `Error('ALPHA_FUNCTIONS_URL not configured')` if the env var is missing.
- No state, no caching — the route handler is the persistence layer.

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

POST endpoint. Exchanges the Alpha token for user info, upserts the profile, and bridges to a Supabase magic link.

**Request body:** `{ token: string }`
**Response (200):** `{ email: string; token_hash: string; metroSlug: string | null }`
**Response (401):** `{ error: 'invalid_token' | 'token_expired' }` — Alpha's exchange endpoint rejected the token.
**Response (500):** `{ error: 'sso_failed' }` — admin SDK or DB error.

Logic:

1. `exchangeAlphaToken(token)` — throws → 401 with the Alpha error code (preserve `token_expired` vs other codes so the client can show a "please re-click the button on community.alpha.school" message if useful later).
2. Look up existing `pp_profiles` row by `email`. If found, use its `id` as `userId` (fast path for return visits).
3. Else: `supabaseAdmin.auth.admin.createUser({ email, email_confirm: true })` to provision a new auth user. If that fails with "already registered" (orphan auth user without a profile), fall back to `admin.auth.admin.listUsers` and filter by email.
4. `pp_profiles` **fill-blanks upsert** keyed on `id`:
   - Always insert (`id`, `email`) if row absent.
   - For existing row, update only columns currently NULL:
     - `display_name` ← `info.name` ?? `email.split('@')[0]`
     - `home_lat` ← `info.lat`
     - `home_lng` ← `info.lon`
     - `home_address` ← compose from `city + zip` if either non-null
     - `alpha_user_profile_id` ← `info.user_profile_id`
     - `alpha_community` ← `info.community`
     - `alpha_enrollment_status` ← `info.enrollment_status`
   - Implementation: one row read followed by one row update using JavaScript `??` on each field (`existing.home_lat ?? info.lat`), so we write all columns at once and only fill what's currently null. Single round-trip, easy to read.
5. `supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email })` — extract `properties.hashed_token`.
6. `resolveCommunityToMetro(community, lat, lon)` → `metroSlug` (or null).
7. Return `{ email, token_hash, metroSlug }`.

Never logs the raw token or `hashed_token`. Logs structured errors only.

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
  add column if not exists alpha_user_profile_id text,
  add column if not exists alpha_community text,
  add column if not exists alpha_enrollment_status text;
```

No index needed at v1 volumes. Add an index on `alpha_user_profile_id` later if admin queries need cross-referencing back to Alpha.

## Data flow

```
community.alpha.school
    ↓  (button click → 302)
real-estate.alpha.school/?token=eyJ...
    ↓  (HomeContent mounts; AlphaTokenHandler detects ?token=)
POST /api/auth/alpha-sso { token }
    ↓  (our server)
exchangeAlphaToken(token)              ← POST to Alpha's /users/get-real-estate-info
    ↓ returns AlphaUserInfo
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

- `ALPHA_FUNCTIONS_URL` — `https://mstzpwibigesyzugwzcu.supabase.co/functions/v1`
- Add to `.env.local` and Vercel (Production + Preview + Development scopes).

Existing `SUPABASE_SERVICE_ROLE_KEY` is reused for the admin SDK; no new credentials.

## Security

- Token verification is performed by Alpha's exchange endpoint (signed under their control). We never see the JWT internals.
- All exchanges happen server-side from our API route — the browser never calls Alpha's exchange endpoint directly, which keeps the integration agnostic of CORS on Alpha's side and avoids leaking the token through client logs.
- `hashed_token` is single-use and short-lived (~1 hour by default for Supabase magic links). It's returned to the client only because we need to complete the localStorage session handshake there. The attack surface is equivalent to a magic link Alpha could have emailed the user directly.
- We do NOT trust any field returned from Alpha for authorization decisions. The info only populates display/UX; authorization continues to come from the resulting Supabase session.
- Raw token and `hashed_token` never logged.

## Error handling

| Failure                                              | User sees                  | Server logs                                  |
|------------------------------------------------------|----------------------------|----------------------------------------------|
| `?token=` missing                                    | Normal anon UI             | Nothing                                      |
| Alpha returns 401 with any code (`token_expired`, `invalid_signature`, etc.) | Normal anon UI | `console.error` with the Alpha error code     |
| Alpha endpoint unreachable / non-401 / non-200       | Normal anon UI             | `console.error` with HTTP status             |
| Admin SDK / DB error                                 | Normal anon UI             | `console.error` 500                          |
| `verifyOtp` fails client-side                        | Normal anon UI             | `console.error` (client)                     |
| `community` unknown + no `lat`/`lon`                 | Sign-in succeeds, no fly-to | None (expected case)                         |

In every error case, `?token=` is stripped from the URL so a refresh doesn't retry endlessly with a stale token.

## Testing

**Unit (Vitest):**
- `exchangeAlphaToken` — happy path returns parsed `AlphaUserInfo`; 401 with `token_expired` raises an error whose message contains the code; 401 with other codes raises distinguishable errors; network failure surfaces underlying error; missing env var throws a clear configuration error.
- `resolveCommunityToMetro` — exact match for each of the 4 expected strings, mixed casing/whitespace, substring match, unknown community with lat/lon fallback, unknown community without coords (→ null), null/undefined/empty community.

**Manual end-to-end (after Alpha is live):**
- Visit `/?token=<token from Guy or by joining a Miami campus on community.alpha.school>` → verify session established, profile populated, map flown to correct metro, URL bar shows `/` (no `?token=`).
- Refresh the page → still signed in (localStorage persistence), no re-exchange needed.
- Sign out → drop back to anon, no Alpha info leaked.
- Existing profile with `display_name` already set → `display_name` preserved (fill-blanks check works).
- Invalid token / expired token → silently anon, URL cleaned, server log shows the Alpha error code.

**Skipped at v1:** Playwright e2e for the SSO flow (depends on test tokens from Alpha). Add in a follow-up if Guy provides a way to mint test tokens.

## Open questions / follow-ups

- **Exact `community` string values from Alpha.** v1 handles this defensively (substring match + lat/lon fallback). After Guy confirms the strings (and once we see real tokens in logs), tighten the matcher to exact-equality if useful.
- **Landing URL.** Recommend `/miami` to Guy when we ping for community strings — better UX than `/`.
- **Test token for end-to-end verification.** Ask Guy for a token we can run through the exchange endpoint before going live tomorrow morning, or sign in on `community.alpha.school` ourselves once a Miami campus is joinable.

## Out of scope (v1)

- Sign-out → sign back in flow (works automatically; nothing custom needed).
- Account merging if an Alpha user's email differs from an existing pp_profile email. Each unique email = separate Supabase user.
- Targeting / filtering admin UI by `alpha_community` or `alpha_enrollment_status`. Columns exist; UI comes later if needed.
- Other (non-Miami) communities. The integration accepts them globally, but only the 4 Miami slugs have curated mappings; everyone else falls back to lat/lon nearest-metro.
- Server-rendered token verification at the page level. Client-side handler is simpler and matches the pp project's existing client-rendered home page.
