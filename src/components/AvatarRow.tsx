"use client";

import { VoterInfo } from "@/types";

function getInitials(voter: VoterInfo): string {
  if (voter.displayName) {
    const parts = voter.displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  return voter.email[0].toUpperCase();
}

const COLORS = [
  "bg-blue-500 text-white",
  "bg-emerald-500 text-white",
  "bg-purple-500 text-white",
  "bg-orange-500 text-white",
];

interface AvatarRowProps {
  voters: VoterInfo[];
  maxDisplay?: number;
}

export function AvatarRow({ voters, maxDisplay = 4 }: AvatarRowProps) {
  const inVoters = voters.filter(v => v.voteType === 'in');
  const displayed = inVoters.slice(0, maxDisplay);
  const overflow = inVoters.length - maxDisplay;

  if (displayed.length === 0) return null;

  return (
    <div className="flex items-center">
      {displayed.map((voter, i) => (
        <div
          key={voter.userId}
          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${COLORS[i % COLORS.length]} ${i > 0 ? '-ml-1.5' : ''} ring-2 ring-white`}
        >
          {getInitials(voter)}
        </div>
      ))}
      {overflow > 0 && (
        <span className="ml-1.5 text-xs text-gray-500">+{overflow}</span>
      )}
    </div>
  );
}
