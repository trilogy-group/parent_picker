import type { SiteStage } from '@/types';

export interface StageInput {
  leasing?: string | null;
  loi?: string | null;
  strategy?: string | null;
  leasingDetails?: { process_exception?: boolean; [k: string]: unknown };
  // `opened_at` from pp_locations (timestamptz). When set, signals school is
  // operating (Open) or about to (Ready) — supersedes the leasing/loi pipeline.
  openedAt?: string | null;
  // Override "now" for deterministic tests.
  now?: Date;
}

// COMMITTED is reserved for the binding moment — lease signed. LOI signing is
// material progress but still engaged (LOI is non-binding). Any other in-flight
// leasing/loi state is engaged. This is forward-compatible: new REBL state vocab
// surfaces as engaged instead of silently falling back to scored.

const MOVED_ON_LEASING = new Set(['cut']);
const MOVED_ON_LOI = new Set(['cut']);

export function getStage(input: StageInput): SiteStage {
  // Moved On — definitive end state, takes top priority. strategy='kill' is
  // REBL's authoritative kill signal (used by pp_watch_loi_status to demote);
  // it can be set while leasing/loi remain in non-cut states.
  if (input.strategy === 'kill') return 'moved_on';
  if (input.leasing && MOVED_ON_LEASING.has(input.leasing)) return 'moved_on';
  if (input.loi && MOVED_ON_LOI.has(input.loi)) return 'moved_on';
  if (input.leasing === 'done' && input.leasingDetails?.process_exception === true) {
    return 'moved_on';
  }

  // Open / Ready — opened_at signals school is/will be operating. Beats the
  // leasing pipeline because the pipeline often stays stale ("loi=done,
  // leasing=claimed") on already-open campuses.
  if (input.openedAt) {
    const opened = new Date(input.openedAt);
    if (!Number.isNaN(opened.getTime())) {
      return opened <= (input.now ?? new Date()) ? 'open' : 'ready';
    }
  }

  // Committed — lease executed (binding contract)
  if (input.leasing === 'done') return 'committed';

  // Engaged — any other active leasing/loi state means REBL is working on this site
  // (LOI signed counts here — it's progress but not yet binding)
  if (input.leasing) return 'engaged';
  if (input.loi) return 'engaged';

  return 'scored';
}
