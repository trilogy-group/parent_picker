import { describe, it, expect } from "vitest";
import {
  ACTIVE_METROS,
  findActiveMetro,
  getActiveMetroBySlug,
  getActiveMetroByDisplayName,
} from "./active-metros";

describe("ACTIVE_METROS data integrity", () => {
  it("has at least 10 metros seeded", () => {
    expect(ACTIVE_METROS.length).toBeGreaterThanOrEqual(10);
  });

  it("has unique slugs", () => {
    const slugs = ACTIVE_METROS.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has unique display names", () => {
    const names = ACTIVE_METROS.map((m) => m.displayName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every metro has plausible lat/lng/zoom/radius", () => {
    for (const m of ACTIVE_METROS) {
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
});

describe("findActiveMetro", () => {
  it("returns the metro for a point inside its radius", () => {
    const m = findActiveMetro(30.2672, -97.7431);
    expect(m?.slug).toBe("austin");
  });

  it("returns null for a point far from every active metro", () => {
    expect(findActiveMetro(43.0, -107.5)).toBeNull();
  });

  it("returns the nearer metro when two radii overlap", () => {
    const m = findActiveMetro(33.8366, -117.9143);
    expect(m?.slug).toBe("oc");
  });

  it("returns the metro itself for a point exactly at its center", () => {
    const target = ACTIVE_METROS[0];
    const m = findActiveMetro(target.lat, target.lng);
    expect(m?.slug).toBe(target.slug);
  });
});

describe("getActiveMetroBySlug", () => {
  it("returns the matching metro", () => {
    expect(getActiveMetroBySlug("austin")?.displayName).toBe("Austin");
  });

  it("returns null for an unknown slug", () => {
    expect(getActiveMetroBySlug("not-a-real-slug")).toBeNull();
  });
});

describe("getActiveMetroByDisplayName", () => {
  it("returns the matching metro", () => {
    expect(getActiveMetroByDisplayName("New York")?.slug).toBe("nyc");
  });

  it("returns null for an unknown name", () => {
    expect(getActiveMetroByDisplayName("Nowhere")).toBeNull();
  });
});
