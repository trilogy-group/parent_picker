import { describe, it, expect } from 'vitest';
import { getStage } from './stage';

describe('getStage', () => {
  it('returns prospecting when no data', () => {
    expect(getStage({})).toBe('prospecting');
  });

  it('returns prospecting for pre-LOI activity (loi not done)', () => {
    expect(getStage({ loi: 'claimed' })).toBe('prospecting');
    expect(getStage({ loi: 'submitted' })).toBe('prospecting');
    expect(getStage({ loi: 'in_progress' })).toBe('prospecting');
    expect(getStage({ leasing: 'turn_1' })).toBe('prospecting');
    expect(getStage({ leasing: 'turn_2', loi: 'submitted' })).toBe('prospecting');
  });

  it('returns diligence when LOI is done and leasing is still working', () => {
    expect(getStage({ loi: 'done', leasing: 'claimed' })).toBe('diligence');
    expect(getStage({ loi: 'done', leasing: 'turn_1' })).toBe('diligence');
    expect(getStage({ loi: 'done', leasing: 'negotiating' })).toBe('diligence');
    expect(getStage({ loi: 'done' })).toBe('diligence');
  });

  it('returns diligence when LOI is done and lease is ready to sign (formerly ready_to_commit)', () => {
    expect(getStage({ loi: 'done', leasing: 'ready' })).toBe('diligence');
  });

  it('returns build_out when lease is executed (leasing=done)', () => {
    expect(getStage({ leasing: 'done' })).toBe('build_out');
    expect(getStage({ loi: 'done', leasing: 'done' })).toBe('build_out');
  });

  it('returns build_out when leasing=done with no opened_at', () => {
    expect(getStage({ leasing: 'done', loi: 'done' })).toBe('build_out');
  });

  it('returns moved_on when leasing is cut', () => {
    expect(getStage({ leasing: 'cut' })).toBe('moved_on');
  });

  it('returns moved_on when loi is cut', () => {
    expect(getStage({ loi: 'cut' })).toBe('moved_on');
  });

  it('returns moved_on when leasing=done with process_exception', () => {
    expect(getStage({ leasing: 'done', leasingDetails: { process_exception: true } })).toBe('moved_on');
  });

  it('returns moved_on when strategy=kill (REBL killed the deal)', () => {
    expect(getStage({ strategy: 'kill' })).toBe('moved_on');
    // strategy=kill wins over any pipeline state
    expect(getStage({ leasing: 'ready', loi: 'done', strategy: 'kill' })).toBe('moved_on');
    expect(getStage({ leasing: 'done', strategy: 'kill' })).toBe('moved_on');
  });

  it('strategy=start does not promote stage by itself', () => {
    expect(getStage({ strategy: 'start' })).toBe('prospecting');
    expect(getStage({ leasing: 'ready', strategy: 'start' })).toBe('prospecting');
  });

  describe('opened_at (Open / Build-out via calendar)', () => {
    const now = new Date('2026-05-18T00:00:00Z');

    it('returns open when opened_at is in the past', () => {
      expect(getStage({ openedAt: '2024-08-12', now })).toBe('open');
      expect(getStage({ openedAt: '2025-08-12T00:00:00Z', now })).toBe('open');
    });

    it('returns build_out when opened_at is in the future (formerly ready_to_open)', () => {
      expect(getStage({ openedAt: '2027-08-12', now })).toBe('build_out');
    });

    it('returns open when opened_at equals now (boundary)', () => {
      expect(getStage({ openedAt: '2026-05-18T00:00:00Z', now })).toBe('open');
    });

    it('open supersedes a stale pipeline (353 Hiatt: loi=done, leasing=claimed)', () => {
      expect(getStage({ openedAt: '2025-08-12', leasing: 'claimed', loi: 'done', now })).toBe('open');
    });

    it('moved_on still wins over open / future-dated build_out', () => {
      expect(getStage({ openedAt: '2024-08-12', strategy: 'kill', now })).toBe('moved_on');
      expect(getStage({ openedAt: '2024-08-12', leasing: 'cut', now })).toBe('moved_on');
    });

    it('ignores invalid opened_at strings (falls back to pipeline)', () => {
      expect(getStage({ openedAt: 'not-a-date', leasing: 'done', now })).toBe('build_out');
      expect(getStage({ openedAt: '', leasing: 'done', now })).toBe('build_out');
    });
  });
});
