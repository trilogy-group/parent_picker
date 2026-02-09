"use client";

import { useState, useEffect } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Map } from "@/components/Map";
import { LocationsList } from "@/components/LocationsList";
import { SuggestLocationModal } from "@/components/SuggestLocationModal";
import { AuthButton } from "@/components/AuthButton";
import { useVotesStore } from "@/lib/votes";
import { useAuth } from "@/components/AuthProvider";
import { AUSTIN_CENTER } from "@/lib/locations";

export default function Home() {
  const [panelExpanded, setPanelExpanded] = useState(false);
  const { locations, citySummaries, zoomLevel, loadCitySummaries, setReferencePoint, setIsAdmin, releasedFilter, showRedLocations, viewAsParent } = useVotesStore();
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
  }, [releasedFilter, isAdmin, showRedLocations, viewAsParent, loadCitySummaries]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Full-screen Map */}
      <div className="absolute inset-0">
        <Map />
      </div>

      {/* Desktop: Left overlay panel */}
      <div data-testid="desktop-panel" className="hidden lg:flex flex-col absolute top-4 left-4 bottom-4 w-[380px] bg-blue-600 rounded-xl shadow-2xl overflow-hidden">
        {/* Panel Header */}
        <div className="p-4 pb-2 text-white">
          <div className="flex items-center gap-1.5 mb-1">
            <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <h1 className="text-lg font-bold leading-tight">Alpha School Locations</h1>
          </div>
          <p className="text-blue-100 text-sm mb-1">Find &amp; vote on micro school sites</p>
          <AuthButton />
        </div>

        {/* Stats */}
        <div className="px-5 pb-4 text-white border-b border-blue-500">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
            <span className="text-2xl font-bold">{totalVotes}</span>
            <span className="text-blue-100">Votes from Parents</span>
          </div>
        </div>

        {/* How it works */}
        <div className="px-5 pb-3">
          <h3 className="text-white font-semibold text-sm mb-2">How It Works</h3>
          <ol className="text-blue-100 text-xs space-y-1.5">
            <li className="flex gap-2">
              <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] flex-shrink-0">1</span>
              <span>Browse locations on the map or list below</span>
            </li>
            <li className="flex gap-2">
              <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] flex-shrink-0">2</span>
              <span>Vote for locations near you</span>
            </li>
            <li className="flex gap-2">
              <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] flex-shrink-0">3</span>
              <span>Top-voted locations will be prioritized for development</span>
            </li>
          </ol>
          <div className="mt-3">
            <SuggestLocationModal />
          </div>
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
              <SuggestLocationModal />
            </div>
          </div>
        )}

        {/* Expanded panel */}
        {panelExpanded && (
          <div className="bg-white max-h-[70vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <h2 className="font-bold">Alpha School Locations</h2>
                <p className="text-sm text-muted-foreground">{totalVotes} Votes from Parents</p>
              </div>
              <SuggestLocationModal />
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
