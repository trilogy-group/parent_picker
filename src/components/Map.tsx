"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(
  () => import("./MapView").then((mod) => mod.MapView),
  {
    loading: () => (
      <div className="flex items-center justify-center h-full bg-muted animate-pulse">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    ),
    ssr: false,
  }
);

export function Map() {
  return <MapView />;
}
