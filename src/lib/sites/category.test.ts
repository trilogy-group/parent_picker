import { describe, it, expect } from 'vitest';
import { getCategory } from './category';
import type { SiteChampion } from '@/types';

const champion = (overrides: Partial<SiteChampion> = {}): SiteChampion => ({
  id: 'c1',
  siteId: 's1',
  userId: 'u1',
  role: 'lead',
  claimedAt: new Date().toISOString(),
  releasedAt: null,
  passedToUserId: null,
  ...overrides,
});

describe('getCategory', () => {
  it('returns short_term when isBridge is true (highest priority)', () => {
    expect(getCategory({ isBridge: true, champions: [champion()] })).toBe('short_term');
  });

  it('returns parent when there is at least one active champion', () => {
    expect(getCategory({ isBridge: false, champions: [champion()] })).toBe('parent');
  });

  it('ignores released champions', () => {
    const released = champion({ releasedAt: new Date().toISOString() });
    expect(getCategory({ isBridge: false, champions: [released] })).toBe('ai');
  });

  it('returns ai when no active champion and not bridge', () => {
    expect(getCategory({ isBridge: false, champions: [] })).toBe('ai');
    expect(getCategory({ isBridge: false, champions: undefined })).toBe('ai');
  });
});
