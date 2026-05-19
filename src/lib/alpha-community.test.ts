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
