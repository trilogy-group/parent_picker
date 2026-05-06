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

  it('forward-compatible: any unknown non-null loi/leasing value is engaged', () => {
    expect(getStage({ loi: 'some-future-state' })).toBe('engaged');
    expect(getStage({ leasing: 'some-future-state' })).toBe('engaged');
  });

  it('returns engaged when LOI is signed (LOI is non-binding; lease not yet executed)', () => {
    expect(getStage({ loi: 'signed' })).toBe('engaged');
    expect(getStage({ loi: 'loi-signed' })).toBe('engaged');
    expect(getStage({ loi: 'done' })).toBe('engaged');
    expect(getStage({ loi: 'completed' })).toBe('engaged');
  });

  it('returns committed only when lease is executed (leasing=done, no process_exception)', () => {
    expect(getStage({ leasing: 'done' })).toBe('committed');
    expect(getStage({ leasing: 'done', loi: 'done' })).toBe('committed');
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

  it('moved_on takes precedence over committed when leasing is cut', () => {
    expect(getStage({ loi: 'signed', leasing: 'cut' })).toBe('moved_on');
  });

  it('moved_on takes precedence over engaged when loi is cut', () => {
    expect(getStage({ loi: 'cut', leasing: 'turn_1' })).toBe('moved_on');
  });

  it('signed leasing then cut should be moved_on (cut wins)', () => {
    expect(getStage({ loi: 'cut', leasing: 'cut' })).toBe('moved_on');
  });

  it('returns moved_on when strategy is kill (REBL killed the deal)', () => {
    expect(getStage({ strategy: 'kill' })).toBe('moved_on');
  });

  it('strategy=kill takes precedence over engaged/committed states', () => {
    // Real Southgate case: loi=done, leasing=ready, strategy=kill → moved_on
    expect(getStage({ leasing: 'ready', loi: 'done', strategy: 'kill' })).toBe('moved_on');
    // Even with leasing=done (would be committed), strategy=kill wins
    expect(getStage({ leasing: 'done', strategy: 'kill' })).toBe('moved_on');
  });

  it('strategy=start does not affect stage (only kill is meaningful here)', () => {
    expect(getStage({ leasing: 'ready', strategy: 'start' })).toBe('engaged');
    expect(getStage({ strategy: 'start' })).toBe('scored');
  });
});
