import { describe, expect, it } from 'vitest';
import { SnapshotInterpolator } from './interpolation';
import type { MultiplayerState } from './scene';

function state(seq: number, patch: Partial<MultiplayerState> = {}): MultiplayerState {
  return { seq, x: 0, y: 0, vx: 100, vy: 0, grounded: true, wall: 0, ceiling: false, sliding: false, facing: 1, lean: 0, runPhase: 0, deaths: 0, finished: false, ...patch };
}
const make = () => new SnapshotInterpolator();

describe('SnapshotInterpolator', () => {
  it('interpolates continuous fields and retains discrete values from the earlier state', () => {
    const buffer = make();
    buffer.push(state(1, { x: 0, vx: 0, facing: 1, grounded: true }), 0);
    buffer.push(state(2, { x: 100, vx: 100, facing: -1, grounded: false, lean: 1, runPhase: 8 }), 200);
    const result = buffer.sample(220)!; // target = 100ms
    expect(result.x).toBe(50);
    expect(result.vx).toBe(50);
    expect(result.lean).toBeCloseTo(0.5);
    expect(result.runPhase).toBe(4);
    expect(result.facing).toBe(1);
    expect(result.grounded).toBe(true);
  });

  it('keeps playback continuous when jittery arrivals append snapshots', () => {
    const buffer = make();
    buffer.push(state(1, { x: 0 }), 0);
    buffer.push(state(2, { x: 20 }), 100);
    const before = buffer.sample(170)!.x; // 50ms target, halfway
    buffer.push(state(3, { x: 40 }), 200);
    const after = buffer.sample(170)!.x;
    expect(before).toBe(10);
    expect(after).toBe(before);
    buffer.push(state(4, { x: 60 }), 350);
    expect(buffer.sample(270)!.x).toBe(30);
  });

  it('accepts late-arriving newer sequences without moving receipt time backward', () => {
    const buffer = make();
    buffer.push(state(1, { x: 0 }), 500);
    buffer.push(state(2, { x: 10 }), 400);
    expect(buffer.sample(620)!.x).toBe(0);
    expect(buffer.sample(620.5)!.x).toBe(5);
  });

  it('ignores stale sequences', () => {
    const buffer = make();
    buffer.push(state(4, { x: 40 }), 0);
    buffer.push(state(3, { x: 300 }), 50);
    expect(buffer.sample(120)!.x).toBe(40);
  });

  it('resets at death changes and does not interpolate or extrapolate across them', () => {
    const buffer = make();
    buffer.push(state(1, { x: 100, deaths: 0 }), 0);
    buffer.push(state(2, { x: 0, deaths: 1, vx: 0 }), 100);
    expect(buffer.sample(1000)).toMatchObject({ x: 0, deaths: 1 });
    expect(buffer.sample(1000)!.x).toBe(0);
  });

  it('caps extrapolation at 100ms then freezes', () => {
    const buffer = make();
    buffer.push(state(1, { x: 10, y: 20, vx: 200, vy: -50 }), 0);
    expect(buffer.sample(220)).toMatchObject({ x: 30, y: 15 });
    expect(buffer.sample(1000)).toMatchObject({ x: 30, y: 15 });
  });

  it('does not teleport for large movement consistent with elapsed travel time', () => {
    const buffer = make();
    buffer.push(state(1, { x: 0, vx: 1000 }), 0);
    buffer.push(state(2, { x: 350, vx: 1000 }), 350);
    expect(buffer.sample(420)!.x).toBeGreaterThan(0);
    expect(buffer.sample(420)!.x).toBeLessThan(350);
  });

  it('resets on a large teleport and handles non-monotonic receipt times', () => {
    const buffer = make();
    buffer.push(state(1, { x: 0 }), 100);
    buffer.push(state(2, { x: 500, vx: 0 }), 50);
    expect(buffer.sample(1000)!.x).toBe(500);
  });
});
