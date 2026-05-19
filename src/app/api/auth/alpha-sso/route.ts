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
        // Distinguish "user already exists" (recoverable — look them up) from
        // any other createUser failure (rate limit, network, misconfig — bail loud).
        const msg = createErr.message?.toLowerCase() ?? '';
        const isDuplicate =
          (createErr as { status?: number }).status === 422 ||
          msg.includes('already registered') ||
          msg.includes('already exists') ||
          msg.includes('email_exists');

        if (!isDuplicate) throw createErr;

        // Orphan auth user without a pp_profiles row — list and filter to find them.
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const orphan = list?.users.find(
          (u) => u.email?.toLowerCase() === info.email.toLowerCase()
        );
        if (!orphan) throw createErr;
        userId = orphan.id;
      } else {
        throw new Error('createUser returned no user and no error');
      }
    }

    // --- Fill-blanks upsert on pp_profiles ---
    const { data: existingRow } = await admin
      .from('pp_profiles')
      .select(
        'email, display_name, home_lat, home_lng, home_address, ' +
        'alpha_user_profile_id, alpha_community, alpha_enrollment_status'
      )
      .eq('id', userId)
      .maybeSingle();

    // Cast to a plain object so TS resolves column names correctly
    const existing = existingRow as {
      email: string | null;
      display_name: string | null;
      home_lat: number | null;
      home_lng: number | null;
      home_address: string | null;
      alpha_user_profile_id: string | null;
      alpha_community: string | null;
      alpha_enrollment_status: string | null;
    } | null;

    const emailPrefix = info.email.split('@')[0];
    const composedAddress = [info.city, info.zip].filter(Boolean).join(' ').trim() || null;

    const filled = {
      id: userId,
      email: existing?.email ?? info.email,
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
