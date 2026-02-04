"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MapIcon } from "lucide-react";
import { Map } from "@/components/Map";
import { LocationsList } from "@/components/LocationsList";
import { SuggestLocationModal } from "@/components/SuggestLocationModal";

export default function Home() {
  const [mapCollapsed, setMapCollapsed] = useState(false);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b bg-background px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Parent Picker</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">
            Vote for your preferred school locations
          </p>
        </div>
        <SuggestLocationModal />
      </header>

      {/* Main content - Split pane */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Map section */}
        <div
          className={`lg:w-1/2 lg:h-full transition-all duration-300 ${
            mapCollapsed ? "h-12" : "h-[40vh]"
          } lg:block relative`}
        >
          {/* Mobile collapse toggle */}
          <button
            onClick={() => setMapCollapsed(!mapCollapsed)}
            className="lg:hidden absolute bottom-0 left-0 right-0 z-10 bg-background/80 backdrop-blur border-t py-1 flex items-center justify-center gap-1 text-sm text-muted-foreground"
          >
            <MapIcon className="h-4 w-4" />
            {mapCollapsed ? (
              <>
                Show Map <ChevronDown className="h-4 w-4" />
              </>
            ) : (
              <>
                Hide Map <ChevronUp className="h-4 w-4" />
              </>
            )}
          </button>
          <div className={`h-full ${mapCollapsed ? "lg:block hidden" : ""}`}>
            <Map />
          </div>
        </div>

        {/* Locations list section */}
        <div className="flex-1 lg:w-1/2 lg:border-l overflow-hidden">
          <LocationsList />
        </div>
      </div>
    </div>
  );
}
