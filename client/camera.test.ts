import { describe, expect, it } from 'vitest';
import { CAMERA_LOOK_AHEAD, smoothCameraOffset } from './camera';

describe('camera look-ahead', () => {
  it('changes gradually when the player turns around', () => {
    const start = -CAMERA_LOOK_AHEAD;
    const next = smoothCameraOffset(start, -1, 1 / 120);
    expect(next).toBeGreaterThan(start);
    expect(next).toBeLessThan(0);
    expect(next - start).toBeLessThan(3);
  });

  it('converges to a smaller offset in the new direction', () => {
    let offset = -CAMERA_LOOK_AHEAD;
    for (let i = 0; i < 600; i++) offset = smoothCameraOffset(offset, -1, 1 / 120);
    expect(offset).toBeCloseTo(CAMERA_LOOK_AHEAD, 1);
  });

  it('is independent of fixed-step subdivision', () => {
    const step = (dt: number, count: number) => {
      let offset = -CAMERA_LOOK_AHEAD;
      for (let i = 0; i < count; i++) offset = smoothCameraOffset(offset, -1, dt);
      return offset;
    };
    expect(step(1 / 120, 120)).toBeCloseTo(step(1 / 60, 60), 10);
    expect(smoothCameraOffset(10, 1, 0)).toBe(10);
  });
});
