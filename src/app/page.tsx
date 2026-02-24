"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronUp, ChevronDown, Plus } from "lucide-react";
import { Map } from "@/components/Map";
import { LocationsList } from "@/components/LocationsList";
import { HelpModal } from "@/components/HelpModal";
import { AuthButton } from "@/components/AuthButton";
import { useVotesStore } from "@/lib/votes";
import { useAuth } from "@/components/AuthProvider";
import { AUSTIN_CENTER } from "@/lib/locations";
function DeepLinkHandler() {
  const searchParams = useSearchParams();
  const locationId = searchParams.get("location");
  const { locations, setSelectedLocation, setFlyToTarget, addLocation } = useVotesStore();
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!locationId) return;

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

export default function Home() {
  const [panelExpanded, setPanelExpanded] = useState(false);
  const { locations, citySummaries, zoomLevel, loadCitySummaries, setReferencePoint, setIsAdmin, releasedFilter, showUnscored, viewAsParent } = useVotesStore();
  const { isAdmin } = useAuth();

  // Sync isAdmin from AuthProvider into Zustand store
  useEffect(() => {
    setIsAdmin(isAdmin);
  }, [isAdmin, setIsAdmin]);

  // At wide zoom, total votes comes from city summaries; at city zoom, from locations
  const totalVotes = zoomLevel < 9
    ? citySummaries.reduce((sum, c) => sum + c.totalVotes, 0)
    : locations.reduce((sum, loc) => sum + loc.votes, 0);

  useEffect(() => {
    setReferencePoint(AUSTIN_CENTER);
    loadCitySummaries();
  }, [loadCitySummaries, setReferencePoint]);

  // Refetch city summaries when filters change (admin released filter, non-admin red toggle, view-as-parent)
  useEffect(() => {
    loadCitySummaries();
  }, [releasedFilter, isAdmin, showUnscored, viewAsParent, loadCitySummaries]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Suspense><DeepLinkHandler /></Suspense>
      {/* Full-screen Map */}
      <div className="absolute inset-0">
        <Map />
      </div>

      {/* Desktop: Left overlay panel */}
      <div data-testid="desktop-panel" className="hidden lg:flex flex-col absolute top-4 left-4 bottom-4 w-[380px] bg-blue-600 rounded-xl shadow-2xl overflow-hidden">
        {/* Panel Header */}
        <div className="px-4 pt-4 pb-2 text-white">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <h1 className="text-lg font-bold leading-tight">Alpha School Locations</h1>
            </div>
            <AuthButton />
          </div>
          <p className="text-blue-100 text-sm">Help us find the perfect space in your area</p>
        </div>

        {/* How you can help */}
        <div className="px-4 pb-3 text-white">
          <ul className="text-xs space-y-1 text-blue-100 mb-3">
            <li className="flex gap-1.5">
              <span className="text-amber-300 mt-0.5">&#8226;</span>
              <span>Suggest a space you know — we can evaluate it in minutes</span>
            </li>
            <li className="flex gap-1.5">
              <span className="text-amber-300 mt-0.5">&#8226;</span>
              <span>Vote for locations you&apos;d want your kids to attend</span>
            </li>
            <li className="flex gap-1.5">
              <span className="text-amber-300 mt-0.5">&#8226;</span>
              <span>Connect us with landlords or property owners</span>
            </li>
          </ul>
          <div className="flex gap-2">
            <HelpModal variant="panel" />
            <Link href="/suggest" className="flex-1">
              <button className="w-full flex items-center justify-center gap-1.5 bg-amber-400 hover:bg-amber-500 text-amber-950 font-semibold text-xs py-2 px-3 rounded-lg transition-colors shadow-md">
                <Plus className="w-3.5 h-3.5" />
                Suggest a Location
              </button>
            </Link>
          </div>
        </div>

        {/* Vote counter */}
        <div className="px-4 pb-3 flex items-center gap-2 text-white border-b border-blue-500">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
          <span className="text-sm"><strong>{totalVotes}</strong> votes from parents</span>
        </div>

        {/* Locations List */}
        <div className="flex-1 bg-white overflow-hidden flex flex-col">
          <LocationsList />
        </div>
      </div>

      {/* Mobile: Bottom sheet */}
      <div data-testid="mobile-bottom-sheet" className="lg:hidden absolute left-0 right-0 bottom-0 flex flex-col">
        {/* Pull handle */}
        <button
          onClick={() => setPanelExpanded(!panelExpanded)}
          className="bg-white rounded-t-2xl shadow-lg pt-2 pb-3 flex flex-col items-center"
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full mb-2" />
          <div className="flex items-center gap-2 text-sm font-medium">
            {panelExpanded ? (
              <>
                <ChevronDown className="w-4 h-4" />
                Hide Locations
              </>
            ) : (
              <>
                <ChevronUp className="w-4 h-4" />
                View Locations
              </>
            )}
          </div>
        </button>

        {/* Collapsed summary */}
        {!panelExpanded && (
          <div className="bg-white px-4 pb-4 border-t">
            <div className="flex items-center justify-between py-3">
              <div>
                <h2 className="font-bold">Alpha School Locations</h2>
                <p className="text-sm text-muted-foreground">{totalVotes} Votes from Parents</p>
              </div>
              <AuthButton darkBg={false} />
            </div>
            <ul className="text-xs space-y-1 text-gray-500 mb-3">
              <li className="flex gap-1.5">
                <span className="text-amber-500 mt-0.5">&#8226;</span>
                <span>Suggest a space you know — we can evaluate it in minutes</span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-amber-500 mt-0.5">&#8226;</span>
                <span>Vote for locations you&apos;d want your kids to attend</span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-amber-500 mt-0.5">&#8226;</span>
                <span>Connect us with landlords or property owners</span>
              </li>
            </ul>
            <div className="flex gap-2">
              <HelpModal variant="panel" />
              <Link href="/suggest" className="flex-1">
                <button className="w-full flex items-center justify-center gap-1.5 bg-amber-400 hover:bg-amber-500 text-amber-950 font-semibold text-xs py-2 px-3 rounded-lg transition-colors shadow-md">
                  <Plus className="w-3.5 h-3.5" />
                  Suggest a Location
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Expanded panel */}
        {panelExpanded && (
          <div className="bg-white max-h-[50vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <h2 className="font-bold">Alpha School Locations</h2>
                <p className="text-sm text-muted-foreground">{totalVotes} Votes from Parents</p>
              </div>
              <AuthButton darkBg={false} />
            </div>
            <div className="flex-1 overflow-hidden">
              <LocationsList />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
