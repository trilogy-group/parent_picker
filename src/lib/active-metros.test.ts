import { describe, it, expect } from "vitest";
import {
  ACTIVE_METROS,
  ALL_METROS,
  findActiveMetro,
  getActiveMetroBySlug,
  getActiveMetroByDisplayName,
} from "./active-metros";

describe("metro inventory data integrity", () => {
  // ALL_METROS = full catalog (includes stashed/disabled). ACTIVE_METROS is
  // the runtime-visible subset filtered by ENABLED_METRO_SLUGS.
  it("ALL_METROS has at least 10 metros catalogued", () => {
    expect(ALL_METROS.length).toBeGreaterThanOrEqual(10);
  });

  it("ALL_METROS has unique slugs", () => {
    const slugs = ALL_METROS.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("ALL_METROS has unique display names", () => {
    const names = ALL_METROS.map((m) => m.displayName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every catalogued metro has plausible lat/lng/zoom/radius", () => {
    for (const m of ALL_METROS) {
      expect(m.lat).toBeGreaterThan(15);
      expect(m.lat).toBeLessThan(50);
      expect(m.lng).toBeGreaterThan(-130);
      expect(m.lng).toBeLessThan(-65);
      expect(m.defaultZoom).toBeGreaterThanOrEqual(8);
      expect(m.defaultZoom).toBeLessThanOrEqual(13);
      expect(m.radiusMiles).toBeGreaterThan(10);
      expect(m.radiusMiles).toBeLessThan(150);
    }
  });

  it("ACTIVE_METROS is a non-empty subset of ALL_METROS", () => {
    expect(ACTIVE_METROS.length).toBeGreaterThan(0);
    const allSlugs = new Set(ALL_METROS.map((m) => m.slug));
    for (const m of ACTIVE_METROS) expect(allSlugs.has(m.slug)).toBe(true);
  });
});

describe("findActiveMetro", () => {
  it("returns the metro for a point inside its radius", () => {
    // Miami center
    const m = findActiveMetro(25.7617, -80.1918);
    expect(m?.slug).toBe("miami");
  });

  it("returns null for a point far from every active metro", () => {
    expect(findActiveMetro(43.0, -107.5)).toBeNull();
  });

  it("returns the nearer metro when two radii overlap", () => {
    // Point in Miami Beach is also within Miami's 40mi radius; should pick miami-beach
    const m = findActiveMetro(25.81, -80.14);
    expect(m?.slug).toBe("miami-beach");
  });

  it("returns the metro itself for a point exactly at its center", () => {
    const target = ACTIVE_METROS[0];
    const m = findActiveMetro(target.lat, target.lng);
    expect(m?.slug).toBe(target.slug);
  });
});

describe("getActiveMetroBySlug", () => {
  it("returns the matching metro", () => {
    expect(getActiveMetroBySlug("miami")?.displayName).toBe("Miami");
  });

  it("returns null for an unknown slug", () => {
    expect(getActiveMetroBySlug("not-a-real-slug")).toBeNull();
  });
});

describe("getActiveMetroByDisplayName", () => {
  it("returns the matching metro", () => {
    expect(getActiveMetroByDisplayName("Miami Beach")?.slug).toBe("miami-beach");
  });

  it("returns null for an unknown name", () => {
    expect(getActiveMetroByDisplayName("Nowhere")).toBeNull();
  });
});
