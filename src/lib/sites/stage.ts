import type { SiteStage } from '@/types';

export interface StageInput {
  leasing?: string | null;
  loi?: string | null;
  leasingDetails?: { process_exception?: boolean; [k: string]: unknown };
}

const ENGAGED_LEASING = new Set(['turn_1', 'turn_2', 'turn_3', 'ready']);
const COMMITTED_LOI = new Set(['signed', 'loi-signed', 'done', 'completed']);
const MOVED_ON_LEASING = new Set(['cut']);

export function getStage(input: StageInput): SiteStage {
  if (input.leasing && MOVED_ON_LEASING.has(input.leasing)) return 'moved_on';
  if (input.leasing === 'done' && input.leasingDetails?.process_exception === true) {
    return 'moved_on';
  }
  if (input.loi && COMMITTED_LOI.has(input.loi)) return 'committed';
  if (input.leasing && ENGAGED_LEASING.has(input.leasing)) return 'engaged';
  return 'scored';
}
