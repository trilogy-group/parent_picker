"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import Map, { Source, Layer, NavigationControl, Popup, Marker } from "react-map-gl/mapbox";
import { MapPin } from "lucide-react";
import { HelpModal } from "./HelpModal";
import { extractStreet } from "@/lib/address";
import { useVotesStore } from "@/lib/votes";
import { useShallow } from "zustand/react/shallow";
import { useAuth } from "./AuthProvider";
import { getInitialMapView, US_CENTER, US_ZOOM } from "@/lib/locations";
import { sortMostSupport, sortMostViable, sortMostViableWithPriority, makeSortNearest } from "@/lib/sort";
import { fetchIsochrone } from "@/lib/isochrone";
import { pointInIsochrone } from "@/lib/geo";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MapMouseEvent } from "react-map-gl/mapbox";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

// Calculate a generous bounding box for a center+zoom when actual map bounds aren't available yet.
// Uses ~3x the typical viewport width to ensure all visible locations are captured.
function approxBounds(center: { lat: number; lng: number }, zoom: number) {
  const half = (360 / Math.pow(2, Math.max(zoom, 4))) * 3;
  return {
    north: Math.min(85, center.lat + half * 0.6),
    south: Math.max(-85, center.lat - half * 0.6),
    east: center.lng + half,
    west: center.lng - half,
  };
}

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
    setUserLocationStore,
    showTopOnly,
    sortMode,
    mapBounds,
    viableSubPriority,
    storeUserLocation,
    userLocationSource,
    driveTimeMinutes,
    showDriveFilter,
    userIsochrone,
    setUserIsochrone,
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
    // Include filter-related state so map re-renders when filters change
    showUnscored: s.showUnscored,
    releasedFilter: s.releasedFilter,
    isAdmin: s.isAdmin,
    viewAsParent: s.viewAsParent,
    setUserLocationStore: s.setUserLocation,
    showTopOnly: s.showTopOnly,
    sortMode: s.sortMode,
    mapBounds: s.mapBounds,
    altSizeFilter: s.altSizeFilter,
    viableSubPriority: s.viableSubPriority,
    storeUserLocation: s.userLocation,
    userLocationSource: s.userLocationSource,
    driveTimeMinutes: s.driveTimeMinutes,
    showDriveFilter: s.showDriveFilter,
    userIsochrone: s.userIsochrone,
    setUserIsochrone: s.setUserIsochrone,
  })));

  const { user, isOfflineMode } = useAuth();

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  // Start false — the geolocation useEffect will set true on client once resolved/unavailable
  const [geoResolved, setGeoResolved] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const initialViewSetRef = useRef<boolean | "profile">(false);
  const flyingRef = useRef(false);
  const selectedLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  // Shift+drag box selection state
  const [boxSelectBounds, setBoxSelectBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);
  const boxStartRef = useRef<{ x: number; y: number } | null>(null);
  const boxCurrentRef = useRef<{ x: number; y: number } | null>(null);
  const [boxRect, setBoxRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const allFiltered = filteredLocations();
  const displayLocations = showDriveFilter && userIsochrone
    ? allFiltered.filter(loc => loc.id === selectedLocationId || pointInIsochrone(loc.lat, loc.lng, userIsochrone))
    : allFiltered;
  const selectedLocation = displayLocations.find((l) => l.id === selectedLocationId);
  selectedLocationRef.current = selectedLocation ? { lat: selectedLocation.lat, lng: selectedLocation.lng } : null;

  const showCities = zoomLevel < 9;

  // Isochrone drive-time polygons
  const [locationIsochrone, setLocationIsochrone] = useState<GeoJSON.FeatureCollection | null>(null);
  const emptyGeojson = useMemo<GeoJSON.FeatureCollection>(() => ({ type: "FeatureCollection", features: [] }), []);

  // Location isochrone (detail view)
  useEffect(() => {
    if (!selectedLocation) {
      setLocationIsochrone(null);
      return;
    }
    let cancelled = false;
    fetchIsochrone(selectedLocation.lng, selectedLocation.lat, driveTimeMinutes).then((data) => {
      if (!cancelled) setLocationIsochrone(data);
    });
    return () => { cancelled = true; };
  }, [selectedLocation?.id, driveTimeMinutes]); // eslint-disable-line react-hooks/exhaustive-deps

  // User isochrone (list view — eagerly fetch when in metro view with user location)
  // Note: driveTimeMinutes change clears userIsochrone via setDriveTimeMinutes
  useEffect(() => {
    if (!storeUserLocation || showCities || userIsochrone) return;
    let cancelled = false;
    fetchIsochrone(storeUserLocation.lng, storeUserLocation.lat, driveTimeMinutes).then((data) => {
      if (!cancelled) setUserIsochrone(data);
    });
    return () => { cancelled = true; };
  }, [storeUserLocation?.lat, storeUserLocation?.lng, driveTimeMinutes, showCities, userIsochrone, setUserIsochrone]);

  // Pick which isochrone to display: location (detail) takes priority, else user (list)
  const activeIsochrone = selectedLocation ? locationIsochrone : userIsochrone;

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

  // Compute top-N IDs for dot filtering (only when showTopOnly + altUI)
  const topLocationIds = useMemo(() => {
    if (!showTopOnly || !mapBounds) return null;
    const inView = displayLocations.filter(loc =>
      loc.lat <= mapBounds.north && loc.lat >= mapBounds.south &&
      loc.lng <= mapBounds.east && loc.lng >= mapBounds.west
    );
    let sortFn: (a: typeof inView[0], b: typeof inView[0]) => number;
    if (sortMode === 'nearest' && storeUserLocation) {
      sortFn = makeSortNearest(storeUserLocation.lat, storeUserLocation.lng);
    } else if (sortMode === 'most_support') {
      sortFn = sortMostSupport;
    } else if (viableSubPriority && sortMode === 'most_viable') {
      sortFn = (a, b) => sortMostViableWithPriority(a, b, viableSubPriority);
    } else {
      sortFn = sortMostViable;
    }
    const sorted = [...inView].sort(sortFn);
    return new Set(sorted.slice(0, 10).map(loc => loc.id));
  }, [showTopOnly, mapBounds, displayLocations, sortMode, viableSubPriority, storeUserLocation]);

  // GeoJSON for individual location dots — filtered by top-N when active
  const locationGeojson = useMemo(() => {
    const locs = selectedLocationId
      ? displayLocations.filter((loc) => loc.id === selectedLocationId)
      : topLocationIds
        ? displayLocations.filter((loc) => topLocationIds.has(loc.id))
        : displayLocations;
    return {
      type: "FeatureCollection" as const,
      features: locs.map((loc) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [loc.lng, loc.lat] },
        properties: {
          id: loc.id,
          name: loc.name,
          address: loc.address,
          votes: loc.votes,
          overallColor: loc.scores?.overallColor || null,
          suggested: loc.suggested || false,
          selected: loc.id === selectedLocationId,
          proposed: loc.proposed === true,
        },
      })),
    };
  }, [displayLocations, selectedLocationId, topLocationIds]);

  const interactiveLayerIds = useMemo(
    () => (showCities ? ["city-clusters", "city-circles"] : ["unclustered-point"]),
    [showCities]
  );

  // Request user's geolocation on mount
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoResolved(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(coords);
        // Only push to store if no saved profile address (profile takes priority)
        if (useVotesStore.getState().userLocationSource !== "profile") {
          setUserLocationStore(coords);
        }
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
  // Skip if a deep link is present — let DeepLinkHandler control the view
  // Prefer storeUserLocation (profile) over local geolocation
  const initialViewLocation = storeUserLocation ?? userLocation;

  useEffect(() => {
    if (!geoResolved || !mapReady || citySummaries.length === 0) return;
    // Allow re-fire when profile location arrives after geo-based initial view
    if (initialViewSetRef.current && userLocationSource !== "profile") return;
    if (initialViewSetRef.current === "profile") return;
    const hasDeepLink = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("location");
    if (hasDeepLink || flyToTarget) { initialViewSetRef.current = true; return; }

    const { center, zoom } = getInitialMapView(
      initialViewLocation?.lat ?? null,
      initialViewLocation?.lng ?? null,
      citySummaries
    );

    setReferencePoint(center);

    const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;
    const adjustedZoom = isMobile && zoom < 9 ? zoom - 0.5 : zoom;

    mapRef.current?.flyTo({
      center: [center.lng, center.lat],
      zoom: adjustedZoom,
      duration: 1500,
    });

    // If zooming to city level, fetch nearby locations and set bounds/center
    // immediately (same pattern as flyToTarget handler). The old 100ms setTimeout
    // read map.getBounds() mid-animation which returned near-US-wide garbage,
    // and on mobile handleMoveEnd never fires to correct it.
    if (zoom >= 9) {
      const bounds = approxBounds(center, zoom);
      fetchNearbyForce(bounds);
      setMapBounds(bounds);
      setMapCenter(center);
      setZoomLevel(zoom);
    } else {
      // US-wide view: set bounds/center after a short delay so the map has
      // initialized its viewport (no flyTo race here since we stay at US zoom)
      setTimeout(() => {
        const map = mapRef.current?.getMap();
        if (map) {
          const b = map.getBounds();
          setMapBounds({
            north: b.getNorth(),
            south: b.getSouth(),
            east: b.getEast(),
            west: b.getWest(),
          });
          setMapCenter(center);
          setZoomLevel(map.getZoom());
        }
      }, 100);
    }

    initialViewSetRef.current = userLocationSource === "profile" ? "profile" : true;
  }, [initialViewLocation, userLocationSource, citySummaries, geoResolved, mapReady, locations, setReferencePoint, setMapBounds, setMapCenter, setZoomLevel, fetchNearbyForce]); // eslint-disable-line react-hooks/exhaustive-deps

  const flyToCoords = useCallback((coords: { lat: number; lng: number }, zoom?: number) => {
    flyingRef.current = true;
    const targetZoom = zoom ?? 14;
    setZoomLevel(targetZoom);  // Switch layers immediately
    const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;
    mapRef.current?.flyTo({
      center: [coords.lng, coords.lat],
      zoom: targetZoom,
      duration: 1000,
      ...(isMobile ? { padding: { top: 0, bottom: 120, left: 0, right: 0 } } : {}),
    });
  }, [setZoomLevel]);

  // Fly to selected location (only when selection changes, not on re-renders)
  useEffect(() => {
    if (selectedLocationId) {
      const loc = displayLocations.find((l) => l.id === selectedLocationId);
      if (loc) flyToCoords(loc);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId]);

  // Fly to search target (city cards)
  useEffect(() => {
    if (flyToTarget) {
      const targetZoom = flyToTarget.zoom ?? 14;
      flyToCoords(flyToTarget, targetZoom);
      const bounds = approxBounds(flyToTarget, targetZoom);
      fetchNearbyForce(bounds);
      // Set bounds/center immediately so the panel filters correctly even if
      // the map is hidden (mobile) and handleMoveEnd never fires.
      setMapBounds(bounds);
      setMapCenter({ lat: flyToTarget.lat, lng: flyToTarget.lng });
      setFlyToTarget(null);
    }
  }, [flyToTarget, flyToCoords, setFlyToTarget, fetchNearbyForce, setMapBounds, setMapCenter]);

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
        flyToCoords({ lat, lng }, 9);
        fetchNearbyForce(approxBounds({ lat, lng }, 9));
      }
    } else if (feature.layer?.id === "unclustered-point") {
      const props = feature.properties;
      if (props?.id) {
        // Toggle: clicking the same dot again deselects it
        const current = useVotesStore.getState().selectedLocationId;
        setSelectedLocation(current === props.id ? null : props.id);
      }
    }
  }, [setSelectedLocation, fetchNearbyForce, flyToCoords]);

  // Shift+drag box selection: disable default boxzoom and wire up custom handlers
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    // Disable mapbox's built-in shift+drag box zoom
    map.boxZoom.disable();

    const container = map.getContainer();

    const onMouseDown = (e: MouseEvent) => {
      if (!e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = container.getBoundingClientRect();
      boxStartRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      boxCurrentRef.current = boxStartRef.current;
      setBoxRect(null);
      // Clear any previous box selection
      setBoxSelectBounds(null);

      const onMouseMove = (me: MouseEvent) => {
        if (!boxStartRef.current) return;
        const r = container.getBoundingClientRect();
        boxCurrentRef.current = { x: me.clientX - r.left, y: me.clientY - r.top };
        const start = boxStartRef.current;
        const cur = boxCurrentRef.current;
        setBoxRect({
          left: Math.min(start.x, cur.x),
          top: Math.min(start.y, cur.y),
          width: Math.abs(cur.x - start.x),
          height: Math.abs(cur.y - start.y),
        });
      };

      const onMouseUp = (me: MouseEvent) => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        const start = boxStartRef.current;
        if (!start) return;
        const r = container.getBoundingClientRect();
        const end = { x: me.clientX - r.left, y: me.clientY - r.top };
        boxStartRef.current = null;
        setBoxRect(null);

        // Ignore tiny drags (< 10px)
        if (Math.abs(end.x - start.x) < 10 || Math.abs(end.y - start.y) < 10) return;

        // Convert pixel corners to lat/lng
        const sw = map.unproject([Math.min(start.x, end.x), Math.max(start.y, end.y)]);
        const ne = map.unproject([Math.max(start.x, end.x), Math.min(start.y, end.y)]);
        const bounds = {
          north: ne.lat,
          south: sw.lat,
          east: ne.lng,
          west: sw.lng,
        };
        setBoxSelectBounds(bounds);
        setMapBounds(bounds);
        setMapCenter({ lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 });
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    container.addEventListener("mousedown", onMouseDown);
    return () => {
      container.removeEventListener("mousedown", onMouseDown);
    };
  }, [mapReady, setMapBounds, setMapCenter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear box selection on any pan/zoom
  const prevBoundsRef = useRef(mapBounds);
  useEffect(() => {
    if (!boxSelectBounds || !mapBounds || !prevBoundsRef.current) {
      prevBoundsRef.current = mapBounds;
      return;
    }
    // If bounds changed and it's NOT from our box selection, clear it
    const b = boxSelectBounds;
    if (mapBounds.north !== b.north || mapBounds.south !== b.south ||
        mapBounds.east !== b.east || mapBounds.west !== b.west) {
      setBoxSelectBounds(null);
    }
    prevBoundsRef.current = mapBounds;
  }, [mapBounds, boxSelectBounds]);

  // onZoom: update zoomLevel live so panel switches layers immediately
  const handleZoom = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    setZoomLevel(map.getZoom());
  }, [setZoomLevel]);

  // onMoveEnd: update bounds/center/zoom, trigger fetches
  const handleMoveEnd = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    flyingRef.current = false;

    // Skip bounds update if map container is hidden/zero-size (mobile altUI).
    // getBounds() returns garbage on a zero-size canvas and would overwrite
    // the correct approxBounds set by the flyToTarget handler.
    const container = map.getContainer();
    if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;

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
      fetchNearby({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
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
        zoom: typeof window !== "undefined" && window.innerWidth < 1024 ? US_ZOOM - 0.5 : US_ZOOM,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      mapboxAccessToken={MAPBOX_TOKEN}
      onLoad={() => setMapReady(true)}
      onClick={handleMapClick}
      onZoom={handleZoom}
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
              "circle-radius": [
                "case", ["get", "selected"], 14,
                6,
              ],
              "circle-stroke-width": [
                "case", ["get", "selected"], 3,
                2,
              ],
              "circle-stroke-color": "#ffffff",
            }}
          />
          <Layer
            id="proposed-dots"
            type="circle"
            source="locations"
            filter={["==", ["get", "proposed"], true]}
            paint={{
              "circle-radius": 10,
              "circle-color": "#6366f1",
              "circle-stroke-width": 3,
              "circle-stroke-color": "#c7d2fe",
            }}
          />
        </Source>
      )}

      {/* Isochrone drive-time polygon — blue for location detail, green for user catchment */}
      {!showCities && (
        <Source id="isochrone" type="geojson" data={activeIsochrone ?? emptyGeojson}>
          <Layer
            id="isochrone-fill"
            type="fill"
            paint={{
              "fill-color": selectedLocation ? "#2563eb" : "#7c3aed",
              "fill-opacity": selectedLocation ? 0.12 : 0.15,
            }}
          />
          <Layer
            id="isochrone-outline"
            type="line"
            paint={{
              "line-color": selectedLocation ? "#2563eb" : "#16a34a",
              "line-width": selectedLocation ? 2 : 2,
              "line-opacity": selectedLocation ? 0.6 : 0.7,
            }}
          />
        </Source>
      )}

      {/* Selected location popup card on map */}
      {selectedLocation && (
        <Popup
          latitude={selectedLocation.lat}
          longitude={selectedLocation.lng}
          anchor="bottom"
          closeButton={false}
          closeOnClick={false}
          offset={[0, -16]}
          maxWidth="none"
        >
          <div className="w-[280px] overflow-hidden rounded-lg shadow-lg bg-white">
            {GOOGLE_MAPS_KEY && (
              <img
                src={`https://maps.googleapis.com/maps/api/streetview?size=560x200&location=${selectedLocation.lat},${selectedLocation.lng}&fov=90&pitch=0&source=outdoor&key=${GOOGLE_MAPS_KEY}`}
                alt={selectedLocation.name}
                className="w-full h-[100px] object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <div className="p-2.5">
              <p className="text-sm font-semibold text-gray-900 truncate">{extractStreet(selectedLocation.address, selectedLocation.city)}</p>
              <p className="text-xs text-gray-500">{selectedLocation.city}, {selectedLocation.state}</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${selectedLocation.lat},${selectedLocation.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <MapPin className="w-3 h-3" />
                View on Google Maps
              </a>
            </div>
          </div>
        </Popup>
      )}

      {/* Box selection rectangle on map */}
      {boxSelectBounds && (
        <Source
          id="box-select"
          type="geojson"
          data={{
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [[
                [boxSelectBounds.west, boxSelectBounds.north],
                [boxSelectBounds.east, boxSelectBounds.north],
                [boxSelectBounds.east, boxSelectBounds.south],
                [boxSelectBounds.west, boxSelectBounds.south],
                [boxSelectBounds.west, boxSelectBounds.north],
              ]],
            },
            properties: {},
          }}
        >
          <Layer
            id="box-select-fill"
            type="fill"
            paint={{ "fill-color": "#3b82f6", "fill-opacity": 0.08 }}
          />
          <Layer
            id="box-select-outline"
            type="line"
            paint={{ "line-color": "#3b82f6", "line-width": 2, "line-dasharray": [3, 2] }}
          />
        </Source>
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
      {/* Drag preview rectangle overlay */}
      {boxRect && (
        <div
          style={{
            position: "absolute",
            left: boxRect.left,
            top: boxRect.top,
            width: boxRect.width,
            height: boxRect.height,
            border: "2px dashed #3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}
    </Map>
  );
}
