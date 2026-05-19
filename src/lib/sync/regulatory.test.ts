import { describe, it, expect } from "vitest";
import { computeRegulatorySyncOps, RegulatoryIssue, ExistingProblem } from "./regulatory";

const SITE = "site-uuid-1";
const METRO = "Nashville";

const issueA: RegulatoryIssue = {
  name: "Need school-use variance from Metro Council",
  type: "zoning",
  severity: "H",
};

describe("computeRegulatorySyncOps", () => {
  it("inserts new issues with parent_ownable=false and source_ref set", () => {
    const ops = computeRegulatorySyncOps({
      siteId: SITE,
      metro: METRO,
      rebl3SiteId: "rebl3-slug",
      issues: [issueA],
      existing: [],
    });
    expect(ops.insert).toHaveLength(1);
    expect(ops.insert[0]).toMatchObject({
      site_id: SITE,
      metro: METRO,
      title: issueA.name,
      category: "zoning",
      severity: "H",
      parent_ownable: false,
      source_ref: { system: "regulatory", site_id: "rebl3-slug", name: issueA.name },
      status: "open",
    });
    expect(ops.update).toHaveLength(0);
    expect(ops.skip).toHaveLength(0);
  });

  it("is idempotent — same payload twice produces zero ops the second time", () => {
    const inserted: ExistingProblem = {
      id: "p1",
      title: issueA.name,
      category: "zoning",
      severity: "H",
      adminEditedAt: null,
      sourceRef: { system: "regulatory", site_id: "rebl3-slug", name: issueA.name },
    };
    const ops = computeRegulatorySyncOps({
      siteId: SITE,
      metro: METRO,
      rebl3SiteId: "rebl3-slug",
      issues: [issueA],
      existing: [inserted],
    });
    expect(ops.insert).toHaveLength(0);
    expect(ops.update).toHaveLength(0);
    expect(ops.skip).toContainEqual({ reason: "no-change", id: "p1" });
  });

  it("updates title/category/severity when row is not admin-edited", () => {
    const stale: ExistingProblem = {
      id: "p1",
      title: "old name",
      category: "other",
      severity: "L",
      adminEditedAt: null,
      sourceRef: { system: "regulatory", site_id: "rebl3-slug", name: issueA.name },
    };
    const ops = computeRegulatorySyncOps({
      siteId: SITE,
      metro: METRO,
      rebl3SiteId: "rebl3-slug",
      issues: [issueA],
      existing: [stale],
    });
    expect(ops.update).toHaveLength(1);
    expect(ops.update[0]).toMatchObject({
      id: "p1",
      patch: { title: issueA.name, category: "zoning", severity: "H" },
    });
  });

  it("does NOT overwrite admin-edited rows", () => {
    const edited: ExistingProblem = {
      id: "p1",
      title: "Get a play-area variance from Nashville Metro Council",
      category: "zoning",
      severity: "H",
      adminEditedAt: "2026-05-08T10:00:00Z",
      sourceRef: { system: "regulatory", site_id: "rebl3-slug", name: issueA.name },
    };
    const ops = computeRegulatorySyncOps({
      siteId: SITE,
      metro: METRO,
      rebl3SiteId: "rebl3-slug",
      issues: [{ ...issueA, severity: "M" }],
      existing: [edited],
    });
    expect(ops.insert).toHaveLength(0);
    expect(ops.update).toHaveLength(0);
    expect(ops.skip).toContainEqual({ reason: "admin-edited", id: "p1" });
  });

  it("never sets parent_ownable from REBL on update", () => {
    const stale: ExistingProblem = {
      id: "p1",
      title: issueA.name,
      category: "other",
      severity: "L",
      adminEditedAt: null,
      sourceRef: { system: "regulatory", site_id: "rebl3-slug", name: issueA.name },
    };
    const ops = computeRegulatorySyncOps({
      siteId: SITE,
      metro: METRO,
      rebl3SiteId: "rebl3-slug",
      issues: [issueA],
      existing: [stale],
    });
    expect(ops.update[0].patch).not.toHaveProperty("parent_ownable");
  });

  it("flags orphan rows when REBL drops them from payload", () => {
    const orphan: ExistingProblem = {
      id: "p1",
      title: "Old issue REBL no longer reports",
      category: "zoning",
      severity: "M",
      adminEditedAt: null,
      sourceRef: { system: "regulatory", site_id: "rebl3-slug", name: "Old issue REBL no longer reports" },
    };
    const ops = computeRegulatorySyncOps({
      siteId: SITE,
      metro: METRO,
      rebl3SiteId: "rebl3-slug",
      issues: [issueA],
      existing: [orphan],
    });
    expect(ops.skip).toContainEqual({ reason: "orphan", id: "p1" });
    expect(ops.insert).toHaveLength(1);
  });

  it("clamps unknown type to 'other' on insert", () => {
    const ops = computeRegulatorySyncOps({
      siteId: SITE,
      metro: METRO,
      rebl3SiteId: "rebl3-slug",
      issues: [{ name: "weird", type: "frobnicate", severity: "M" }],
      existing: [],
    });
    expect(ops.insert[0].category).toBe("other");
  });

  it("clamps unknown severity to 'M' on insert", () => {
    const ops = computeRegulatorySyncOps({
      siteId: SITE,
      metro: METRO,
      rebl3SiteId: "rebl3-slug",
      issues: [{ name: "weird", type: "zoning", severity: "X" }],
      existing: [],
    });
    expect(ops.insert[0].severity).toBe("M");
  });

  it("ignores existing rows whose sourceRef is null (admin-typed, not regulatory)", () => {
    const adminTyped: ExistingProblem = {
      id: "p1",
      title: "Recruit more Austin parents",
      category: "other",
      severity: "M",
      adminEditedAt: "2026-05-08T10:00:00Z",
      sourceRef: null,
    };
    const ops = computeRegulatorySyncOps({
      siteId: SITE,
      metro: METRO,
      rebl3SiteId: "rebl3-slug",
      issues: [issueA],
      existing: [adminTyped],
    });
    // Should insert issueA (no existing match by name) and not flag adminTyped as anything
    expect(ops.insert).toHaveLength(1);
    expect(ops.skip.find(s => s.id === "p1")).toBeUndefined();
  });
});
