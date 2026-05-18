import type { Location } from "@/types";

/**
 * Compose a short human-readable pipeline status from leasing+loi state.
 * Returns null if the site has no REBL pipeline activity (i.e. it's still
 * just a scored candidate).
 *
 * Reads from `loc.derived.leasingStatus` / `loc.derived.loiStatus` which are
 * surfaced by `applyDerived()` in `src/lib/locations.ts`.
 */
export function formatPipelineStatus(loc: Location): string | null {
  const stage = loc.derived?.stage;
  // Open campuses don't show pipeline status — the school is operating, and
  // REBL leasing/loi values are often stale for these sites (e.g. 353 Hiatt
  // has loi=done/leasing=claimed but is Open).
  if (stage === "open") return null;

  const leasing = loc.derived?.leasingStatus ?? null;
  const loi = loc.derived?.loiStatus ?? null;

  // Moved-on / killed deals
  if (leasing === "cut" || loi === "cut") return "Deal cancelled";

  // Lease executed (committed)
  if (leasing === "done") return "Lease executed";

  // Active landlord conversation (post-LOI, pre-lease-signed)
  if (leasing === "ready") return "Lease ready for signing";
  if (leasing === "negotiating") return "Lease negotiating";
  if (leasing === "received") return "Lease received";
  if (leasing === "claimed") return "Lease prep";
  if (leasing === "reset") return "Lease restarted";
  const turnMatch = typeof leasing === "string" ? leasing.match(/^turn_(\d+)$/) : null;
  if (turnMatch) return `Landlord turn ${turnMatch[1]}`;

  // LOI states (no leasing yet, or leasing not in known set)
  if (loi === "submitted") return "LOI sent to landlord";
  if (loi === "claimed") return "REBL pursuing LOI";
  if (loi === "done" || loi === "signed" || loi === "loi-signed" || loi === "completed") {
    return "LOI signed";
  }

  return null;
}
