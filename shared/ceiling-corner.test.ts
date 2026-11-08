import { describe, expect, it } from 'vitest';
import { CEILING_CORNER_UPWARD_VELOCITY, JUMP_UPWARD_VELOCITY, ceilingCornerLaunchDirection, shouldSkipCeilingCornerRoofCollision } from './movement';

const roof = { x: 100, y: 100, w: 100, h: 20 };
const solids = [roof];
const launch = (x: number, velocity: number, y = 120, geometry = solids) =>
  ceilingCornerLaunchDirection(x, y, 25, geometry, velocity);
const overlap = (x: number, y: number, w: number, h: number, r: typeof roof) =>
  x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y;

describe('ceiling corner launch detection', () => {
  it('uses the same initial upward velocity as a normal jump', () => {
    expect(CEILING_CORNER_UPWARD_VELOCITY).toBe(JUMP_UPWARD_VELOCITY);
    expect(CEILING_CORNER_UPWARD_VELOCITY).toBe(-590);
  });
  it('detects exposed left and right corners when velocity points outward', () => {
    expect(launch(91, -400)).toBe(-1);
    expect(launch(184, 400)).toBe(1);
  });

  it('does not boost a release near the center of a ceiling', () => {
    expect(launch(137.5, -400)).toBeNull();
    expect(launch(137.5, 400)).toBeNull();
  });

  it('requires velocity to point toward an exposed edge', () => {
    expect(launch(91, 400)).toBeNull();
    expect(launch(184, -400)).toBeNull();
    expect(launch(91, 0)).toBeNull();
  });

  it('rejects a seam joined to adjacent solid geometry', () => {
    const joined = [roof, { x: 200, y: 100, w: 80, h: 20 }];
    expect(launch(184, 400, 120, joined)).toBeNull();
    expect(launch(91, -400, 120, joined)).toBe(-1);
  });

  it('checks vertical contact and accepts only the configured contact tolerance', () => {
    expect(launch(91, -400, 120.9)).toBe(-1);
    expect(launch(91, -400, 121.01)).toBeNull();
    expect(launch(91, -400, 121.1)).toBeNull();
  });

  it('uses player half-width plus an enlarged but bounded edge margin', () => {
    expect(launch(99, -400)).toBe(-1);
    expect(launch(105, -400)).toBe(-1); // Beyond the former 4 px margin.
    expect(launch(118, -400)).toBeNull();
    expect(launch(87, -400)).toBeNull(); // Center is outside the roof contact span.
  });

  it('automatically launches and clears the exposed roof in both directions, but not while still', () => {
    const step = (startX: number, direction: -1 | 1) => {
      let x = startX, y = 120, vx = direction * 500, vy = CEILING_CORNER_UPWARD_VELOCITY;
      const width = 25, dt = 1 / 120;
      const corner = ceilingCornerLaunchDirection(x, y, width, solids, direction * 190);
      if (!corner) return { x, y, launched: false };
      let launched = true;
      for (let i = 0; i < 30; i++) {
        const oldX = x, oldY = y;
        x += vx * dt;
        if (overlap(x, y, width, 42, roof) && !shouldSkipCeilingCornerRoofCollision(x, width, vx, vy, direction, roof, roof)) {
          if (vx > 0 && oldX + width <= roof.x + 3) { x = roof.x - width; vx = 0; }
          else if (vx < 0 && oldX >= roof.x + roof.w - 3) { x = roof.x + roof.w; vx = 0; }
        }
        y += vy * dt;
        if (overlap(x, y, width, 42, roof) && !shouldSkipCeilingCornerRoofCollision(x, width, vx, vy, direction, roof, roof)) {
          if (vy < 0 && oldY >= roof.y + roof.h - 4) { y = roof.y + roof.h; vy = 0; }
        }
        // Match scene gravity: do not apply released-jump gravity while the upward escape arc is active.
        vy += 1550 * dt;
        if (x + width <= roof.x || x >= roof.x + roof.w) break;
      }
      return { x, y, launched };
    };
    const left = step(110, -1), right = step(165, 1);
    expect(left.launched).toBe(true);
    expect(left.x + 25).toBeLessThanOrEqual(roof.x);
    expect(left.y).toBeLessThan(roof.y + roof.h - 20);
    expect(right.launched).toBe(true);
    expect(right.x).toBeGreaterThanOrEqual(roof.x + roof.w);
    expect(right.y).toBeLessThan(roof.y + roof.h - 20);
    expect(ceilingCornerLaunchDirection(110, 120, 25, solids, 0)).toBeNull();
  });

  it('lets an outward launch clear only its roof, then restores normal collisions', () => {
    const xStart = 91, width = 25, dt = 1 / 120;
    let x = xStart, y = 120, vx = -500, vy = CEILING_CORNER_UPWARD_VELOCITY;
    let skipped = 0;
    const overlaps = (r: typeof roof) => x < r.x + r.w && x + width > r.x && y < r.y + r.h && y + 42 > r.y;
    for (let i = 0; i < 12; i++) {
      const oldY = y;
      x += vx * dt;
      y += vy * dt;
      if (overlaps(roof)) {
        if (shouldSkipCeilingCornerRoofCollision(x, width, vx, vy, -1, roof, roof)) skipped++;
        else if (vy < 0 && oldY >= roof.y + roof.h - 4) { y = roof.y + roof.h; vy = 0; }
      }
      if (x + width <= roof.x) break;
    }
    expect(skipped).toBeGreaterThan(0);
    expect(x + width).toBeLessThanOrEqual(roof.x);
    expect(y).toBeLessThan(roof.y + roof.h);
    expect(shouldSkipCeilingCornerRoofCollision(x, width, vx, -350, -1, roof, roof)).toBe(false);
    expect(shouldSkipCeilingCornerRoofCollision(91, width, 500, -350, -1, roof, roof)).toBe(false);
    const otherRoof = { x: 80, y: 100, w: 20, h: 20 };
    expect(shouldSkipCeilingCornerRoofCollision(91, width, vx, -350, -1, otherRoof, roof)).toBe(false);
  });
});
