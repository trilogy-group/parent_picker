import { describe, it, expect } from 'vitest';
import { parseCommittedSubStage, parseMovedOnReason } from './parser';

describe('parseCommittedSubStage', () => {
  it('returns loi when only loi is set', () => {
    expect(parseCommittedSubStage({ loi: 'signed' })).toBe('loi');
  });

  it('returns lease when lease execution date is present', () => {
    expect(parseCommittedSubStage({
      loi: 'signed',
      leaseDetails: { lease_executed_at: '2026-04-01' }
    })).toBe('lease');
  });

  it('returns zoning when zoning approval is in progress', () => {
    expect(parseCommittedSubStage({
      loi: 'signed',
      leaseDetails: { lease_executed_at: '2026-04-01' },
      zoningStatus: 'pending'
    })).toBe('zoning');
  });

  it('returns permits when zoning is approved and permits submitted', () => {
    expect(parseCommittedSubStage({
      loi: 'signed',
      leaseDetails: { lease_executed_at: '2026-04-01' },
      zoningStatus: 'approved',
      permitsDetails: { submitted_at: '2026-05-01' },
    })).toBe('permits');
  });

  it('returns buildout when permits approved and buildout started', () => {
    expect(parseCommittedSubStage({
      loi: 'signed',
      leaseDetails: { lease_executed_at: '2026-04-01' },
      zoningStatus: 'approved',
      permitsDetails: { submitted_at: '2026-05-01', approved_at: '2026-05-15' },
      buildoutDetails: { started_at: '2026-06-01' },
    })).toBe('buildout');
  });

  it('returns co when CO received', () => {
    expect(parseCommittedSubStage({
      loi: 'signed',
      coReceivedAt: '2026-08-01',
    })).toBe('co');
  });
});

describe('parseMovedOnReason', () => {
  it('returns reason from process_exception details', () => {
    const reason = parseMovedOnReason({
      leasing: 'done',
      leasingDetails: { process_exception: true, exception_reason: 'lease-not-signed' },
    });
    expect(reason).toMatch(/lease.*not.*signed/i);
  });

  it('returns "Owner withdrew" when leasing=cut with owner_withdrew', () => {
    const reason = parseMovedOnReason({
      leasing: 'cut',
      leasingDetails: { reason: 'owner-withdrew' },
    });
    expect(reason).toMatch(/owner withdrew/i);
  });

  it('returns generic "Moved on" when leasing=cut without details', () => {
    const reason = parseMovedOnReason({ leasing: 'cut' });
    expect(reason).toMatch(/moved on/i);
  });

  it('returns null when not moved on', () => {
    expect(parseMovedOnReason({ leasing: 'turn_1' })).toBeNull();
  });
});
