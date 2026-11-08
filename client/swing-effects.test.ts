import { describe, expect, it } from 'vitest';
import { CeilingSwingEffects } from './swing-effects';

const point = { x: 120, y: 45 };

describe('CeilingSwingEffects', () => {
  it('starts a directional swing with smooth lean, limb motion, and a warm trail', () => {
    const effect = new CeilingSwingEffects();
    effect.trigger(point, -1);
    const initial = effect.update(0, point);
    expect(initial.trail[0]).toMatchObject({ x: point.x, y: point.y, alpha: 1 });
    expect(initial.lean).toBe(0);

    const next = effect.update(0.04, point);
    expect(next.lean).toBeLessThan(0);
    expect(next.lean).toBeGreaterThan(-0.32);
    expect(next.limbSwing).not.toBe(0);
    expect(next.trail.length).toBeGreaterThan(1);
    expect(next.trail[0].alpha).toBeLessThan(1);
  });

  it('fades out and expires trail particles after a finite lifetime', () => {
    const effect = new CeilingSwingEffects({ particleInterval: 1 });
    effect.trigger(point, 1);
    const soon = effect.update(0.1, point);
    const later = effect.update(0.5, point);
    expect(Math.abs(later.lean)).toBeLessThan(Math.abs(soon.lean));
    expect(later.limbSwing).toBeCloseTo(0);
    expect(later.trail).toHaveLength(0);
  });

  it('bounds particle count and handles large frame steps', () => {
    const effect = new CeilingSwingEffects({ maxParticles: 3, particleInterval: 0.01 });
    effect.trigger(point, 1);
    const frame = effect.update(0.2, point);
    expect(frame.trail.length).toBeLessThanOrEqual(3);
    expect(frame.trail.every((particle) => Number.isFinite(particle.x) && Number.isFinite(particle.alpha))).toBe(true);
  });

  it('supports remote attachment-end triggers and reset clears all state', () => {
    const effect = new CeilingSwingEffects();
    let wasCeiling = true;
    const ceiling = false; // Caller detects the remote true-to-false transition.
    if (wasCeiling && !ceiling) effect.trigger(point, 1);
    wasCeiling = ceiling;
    expect(wasCeiling).toBe(false);
    expect(effect.update(0, point).trail).toHaveLength(1);

    effect.reset();
    expect(effect.update(0, point)).toEqual({ lean: 0, limbSwing: 0, trail: [] });
  });

  it('ignores invalid frame durations and positions without producing non-finite output', () => {
    const effect = new CeilingSwingEffects();
    effect.trigger(point, 0);
    const frame = effect.update(Number.NaN, { x: Number.NaN, y: 0 });
    expect(Number.isFinite(frame.lean)).toBe(true);
    expect(Number.isFinite(frame.limbSwing)).toBe(true);
    expect(frame.trail.every(({ x, y, alpha }) => [x, y, alpha].every(Number.isFinite))).toBe(true);
  });
});
