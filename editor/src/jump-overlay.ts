export const PLAYER_WIDTH = 25;
export const PLAYER_HEIGHT = 42;
export const JUMP_IMPULSE = 590;
export const GRAVITY = 1550;
// Production physics in client/scene.ts: vy = -590, gravity = 1550, fixed step = 1/120.
// The editor uses the ~110-unit observed fixed-step rise, not the continuous 112.27-unit ideal.
export const MAX_JUMP_RISE = 110;

export type JumpSurface = { x: number; y: number; width: number };
export type JumpReach = JumpSurface & {
  referenceX: number;
  standingHeadY: number;
  apexHeadY: number;
  standingTop: number;
  standingHeight: number;
  reachTop: number;
  reachHeight: number;
  headReach: number;
};

/** Geometry for a visual, full-hold jump indicator in editor world coordinates. */
export function jumpReach(surface: JumpSurface): JumpReach {
  const referenceX = surface.x + (surface.width - PLAYER_WIDTH) / 2;
  const standingHeadY = surface.y - PLAYER_HEIGHT;
  const apexHeadY = standingHeadY - MAX_JUMP_RISE;
  return {
    ...surface,
    referenceX,
    standingHeadY,
    apexHeadY,
    standingTop: standingHeadY,
    standingHeight: PLAYER_HEIGHT,
    reachTop: surface.y - MAX_JUMP_RISE,
    reachHeight: MAX_JUMP_RISE,
    headReach: PLAYER_HEIGHT + MAX_JUMP_RISE,
  };
}

/** Floor plus the top face of every solid piece are candidate visual references. */
export function jumpSurfaces(platforms: readonly { kind: string; x: number; y: number; w: number }[], worldWidth: number): JumpSurface[] {
  return [
    { x: 0, y: 0, width: worldWidth },
    ...platforms.filter(p => p.kind === 'solid').map(p => ({ x: p.x, y: p.y, width: p.w })),
  ];
}
