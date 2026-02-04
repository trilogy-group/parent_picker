"use client";

import { useEffect, useRef, useCallback } from "react";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/mapbox";
import { MapPin } from "lucide-react";
import { useVotesStore } from "@/lib/votes";
import { Location } from "@/types";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Austin, TX default center
const DEFAULT_CENTER = {
  latitude: 30.2672,
  longitude: -97.7431,
  zoom: 10,
};

interface LocationMarkerProps {
  location: Location;
  isSelected: boolean;
  onClick: () => void;
}

function LocationMarker({ location, isSelected, onClick }: LocationMarkerProps) {
  return (
    <Marker
      latitude={location.lat}
      longitude={location.lng}
      anchor="bottom"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick();
      }}
    >
      <div
        className={`cursor-pointer transition-transform ${
          isSelected ? "scale-125" : "hover:scale-110"
        }`}
      >
        <div
          className={`relative flex items-center justify-center w-8 h-8 rounded-full ${
            isSelected
              ? "bg-primary text-primary-foreground"
              : location.suggested
              ? "bg-amber-500 text-white"
              : "bg-red-500 text-white"
          } shadow-lg`}
        >
          <MapPin className="h-4 w-4" />
          {location.votes > 0 && (
            <span className="absolute -top-1 -right-1 bg-white text-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow">
              {location.votes > 99 ? "99+" : location.votes}
            </span>
          )}
        </div>
      </div>
    </Marker>
  );
}

export function MapView() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const { filteredLocations, selectedLocationId, setSelectedLocation } =
    useVotesStore();

  const locations = filteredLocations();
  const selectedLocation = locations.find((l) => l.id === selectedLocationId);

  const flyToLocation = useCallback((location: Location) => {
    mapRef.current?.flyTo({
      center: [location.lng, location.lat],
      zoom: 14,
      duration: 1000,
    });
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      flyToLocation(selectedLocation);
    }
  }, [selectedLocation, flyToLocation]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-full bg-muted">
        <div className="text-center p-8">
          <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">Map Unavailable</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Please set NEXT_PUBLIC_MAPBOX_TOKEN in your .env.local file to
            enable the map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={DEFAULT_CENTER}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      mapboxAccessToken={MAPBOX_TOKEN}
      onClick={() => setSelectedLocation(null)}
    >
      <NavigationControl position="top-right" />

      {locations.map((location) => (
        <LocationMarker
          key={location.id}
          location={location}
          isSelected={selectedLocationId === location.id}
          onClick={() => setSelectedLocation(location.id)}
        />
      ))}

      {selectedLocation && (
        <Popup
          latitude={selectedLocation.lat}
          longitude={selectedLocation.lng}
          anchor="top"
          closeButton={false}
          closeOnClick={false}
          offset={[0, 8]}
        >
          <div className="p-1">
            <p className="font-semibold text-sm">{selectedLocation.name}</p>
            <p className="text-xs text-muted-foreground">
              {selectedLocation.address}
            </p>
          </div>
        </Popup>
      )}
    </Map>
  );
}
