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
  const slug = communityToSlug(community);
  if (slug) {
    const metro = ACTIVE_METROS.find((m) => m.slug === slug);
    if (metro) return metro;
    // Slug matched but isn't currently in ACTIVE_METROS — fall through to geo.
  }
  if (lat != null && lon != null) {
    return findActiveMetro(lat, lon);
  }
  return null;
}

function communityToSlug(community: string | null | undefined): string | null {
  if (!community || !community.trim()) return null;
  const c = community.toLowerCase().trim();
  if (c.includes('miami beach')) return 'miami-beach';
  if (c.includes('boca')) return 'boca';
  if (c.includes('palm beach')) return 'palm-beach';
  if (c.includes('miami')) return 'miami';
  return null;
}
