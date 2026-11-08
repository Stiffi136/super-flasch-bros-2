import { describe, expect, it } from 'vitest';
import { jumpReach, jumpSurfaces, MAX_JUMP_RISE, PLAYER_HEIGHT, PLAYER_WIDTH } from './jump-overlay';

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
