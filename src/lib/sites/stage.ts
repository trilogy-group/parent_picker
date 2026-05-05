import type { SiteStage } from '@/types';

export interface StageInput {
  leasing?: string | null;
  loi?: string | null;
  leasingDetails?: { process_exception?: boolean; [k: string]: unknown };
}

// We enumerate the well-defined "end states" explicitly; everything else with
// any non-null leasing or loi value is treated as engaged. This is forward-
// compatible: new REBL state vocab (e.g., 'negotiating', 'received') will
// surface as engaged instead of silently falling back to scored.

const COMMITTED_LOI = new Set(['signed', 'loi-signed', 'done', 'completed']);
const MOVED_ON_LEASING = new Set(['cut']);
const MOVED_ON_LOI = new Set(['cut']);

export function getStage(input: StageInput): SiteStage {
  // Moved On — definitive end state, takes top priority
  if (input.leasing && MOVED_ON_LEASING.has(input.leasing)) return 'moved_on';
  if (input.loi && MOVED_ON_LOI.has(input.loi)) return 'moved_on';
  if (input.leasing === 'done' && input.leasingDetails?.process_exception === true) {
    return 'moved_on';
  }

  // Committed — LOI signed (or lease executed, which implies LOI signed)
  if (input.loi && COMMITTED_LOI.has(input.loi)) return 'committed';
  if (input.leasing === 'done') return 'committed';

  // Engaged — any other active leasing/loi state means REBL is working on this site
  if (input.leasing) return 'engaged';
  if (input.loi) return 'engaged';

  return 'scored';
}
