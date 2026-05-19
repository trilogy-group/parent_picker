"use client";

import { useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Map } from "@/components/Map";
import { useVotesStore } from "@/lib/votes";
import { useAuth } from "@/components/AuthProvider";
import { AltPanelRedesign } from "@/components/AltPanelRedesign";
import { AltPanelLegacy } from "@/components/AltPanelLegacy";
import { AUSTIN_CENTER } from "@/lib/locations";
import { supabase } from "@/lib/supabase";
import { getActiveMetroBySlug } from "@/lib/active-metros";

function DeepLinkHandler() {
  const searchParams = useSearchParams();
  const locationId = searchParams.get("location");
  const tabParam = searchParams.get("tab");
  const { locations, setSelectedLocation, setFlyToTarget, addLocation, setDeepLinkTab } = useVotesStore();
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!locationId) return;

    // Set tab from URL if present
    if (tabParam === "other" || tabParam === "concerns" || tabParam === "in") {
      setDeepLinkTab(tabParam);
    }

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
          zip: data.zip || null,
          rebl3SiteId: data.property_source_key || null,
          scores: scores?.overall_color != null ? {
            overallColor: scores.overall_color || null,
            overallDetailsUrl: scores.overall_details_url || null,
            price: { color: scores.price_color || null },
            zoning: { color: scores.zoning_color || null },
            neighborhood: { color: scores.neighborhood_color || null },
            building: { color: scores.building_color || null },
            sizeClassification: scores.size_classification || null,
            capacity: scores.capacity != null ? Number(scores.capacity) : null,
          } : undefined,
        });
        setFlyToTarget({ lat: Number(data.lat), lng: Number(data.lng), zoom: 15 });
        setSelectedLocation(data.id);
      });
  }, [locationId, locations.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function AlphaTokenHandler() {
  const { setFlyToTarget } = useVotesStore();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) return;

    // JWTs are 200+ chars in practice; bail on anything implausibly short to
    // avoid clashing with stray `?token=` params from other systems.
    if (token.length < 100) return;

    ranRef.current = true;

    (async () => {
      let res: Response;
      try {
        res = await fetch('/api/auth/alpha-sso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      } catch (err) {
        console.error('[alpha-sso] network error:', err);
        stripTokenFromUrl();
        return;
      }

      // Always strip the token so a page refresh doesn't retry.
      stripTokenFromUrl();

      if (!res.ok) {
        console.error('[alpha-sso] server returned', res.status);
        return;
      }

      let json: { token_hash?: string; metroSlug?: string | null };
      try {
        json = await res.json();
      } catch {
        return;
      }

      const { token_hash, metroSlug } = json;
      if (!token_hash || !supabase) return;

      // NOTE: Supabase docs use 'email' for magiclink token verification.
      // If the installed @supabase/supabase-js version disagrees, swap to 'magiclink'.
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'email',
      });
      if (error) {
        console.error('[alpha-sso] verifyOtp failed:', error.message);
        return;
      }

      if (metroSlug) {
        const metro = getActiveMetroBySlug(metroSlug);
        if (metro) {
          setFlyToTarget({ lat: metro.lat, lng: metro.lng, zoom: metro.defaultZoom });
        }
      }
    })();
  }, [setFlyToTarget]);

  return null;
}

function stripTokenFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('token');
  window.history.replaceState({}, '', url.toString());
}

export function HomeContent({ variant = "legacy" }: { variant?: "legacy" | "redesign" } = {}) {
  const { loadCitySummaries, setReferencePoint, setIsAdmin, setRedesignVariant, releasedFilter, showUnscored, viewAsParent } = useVotesStore();
  const { isAdmin } = useAuth();

  // Sync isAdmin from AuthProvider into Zustand store
  useEffect(() => {
    setIsAdmin(isAdmin);
  }, [isAdmin, setIsAdmin]);

  useEffect(() => {
    setRedesignVariant(variant === "redesign");
  }, [variant, setRedesignVariant]);

  useEffect(() => {
    setReferencePoint(AUSTIN_CENTER);
  }, [setReferencePoint]);

  // Legacy panel reads citySummaries to populate its city-card list. Redesign uses ACTIVE_METROS.
  useEffect(() => {
    if (variant === "legacy") loadCitySummaries();
  }, [variant, releasedFilter, isAdmin, showUnscored, viewAsParent, loadCitySummaries]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Suspense><DeepLinkHandler /></Suspense>
      <AlphaTokenHandler />
      {/* Full-screen Map — hidden on mobile */}
      <div className="absolute inset-0 hidden lg:block">
        <Map variant={variant} />
      </div>

      {/* Desktop: Left overlay panel */}
      <div data-testid="desktop-panel" className="hidden lg:flex flex-col absolute top-4 left-4 bottom-4 w-[400px] bg-white rounded-xl shadow-2xl overflow-hidden">
        {variant === "redesign" ? <AltPanelRedesign /> : <AltPanelLegacy />}
      </div>

      {/* Mobile: Full-screen panel */}
      <div data-testid="mobile-bottom-sheet" className="lg:hidden absolute inset-0 bg-white flex flex-col">
        {variant === "redesign" ? <AltPanelRedesign /> : <AltPanelLegacy />}
      </div>
    </div>
  );
}
