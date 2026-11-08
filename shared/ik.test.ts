import { describe, expect, it } from 'vitest';
import { solveLimb } from './ik';

describe('two-segment limb solver', () => {
  it('bends both limbs in the facing direction for varied running targets', () => {
    for (const facing of [-1, 1]) for (const dx of [-8, -3, 0, 3, 8]) {
      const anchor = { x: 0, y: 0 }, target = { x: dx, y: 16 };
      const { joint, end } = solveLimb(anchor, target, 11, 11, facing);
      expect((joint.x - (anchor.x + end.x) / 2) * facing).toBeGreaterThanOrEqual(0);
      expect(Math.hypot(joint.x, joint.y)).toBeCloseTo(11, 6);
      expect(Math.hypot(end.x - joint.x, end.y - joint.y)).toBeCloseTo(11, 6);
    }
  });
  it('can bend elbows opposite to the running direction', () => {
    for (const facing of [-1, 1]) {
      const { joint, end } = solveLimb({ x: 0, y: 0 }, { x: 4, y: 15 }, 12, 12, -facing);
      expect((joint.x - end.x / 2) * facing).toBeLessThanOrEqual(0);
    }
  });
  it('keeps the same horizontal bend for hands reaching up', () => {
    for (const facing of [-1, 1]) {
      const { joint, end } = solveLimb({ x: 0, y: 0 }, { x: 3, y: -16 }, 12, 12, facing);
      expect((joint.x - end.x / 2) * facing).toBeGreaterThanOrEqual(0);
    }
  });
});
