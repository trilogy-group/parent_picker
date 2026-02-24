"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import LocationDetailView from "@/components/LocationDetailView";
import { useVotesStore } from "@/lib/votes";
import { useShallow } from "zustand/react/shallow";
import { useAuth } from "@/components/AuthProvider";

export default function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, session } = useAuth();
  const isAuthenticated = !!user;
  const {
    locations, votedLocationIds, votedNotHereIds,
    voteIn, voteNotHere, loadLocationVoters, locationVoters,
  } = useVotesStore(useShallow((s) => ({
    locations: s.locations,
    votedLocationIds: s.votedLocationIds,
    votedNotHereIds: s.votedNotHereIds,
    voteIn: s.voteIn,
    voteNotHere: s.voteNotHere,
    loadLocationVoters: s.loadLocationVoters,
    locationVoters: s.locationVoters,
  })));

  const location = locations.find(l => l.id === id);
  const voters = locationVoters.get(id) || [];

  useEffect(() => {
    if (id) loadLocationVoters([id]);
  }, [id, loadLocationVoters]);

  if (!location) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Loading location...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white">
      <LocationDetailView
        location={location}
        voters={voters}
        hasVotedIn={votedLocationIds.has(id)}
        hasVotedNotHere={votedNotHereIds.has(id)}
        isAuthenticated={isAuthenticated}
        session={session}
        onBack={() => router.back()}
        onVoteIn={() => voteIn(id)}
        onVoteNotHere={(comment) => voteNotHere(id, comment)}
      />
    </div>
  );
}
