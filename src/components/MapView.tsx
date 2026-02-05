"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/mapbox";
import { MapPin } from "lucide-react";
import { useVotesStore } from "@/lib/votes";
import { getInitialMapView, AUSTIN_CENTER, AUSTIN_ZOOM } from "@/lib/locations";
import { Location } from "@/types";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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
      anchor="center"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick();
      }}
    >
      <div
        className={`cursor-pointer transition-all duration-200 ${
          isSelected ? "scale-150 z-10" : "hover:scale-125"
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full border-2 border-white shadow-md ${
            isSelected
              ? "bg-blue-600"
              : location.suggested
              ? "bg-amber-500"
              : "bg-slate-600"
          }`}
        />
      </div>
    </Marker>
  );
}

export function MapView() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const { filteredLocations, selectedLocationId, setSelectedLocation, locations, flyToTarget, setFlyToTarget, previewLocation, setMapCenter, setMapBounds, setReferencePoint } =
    useVotesStore();

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoResolved, setGeoResolved] = useState(() => {
    // Initialize based on whether geolocation is available
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return true;
    }
    return false;
  });
  const initialViewSetRef = useRef(false);

  const displayLocations = filteredLocations();
  const selectedLocation = displayLocations.find((l) => l.id === selectedLocationId);

  // Request user's geolocation on mount
  useEffect(() => {
    // If geolocation not available, geoResolved is already true from initial state
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGeoResolved(true);
      },
      (error) => {
        console.log("Geolocation error or denied:", error.message);
        setGeoResolved(true);
      },
      { timeout: 5000, enableHighAccuracy: false }
    );
  }, []);

  // Set initial map view based on user location and nearby listings
  useEffect(() => {
    // Wait for both geolocation to resolve AND locations to load
    if (initialViewSetRef.current || !geoResolved || locations.length === 0) return;

    const { center, zoom } = getInitialMapView(
      userLocation?.lat ?? null,
      userLocation?.lng ?? null,
      locations
    );

    // Set reference point for list sorting (doesn't change after this)
    setReferencePoint(center);

    mapRef.current?.flyTo({
      center: [center.lng, center.lat],
      zoom,
      duration: 1500,
    });

    initialViewSetRef.current = true;
  }, [userLocation, locations, geoResolved, setReferencePoint]);

  const flyToLocation = useCallback((location: Location) => {
    mapRef.current?.flyTo({
      center: [location.lng, location.lat],
      zoom: 14,
      duration: 1000,
    });
  }, []);

  const flyToCoords = useCallback((coords: { lat: number; lng: number }) => {
    mapRef.current?.flyTo({
      center: [coords.lng, coords.lat],
      zoom: 14,
      duration: 1000,
    });
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      flyToLocation(selectedLocation);
    }
  }, [selectedLocation, flyToLocation]);

  useEffect(() => {
    if (flyToTarget) {
      flyToCoords(flyToTarget);
      setFlyToTarget(null);
    }
  }, [flyToTarget, flyToCoords, setFlyToTarget]);

  useEffect(() => {
    if (previewLocation) {
      flyToCoords(previewLocation);
    }
  }, [previewLocation, flyToCoords]);

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
      initialViewState={{
        latitude: AUSTIN_CENTER.lat,
        longitude: AUSTIN_CENTER.lng,
        zoom: AUSTIN_ZOOM,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      mapboxAccessToken={MAPBOX_TOKEN}
      onClick={() => setSelectedLocation(null)}
      onMove={(evt) => {
        const center = evt.viewState;
        setMapCenter({ lat: center.latitude, lng: center.longitude });

        // Update bounds for viewport-aware sorting
        const map = mapRef.current?.getMap();
        if (map) {
          const bounds = map.getBounds();
          setMapBounds({
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          });
        }
      }}
    >
      <NavigationControl position="top-right" />

      {displayLocations.map((location) => (
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

      {previewLocation && (
        <>
          <Marker
            latitude={previewLocation.lat}
            longitude={previewLocation.lng}
            anchor="center"
          >
            <div className="relative">
              <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-white shadow-lg animate-pulse" />
              <div className="absolute inset-0 w-6 h-6 rounded-full bg-red-400 animate-ping opacity-75" />
            </div>
          </Marker>
          <Popup
            latitude={previewLocation.lat}
            longitude={previewLocation.lng}
            anchor="top"
            closeButton={false}
            closeOnClick={false}
            offset={[0, 12]}
          >
            <div className="p-1">
              <p className="font-semibold text-sm text-red-700">Preview</p>
              <p className="text-xs text-muted-foreground">
                {previewLocation.address}
              </p>
            </div>
          </Popup>
        </>
      )}
    </Map>
  );
}
