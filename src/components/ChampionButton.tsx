'use client';

import { useState } from 'react';
import type { Location } from '@/types';
import { useVotesStore } from '@/lib/votes';

interface Props {
  location: Location;
  isAuthenticated: boolean;
  session?: { access_token: string } | null;
  onSignInNeeded: () => void;
}

export function ChampionButton({ location, isAuthenticated, session, onSignInNeeded }: Props) {
  const userId = useVotesStore(s => s.userId);
  const refreshChampions = useVotesStore(s => s.refreshChampions);
  const [busy, setBusy] = useState(false);

  const myActiveChamp = (location.champions ?? []).find(
    c => c.userId === userId && !c.releasedAt
  );

  async function claim() {
    if (!isAuthenticated || !session) {
      onSignInNeeded();
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/sites/${location.id}/champion`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      await refreshChampions(location.id);
    } finally {
      setBusy(false);
    }
  }

  async function release() {
    if (!session) return;
    setBusy(true);
    try {
      await fetch(`/api/sites/${location.id}/champion`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      await refreshChampions(location.id);
    } finally {
      setBusy(false);
    }
  }

  if (myActiveChamp) {
    return (
      <button
        onClick={release}
        disabled={busy}
        className="text-xs text-stone-500 underline disabled:opacity-50"
        data-testid="champion-button-release"
      >
        {myActiveChamp.role === 'lead'
          ? "★ I'm leading this — pass the torch"
          : "★ I'm supporting — step back"}
      </button>
    );
  }

  return (
    <button
      onClick={claim}
      disabled={busy}
      className="text-xs px-3 py-1 rounded bg-emerald-100 text-emerald-800 font-semibold hover:bg-emerald-200 disabled:opacity-50"
      data-testid="champion-button-claim"
    >
      ★ Champion this site
    </button>
  );
}
