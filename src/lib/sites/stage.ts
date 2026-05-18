import type { SiteStage } from '@/types';

export interface StageInput {
  leasing?: string | null;
  loi?: string | null;
  strategy?: string | null;
  leasingDetails?: { process_exception?: boolean; [k: string]: unknown };
  // `opened_at` from pp_locations (timestamptz). When set, signals school is
  // operating (Open) or about to (still in build-out with a known target).
  openedAt?: string | null;
  // Override "now" for deterministic tests.
  now?: Date;
}

// Stage taxonomy (parent-visible pipeline) — 4 active stages + moved_on:
//   prospecting → pre-LOI activity, evaluating fit
//   diligence   → LOI signed, working out lease terms (incl. lease-ready)
//   build_out   → lease signed, school under construction / awaiting first day
//   open        → school operating
//   moved_on    → killed / cut / process-exception
//
// Collapsed from prior 6-stage model: `ready_to_commit` folds into diligence
// (still pre-signature), `ready_to_open` folds into build_out (still pre-open).

const MOVED_ON_LEASING = new Set(['cut']);
const MOVED_ON_LOI = new Set(['cut']);

export function getStage(input: StageInput): SiteStage {
  // 1. Moved On — highest priority, terminal end state.
  if (input.strategy === 'kill') return 'moved_on';
  if (input.leasing && MOVED_ON_LEASING.has(input.leasing)) return 'moved_on';
  if (input.loi && MOVED_ON_LOI.has(input.loi)) return 'moved_on';
  if (input.leasing === 'done' && input.leasingDetails?.process_exception === true) {
    return 'moved_on';
  }

  // 2. Open / Build-out (with opened_at) — opened_at signals school is/will be
  // operating. Beats the leasing pipeline because pipeline often stays stale
  // on open sites. Future opened_at stays in build_out (collapsed from former
  // 'ready_to_open' — same actors, calendar gap until doors open).
  if (input.openedAt) {
    const opened = new Date(input.openedAt);
    if (!Number.isNaN(opened.getTime())) {
      return opened <= (input.now ?? new Date()) ? 'open' : 'build_out';
    }
  }

  // 3. Build-out — lease executed (binding contract).
  if (input.leasing === 'done') return 'build_out';

  // 4. Diligence — LOI signed; includes lease-ready (formerly its own
  // 'ready_to_commit' stage — same activity, no behavior change for parents).
  if (input.loi === 'done') return 'diligence';

  // 5. Prospecting — everything else (pre-LOI activity collapses here).
  return 'prospecting';
}
