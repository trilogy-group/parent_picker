import type { SiteStage } from '@/types';

export interface StageInput {
  leasing?: string | null;
  loi?: string | null;
  strategy?: string | null;
  leasingDetails?: { process_exception?: boolean; [k: string]: unknown };
  // `opened_at` from pp_locations (timestamptz). When set, signals school is
  // operating (Open) or about to (Ready to open) — supersedes the pipeline.
  openedAt?: string | null;
  // Override "now" for deterministic tests.
  now?: Date;
}

// Stage taxonomy (parent-visible pipeline):
//   prospect          → not yet pursued (or pre-LOI activity)
//   diligence         → LOI signed (loi='done'), working out lease terms
//   ready_to_commit   → lease terms ready to sign (leasing='ready') + LOI done
//   build_out         → lease signed (leasing='done'), school under construction
//   ready_to_open     → construction done, opened_at in the future
//   open              → opened_at <= now
//   moved_on          → killed / cut / process-exception

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

  // 2. Open / Ready to open — opened_at signals school is/will be operating.
  // Beats the leasing pipeline because pipeline often stays stale on open sites.
  if (input.openedAt) {
    const opened = new Date(input.openedAt);
    if (!Number.isNaN(opened.getTime())) {
      return opened <= (input.now ?? new Date()) ? 'open' : 'ready_to_open';
    }
  }

  // 3. Build-out — lease executed (binding contract). No opened_at yet.
  if (input.leasing === 'done') return 'build_out';

  // 4. Ready to commit — lease terms ready to sign + diligence (LOI) done.
  if (input.loi === 'done' && input.leasing === 'ready') return 'ready_to_commit';

  // 5. Diligence — LOI signed, working out lease and DD.
  if (input.loi === 'done') return 'diligence';

  // 6. Prospect — everything else (pre-LOI activity collapses here).
  return 'prospect';
}
