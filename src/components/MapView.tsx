"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import Map, { Source, Layer, NavigationControl, Popup, Marker } from "react-map-gl/mapbox";
import { MapPin } from "lucide-react";
import { ScoreBadge } from "./ScoreBadge";
import { useVotesStore } from "@/lib/votes";
import { useShallow } from "zustand/react/shallow";
import { getInitialMapView, US_CENTER, US_ZOOM } from "@/lib/locations";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MapMouseEvent } from "react-map-gl/mapbox";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function MapView() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const {
    filteredLocations,
    selectedLocationId,
    setSelectedLocation,
    locations,
    citySummaries,
    zoomLevel,
    setZoomLevel,
    flyToTarget,
    setFlyToTarget,
    previewLocation,
    setMapCenter,
    setMapBounds,
    setReferencePoint,
    fetchNearby,
    fetchNearbyForce,
  } = useVotesStore(useShallow((s) => ({
    filteredLocations: s.filteredLocations,
    selectedLocationId: s.selectedLocationId,
    setSelectedLocation: s.setSelectedLocation,
    locations: s.locations,
    citySummaries: s.citySummaries,
    zoomLevel: s.zoomLevel,
    setZoomLevel: s.setZoomLevel,
    flyToTarget: s.flyToTarget,
    setFlyToTarget: s.setFlyToTarget,
    previewLocation: s.previewLocation,
    setMapCenter: s.setMapCenter,
    setMapBounds: s.setMapBounds,
    setReferencePoint: s.setReferencePoint,
    fetchNearby: s.fetchNearby,
    fetchNearbyForce: s.fetchNearbyForce,
  })));

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoResolved, setGeoResolved] = useState(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return true;
    }
    return false;
  });
  const initialViewSetRef = useRef(false);
  const flyingRef = useRef(false);
  const selectedLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  const displayLocations = filteredLocations();
  const selectedLocation = displayLocations.find((l) => l.id === selectedLocationId);
  selectedLocationRef.current = selectedLocation ? { lat: selectedLocation.lat, lng: selectedLocation.lng } : null;

  const showCities = zoomLevel < 9;

  // GeoJSON for city bubbles
  const cityGeojson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: citySummaries.map((c) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
      properties: {
        city: c.city,
        state: c.state,
        locationCount: c.locationCount,
        totalVotes: c.totalVotes,
        lng: c.lng,
        lat: c.lat,
      },
    })),
  }), [citySummaries]);

  // GeoJSON for individual location dots
  const locationGeojson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: displayLocations.map((loc) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [loc.lng, loc.lat] },
      properties: {
        id: loc.id,
        name: loc.name,
        address: loc.address,
        votes: loc.votes,
        overallColor: loc.scores?.overallColor || null,
        suggested: loc.suggested || false,
      },
    })),
  }), [displayLocations]);

  const interactiveLayerIds = useMemo(
    () => (showCities ? ["city-clusters", "city-circles"] : ["unclustered-point"]),
    [showCities]
  );

  // Request user's geolocation on mount
  useEffect(() => {
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
    if (initialViewSetRef.current || !geoResolved || citySummaries.length === 0) return;

    const { center, zoom } = getInitialMapView(
      userLocation?.lat ?? null,
      userLocation?.lng ?? null,
      locations
    );

    setReferencePoint(center);

    mapRef.current?.flyTo({
      center: [center.lng, center.lat],
      zoom,
      duration: 1500,
    });

    // If zooming to city level, fetch nearby locations
    if (zoom >= 9) {
      fetchNearbyForce(center);
    }

    setTimeout(() => {
      const map = mapRef.current?.getMap();
      if (map) {
        const bounds = map.getBounds();
        setMapBounds({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        });
        setMapCenter(center);
        setZoomLevel(map.getZoom());
      }
    }, 100);

    initialViewSetRef.current = true;
  }, [userLocation, citySummaries, geoResolved, locations, setReferencePoint, setMapBounds, setMapCenter, setZoomLevel, fetchNearbyForce]);

  const flyToCoords = useCallback((coords: { lat: number; lng: number }, zoom?: number) => {
    flyingRef.current = true;
    mapRef.current?.flyTo({
      center: [coords.lng, coords.lat],
      zoom: zoom ?? 14,
      duration: 1000,
    });
  }, []);

  // Fly to selected location (only when selection changes, not on re-renders)
  useEffect(() => {
    if (selectedLocationId) {
      const loc = displayLocations.find((l) => l.id === selectedLocationId);
      if (loc) flyToCoords(loc);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId]);

  // Fly to search target
  useEffect(() => {
    if (flyToTarget) {
      flyToCoords(flyToTarget);
      fetchNearbyForce(flyToTarget);
      setFlyToTarget(null);
    }
  }, [flyToTarget, flyToCoords, setFlyToTarget, fetchNearbyForce]);

  // Fly to preview location
  useEffect(() => {
    if (previewLocation) {
      flyToCoords(previewLocation);
    }
  }, [previewLocation, flyToCoords]);

  // Click handler for Source/Layer features
  const handleMapClick = useCallback((e: MapMouseEvent) => {
    const features = e.features;
    if (!features || features.length === 0) {
      setSelectedLocation(null);
      return;
    }

    const feature = features[0];

    if (feature.layer?.id === "city-clusters" || feature.layer?.id === "city-circles") {
      const coords = (feature.geometry as GeoJSON.Point).coordinates;
      if (coords) {
        const lng = coords[0];
        const lat = coords[1];
        flyingRef.current = true;
        mapRef.current?.flyTo({
          center: [lng, lat],
          zoom: 9,
          duration: 1000,
        });
        fetchNearbyForce({ lat, lng });
      }
    } else if (feature.layer?.id === "unclustered-point") {
      const props = feature.properties;
      if (props?.id) {
        // Toggle: clicking the same dot again deselects it
        const current = useVotesStore.getState().selectedLocationId;
        setSelectedLocation(current === props.id ? null : props.id);
      }
    }
  }, [setSelectedLocation, fetchNearbyForce]);

  // onMoveEnd: update bounds/center/zoom, trigger fetches
  const handleMoveEnd = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    flyingRef.current = false;

    const center = map.getCenter();
    const zoom = map.getZoom();
    const bounds = map.getBounds();

    // Clear selection if the selected dot is no longer visible
    if (selectedLocationRef.current) {
      const loc = selectedLocationRef.current;
      if (!bounds.contains([loc.lng, loc.lat])) {
        setSelectedLocation(null);
      }
    }

    setMapCenter({ lat: center.lat, lng: center.lng });
    setZoomLevel(zoom);
    setMapBounds({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });

    if (zoom >= 9) {
      fetchNearby({ lat: center.lat, lng: center.lng });
    }
  }, [setMapCenter, setZoomLevel, setMapBounds, fetchNearby, setSelectedLocation]);

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
        latitude: US_CENTER.lat,
        longitude: US_CENTER.lng,
        zoom: US_ZOOM,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      mapboxAccessToken={MAPBOX_TOKEN}
      onClick={handleMapClick}
      onMoveEnd={handleMoveEnd}
      interactiveLayerIds={interactiveLayerIds}
      cursor="auto"
    >
      <NavigationControl position="top-right" />

      {/* City bubbles layer (zoom < 9) */}
      {showCities && (
        <Source id="cities" type="geojson" data={cityGeojson}
          cluster={true}
          clusterRadius={50}
          clusterMaxZoom={8}
          clusterProperties={{
            totalLocations: ["+", ["get", "locationCount"]],
            totalVotes: ["+", ["get", "totalVotes"]],
          }}
        >
          {/* Cluster circles */}
          <Layer
            id="city-clusters"
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": "#2563eb",
              "circle-radius": [
                "interpolate", ["linear"], ["get", "totalLocations"],
                1, 16,
                50, 24,
                200, 34,
                500, 42,
              ],
              "circle-opacity": 1,
              "circle-stroke-width": 3,
              "circle-stroke-color": "#ffffff",
            }}
          />
          {/* Cluster labels */}
          <Layer
            id="city-cluster-labels"
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              "text-field": ["to-string", ["get", "totalLocations"]],
              "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
              "text-size": 13,
              "text-allow-overlap": false,
            }}
            paint={{
              "text-color": "#ffffff",
              "text-halo-color": "#1e40af",
              "text-halo-width": 1.5,
            }}
          />
          {/* Unclustered city circles */}
          <Layer
            id="city-circles"
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": "#2563eb",
              "circle-radius": [
                "interpolate", ["linear"], ["get", "locationCount"],
                1, 14,
                50, 22,
                200, 32,
              ],
              "circle-opacity": 1,
              "circle-stroke-width": 3,
              "circle-stroke-color": "#ffffff",
            }}
          />
          {/* City labels */}
          <Layer
            id="city-labels"
            type="symbol"
            filter={["!", ["has", "point_count"]]}
            layout={{
              "text-field": ["to-string", ["get", "locationCount"]],
              "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
              "text-size": 13,
              "text-allow-overlap": false,
            }}
            paint={{
              "text-color": "#ffffff",
              "text-halo-color": "#1e40af",
              "text-halo-width": 1.5,
            }}
          />
        </Source>
      )}

      {/* Individual location dots (zoom >= 9) */}
      {!showCities && (
        <Source id="locations" type="geojson" data={locationGeojson}>
          <Layer
            id="unclustered-point"
            type="circle"
            paint={{
              "circle-color": [
                "match", ["get", "overallColor"],
                "GREEN", "#22c55e",
                "YELLOW", "#facc15",
                "AMBER", "#f59e0b",
                "RED", "#ef4444",
                "#475569",
              ],
              "circle-radius": 6,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            }}
          />
        </Source>
      )}

      {/* Selected location popup */}
      {selectedLocation && (
        <Popup
          latitude={selectedLocation.lat}
          longitude={selectedLocation.lng}
          anchor="top"
          closeButton={true}
          closeOnClick={false}
          onClose={() => setSelectedLocation(null)}
          offset={[0, 8]}
        >
          <div className="p-1">
            <p className="font-semibold text-sm">{selectedLocation.name}</p>
            <p className="text-xs text-muted-foreground">
              {selectedLocation.address}
            </p>
            <ScoreBadge scores={selectedLocation.scores} />
          </div>
        </Popup>
      )}

      {/* Preview marker for suggested locations */}
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
