import type { SiteCategory, SiteChampion } from '@/types';

export interface CategoryInput {
  isBridge?: boolean;
  champions?: SiteChampion[];
}

export function getCategory(input: CategoryInput): SiteCategory {
  if (input.isBridge) return 'short_term';
  const hasActiveChampion = (input.champions ?? []).some(c => c.releasedAt === null);
  if (hasActiveChampion) return 'parent';
  return 'ai';
}
