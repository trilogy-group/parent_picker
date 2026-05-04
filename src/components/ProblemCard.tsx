"use client";

import { useState } from "react";
import type { SiteProblem } from "@/types";
import { useVotesStore } from "@/lib/votes";

interface Props {
  problem: SiteProblem;
  isAuthenticated: boolean;
  session?: { access_token: string } | null;
  onSignInNeeded: () => void;
  onChanged?: () => void;
}

export function ProblemCard({ problem, isAuthenticated, session, onSignInNeeded, onChanged }: Props) {
  const userId = useVotesStore(s => s.userId);
  const [busy, setBusy] = useState(false);

  const isMine = problem.owner?.userId === userId;
  const isUnclaimed = !problem.owner;

  async function claim() {
    if (!isAuthenticated || !session) {
      onSignInNeeded();
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/problems/${problem.id}/claim`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function release() {
    if (!session) return;
    setBusy(true);
    try {
      await fetch(`/api/problems/${problem.id}/claim`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`p-3 rounded-md border ${problem.pivotTrigger ? "border-orange-400 border-l-4" : "border-stone-200"}`}>
      {problem.pivotTrigger && (
        <div className="text-[10px] font-bold text-orange-700 mb-1 uppercase tracking-wider">
          ★ HIGH-LEVERAGE PROBLEM
        </div>
      )}
      <div className="flex justify-between items-start gap-2">
        <div className="font-semibold text-sm">{problem.title}</div>
        {problem.deadline && (
          <div className="text-xs text-stone-500 shrink-0">{problem.deadline}</div>
        )}
      </div>
      {problem.description && (
        <p className="text-sm text-stone-600 mt-1">{problem.description}</p>
      )}
      <div className="flex justify-between items-center mt-2 gap-2">
        {isUnclaimed ? (
          <button
            onClick={claim}
            disabled={busy}
            className="text-xs px-3 py-1 bg-orange-100 text-orange-800 font-semibold rounded hover:bg-orange-200 disabled:opacity-50"
            data-testid="problem-claim"
          >
            Sign up to own
          </button>
        ) : (
          <div className="text-xs text-stone-600">
            {isMine
              ? "You're driving this"
              : `${problem.owner?.displayName ?? "A parent"} is driving this`}
          </div>
        )}
        {isMine && (
          <button
            onClick={release}
            disabled={busy}
            className="text-xs text-stone-500 underline disabled:opacity-50"
          >
            Release
          </button>
        )}
      </div>
    </div>
  );
}
