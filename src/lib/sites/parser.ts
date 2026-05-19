import type { CommittedSubStage } from '@/types';

export interface ParserInput {
  loi?: string | null;
  leasing?: string | null;
  leasingDetails?: { process_exception?: boolean; reason?: string; exception_reason?: string; [k: string]: unknown };
  leaseDetails?: { lease_executed_at?: string; [k: string]: unknown };
  zoningStatus?: 'not_required' | 'pending' | 'approved' | 'denied' | string;
  zoningApprovedAt?: string;
  permitsDetails?: { submitted_at?: string; approved_at?: string; [k: string]: unknown };
  buildoutDetails?: { started_at?: string; complete_at?: string; [k: string]: unknown };
  coReceivedAt?: string;
}

const LOI_SIGNED = new Set(['done', 'signed', 'loi-signed', 'completed']);

export function parseCommittedSubStage(input: ParserInput): CommittedSubStage {
  // Structured milestones (V2; not yet populated by REBL but supported)
  if (input.coReceivedAt) return 'co';
  if (input.buildoutDetails?.started_at) return 'buildout';
  if (input.permitsDetails?.submitted_at) return 'permits';
  if (input.zoningStatus === 'pending') return 'zoning';
  if (input.zoningStatus === 'approved' && !input.permitsDetails?.submitted_at) {
    return 'zoning';
  }
  if (input.leaseDetails?.lease_executed_at) return 'lease';

  // V1 inference from leasing/loi status only.
  // Lease executed → past lease step (best effort: zoning is current)
  if (input.leasing === 'done') return 'zoning';
  // Active lease activity (turn_X / ready / negotiating / claimed / received / reset)
  if (input.leasing) return 'lease';
  // LOI signed → lease step current (waiting on lease)
  if (input.loi && LOI_SIGNED.has(input.loi)) return 'lease';
  // Pre-LOI-signed (claimed / submitted / etc.) → still on LOI step
  return 'loi';
}

const MOVE_ON_REASON_LABELS: Record<string, string> = {
  'owner-withdrew': 'Owner withdrew',
  'zoning-blocked': 'Zoning blocked',
  'building-unfit': 'Building unfit',
  'pricing-failed': 'Pricing fell through',
  'lease-not-signed': 'Lease not signed',
};

export function parseMovedOnReason(input: ParserInput): string | null {
  if (input.leasing === 'done' && input.leasingDetails?.process_exception) {
    const code = input.leasingDetails.exception_reason ?? '';
    return MOVE_ON_REASON_LABELS[code] ?? `Process exception (${code || 'reason unknown'})`;
  }

  if (input.leasing === 'cut') {
    const code = input.leasingDetails?.reason ?? '';
    return MOVE_ON_REASON_LABELS[code] ?? 'Moved on';
  }

  return null;
}
