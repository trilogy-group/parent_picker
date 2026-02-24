"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LocationDetailView from "@/components/LocationDetailView";
import { useVotesStore } from "@/lib/votes";
import { useShallow } from "zustand/react/shallow";
import { useAuth } from "@/components/AuthProvider";
import { Location } from "@/types";

export default function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, session } = useAuth();
  const isAuthenticated = !!user;
  const {
    locations, votedLocationIds, votedNotHereIds,
    voteIn, voteNotHere, removeVote, loadLocationVoters, locationVoters,
  } = useVotesStore(useShallow((s) => ({
    locations: s.locations,
    votedLocationIds: s.votedLocationIds,
    votedNotHereIds: s.votedNotHereIds,
    voteIn: s.voteIn,
    voteNotHere: s.voteNotHere,
    removeVote: s.removeVote,
    loadLocationVoters: s.loadLocationVoters,
    locationVoters: s.locationVoters,
  })));

  const [fetchedLocation, setFetchedLocation] = useState<Location | null>(null);
  const [fetchError, setFetchError] = useState(false);

  const location = locations.find(l => l.id === id) || fetchedLocation;
  const voters = locationVoters.get(id) || [];

  // Fetch location from API if not in store (direct navigation)
  useEffect(() => {
    if (!locations.find(l => l.id === id) && !fetchedLocation && !fetchError) {
      fetch(`/api/locations/${id}`)
        .then(res => { if (!res.ok) throw new Error(); return res.json(); })
        .then(data => setFetchedLocation(data))
        .catch(() => setFetchError(true));
    }
  }, [id, locations, fetchedLocation, fetchError]);

  useEffect(() => {
    if (id) loadLocationVoters([id]);
  }, [id, loadLocationVoters]);

  if (fetchError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Location not found.</p>
      </div>
    );
  }

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
        onRemoveVote={() => removeVote(id)}
      />
    </div>
  );
}
