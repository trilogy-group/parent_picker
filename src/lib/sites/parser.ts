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

export function parseCommittedSubStage(input: ParserInput): CommittedSubStage {
  if (input.coReceivedAt) return 'co';
  if (input.buildoutDetails?.started_at) return 'buildout';
  if (input.permitsDetails?.submitted_at) return 'permits';
  if (input.zoningStatus === 'pending') return 'zoning';
  if (input.zoningStatus === 'approved' && !input.permitsDetails?.submitted_at) {
    return 'zoning';
  }
  if (input.leaseDetails?.lease_executed_at) return 'lease';
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
    if (!code) return 'Process exception (reason unknown)';
    const label = MOVE_ON_REASON_LABELS[code];
    // Surface the raw code alongside any humanized label so callers can
    // distinguish exception kinds programmatically.
    return label ? `${label} (${code})` : `Process exception (${code})`;
  }

  if (input.leasing === 'cut') {
    const code = input.leasingDetails?.reason ?? '';
    return MOVE_ON_REASON_LABELS[code] ?? 'Moved on';
  }

  return null;
}
