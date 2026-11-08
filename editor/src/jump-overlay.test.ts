import { describe, expect, it } from 'vitest';
import { cornerTrajectories, jumpReach, jumpSurfaces, MAX_JUMP_RISE, PLAYER_HEIGHT, PLAYER_WIDTH } from './jump-overlay';

describe('editor jump overlay geometry', () => {
  it('shows approximately 110 units of rise and 152 units of head reach', () => {
    expect(MAX_JUMP_RISE).toBe(110);
    const reach = jumpReach({ x: 100, y: -48, width: 120 });
    expect(reach.reachTop).toBe(-158);
    expect(reach.reachHeight).toBe(110);
    expect(reach.headReach).toBe(152);
    expect(reach.standingTop).toBe(-90);
    expect(reach.standingHeight).toBe(PLAYER_HEIGHT);
  });

  it('keeps reach spanning each whole launch surface and centers the player reference', () => {
    const reach = jumpReach({ x: 100, y: 0, width: 120 });
    expect(reach.x).toBe(100);
    expect(reach.width).toBe(120);
    expect(reach.referenceX).toBe(147.5);
    expect(PLAYER_WIDTH).toBe(25);
  });

  it('simulates both exposed ceiling corners at 3 representative horizontal speeds', () => {
    const paths = cornerTrajectories([{ kind: 'solid', x: 100, y: 100, w: 100, h: 20 }]);
    expect(paths.map(path => [path.direction, path.speed])).toEqual([
      ...[190, 290, 390, 490, 590, 690, 790, 900].map(speed => [-1, speed]),
      ...[190, 290, 390, 490, 590, 690, 790, 900].map(speed => [1, speed]),
    ]);
    expect(paths.every(path => path.points.length > 2)).toBe(true);
    expect(paths[0].points[0].x).toBe(128.5);
    expect(paths[8].points[0].x).toBe(171.5);
    expect(paths[0].points[1].y).toBeLessThan(paths[0].points[0].y);
  });

  it('omits joined ceiling seams and clips traces on ordinary solid collisions', () => {
    const seam = cornerTrajectories([
      { kind: 'solid', x: 100, y: 100, w: 100, h: 20 },
      { kind: 'solid', x: 200, y: 100, w: 100, h: 20 },
    ]);
    expect(seam.map(path => path.direction)).toEqual([...Array(8).fill(-1), ...Array(8).fill(1)]);
    const clipped = cornerTrajectories([
      { kind: 'solid', x: 100, y: 100, w: 100, h: 20 },
      { kind: 'solid', x: 80, y: 30, w: 16, h: 60 },
    ]);
    expect(clipped.some(path => path.direction === -1 && path.clipped)).toBe(true);
  });

  it('includes the whole floor and only solid block tops as launch surfaces', () => {
    expect(jumpSurfaces([
      { kind: 'solid', x: 20, y: -80, w: 90 },
      { kind: 'hazard', x: 120, y: -40, w: 30 },
      { kind: 'grip', x: 200, y: -30, w: 100 },
    ], 840)).toEqual([
      { x: 0, y: 0, width: 840 },
      { x: 20, y: -80, width: 90 },
    ]);
  });
});
