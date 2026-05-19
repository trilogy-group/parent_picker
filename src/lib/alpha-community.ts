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
