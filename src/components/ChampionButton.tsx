'use client';

import type { Location } from '@/types';

interface Props {
  location: Location;
  isAuthenticated: boolean;
  session?: { access_token: string } | null;
  onSignInNeeded: () => void;
}

// Temporarily disabled — 2026-05-19 incident: one user mass-claimed 18
// Miami Beach sites in 2 minutes without voting on any. Re-enable after we
// revisit the copy/UX so it can't be mistaken for a bookmark.
export function ChampionButton(_props: Props) {
  return null;
}
