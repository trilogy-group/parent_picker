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
  const raw = process.env.ALPHA_FUNCTIONS_URL;
  if (!raw) {
    throw new Error('ALPHA_FUNCTIONS_URL not configured');
  }
  const base = raw.replace(/\/+$/, '');

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
