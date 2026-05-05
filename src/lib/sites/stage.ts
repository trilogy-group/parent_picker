import type { SiteStage } from '@/types';

export interface StageInput {
  leasing?: string | null;
  loi?: string | null;
  leasingDetails?: { process_exception?: boolean; [k: string]: unknown };
}

const ENGAGED_LEASING = new Set(['turn_1', 'turn_2', 'turn_3', 'ready']);
const ENGAGED_LOI = new Set(['claimed']);
const COMMITTED_LOI = new Set(['signed', 'loi-signed', 'done', 'completed']);
const MOVED_ON_LEASING = new Set(['cut']);
const MOVED_ON_LOI = new Set(['cut']);

export function getStage(input: StageInput): SiteStage {
  // Moved On takes top priority — definitive end state
  if (input.leasing && MOVED_ON_LEASING.has(input.leasing)) return 'moved_on';
  if (input.loi && MOVED_ON_LOI.has(input.loi)) return 'moved_on';
  if (input.leasing === 'done' && input.leasingDetails?.process_exception === true) {
    return 'moved_on';
  }

  // Committed (LOI signed) — survives past leasing transitioning
  if (input.loi && COMMITTED_LOI.has(input.loi)) return 'committed';

  // Engaged: active landlord conversation OR REBL has staked the LOI
  if (input.leasing && ENGAGED_LEASING.has(input.leasing)) return 'engaged';
  if (input.loi && ENGAGED_LOI.has(input.loi)) return 'engaged';

  return 'scored';
}
