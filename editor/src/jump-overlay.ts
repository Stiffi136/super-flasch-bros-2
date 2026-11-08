import { CEILING_CORNER_EDGE_MARGIN, CEILING_CORNER_UPWARD_VELOCITY, findCeilingCornerLaunch, horizontalVelocity, MAX_SWING_SPEED, runningSpeed, shouldSkipCeilingCornerRoofCollision } from '../../shared/movement';

export const PLAYER_WIDTH = 25;
export const PLAYER_HEIGHT = 42;
export const JUMP_IMPULSE = 590;
export const GRAVITY = 1550;
export const FIXED_STEP = 1 / 120;
// Same ~110-unit fixed-step rise used by the scene's full corner-launch impulse.
export const MAX_JUMP_RISE = 110;
const HORIZONTAL_VARIANTS = [190, 290, 390, 490, 590, 690, 790, MAX_SWING_SPEED] as const;
const MAX_TIME = 1.5;

type Rect = { x: number; y: number; w: number; h: number };
export type JumpSurface = { x: number; y: number; width: number };
export type JumpReach = JumpSurface & {
  referenceX: number; standingHeadY: number; apexHeadY: number; standingTop: number;
  standingHeight: number; reachTop: number; reachHeight: number; headReach: number;
};
export type CornerTrajectory = { direction: -1 | 1; speed: number; roof: Rect; points: Array<{ x: number; y: number }>; clipped: boolean };

/** Geometry for a visual, full-hold jump indicator in editor world coordinates. */
export function jumpReach(surface: JumpSurface): JumpReach {
  const referenceX = surface.x + (surface.width - PLAYER_WIDTH) / 2;
  const standingHeadY = surface.y - PLAYER_HEIGHT;
  const apexHeadY = standingHeadY - MAX_JUMP_RISE;
  return { ...surface, referenceX, standingHeadY, apexHeadY, standingTop: standingHeadY,
    standingHeight: PLAYER_HEIGHT, reachTop: surface.y - MAX_JUMP_RISE, reachHeight: MAX_JUMP_RISE,
    headReach: PLAYER_HEIGHT + MAX_JUMP_RISE };
}

/** Floor plus the top face of every solid piece are candidate visual references. */
export function jumpSurfaces(platforms: readonly { kind: string; x: number; y: number; w: number }[], worldWidth: number): JumpSurface[] {
  return [{ x: 0, y: 0, width: worldWidth }, ...platforms.filter(p => p.kind === 'solid').map(p => ({ x: p.x, y: p.y, width: p.w }))];
}

/** Simulate representative outward corner launches with scene fixed-step movement and solid collision. */
export function cornerTrajectories(platforms: readonly { kind: string; x: number; y: number; w: number; h: number }[]): CornerTrajectory[] {
  const solids: Rect[] = platforms.filter(p => p.kind === 'solid').map(({ x, y, w, h }) => ({ x, y, w, h }));
  const paths: CornerTrajectory[] = [];
  for (const roof of solids) for (const direction of [-1, 1] as const) {
    // Automatic walking launches at the outermost valid center position:
    // half the player width plus the shared corner margin inside the edge.
    const inset = PLAYER_WIDTH / 2 + CEILING_CORNER_EDGE_MARGIN;
    const centerX = direction < 0 ? roof.x + inset : roof.x + roof.w - inset;
    const playerX = centerX - PLAYER_WIDTH / 2, playerY = roof.y + roof.h;
    const corner = findCeilingCornerLaunch(playerX, playerY, PLAYER_WIDTH, solids, direction * 480);
    if (!corner) continue;
    for (const speed of HORIZONTAL_VARIANTS) {
      let x = playerX, y = playerY, vx = direction * speed, vy = CEILING_CORNER_UPWARD_VELOCITY;
      const points = [{ x: x + PLAYER_WIDTH / 2, y: y + PLAYER_HEIGHT / 2 }];
      let clipped = false;
      for (let step = 0; step < MAX_TIME / FIXED_STEP; step++) {
        const oldX = x, oldY = y;
        vx = horizontalVelocity(vx, direction, false, false, FIXED_STEP, runningSpeed(0));
        vy = Math.min(vy + GRAVITY * FIXED_STEP, 850);
        x += vx * FIXED_STEP;
        for (const p of solids) if (overlap(x, y, p)) {
          if (p === corner.roof && shouldSkipCeilingCornerRoofCollision(x, PLAYER_WIDTH, vx, vy, direction, p, corner.roof)) continue;
          if (vx > 0 && oldX + PLAYER_WIDTH <= p.x + 3) x = p.x - PLAYER_WIDTH;
          else if (vx < 0 && oldX >= p.x + p.w - 3) x = p.x + p.w;
          vx = 0; clipped = true;
        }
        y += vy * FIXED_STEP;
        for (const p of solids) if (overlap(x, y, p)) {
          if (vy < 0 && p === corner.roof && shouldSkipCeilingCornerRoofCollision(x, PLAYER_WIDTH, vx, vy, direction, p, corner.roof)) continue;
          if (vy > 0 && oldY + PLAYER_HEIGHT <= p.y + 4) { y = p.y - PLAYER_HEIGHT; vy = 0; }
          else if (vy < 0 && oldY >= p.y + p.h - 4) { y = p.y + p.h; vy = 0; }
          clipped = true;
        }
        points.push({ x: x + PLAYER_WIDTH / 2, y: y + PLAYER_HEIGHT / 2 });
        if (clipped || (vy >= 0 && y > playerY + 180)) break;
      }
      paths.push({ direction, speed, roof: corner.roof, points, clipped });
    }
  }
  return paths;
}
function overlap(x: number, y: number, p: Rect): boolean {
  return x < p.x + p.w && x + PLAYER_WIDTH > p.x && y < p.y + p.h && y + PLAYER_HEIGHT > p.y;
}
