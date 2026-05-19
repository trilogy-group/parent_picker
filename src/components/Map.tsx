"use client";

import dynamic from "next/dynamic";

const MapViewRedesign = dynamic(
  () => import("./MapViewRedesign").then((mod) => mod.MapViewRedesign),
  {
    loading: () => (
      <div className="flex items-center justify-center h-full bg-muted animate-pulse">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    ),
    ssr: false,
  }
);

const MapViewLegacy = dynamic(
  () => import("./MapViewLegacy").then((mod) => mod.MapViewLegacy),
  {
    loading: () => (
      <div className="flex items-center justify-center h-full bg-muted animate-pulse">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    ),
    ssr: false,
  }
);

export function Map({ variant = "legacy" }: { variant?: "legacy" | "redesign" } = {}) {
  return variant === "redesign" ? <MapViewRedesign /> : <MapViewLegacy />;
}
