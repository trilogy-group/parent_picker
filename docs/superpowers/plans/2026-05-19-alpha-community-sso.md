# Alpha Community SSO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up token-based auto-sign-in so parents arriving from `community.alpha.school?token=eyJ...` land signed-in on the correct Miami metro view. After Guy's security audit (revised 2026-05-19 PM), Alpha owns token verification — we exchange the token at their endpoint and get structured user info back.

**Architecture:** Client-side token detection in `HomeContent` → `POST /api/auth/alpha-sso` → our server calls Alpha's `/users/get-real-estate-info` exchange endpoint → fill-blanks upserts `pp_profiles` → `supabase.auth.admin.generateLink` for a magic-link `token_hash`. Client exchanges via `supabase.auth.verifyOtp` (localStorage session), then flies the map to the resolved metro and strips `?token=` from the URL.

**Tech Stack:** Next.js 15 App Router, TypeScript, `fetch` (no JWT lib needed — Alpha decodes), `@supabase/supabase-js` v2.94 admin SDK, Vitest for unit tests.

**Spec:** `docs/superpowers/specs/2026-05-19-alpha-community-sso-design.md`

---

## File map

**Create**
- `src/lib/exchange-alpha-token.ts` — Wrapper around Alpha's exchange endpoint
- `src/lib/exchange-alpha-token.test.ts` — Vitest unit tests
- `src/lib/alpha-community.ts` — `community → ActiveMetro` resolver
- `src/lib/alpha-community.test.ts` — Vitest unit tests
- `src/app/api/auth/alpha-sso/route.ts` — POST handler (token → token_hash exchange)
- `sql/2026-05-19-alpha-sso.sql` — DB migration

**Modify**
- `src/components/HomeContent.tsx` — add `AlphaTokenHandler` sibling to `DeepLinkHandler`
- `.env.local` — add `ALPHA_FUNCTIONS_URL` (developer machine; Vercel set out-of-band)

---

## Task 1: Add env var

**Files:**
- Modify: `.env.local`

No new npm deps — Guy's revised flow uses plain `fetch`.

- [ ] **Step 1: Add `ALPHA_FUNCTIONS_URL` to local env**

Add this line to `.env.local`:

```
ALPHA_FUNCTIONS_URL=https://mstzpwibigesyzugwzcu.supabase.co/functions/v1
```

- [ ] **Step 2: Verify the exchange endpoint shape (sanity check)**

```bash
curl -s -X POST https://mstzpwibigesyzugwzcu.supabase.co/functions/v1/users/get-real-estate-info \
  -H 'Content-Type: application/json' \
  -d '{"token":"not-a-real-token"}'
```

Expected (once Alpha is live): a JSON 401 like `{"error":"invalid_token","message":"..."}`. If it returns 404 or some other non-JSON, Alpha-side may not be deployed yet — that's fine, we still develop with the env configured.

- [ ] **Step 3: Reminder — add `ALPHA_FUNCTIONS_URL` to Vercel before merging**

Manually after merge (CLI step, not part of any commit):

```bash
echo "https://mstzpwibigesyzugwzcu.supabase.co/functions/v1" | vercel env add ALPHA_FUNCTIONS_URL production
echo "https://mstzpwibigesyzugwzcu.supabase.co/functions/v1" | vercel env add ALPHA_FUNCTIONS_URL preview
echo "https://mstzpwibigesyzugwzcu.supabase.co/functions/v1" | vercel env add ALPHA_FUNCTIONS_URL development
```

No commit for this task — `.env.local` is gitignored. Move on to Task 2.

---

## Task 2: DB migration — add `alpha_*` columns to `pp_profiles`

**Files:**
- Create: `sql/2026-05-19-alpha-sso.sql`

- [ ] **Step 1: Write the migration**

`sql/2026-05-19-alpha-sso.sql`:

```sql
-- Alpha Community SSO: capture which Alpha community/cohort the parent belongs to,
-- plus their Alpha-side user id for future cross-referencing.
-- Filled (blanks-only) by /api/auth/alpha-sso on token exchange.
alter table pp_profiles
  add column if not exists alpha_user_profile_id text,
  add column if not exists alpha_community text,
  add column if not exists alpha_enrollment_status text;

-- alpha_enrollment_status is one of: 'enrolled', 'committed', or null
-- (per Alpha's get-real-estate-info response contract).
```

- [ ] **Step 2: Apply the migration to Supabase**

Apply via the Supabase MCP tool against the `restaurant-rolodex` project (`qvinpcymcbadrgnwacuf`):

```
mcp__supabase__execute_sql with the migration SQL above
```

Expected: success, no rows affected (DDL).

- [ ] **Step 3: Verify columns exist**

```
mcp__supabase__execute_sql:
select column_name, data_type
from information_schema.columns
where table_name = 'pp_profiles'
  and column_name in ('alpha_user_profile_id', 'alpha_community', 'alpha_enrollment_status');
```

Expected: three rows returned, all `text`.

- [ ] **Step 4: Commit**

```bash
git add sql/2026-05-19-alpha-sso.sql
git commit -m "db: add alpha_user_profile_id + alpha_community + alpha_enrollment_status to pp_profiles"
```

---

## Task 3: Token exchange client (TDD)

**Files:**
- Create: `src/lib/exchange-alpha-token.ts`
- Create: `src/lib/exchange-alpha-token.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/exchange-alpha-token.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exchangeAlphaToken } from './exchange-alpha-token';

describe('exchangeAlphaToken', () => {
  beforeEach(() => {
    process.env.ALPHA_FUNCTIONS_URL = 'https://alpha.example.com/functions/v1';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    delete process.env.ALPHA_FUNCTIONS_URL;
    vi.unstubAllGlobals();
  });

  it('throws a clear error when ALPHA_FUNCTIONS_URL is missing', async () => {
    delete process.env.ALPHA_FUNCTIONS_URL;
    await expect(exchangeAlphaToken('tok')).rejects.toThrow(
      'ALPHA_FUNCTIONS_URL not configured'
    );
  });

  it('POSTs the token to /users/get-real-estate-info', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      user_profile_id: 'u_1',
      email: 'a@b.com',
      name: 'Jane Smith',
      community: 'Miami',
      lat: 25.76, lon: -80.19, city: 'Miami', zip: '33101',
      enrollment_status: 'enrolled',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await exchangeAlphaToken('the-token');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://alpha.example.com/functions/v1/users/get-real-estate-info',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'the-token' }),
      })
    );
  });

  it('returns the parsed AlphaUserInfo on 200', async () => {
    const info = {
      user_profile_id: 'u_1',
      email: 'a@b.com',
      name: 'Jane Smith',
      community: 'Miami Beach',
      lat: 25.79, lon: -80.13, city: 'Miami Beach', zip: '33139',
      enrollment_status: 'committed',
    };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(info), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));

    const result = await exchangeAlphaToken('tok');
    expect(result).toEqual(info);
  });

  it('throws an error whose message contains the Alpha error code on 401', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      error: 'token_expired',
      message: 'Token has expired',
    }), { status: 401, headers: { 'Content-Type': 'application/json' } }));

    await expect(exchangeAlphaToken('expired-token')).rejects.toThrow(/token_expired/);
  });

  it('distinguishes invalid_signature from token_expired', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      error: 'invalid_signature',
      message: '...',
    }), { status: 401, headers: { 'Content-Type': 'application/json' } }));

    await expect(exchangeAlphaToken('tampered')).rejects.toThrow(/invalid_signature/);
  });

  it('includes the HTTP status in the error message when no error code is returned', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Server error', { status: 500 }));

    await expect(exchangeAlphaToken('tok')).rejects.toThrow(/500/);
  });

  it('propagates network failures', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(exchangeAlphaToken('tok')).rejects.toThrow('ECONNREFUSED');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npm run test:unit -- exchange-alpha-token
```

Expected: tests fail with "Cannot find module './exchange-alpha-token'" or similar.

- [ ] **Step 3: Write the implementation**

`src/lib/exchange-alpha-token.ts`:

```ts
export interface AlphaUserInfo {
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

/**
 * Exchange an Alpha-issued JWT for structured user info.
 *
 * Per Guy Harel's revised integration (post security audit, 2026-05-19), we do
 * NOT decode the JWT ourselves — Alpha's `/users/get-real-estate-info` endpoint
 * verifies the signature, expiry, audience, and claims, then returns the
 * caller's profile fields.
 *
 * Token TTL is 1 hour. Persist the returned info on our side; do not re-call
 * this on every request.
 *
 * Throws an Error on any non-200. The error message includes Alpha's error
 * code when available (e.g. 'token_expired', 'invalid_signature') so callers
 * can log and distinguish failure modes.
 */
export async function exchangeAlphaToken(token: string): Promise<AlphaUserInfo> {
  const base = process.env.ALPHA_FUNCTIONS_URL;
  if (!base) {
    throw new Error('ALPHA_FUNCTIONS_URL not configured');
  }

  const res = await fetch(`${base}/users/get-real-estate-info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    let code: string | null = null;
    try {
      const body = (await res.json()) as { error?: string };
      if (typeof body.error === 'string') code = body.error;
    } catch {
      // Non-JSON error body — fall through to HTTP-status-only error.
    }
    throw new Error(
      code
        ? `Alpha token exchange failed: ${code} (HTTP ${res.status})`
        : `Alpha token exchange failed: HTTP ${res.status}`
    );
  }

  return (await res.json()) as AlphaUserInfo;
}
```

- [ ] **Step 4: Run tests, verify all pass**

```bash
npm run test:unit -- exchange-alpha-token
```

Expected: 7 tests pass.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/exchange-alpha-token.ts src/lib/exchange-alpha-token.test.ts
git commit -m "feat: exchangeAlphaToken — POST to Alpha get-real-estate-info + tests"
```

---

## Task 4: Community-to-metro resolver (TDD)

**Files:**
- Create: `src/lib/alpha-community.ts`
- Create: `src/lib/alpha-community.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/alpha-community.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveCommunityToMetro } from './alpha-community';

describe('resolveCommunityToMetro', () => {
  it('maps "Miami" community string to miami metro', () => {
    expect(resolveCommunityToMetro('Miami', null, null)?.slug).toBe('miami');
  });

  it('maps "Miami Beach" community string to miami-beach (more-specific match wins over "miami")', () => {
    expect(resolveCommunityToMetro('Miami Beach', null, null)?.slug).toBe('miami-beach');
  });

  it('maps "Palm Beach" community string to palm-beach', () => {
    expect(resolveCommunityToMetro('Palm Beach', null, null)?.slug).toBe('palm-beach');
  });

  it('maps "Boca Raton" community string to boca', () => {
    expect(resolveCommunityToMetro('Boca Raton', null, null)?.slug).toBe('boca');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(resolveCommunityToMetro('  MIAMI BEACH  ', null, null)?.slug).toBe('miami-beach');
    expect(resolveCommunityToMetro('boca', null, null)?.slug).toBe('boca');
  });

  it('matches when the community string contains a metro name as a substring', () => {
    expect(resolveCommunityToMetro('Alpha Miami Beach Community', null, null)?.slug).toBe('miami-beach');
    expect(resolveCommunityToMetro('Alpha Boca Raton Pre-K', null, null)?.slug).toBe('boca');
  });

  it('falls back to lat/lon when the community string is unknown', () => {
    // 25.76, -80.19 = downtown Miami → miami metro
    expect(resolveCommunityToMetro('Some Unknown Place', 25.76, -80.19)?.slug).toBe('miami');
  });

  it('falls back to lat/lon when the community string is empty', () => {
    expect(resolveCommunityToMetro('', 25.76, -80.19)?.slug).toBe('miami');
  });

  it('returns null when the community is unknown and coordinates are absent', () => {
    expect(resolveCommunityToMetro('Some Unknown Place', null, null)).toBeNull();
  });

  it('returns null for null/undefined community without coordinates', () => {
    expect(resolveCommunityToMetro(null, null, null)).toBeNull();
    expect(resolveCommunityToMetro(undefined, null, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npm run test:unit -- alpha-community
```

Expected: fail with "Cannot find module './alpha-community'".

- [ ] **Step 3: Write the implementation**

`src/lib/alpha-community.ts`:

```ts
import { ACTIVE_METROS, findActiveMetro, type ActiveMetro } from './active-metros';

/**
 * Map an Alpha `community` value (free-form string) to one of our ActiveMetro
 * entries. Defensive: substring match (case- and whitespace-insensitive) against
 * the four Miami-area community names; falls back to nearest-active-metro by
 * lat/lon when the string is unknown.
 *
 * Order matters: more-specific substrings ("miami beach") are checked before
 * less-specific ones ("miami") to avoid prefix collisions.
 */
export function resolveCommunityToMetro(
  community: string | null | undefined,
  lat: number | null,
  lon: number | null
): ActiveMetro | null {
  if (community && community.trim()) {
    const c = community.toLowerCase().trim();
    if (c.includes('miami beach')) return findBySlug('miami-beach');
    if (c.includes('boca')) return findBySlug('boca');
    if (c.includes('palm beach')) return findBySlug('palm-beach');
    if (c.includes('miami')) return findBySlug('miami');
  }
  if (lat != null && lon != null) {
    return findActiveMetro(lat, lon);
  }
  return null;
}

function findBySlug(slug: string): ActiveMetro | null {
  return ACTIVE_METROS.find((m) => m.slug === slug) ?? null;
}
```

- [ ] **Step 4: Run tests, verify all pass**

```bash
npm run test:unit -- alpha-community
```

Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/alpha-community.ts src/lib/alpha-community.test.ts
git commit -m "feat: resolveCommunityToMetro (substring + lat/lon fallback)"
```

---

## Task 5: API route — `POST /api/auth/alpha-sso`

**Files:**
- Create: `src/app/api/auth/alpha-sso/route.ts`

No unit tests for this route — it's orchestration of admin SDK calls. Verified manually in Task 7.

- [ ] **Step 1: Create the route file**

`src/app/api/auth/alpha-sso/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { exchangeAlphaToken, type AlphaUserInfo } from '@/lib/exchange-alpha-token';
import { resolveCommunityToMetro } from '@/lib/alpha-community';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic'; // never cache; tokens are user-specific

export async function POST(req: NextRequest) {
  // --- Parse body ---
  let token: string;
  try {
    const body = await req.json();
    token = body?.token;
    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: 'missing_token' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // --- Exchange the Alpha token for user info ---
  let info: AlphaUserInfo;
  try {
    info = await exchangeAlphaToken(token);
  } catch (err) {
    const msg = (err as Error).message;
    console.error('[alpha-sso] token exchange failed:', msg);
    // Distinguish token_expired so the client can show a "please re-click the
    // CTA" message later if useful. For now both surface as 401.
    const responseCode = msg.includes('token_expired') ? 'token_expired' : 'invalid_token';
    return NextResponse.json({ error: responseCode }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    console.error('[alpha-sso] supabase admin not configured');
    return NextResponse.json({ error: 'sso_failed' }, { status: 500 });
  }

  try {
    // --- Ensure auth user exists; resolve userId ---
    // Fast path: look up by email in our pp_profiles (avoids paginating auth.users).
    let userId: string | null = null;

    const { data: profileRow } = await admin
      .from('pp_profiles')
      .select('id')
      .eq('email', info.email)
      .maybeSingle();

    if (profileRow?.id) {
      userId = profileRow.id;
    } else {
      // No profile row — try to create the auth user.
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: info.email,
        email_confirm: true,
      });

      if (created?.user) {
        userId = created.user.id;
      } else if (createErr) {
        // Edge case: auth user exists but pp_profiles row didn't (trigger failure
        // or legacy account). Fall back to listing auth users.
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = list?.users.find(
          (u) => u.email?.toLowerCase() === info.email.toLowerCase()
        );
        if (!existing) throw createErr;
        userId = existing.id;
      } else {
        throw new Error('createUser returned no user and no error');
      }
    }

    // --- Fill-blanks upsert on pp_profiles ---
    const { data: existing } = await admin
      .from('pp_profiles')
      .select(
        'display_name, home_lat, home_lng, home_address, ' +
        'alpha_user_profile_id, alpha_community, alpha_enrollment_status'
      )
      .eq('id', userId)
      .maybeSingle();

    const emailPrefix = info.email.split('@')[0];
    const composedAddress = [info.city, info.zip].filter(Boolean).join(' ').trim() || null;

    const filled = {
      id: userId,
      email: info.email,
      display_name: existing?.display_name ?? (info.name?.trim() || emailPrefix),
      home_lat: existing?.home_lat ?? info.lat,
      home_lng: existing?.home_lng ?? info.lon,
      home_address: existing?.home_address ?? composedAddress,
      alpha_user_profile_id: existing?.alpha_user_profile_id ?? info.user_profile_id,
      alpha_community: existing?.alpha_community ?? info.community,
      alpha_enrollment_status: existing?.alpha_enrollment_status ?? info.enrollment_status,
    };

    const { error: upsertErr } = await admin
      .from('pp_profiles')
      .upsert(filled, { onConflict: 'id' });

    if (upsertErr) throw upsertErr;

    // --- Generate magic link for client-side session handshake ---
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: info.email,
    });
    if (linkErr || !linkData?.properties?.hashed_token) {
      throw linkErr ?? new Error('generateLink returned no hashed_token');
    }

    // --- Resolve metro ---
    const metro = resolveCommunityToMetro(info.community, info.lat, info.lon);

    return NextResponse.json({
      email: info.email,
      token_hash: linkData.properties.hashed_token,
      metroSlug: metro?.slug ?? null,
    });
  } catch (err) {
    console.error('[alpha-sso] sso_failed:', (err as Error).message);
    return NextResponse.json({ error: 'sso_failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. If TS complains about `linkData.properties.hashed_token`, cast via `(linkData.properties as { hashed_token: string }).hashed_token` — Supabase types may not expose `hashed_token` directly.

- [ ] **Step 3: Lint check**

```bash
npm run lint
```

Expected: 0 new errors.

- [ ] **Step 4: Smoke test the route**

Start dev server in another shell (`npm run dev`), then:

```bash
curl -s -X POST http://localhost:3000/api/auth/alpha-sso \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Expected: `{"error":"missing_token"}` with HTTP 400.

```bash
curl -s -X POST http://localhost:3000/api/auth/alpha-sso \
  -H 'Content-Type: application/json' \
  -d '{"token":"definitely-not-a-real-token-but-long-enough-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'
```

Expected: `{"error":"invalid_token"}` with HTTP 401, and the dev server logs `[alpha-sso] token exchange failed: Alpha token exchange failed: ...`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/alpha-sso/route.ts
git commit -m "feat: /api/auth/alpha-sso route (token exchange → magic link)"
```

---

## Task 6: Wire `AlphaTokenHandler` into `HomeContent`

**Files:**
- Modify: `src/components/HomeContent.tsx`

- [ ] **Step 1: Add the imports and handler component**

Edit `src/components/HomeContent.tsx`. Add to the existing imports at the top of the file:

```ts
import { supabase } from "@/lib/supabase";
import { getActiveMetroBySlug } from "@/lib/active-metros";
```

After the existing `DeepLinkHandler` function (around line 75), add a new component:

```tsx
function AlphaTokenHandler() {
  const { setFlyToTarget } = useVotesStore();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) return;

    // JWTs are 200+ chars in practice; bail on anything implausibly short to
    // avoid clashing with stray `?token=` params from other systems.
    if (token.length < 100) return;

    ranRef.current = true;

    (async () => {
      let res: Response;
      try {
        res = await fetch('/api/auth/alpha-sso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      } catch (err) {
        console.error('[alpha-sso] network error:', err);
        stripTokenFromUrl();
        return;
      }

      // Always strip the token so a page refresh doesn't retry.
      stripTokenFromUrl();

      if (!res.ok) {
        console.error('[alpha-sso] server returned', res.status);
        return;
      }

      let json: { token_hash?: string; metroSlug?: string | null };
      try {
        json = await res.json();
      } catch {
        return;
      }

      const { token_hash, metroSlug } = json;
      if (!token_hash || !supabase) return;

      // NOTE: Supabase docs use 'email' for magiclink token verification.
      // If the installed @supabase/supabase-js version disagrees, swap to 'magiclink'.
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'email',
      });
      if (error) {
        console.error('[alpha-sso] verifyOtp failed:', error.message);
        return;
      }

      if (metroSlug) {
        const metro = getActiveMetroBySlug(metroSlug);
        if (metro) {
          setFlyToTarget({ lat: metro.lat, lng: metro.lng, zoom: metro.defaultZoom });
        }
      }
    })();
  }, [setFlyToTarget]);

  return null;
}

function stripTokenFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('token');
  window.history.replaceState({}, '', url.toString());
}
```

- [ ] **Step 2: Mount the handler in the JSX**

Find the line `<Suspense><DeepLinkHandler /></Suspense>` (around line 101) and add the new handler next to it:

```tsx
<Suspense><DeepLinkHandler /></Suspense>
<AlphaTokenHandler />
```

(No `Suspense` wrapper needed — `AlphaTokenHandler` reads `window.location.search` directly rather than using `useSearchParams`.)

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Lint check**

```bash
npm run lint
```

Expected: 0 new errors (existing warnings unchanged).

- [ ] **Step 5: Build sanity check**

```bash
npm run build
```

Expected: build completes successfully.

- [ ] **Step 6: Commit**

```bash
git add src/components/HomeContent.tsx
git commit -m "feat: AlphaTokenHandler — auto sign-in from Alpha Community tokens"
```

---

## Task 7: Manual end-to-end verification

**Files:** none (verification only)

Before this task, Alpha-side must be live (target: 2026-05-20 morning per Guy). If Alpha is not live yet, mark Step 1 blocked and continue with Step 3 only (graceful-failure path).

- [ ] **Step 1: End-to-end with a real token**

Once Alpha is live tomorrow morning, request a test token from Guy (or sign in on `community.alpha.school` with a Miami account and copy the "Real Estate" button's URL).

Visit `http://localhost:3000/?token=<TOKEN>` and confirm:

1. URL bar updates to `http://localhost:3000/` (no `?token=`).
2. Sign-in indicator in the panel header shows the Alpha user's email.
3. Map flies to the correct metro (Miami / Miami Beach / Palm Beach / Boca Raton).
4. Reloading the page keeps the user signed in (localStorage session persists).
5. Voting on a location records the vote under the Alpha user's identity.
6. Sign out → back to anon, no Alpha info leaked.
7. Verify in Supabase:

```
mcp__supabase__execute_sql:
select email, display_name, alpha_user_profile_id, alpha_community,
       alpha_enrollment_status, home_lat, home_lng
from pp_profiles where email = '<test email>';
```

All fields should be populated. `display_name` should be the user's full `name` from Alpha (not the email prefix).

- [ ] **Step 2: Verify fill-blanks behavior**

Pick a test user who already has `display_name = 'Existing Name'` in `pp_profiles` (or set one manually via the profile page first). Re-run SSO with their Alpha token. Verify `display_name` is preserved (NOT overwritten with Alpha's `name`). New columns (`alpha_user_profile_id`, `alpha_community`, `alpha_enrollment_status`) ARE filled if they were null.

- [ ] **Step 3: Verify graceful failure**

Visit `/?token=garbage-not-a-real-token-but-long-enough-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`. Confirm:

1. Browser console shows `[alpha-sso] server returned 401`.
2. URL bar updates to `/` (token stripped).
3. App renders normal anon UI with no error toast.
4. Server log shows `[alpha-sso] token exchange failed: Alpha token exchange failed: invalid_token (HTTP 401)` (or similar with Alpha's actual error code).

- [ ] **Step 4: Verify expired-token path (if accessible)**

If Guy provides a token with a past expiry, confirm:
1. Server log shows `token_expired` in the error message.
2. Client receives `{"error":"token_expired"}` with HTTP 401.

- [ ] **Step 5: Final commit (if any tweaks needed)**

If verification surfaces bugs, fix them in their own commit. Otherwise, no commit needed for this task.

---

## Task 8: Ship

- [ ] **Step 1: Confirm Vercel has `ALPHA_FUNCTIONS_URL` set**

```bash
vercel env ls | grep ALPHA_FUNCTIONS_URL
```

Expected: three rows (production, preview, development).

- [ ] **Step 2: Push to `origin`**

```bash
git push origin main
```

Both `trilogy-group/parent_picker` and `asiprice/parent_picker` get the push; Vercel auto-deploys from the asiprice mirror.

- [ ] **Step 3: Smoke test production**

After Vercel reports a successful deploy:

```bash
curl -s -X POST https://real-estate.alpha.school/api/auth/alpha-sso \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Expected: `{"error":"missing_token"}` — confirms the route is mounted and reachable.

- [ ] **Step 4: Reply to Guy**

Email Guy confirming the integration is live, and ask for:
1. Confirmation of the exact `community` claim strings (so we can tighten the matcher if needed).
2. Recommendation to set the landing URL to `https://real-estate.alpha.school/miami` for the curated Miami redesign UX.

---

## Verification summary

After all tasks complete, the following must be true:

- `npm run test:unit` passes (existing 21 tests + 7 new exchange tests + 10 new resolver tests = 38+ tests, 0 failures).
- `npx tsc --noEmit` is clean.
- `npm run lint` reports 0 new errors.
- `npm run build` succeeds.
- `/api/auth/alpha-sso` returns 400/401/200 as documented.
- End-to-end sign-in via a real Alpha token lands the user signed-in on the correct metro view.
- Fill-blanks: existing `pp_profiles` fields are never overwritten; only NULL fields get populated.
