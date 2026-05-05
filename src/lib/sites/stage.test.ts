import { describe, it, expect } from 'vitest';
import { getStage } from './stage';

describe('getStage', () => {
  it('returns scored when no leasing or loi data', () => {
    expect(getStage({})).toBe('scored');
  });

  it('returns engaged when leasing is in active landlord conversation', () => {
    expect(getStage({ leasing: 'turn_1' })).toBe('engaged');
    expect(getStage({ leasing: 'turn_2' })).toBe('engaged');
    expect(getStage({ leasing: 'turn_3' })).toBe('engaged');
    expect(getStage({ leasing: 'ready' })).toBe('engaged');
  });

  it('returns engaged when loi is claimed (REBL pursuing the site, no landlord turns yet)', () => {
    expect(getStage({ loi: 'claimed' })).toBe('engaged');
  });

  it('returns engaged when loi is submitted (LOI sent to landlord)', () => {
    expect(getStage({ loi: 'submitted' })).toBe('engaged');
  });

  it('returns engaged for other in-flight leasing states', () => {
    // Any non-cut/non-done leasing value means REBL is actively working the site.
    expect(getStage({ leasing: 'claimed' })).toBe('engaged');
    expect(getStage({ leasing: 'negotiating' })).toBe('engaged');
    expect(getStage({ leasing: 'received' })).toBe('engaged');
    expect(getStage({ leasing: 'reset' })).toBe('engaged');
  });

  it('returns committed when leasing=done (lease executed) without process_exception', () => {
    expect(getStage({ leasing: 'done' })).toBe('committed');
  });

  it('forward-compatible: any unknown non-null loi/leasing value is engaged', () => {
    expect(getStage({ loi: 'some-future-state' })).toBe('engaged');
    expect(getStage({ leasing: 'some-future-state' })).toBe('engaged');
  });

  it('returns committed when LOI is signed', () => {
    expect(getStage({ loi: 'signed' })).toBe('committed');
    expect(getStage({ loi: 'loi-signed' })).toBe('committed');
    expect(getStage({ loi: 'done' })).toBe('committed');
    expect(getStage({ loi: 'completed' })).toBe('committed');
  });

  it('returns moved_on when leasing is cut', () => {
    expect(getStage({ leasing: 'cut' })).toBe('moved_on');
  });

  it('returns moved_on when loi is cut (LOI process killed)', () => {
    expect(getStage({ loi: 'cut' })).toBe('moved_on');
  });

  it('returns moved_on when leasing is done with process_exception', () => {
    expect(getStage({ leasing: 'done', leasingDetails: { process_exception: true } })).toBe('moved_on');
  });

  it('committed takes precedence over engaged', () => {
    expect(getStage({ leasing: 'ready', loi: 'signed' })).toBe('committed');
    expect(getStage({ loi: 'signed', leasing: 'turn_1' })).toBe('committed');
  });

  it('moved_on takes precedence over committed when leasing is cut', () => {
    expect(getStage({ loi: 'signed', leasing: 'cut' })).toBe('moved_on');
  });

  it('moved_on takes precedence over engaged when loi is cut', () => {
    expect(getStage({ loi: 'cut', leasing: 'turn_1' })).toBe('moved_on');
  });

  it('signed leasing then cut should be moved_on (cut wins)', () => {
    expect(getStage({ loi: 'cut', leasing: 'cut' })).toBe('moved_on');
  });
});
