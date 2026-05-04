"use client";

import { useEffect, useState, useCallback } from "react";
import type { SiteProblem } from "@/types";
import { ProblemCard } from "./ProblemCard";

interface Props {
  siteId?: string;
  metro?: string;
  isAuthenticated: boolean;
  session?: { access_token: string } | null;
  onSignInNeeded: () => void;
}

export function ProblemList({ siteId, metro, isAuthenticated, session, onSignInNeeded }: Props) {
  const [problems, setProblems] = useState<SiteProblem[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      let url: string;
      if (siteId) {
        url = `/api/sites/${siteId}/problems`;
      } else if (metro) {
        url = `/api/problems?metro=${encodeURIComponent(metro)}`;
      } else {
        return;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data: SiteProblem[] = await res.json();
        setProblems(data);
      }
    } finally {
      setLoading(false);
    }
  }, [siteId, metro]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  if (loading) {
    return (
      <div className="text-xs text-stone-500 py-2">Loading problems…</div>
    );
  }

  if (problems.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
        Open Problems · {problems.length}
      </h3>
      <div className="space-y-2">
        {problems.map(p => (
          <ProblemCard
            key={p.id}
            problem={p}
            isAuthenticated={isAuthenticated}
            session={session}
            onSignInNeeded={onSignInNeeded}
            onChanged={refetch}
          />
        ))}
      </div>
    </div>
  );
}
