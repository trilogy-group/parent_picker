"use client";

import { useState, useEffect } from "react";
import { ChevronUp, ChevronDown, Heart, MapPin } from "lucide-react";
import { Map } from "@/components/Map";
import { LocationsList } from "@/components/LocationsList";
import { SuggestLocationModal } from "@/components/SuggestLocationModal";
import { HelpModal } from "@/components/HelpModal";
import { AuthButton } from "@/components/AuthButton";
import { useVotesStore } from "@/lib/votes";
import { useAuth } from "@/components/AuthProvider";
import { AUSTIN_CENTER } from "@/lib/locations";

const SCHOOL_TYPES = [
  {
    key: "micro",
    label: "Microschool",
    shortLabel: "Micro",
    students: "~25 students",
    focus: true,
    tagline: "The fastest way to bring Alpha to your neighborhood.",
    whatWeNeed: [
      "2,500–7,500 sq ft commercial space",
      "Zoned for school use by right (no special permits)",
      "Retail, office, or community spaces work great",
    ],
    howYouCanHelp: [
      "Suggest a space you know — we can evaluate it in minutes",
      "Vote for locations you'd want your kids to attend",
      "Connect us with landlords or property owners",
    ],
    timeline: "Can open within months",
  },
  {
    key: "growth",
    label: "Growth",
    shortLabel: "Growth",
    students: "~250 students",
    focus: false,
    tagline: "A full school experience with outdoor space in a premium neighborhood.",
    whatWeNeed: [
      "15,000–50,000 sq ft with outdoor space",
      "Premium neighborhood near top-rated schools",
      "Great drop-off / pick-up access",
    ],
    howYouCanHelp: [
      "Know a church, campus, or large property? Tell us",
      "Help with zoning — introduce us to local contacts",
      "Vote to show demand in your area",
    ],
    timeline: "~2 years to open",
  },
  {
    key: "flagship",
    label: "Flagship",
    shortLabel: "Flagship",
    students: "~1,000 students",
    focus: false,
    tagline: "The premier K–12 campus — the best location in the metro.",
    whatWeNeed: [
      "50,000–150,000+ sq ft",
      "Best neighborhood in the metro",
      "Near the top private or public schools",
    ],
    howYouCanHelp: [
      "Know a major property or campus? Let us know",
      "Introduce us to city officials or zoning contacts",
      "Rally other parents — large campuses need proven demand",
    ],
    timeline: "~4 years to open",
  },
] as const;

export default function Home() {
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const focusIdx = SCHOOL_TYPES.findIndex((t) => t.focus);
    return focusIdx >= 0 ? focusIdx : Math.floor(Math.random() * SCHOOL_TYPES.length);
  });
  const { locations, citySummaries, zoomLevel, loadCitySummaries, setReferencePoint, setIsAdmin, releasedFilter, showRedLocations, showUnscored, viewAsParent } = useVotesStore();
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
  }, [releasedFilter, isAdmin, showRedLocations, showUnscored, viewAsParent, loadCitySummaries]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
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
              <MapPin className="w-5 h-5 shrink-0" />
              <h1 className="text-lg font-bold leading-tight">Alpha School Locations</h1>
            </div>
            <AuthButton />
          </div>
          <p className="text-blue-100 text-sm">Help us find the perfect space in your area</p>
        </div>

        {/* Tab buttons */}
        <div className="flex gap-1 px-4 pt-2 pb-3">
          {SCHOOL_TYPES.map((type, i) => (
            <button
              key={type.key}
              onClick={() => setActiveTab(i)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all relative ${
                i === activeTab
                  ? "bg-white text-blue-700 shadow-md"
                  : "bg-blue-500/40 text-blue-100 hover:bg-blue-500/60"
              }`}
            >
              <div>{type.shortLabel}</div>
              <div className={`text-[10px] font-normal ${i === activeTab ? "text-blue-500" : "text-blue-200"}`}>
                {type.students}
              </div>
              {type.focus && (
                <span className="absolute -top-1.5 -right-1 text-[8px] font-bold bg-amber-400 text-amber-900 px-1 py-0.5 rounded shadow-sm">
                  FOCUS
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {(() => {
          const type = SCHOOL_TYPES[activeTab];
          return (
            <div className="px-4 pb-3 text-white">
              {/* Tagline */}
              <p className="text-sm font-medium leading-snug mb-3">{type.tagline}</p>

              {/* What we need */}
              <div className="mb-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-blue-200 mb-1.5">What we need</h4>
                <ul className="text-xs space-y-1 text-blue-100">
                  {type.whatWeNeed.map((item, j) => (
                    <li key={j} className="flex gap-1.5">
                      <span className="text-blue-300 mt-0.5">&#8226;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* How you can help */}
              <div className="mb-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-blue-200 mb-1.5">How you can help</h4>
                <ul className="text-xs space-y-1 text-blue-100">
                  {type.howYouCanHelp.map((item, j) => (
                    <li key={j} className="flex gap-1.5">
                      <span className="text-amber-300 mt-0.5">&#8226;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Timeline */}
              <p className="text-[11px] text-blue-200 mb-3">
                Timeline: <span className="text-white font-medium">{type.timeline}</span>
              </p>

              {/* CTAs */}
              <div className="flex gap-2">
                <HelpModal variant="panel" />
                <SuggestLocationModal />
              </div>
            </div>
          );
        })()}

        {/* Vote counter */}
        <div className="px-4 pb-3 flex items-center gap-2 text-white">
          <Heart className="w-4 h-4 text-red-300 fill-red-300" />
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
