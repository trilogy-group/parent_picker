"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useVotesStore } from "@/lib/votes";
import { useShallow } from "zustand/react/shallow";
import { useAuth } from "./AuthProvider";
import { AltLocationCard } from "./AltLocationCard";
import LocationDetailView from "./LocationDetailView";
import { ProfilePopover } from "./ProfilePopover";
import { getDistanceMiles } from "@/lib/locations";
import { ACTIVE_METROS, findActiveMetro } from "@/lib/active-metros";
import { sortMostSupport, sortMostViable, sortMostViableWithPriority, makeSortNearest } from "@/lib/sort";
import type { Location } from "@/types";
import { Eye, ChevronDown, Search, X, ChevronLeft, MapPin } from "lucide-react";
import { extractStreet } from "@/lib/address";
import { AvatarRow } from "./AvatarRow";
import { pointInIsochrone } from "@/lib/geo";
import { PlanOfRecord } from "./PlanOfRecord";
import { CategorySection } from "./CategorySection";
import { StageBadge } from "./StageBadge";
import { StageTimeline } from "./StageTimeline";
import { useMetroPlan, useMetroProblems, autoDerivePlan, mergePlan, getPlanRole, comparePlanOrder, type PlanRole } from "@/lib/plan-of-record";
import { formatPipelineStatus } from "@/lib/sites";
import type { SiteProblem } from "@/types";

const PAGE_SIZE = 25;

function formatOpeningDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function AltPanel() {
  const {
    locations, filteredLocations, selectedLocationId, setSelectedLocation,
    voteIn, voteNotHere, removeVote, updateVoteComment, votedLocationIds, votedNotHereIds,
    mapBounds, sortMode, setSortMode,
    locationVoters, loadLocationVoters, zoomLevel,
    setFlyToTarget, userLocation, setZoomLevel, mapCenter,
    viewAsParent, setViewAsParent,
    showTopOnly, setShowTopOnly,
    altSizeFilter, setAltSizeFilter,
    viableSubPriority, setViableSubPriority,
    deepLinkTab, setDeepLinkTab,
    showDriveFilter, setShowDriveFilter, userIsochrone,
    driveTimeMinutes, setDriveTimeMinutes,
    showNoBlockers, setShowNoBlockers,
    showCandidatesPanel, setShowCandidatesPanel,
    userId,
  } = useVotesStore(useShallow((s) => ({
    locations: s.locations,
    filteredLocations: s.filteredLocations,
    selectedLocationId: s.selectedLocationId,
    setSelectedLocation: s.setSelectedLocation,
    voteIn: s.voteIn,
    voteNotHere: s.voteNotHere,
    removeVote: s.removeVote,
    updateVoteComment: s.updateVoteComment,
    votedLocationIds: s.votedLocationIds,
    votedNotHereIds: s.votedNotHereIds,
    mapBounds: s.mapBounds,
    sortMode: s.sortMode,
    setSortMode: s.setSortMode,
    locationVoters: s.locationVoters,
    loadLocationVoters: s.loadLocationVoters,
    zoomLevel: s.zoomLevel,
    setFlyToTarget: s.setFlyToTarget,
    setZoomLevel: s.setZoomLevel,
    mapCenter: s.mapCenter,
    userLocation: s.userLocation,
    viewAsParent: s.viewAsParent,
    setViewAsParent: s.setViewAsParent,
    showTopOnly: s.showTopOnly,
    setShowTopOnly: s.setShowTopOnly,
    altSizeFilter: s.altSizeFilter,
    setAltSizeFilter: s.setAltSizeFilter,
    viableSubPriority: s.viableSubPriority,
    setViableSubPriority: s.setViableSubPriority,
    deepLinkTab: s.deepLinkTab,
    setDeepLinkTab: s.setDeepLinkTab,
    showDriveFilter: s.showDriveFilter,
    setShowDriveFilter: s.setShowDriveFilter,
    userIsochrone: s.userIsochrone,
    driveTimeMinutes: s.driveTimeMinutes,
    setDriveTimeMinutes: s.setDriveTimeMinutes,
    showNoBlockers: s.showNoBlockers,
    setShowNoBlockers: s.setShowNoBlockers,
    showCandidatesPanel: s.showCandidatesPanel,
    setShowCandidatesPanel: s.setShowCandidatesPanel,
    userId: s.userId,
  })));

  const { user, session, isAdmin } = useAuth();
  const isAuthenticated = !!user;
  const router = useRouter();
  const effectiveAdmin = isAdmin && !viewAsParent;

  // Subscore popover state
  const [showSubPopover, setShowSubPopover] = useState(false);
  const subPopoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showSubPopover) return;
    const handleClick = (e: MouseEvent) => {
      if (subPopoverRef.current && !subPopoverRef.current.contains(e.target as Node)) {
        setShowSubPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSubPopover]);

  // Size filter popover state
  const [showSizePopover, setShowSizePopover] = useState(false);
  const sizePopoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showSizePopover) return;
    const handleClick = (e: MouseEvent) => {
      if (sizePopoverRef.current && !sizePopoverRef.current.contains(e.target as Node)) {
        setShowSizePopover(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSizePopover]);

  // Drive time popover state
  const [showDrivePopover, setShowDrivePopover] = useState(false);
  const drivePopoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showDrivePopover) return;
    const handleClick = (e: MouseEvent) => {
      if (drivePopoverRef.current && !drivePopoverRef.current.contains(e.target as Node)) {
        setShowDrivePopover(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDrivePopover]);

  // Admin search state
  const [adminSearch, setAdminSearch] = useState("");

  // Moved-on sites toggle
  const [showMovedOn, setShowMovedOn] = useState(false);

  // Find selected location for detail view
  const selectedLocation = selectedLocationId
    ? locations.find(l => l.id === selectedLocationId)
    : null;

  // Load voters when location selected (for detail view)
  useEffect(() => {
    if (selectedLocationId) {
      loadLocationVoters([selectedLocationId]);
    }
  }, [selectedLocationId, loadLocationVoters]);

  const activeMetro = useMemo(() => {
    if (zoomLevel < 9 || !mapCenter) return null;
    return findActiveMetro(mapCenter.lat, mapCenter.lng);
  }, [zoomLevel, mapCenter]);

  const metroName = activeMetro?.displayName ?? null;

  // Curated metros render directly — order = declared order in active-metros.ts
  const metroCards = ACTIVE_METROS;

  // Show curated cards when fully zoomed out OR when zoomed in past 9 but the
  // map center is outside every active metro's radius (e.g., panned over Memphis).
  const showCityCards = zoomLevel < 9 || !activeMetro;

  // Sort and filter locations in viewport
  const sortedLocations = useMemo(() => {
    const filtered = filteredLocations();
    if (!mapBounds) return filtered;
    const pool = filtered.filter(loc =>
      loc.lat <= mapBounds.north && loc.lat >= mapBounds.south &&
      loc.lng <= mapBounds.east && loc.lng >= mapBounds.west
    );
    let sortFn: (a: typeof pool[0], b: typeof pool[0]) => number;
    if (sortMode === 'nearest' && userLocation) {
      sortFn = makeSortNearest(userLocation.lat, userLocation.lng);
    } else if (sortMode === 'most_support') {
      sortFn = sortMostSupport;
    } else if (viableSubPriority && sortMode === 'most_viable') {
      sortFn = (a, b) => sortMostViableWithPriority(a, b, viableSubPriority);
    } else {
      sortFn = sortMostViable;
    }
    let sorted = [...pool].sort(sortFn);
    // Apply "Close to me" drive-time filter (promoted locations bypass)
    if (showDriveFilter && userIsochrone) {
      sorted = sorted.filter(loc => !!loc.feedbackDeadline || pointInIsochrone(loc.lat, loc.lng, userIsochrone));
    }
    // Deduplicate by ID (safety net against render-time race conditions)
    const seen = new Set<string>();
    return sorted.filter(loc => {
      if (seen.has(loc.id)) return false;
      seen.add(loc.id);
      return true;
    });
  }, [filteredLocations, mapBounds, sortMode, viableSubPriority, userLocation, locations, altSizeFilter, viewAsParent, showDriveFilter, userIsochrone, showNoBlockers]);

  // Apply admin search filter
  const searchFilteredLocations = useMemo(() => {
    if (!adminSearch.trim()) return sortedLocations;
    const q = adminSearch.toLowerCase().trim();
    return sortedLocations.filter(loc => {
      const text = `${loc.address} ${loc.city} ${loc.name || ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [sortedLocations, adminSearch]);

  // Category-grouped highlights are METRO-scoped, not viewport-scoped — so zooming
  // into one site doesn't make the others vanish from the highlights list. Filter
  // by nearest-metro membership against `metroName` (50-mile radius per metros.ts).
  const metroLocations = useMemo(() => {
    if (!activeMetro) return [];
    return filteredLocations().filter((loc) => {
      const m = findActiveMetro(loc.lat, loc.lng);
      return m?.slug === activeMetro.slug;
    });
  // filteredLocations is a stable store function; activeMetro & locations cover state deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredLocations, activeMetro, locations]);

  // Plan of Record (curated) + auto-derived defaults, merged into one effective plan
  const curatedPlan = useMetroPlan(metroName);
  const problemsBySite = useMetroProblems(metroName);
  const effectivePlan = useMemo(
    () => mergePlan(curatedPlan, autoDerivePlan(metroLocations)),
    [curatedPlan, metroLocations]
  );

  const parentSites = useMemo(
    () => metroLocations
      .filter(l => l.derived?.category === "parent")
      .sort((a, b) => comparePlanOrder(a, b, effectivePlan, userId)),
    [metroLocations, effectivePlan, userId]
  );
  const aiActive = useMemo(
    () => metroLocations
      .filter(l => l.derived?.category === "ai" && (
        l.derived?.stage === "diligence" ||
        l.derived?.stage === "ready_to_commit" ||
        l.derived?.stage === "build_out"
      ))
      .sort((a, b) => comparePlanOrder(a, b, effectivePlan, userId)),
    [metroLocations, effectivePlan, userId]
  );
  // Open + Ready-to-open campuses get their own section at the top.
  const openCampuses = useMemo(
    () => metroLocations
      .filter(l => l.derived?.stage === "open" || l.derived?.stage === "ready_to_open")
      .sort((a, b) => {
        // Open first, then Ready-to-open; within each, earliest opened first
        const aOpen = a.derived?.stage === "open" ? 0 : 1;
        const bOpen = b.derived?.stage === "open" ? 0 : 1;
        if (aOpen !== bOpen) return aOpen - bOpen;
        return (a.openedAt ?? "").localeCompare(b.openedAt ?? "");
      }),
    [metroLocations]
  );
  const shortTermSites = useMemo(
    () => metroLocations
      .filter(l => l.derived?.category === "short_term")
      .sort((a, b) => comparePlanOrder(a, b, effectivePlan, userId)),
    [metroLocations, effectivePlan, userId]
  );
  const buildOutCount = useMemo(
    () => metroLocations.filter(l => l.derived?.stage === "build_out").length,
    [metroLocations]
  );

  const movedOnSites = useMemo(
    () => metroLocations.filter(l => l.derived?.stage === "moved_on"),
    [metroLocations]
  );

  const prospectsCount = useMemo(
    () => metroLocations.filter(l => l.derived?.stage === "prospect").length,
    [metroLocations]
  );

  const RichCategoryCard = ({
    loc,
    planRole,
    problems,
  }: {
    loc: Location;
    planRole?: PlanRole | null;
    problems?: SiteProblem[];
  }) => {
    const dist = userLocation ? getDistanceMiles(userLocation.lat, userLocation.lng, loc.lat, loc.lng) : null;
    const voters = locationVoters.get(loc.id) || [];
    const leadChampion = loc.champions?.find(c => c.role === "lead" && !c.releasedAt);
    const pipelineStatus = formatPipelineStatus(loc);
    const stage = loc.derived?.stage;
    const showTimeline =
      stage === "diligence" ||
      stage === "ready_to_commit" ||
      stage === "build_out" ||
      stage === "ready_to_open";
    const subStage = loc.derived?.committedSubStage ?? "loi";
    const openProblems = (problems ?? []).filter(p => p.status === "open" || p.status === "in_progress");
    const hasPivot = openProblems.some(p => p.pivotTrigger);
    const problemCount = openProblems.length;

    // Snapshot/deadline pill text — never gates votes
    const snapshotPill = (() => {
      if (!loc.feedbackDeadline) return null;
      const deadline = new Date(loc.feedbackDeadline);
      const now = new Date();
      const expired = deadline.getTime() - now.getTime() <= 0;
      const dateStr = deadline.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return expired
        ? { label: `Snapshot taken ${dateStr} · still open`, className: "bg-stone-100 text-stone-600" }
        : { label: `First snapshot: ${dateStr}`, className: "bg-indigo-50 text-indigo-700" };
    })();

    const navigateToDetail = () => {
      setSelectedLocation(loc.id);
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        router.push(`/location/${loc.id}`);
      }
    };

    return (
        <div
          onClick={navigateToDetail}
          className="w-full text-left p-3 rounded-lg border border-stone-200 bg-white hover:shadow-sm transition-all cursor-pointer"
        >
          {/* Status row */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {loc.derived?.stage && <StageBadge stage={loc.derived.stage} />}
            {(() => {
              // For build-out / ready-to-open sites, render the 3 hurdle chips
              // even when value is null (default to "pending"). For all other
              // stages, only show chips that are explicitly true or false.
              const buildoutLike =
                loc.derived?.stage === "build_out" || loc.derived?.stage === "ready_to_open";
              const renderChip = (
                label: string,
                value: boolean | null | undefined,
                titleDone: string,
                titlePending: string
              ) => {
                const v = value ?? (buildoutLike ? false : null);
                if (v === null) return null;
                return v ? (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700" title={titleDone}>{label} ✓</span>
                ) : (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700" title={titlePending}>{label} · pending</span>
                );
              };
              return (
                <>
                  {renderChip("REGULATORY", loc.regulatoryApproved, "Regulatory approval complete", "Regulatory approval in progress")}
                  {renderChip("ZONING", loc.zoningCleared, "Zoning cleared", "Zoning in progress")}
                  {renderChip("PERMITS", loc.permitsAcquired, "Permits acquired", "Permits in progress")}
                </>
              );
            })()}
            {loc.summerProgram === true && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700" title="Summer program runs on this site">SUMMER</span>
            )}
            {planRole === "primary" && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">★ PRIMARY</span>
            )}
            {planRole === "bridge" && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">★ BRIDGE</span>
            )}
            {planRole === "watch" && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-stone-200 text-stone-800">★ WATCH</span>
            )}
            {problemCount > 0 && (() => {
              const SEVERITY_RANK: Record<'H' | 'M' | 'L', number> = { H: 0, M: 1, L: 2 };
              const ranked = [...openProblems].sort((a, b) => {
                const aNeeds = a.parentOwnable && !a.owner ? 0 : 1;
                const bNeeds = b.parentOwnable && !b.owner ? 0 : 1;
                if (aNeeds !== bNeeds) return aNeeds - bNeeds;
                return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
              });
              const top = ranked[0];
              const isOrange = (top.parentOwnable && !top.owner) || top.severity === "H" || hasPivot;
              const label = top.parentOwnable && !top.owner
                ? `${top.category.toUpperCase()} · Needs an owner`
                : `${problemCount} ${problemCount === 1 ? "PROBLEM" : "PROBLEMS"}`;
              return (
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    isOrange ? "bg-orange-200 text-orange-900" : "bg-stone-100 text-stone-700"
                  }`}
                  title={openProblems.map(p => p.title).join(" · ")}
                >
                  {isOrange ? "★ " : ""}{label}
                </span>
              );
            })()}
            {leadChampion && (
              <span className="text-[11px] text-emerald-700 font-medium">
                ★ {leadChampion.displayName || "A parent"} is leading this
              </span>
            )}
            {dist != null && (
              <span className="ml-auto text-[11px] text-gray-400">
                {dist.toFixed(1)} mi
              </span>
            )}
          </div>

          {/* Title + pipeline status (replaces redundant address) */}
          <h3 className="text-base font-bold text-stone-900 leading-tight">
            {extractStreet(loc.address, loc.city)}
          </h3>
          {pipelineStatus && (
            <p className="text-xs text-stone-600 mt-0.5">{pipelineStatus}</p>
          )}

          {/* Facts row — capacity / REBL score / opening date(s). For sites with
              both fast-open and max-cap DD blocks we show two rows: Phase 1 first,
              full buildout below. Open campuses fall back to plain REBL capacity.
              pp_location_overrides take precedence (admin-curated fixes for stale
              REBL data — delete the override row once REBL is corrected). */}
          {(() => {
            const fastCap = loc.capacityOverride ?? loc.derived?.fastOpenCapacity ?? null;
            const fastDate = loc.targetOpenDateOverride ?? loc.derived?.fastOpenDate ?? null;
            const maxCap = loc.maxCapCapacityOverride ?? loc.derived?.maxCapCapacity ?? null;
            const maxDate = loc.maxCapDateOverride ?? loc.derived?.maxCapDate ?? null;
            const fallbackCap = loc.capacityOverride ?? loc.scores?.capacity ?? null;
            const score = loc.derived?.reblScore ?? null;
            const colorClass =
              loc.scores?.overallColor === "GREEN" ? "bg-emerald-500" :
              loc.scores?.overallColor === "YELLOW" ? "bg-yellow-500" :
              loc.scores?.overallColor === "AMBER" ? "bg-amber-500" :
              loc.scores?.overallColor === "RED" ? "bg-rose-500" : "bg-stone-300";

            const showDualRows =
              (stage === "build_out" || stage === "ready_to_commit" || stage === "diligence") &&
              (fastCap != null || maxCap != null) &&
              (fastCap !== maxCap || fastDate !== maxDate);

            const rows: React.ReactNode[] = [];

            if (showDualRows) {
              if (fastCap != null || fastDate != null) {
                rows.push(
                  <div key="fast" className="flex flex-wrap items-center gap-x-2 text-xs text-stone-600">
                    <span className="font-medium text-stone-500">Phase 1:</span>
                    {fastCap != null && <span>~{fastCap} students</span>}
                    {fastDate && <span>· opens {formatOpeningDate(fastDate)}</span>}
                  </div>
                );
              }
              if (maxCap != null || maxDate != null) {
                rows.push(
                  <div key="max" className="flex flex-wrap items-center gap-x-2 text-xs text-stone-600">
                    <span className="font-medium text-stone-500">Full:</span>
                    {maxCap != null && <span>~{maxCap} students</span>}
                    {maxDate && <span>· opens {formatOpeningDate(maxDate)}</span>}
                  </div>
                );
              }
            } else {
              const capacity = fastCap ?? maxCap ?? fallbackCap;
              const opening =
                stage === "build_out" ? formatOpeningDate(fastDate ?? maxDate) :
                stage === "ready_to_open" ? formatOpeningDate(loc.openedAt) :
                null;
              const facts: { key: string; node: React.ReactNode }[] = [];
              if (capacity != null) facts.push({ key: "cap", node: <span>~{capacity} students</span> });
              if (opening) facts.push({ key: "open", node: <span>Opens {opening}</span> });
              if (facts.length > 0) {
                rows.push(
                  <div key="facts" className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-600">
                    {facts.map((f, i) => (
                      <span key={f.key} className="inline-flex items-center gap-x-2">
                        {i > 0 && <span aria-hidden="true">·</span>}
                        {f.node}
                      </span>
                    ))}
                  </div>
                );
              }
            }

            // REBL score badge — independent of capacity layout
            if (score != null) {
              rows.push(
                <div key="score" className="flex items-center gap-1 text-xs text-stone-600">
                  <span className={`inline-block w-2 h-2 rounded-full ${colorClass}`} />
                  REBL score {score}
                </div>
              );
            }

            // Upgrade-for hint
            if (loc.upgradeForLocationId) {
              const target = locations.find((l) => l.id === loc.upgradeForLocationId);
              if (target) {
                rows.push(
                  <div key="upgrade" className="text-xs text-emerald-700">
                    ↑ Upgrade for {extractStreet(target.address, target.city)}
                  </div>
                );
              }
            }

            if (rows.length === 0) return null;
            return <div className="mt-1 space-y-0.5">{rows}</div>;
          })()}

          {/* Mini stage timeline — engaged or committed only */}
          {showTimeline && (
            <div className="mt-2">
              <StageTimeline current={subStage} compact />
            </div>
          )}

          {/* Snapshot pill */}
          {snapshotPill && (
            <span className={`inline-block mt-2 text-[11px] font-medium px-2 py-0.5 rounded-full ${snapshotPill.className}`}>
              {snapshotPill.label}
            </span>
          )}

          {/* Vote stats */}
          {(loc.votes > 0 || voters.length > 0) && (
            <div className="flex items-center gap-2 mt-2.5">
              <AvatarRow voters={voters} />
              <span className="text-xs text-stone-700 font-medium">
                {loc.votes} {loc.votes === 1 ? "family" : "families"} in
              </span>
              {loc.notHereVotes > 0 && (
                <span className="text-xs text-amber-600">
                  · {loc.notHereVotes} concern{loc.notHereVotes !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

        </div>
    );
  };

  const TOP_N = 10;

  // Pagination — track extra pages loaded beyond first page (only used in "show all" mode)
  const [extraPages, setExtraPages] = useState(0);
  // Reset extra pages when sort or bounds change
  const resetKey = `${sortMode}-${altSizeFilter}-${showDriveFilter}-${showNoBlockers}-${mapBounds?.north}-${mapBounds?.south}-${mapBounds?.east}-${mapBounds?.west}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (extraPages !== 0) setExtraPages(0);
  }
  const listLocations = searchFilteredLocations;
  const visibleLocations = showTopOnly
    ? listLocations.slice(0, TOP_N)
    : listLocations.slice(0, (extraPages + 1) * PAGE_SIZE);

  // Load voter details for visible cards
  const visibleIdKey = visibleLocations.map(l => l.id).join(',');
  useEffect(() => {
    const ids = visibleLocations.map(l => l.id);
    if (ids.length > 0) loadLocationVoters(ids);
  }, [visibleIdKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Desktop: render detail view when a location is selected
  if (selectedLocation) {
    const voters = locationVoters.get(selectedLocation.id) || [];
    return (
      <LocationDetailView
        location={selectedLocation}
        voters={voters}
        hasVotedIn={votedLocationIds.has(selectedLocation.id)}
        hasVotedNotHere={votedNotHereIds.has(selectedLocation.id)}
        isAuthenticated={isAuthenticated}
        session={session}
        onBack={() => setSelectedLocation(null)}
        onVoteIn={() => voteIn(selectedLocation.id)}
        onVoteNotHere={(comment) => voteNotHere(selectedLocation.id, comment)}
        onRemoveVote={() => removeVote(selectedLocation.id)}
        onContributionSubmitted={() => loadLocationVoters([selectedLocation.id], true)}
        onUpdateVoteComment={(comment) => updateVoteComment(selectedLocation.id, comment)}
        distanceMi={userLocation ? getDistanceMiles(userLocation.lat, userLocation.lng, selectedLocation.lat, selectedLocation.lng) : null}
        initialTab={deepLinkTab || undefined}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <p className="text-lg font-bold text-blue-600 tracking-wide">
            ALPHA SCHOOL
            {metroName && !showCityCards ? (
              <button
                onClick={() => {
                  setSelectedLocation(null);
                  setFlyToTarget({ lat: 39.5, lng: -98.35, zoom: 4 });
                  setZoomLevel(4);
                }}
                title="Back to all metros"
                className="inline-flex items-center gap-0.5 hover:text-blue-700 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <span> &middot; {metroName.toUpperCase()}</span>
              </button>
            ) : metroName ? (
              <> &middot; {metroName.toUpperCase()}</>
            ) : null}
          </p>
          {isAdmin && (
            <button
              onClick={() => setViewAsParent(!viewAsParent)}
              className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md transition-colors shrink-0 ${
                viewAsParent
                  ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              <Eye className="h-3 w-3" />
              {viewAsParent ? "Parent" : "Admin"}
            </button>
          )}
        </div>
        <div className="flex justify-end mt-1">
          <ProfilePopover />
        </div>
        <div className="bg-blue-50 rounded-xl p-4 mt-2">
          <p className="text-sm font-semibold text-blue-600">Choose where your kid goes to school.</p>
          <p className="text-[13px] leading-snug text-gray-500 mt-0.5">
            Here are locations we&rsquo;re considering along with community opinions. Tell us if you like a location. Share what you know. Enough families, and it happens.
          </p>
        </div>
      </div>

      {/* Action boxes */}
      <div className="px-5 mb-4 space-y-3">
        {/* Suggest a location */}
        <a
          href="/suggest"
          className="block bg-blue-50 rounded-xl p-4 hover:bg-blue-100/60 transition-colors"
        >
          <p className="text-sm font-semibold text-blue-600">Suggest a location &rarr;</p>
          <p className="text-[13px] leading-snug text-gray-500 mt-0.5">Know a space that&apos;s not here? We&apos;ll evaluate it within 24 hours.</p>
        </a>
      </div>

      {showCityCards ? (
        /* Zoomed-out: curated active-metro cards */
        <div className="px-4 py-2 space-y-2" data-testid="metro-card-list">
          {metroCards.map((metro) => (
            <button
              key={metro.slug}
              data-testid="metro-card"
              data-metro-slug={metro.slug}
              onClick={() => setFlyToTarget({ lat: metro.lat, lng: metro.lng, zoom: metro.defaultZoom })}
              className="w-full p-4 bg-white rounded-xl border border-gray-200 text-left hover:border-blue-300 transition-colors"
            >
              <p className="font-semibold text-gray-900">{metro.displayName}</p>
            </button>
          ))}
        </div>
      ) : (
        /* Zoomed-in: location cards with sort pills */
        <>
          {/* Plan of Record + Category Highlights — only when in a metro view */}
          {metroName && !showCityCards && (
            <div className="border-b border-stone-200 pb-3">
              <PlanOfRecord metro={metroName} plan={curatedPlan} effectivePlan={effectivePlan} />
              {openCampuses.length > 0 && (
                <div className="mx-4 mb-3 p-3 bg-white border border-emerald-600 border-l-4 rounded">
                  <div className="mb-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      OPEN &middot; {openCampuses.length}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {openCampuses.map((l) => (
                      <RichCategoryCard
                        key={l.id}
                        loc={l}
                        planRole={getPlanRole(l.id, effectivePlan)}
                        problems={problemsBySite.get(l.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
              <CategorySection
                category="parent"
                locations={parentSites}
                renderCard={(l) => <RichCategoryCard key={l.id} loc={l} planRole={getPlanRole(l.id, effectivePlan)} problems={problemsBySite.get(l.id)} />}
              />
              <CategorySection
                category="ai"
                locations={aiActive}
                renderCard={(l) => <RichCategoryCard key={l.id} loc={l} planRole={getPlanRole(l.id, effectivePlan)} problems={problemsBySite.get(l.id)} />}
              />
              <CategorySection
                category="short_term"
                locations={shortTermSites}
                renderCard={(l) => <RichCategoryCard key={l.id} loc={l} planRole={getPlanRole(l.id, effectivePlan)} problems={problemsBySite.get(l.id)} />}
              />
            </div>
          )}

          {/* Candidates banner — gateway to the scored-site browser (metro view only) */}
          {metroName && !showCityCards && (
            <button
              onClick={() => setShowCandidatesPanel(!showCandidatesPanel)}
              className="mx-4 mb-3 mt-3 w-[calc(100%-2rem)] px-4 py-3 border border-stone-200 rounded-md bg-stone-50 hover:bg-stone-100 transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-stone-600">
                    Candidates
                  </div>
                  <div className="text-sm text-stone-500 mt-0.5">
                    {prospectsCount.toLocaleString()} {prospectsCount === 1 ? "prospect" : "prospects"} in this metro
                  </div>
                </div>
                <div className="text-sm text-blue-600 font-medium">
                  {showCandidatesPanel ? "Hide ↑" : "Browse + like →"}
                </div>
              </div>
            </button>
          )}

          {/* Existing flat candidates list — gated behind banner toggle in metro view, always shown otherwise */}
          {(!metroName || showCityCards || showCandidatesPanel) && (
          <>
          {/* Legend + Size filter + Sort pills */}
          <div className="px-5 pb-2 pt-1 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-2">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Promising</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Viable</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Needs Work</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500">Filter</span>
              <div className="relative" ref={sizePopoverRef}>
                <button
                  onClick={() => {
                    if (altSizeFilter === "all") {
                      setAltSizeFilter("micro");
                    } else {
                      setShowSizePopover(!showSizePopover);
                    }
                  }}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    altSizeFilter !== "all"
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {{ micro: "25-100 students", micro2: "100-200 students", growth: "200-500 students", full: "500+ students", all: "Size" }[altSizeFilter]}
                  {altSizeFilter !== "all" && (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
                {showSizePopover && altSizeFilter !== "all" && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
                    {([
                      { value: "micro" as const, label: "25-100 students", badge: "Focus" },
                      { value: "micro2" as const, label: "100-200 students" },
                      { value: "growth" as const, label: "200-500 students" },
                      { value: "full" as const, label: "500+ students" },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setAltSizeFilter(opt.value); setShowSizePopover(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 ${
                          altSizeFilter === opt.value ? 'text-blue-600 font-semibold' : 'text-gray-700'
                        }`}
                      >
                        {opt.label}
                        {opt.badge && (
                          <span className="text-[8px] font-bold text-white bg-amber-500 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            {opt.badge}
                          </span>
                        )}
                      </button>
                    ))}
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        onClick={() => { setAltSizeFilter("all"); setShowSizePopover(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50"
                      >
                        All
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {userLocation && (
                <div className="relative" ref={drivePopoverRef}>
                  <button
                    onClick={() => {
                      if (!showDriveFilter) {
                        setShowDriveFilter(true);
                      } else {
                        setShowDrivePopover(!showDrivePopover);
                      }
                    }}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      showDriveFilter
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <MapPin className="h-3 w-3" />
                    {showDriveFilter ? `${driveTimeMinutes} min` : 'Close to me'}
                    {showDriveFilter && (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                  {showDrivePopover && showDriveFilter && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[120px]">
                      {[10, 20, 30].map((mins) => (
                        <button
                          key={mins}
                          onClick={() => { setDriveTimeMinutes(mins); setShowDrivePopover(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                            driveTimeMinutes === mins ? 'text-violet-600 font-semibold' : 'text-gray-700'
                          }`}
                        >
                          {mins} minutes
                        </button>
                      ))}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                          onClick={() => { setShowDriveFilter(false); setShowDrivePopover(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50"
                        >
                          All
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => setShowNoBlockers(!showNoBlockers)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  showNoBlockers
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                No Blockers
              </button>
            </div>
          </div>
          <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Sort</span>
            <div className="relative" ref={subPopoverRef}>
              <button
                onClick={() => setShowSubPopover(!showSubPopover)}
                className="px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 bg-blue-600 text-white"
              >
                {sortMode === 'most_support' ? 'Popularity'
                  : viableSubPriority === 'zoning' ? 'Zoning approved'
                  : viableSubPriority === 'neighborhood' ? 'Demographics'
                  : 'Overall'}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showSubPopover && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
                  {([
                    { label: 'Overall', mode: 'most_viable' as const, sub: null },
                    { label: 'Popularity', mode: 'most_support' as const, sub: null },
                    { label: 'Zoning approved', mode: 'most_viable' as const, sub: 'zoning' as const },
                    { label: 'Demographics', mode: 'most_viable' as const, sub: 'neighborhood' as const },
                  ]).map((opt) => {
                    const isActive = sortMode === opt.mode && viableSubPriority === opt.sub;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => {
                          setSortMode(opt.mode);
                          setViableSubPriority(opt.sub);
                          setShowSubPopover(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                          isActive ? 'text-blue-600 font-semibold' : 'text-gray-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {/* Search + Show all row */}
          <div className="px-5 pb-3 flex items-center gap-2">
            <div className="flex items-center flex-1 gap-1 relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                placeholder="Search address..."
                className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 rounded-full focus:outline-none focus:border-blue-400"
              />
              {adminSearch && (
                <button
                  onClick={() => setAdminSearch("")}
                  className="absolute right-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xs text-stone-500 shrink-0">
              {showTopOnly && listLocations.length > TOP_N
                ? `Top ${TOP_N} of ${listLocations.length} in view`
                : `${listLocations.length} in view`}
            </div>
            <button
              onClick={() => { setShowTopOnly(!showTopOnly); setExtraPages(0); }}
              className="ml-2 text-xs text-blue-600 font-medium hover:underline shrink-0"
            >
              {showTopOnly ? `Show all (${searchFilteredLocations.length})` : 'Top 10'}
            </button>
          </div>

          {/* Location cards */}
          <div className="px-5 pb-5 space-y-3">
            {visibleLocations.map((loc) => (
              <AltLocationCard
                key={loc.id}
                location={loc}
                voters={locationVoters.get(loc.id) || []}
                isSelected={false}
                isProposed={false}
                distanceMi={userLocation ? getDistanceMiles(userLocation.lat, userLocation.lng, loc.lat, loc.lng) : null}
                onSelect={() => {
                  setSelectedLocation(loc.id);
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                    router.push(`/location/${loc.id}`);
                  }
                }}
              />
            ))}
            {!showTopOnly && listLocations.length > visibleLocations.length && (
              <button
                onClick={() => setExtraPages(p => p + 1)}
                className="w-full py-2 text-sm text-blue-600 font-medium hover:underline"
              >
                Show more locations
              </button>
            )}
            {visibleLocations.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">
                No locations in this area yet. Zoom out or search a different city.
              </p>
            )}

          </div>
          </>
          )}

          {/* Funnel footer — context for the candidate browse list */}
          {metroName && !showCityCards && (
            <div className="mx-5 mt-4 mb-5 pt-4 border-t border-stone-200 text-xs text-stone-500">
              <div>
                From {prospectsCount} prospect{prospectsCount === 1 ? "" : "s"}, {aiActive.length + parentSites.length} in diligence/committed, {buildOutCount} in build-out and {openCampuses.length} open.
                {movedOnSites.length > 0 && (
                  <button
                    onClick={() => setShowMovedOn(s => !s)}
                    className="ml-2 text-blue-600 hover:underline"
                  >
                    {showMovedOn ? "Hide" : "Recently moved on"} ({movedOnSites.length}) {showMovedOn ? "↑" : "→"}
                  </button>
                )}
              </div>
              {showMovedOn && movedOnSites.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {movedOnSites.map(loc => (
                    <li key={loc.id} className="text-stone-400 italic">
                      <button
                        onClick={() => {
                          setSelectedLocation(loc.id);
                          if (typeof window !== "undefined" && window.innerWidth < 1024) {
                            router.push(`/location/${loc.id}`);
                          }
                        }}
                        className="text-left hover:underline"
                      >
                        {loc.address}, {loc.city}
                        {loc.derived?.movedOnReason && (
                          <span className="ml-2 not-italic text-stone-500">— {loc.derived.movedOnReason}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
