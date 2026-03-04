"use client";

import { useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Map } from "@/components/Map";
import { useVotesStore } from "@/lib/votes";
import { useAuth } from "@/components/AuthProvider";
import { AltPanel } from "@/components/AltPanel";
import { AUSTIN_CENTER } from "@/lib/locations";

function DeepLinkHandler() {
  const searchParams = useSearchParams();
  const locationId = searchParams.get("location");
  const tabParam = searchParams.get("tab");
  const { locations, setSelectedLocation, setFlyToTarget, addLocation, setDeepLinkTab } = useVotesStore();
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!locationId) return;

    // Set tab from URL if present
    if (tabParam === "other" || tabParam === "concerns" || tabParam === "in") {
      setDeepLinkTab(tabParam);
    }

    // Check if already in loaded locations
    const loc = locations.find((l) => l.id === locationId);
    if (loc) {
      setFlyToTarget({ lat: loc.lat, lng: loc.lng, zoom: 15 });
      setSelectedLocation(loc.id);
      return;
    }

    // Not in loaded set (e.g. pending_review) — fetch via API (bypasses RLS)
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    fetch(`/api/locations/${locationId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const raw = data.pp_location_scores;
        const scores = Array.isArray(raw) ? raw[0] : raw;
        addLocation({
          id: data.id,
          name: data.name,
          address: data.address,
          city: data.city,
          state: data.state,
          lat: Number(data.lat),
          lng: Number(data.lng),
          votes: 0,
          notHereVotes: 0,
          suggested: data.source === "parent_suggested",
          scores: scores?.overall_color != null ? {
            overallColor: scores.overall_color || null,
            overallDetailsUrl: scores.overall_details_url || null,
            price: { color: scores.price_color || null },
            zoning: { color: scores.zoning_color || null },
            neighborhood: { color: scores.neighborhood_color || null },
            building: { color: scores.building_color || null },
            sizeClassification: scores.size_classification || null,
          } : undefined,
        });
        setFlyToTarget({ lat: Number(data.lat), lng: Number(data.lng), zoom: 15 });
        setSelectedLocation(data.id);
      });
  }, [locationId, locations.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export function HomeContent() {
  const { loadCitySummaries, setReferencePoint, setIsAdmin, releasedFilter, showUnscored, viewAsParent } = useVotesStore();
  const { isAdmin } = useAuth();

  // Sync isAdmin from AuthProvider into Zustand store
  useEffect(() => {
    setIsAdmin(isAdmin);
  }, [isAdmin, setIsAdmin]);

  useEffect(() => {
    setReferencePoint(AUSTIN_CENTER);
  }, [setReferencePoint]);

  // Fetch city summaries on mount and when filters/admin state change
  useEffect(() => {
    loadCitySummaries();
  }, [releasedFilter, isAdmin, showUnscored, viewAsParent, loadCitySummaries]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Suspense><DeepLinkHandler /></Suspense>
      {/* Full-screen Map — hidden on mobile */}
      <div className="absolute inset-0 hidden lg:block">
        <Map />
      </div>

      {/* Desktop: Left overlay panel */}
      <div data-testid="desktop-panel" className="hidden lg:flex flex-col absolute top-4 left-4 bottom-4 w-[400px] bg-white rounded-xl shadow-2xl overflow-hidden">
        <AltPanel />
      </div>

      {/* Mobile: Full-screen panel */}
      <div data-testid="mobile-bottom-sheet" className="lg:hidden absolute inset-0 bg-white flex flex-col">
        <AltPanel />
      </div>
    </div>
  );
}
