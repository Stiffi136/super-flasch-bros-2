import { describe, expect, it } from 'vitest';
import { decideGrab, horizontalVelocity, RELEASE_LOCK_SECONDS, WALL_JUMP_LOCK_SECONDS } from './movement';
import { generateLevel, type Platform } from './game';
import { MODULE_FORMAT, MODULE_VERSION, type ModuleDefinition } from './module-format';

/**
 * Independent fixed-step trajectory harness. It duplicates the relevant movement
 * and axis-separated AABB collision from GameScene.simulate; it does not call the
 * Phaser scene or production collision code. Keep constants and branch assumptions
 * aligned with client/scene.ts. This is a reachability check, not a physics proof.
 */
const DT = 1 / 120, PW = 25, PH = 42, FLOOR_Y = 500;
type Input = { dir: -1 | 0 | 1; jump: boolean; drop?: boolean };
type State = { x: number; y: number; vx: number; vy: number; grounded: boolean; wall: number; ceiling: boolean };
const overlap = (x: number, y: number, p: Platform) => x < p.x + p.w && x + PW > p.x && y < p.y + p.h && y + PH > p.y;

function trajectory(platforms: Platform[], start: { x: number; y: number; vx?: number; grounded?: boolean }, inputAt: (step: number, s: State) => Input, steps = 9000) {
  const solids = platforms.filter(p => p.kind === 'solid');
  const s: State = { ...start, vx: start.vx ?? 0, vy: 0, grounded: start.grounded ?? false, wall: 0, ceiling: false };
  let coyote = 0, jumpBuffer = 0, lastJump = false, releaseLock = 0;
  const history: State[] = [];
  for (let step = 0; step < steps; step++) {
    const input = inputAt(step, s), dir = input.dir, jump = input.jump, drop = !!input.drop;
    releaseLock = Math.max(0, releaseLock - DT);
    if (jump && !lastJump) jumpBuffer = .14; else jumpBuffer = Math.max(0, jumpBuffer - DT);
    lastJump = jump;
    if (s.grounded) coyote = .105; else coyote = Math.max(0, coyote - DT);
    let contactWall: -1 | 0 | 1 = 0, contactCeiling = false;
    const cx = s.x + PW / 2, cy = s.y + PH / 2;
    for (const p of solids) {
      if (Math.abs(s.y - (p.y + p.h)) < 1 && cx > p.x && cx < p.x + p.w) contactCeiling = true;
      if (cy > p.y + 2 && cy < p.y + p.h - 2) {
        if (Math.abs(s.x + PW - p.x) < 1) contactWall = -1;
        if (Math.abs(s.x - (p.x + p.w)) < 1) contactWall = 1;
      }
    }
    const decision = decideGrab({ wall: contactWall, ceiling: contactCeiling }, s.grounded, coyote, jumpBuffer > 0, releaseLock, drop);
    s.wall = decision.wall; s.ceiling = decision.ceiling;
    if (decision.jump === 'drop') { s.vy = Math.max(s.vy, 90); releaseLock = RELEASE_LOCK_SECONDS; }
    else if (decision.jump === 'wall') {
      s.vy = -590; s.vx = contactWall === -1 ? -390 : 390;
      releaseLock = WALL_JUMP_LOCK_SECONDS; jumpBuffer = 0; s.grounded = false; coyote = 0;
    } else if (decision.jump === 'ground') { s.vy = -590; jumpBuffer = 0; s.grounded = false; coyote = 0; }
    if (s.ceiling) { s.vy = 0; s.vx = dir * 190; }
    else if (s.wall) { s.vx = 0; s.vy = Math.max(0, Math.min(s.vy, 35)); }
    else {
      s.vx = horizontalVelocity(s.vx, dir, s.grounded, false, DT);
      s.vy = Math.min(s.vy + 1550 * DT, 850);
      if (!jump && s.vy < -180) s.vy += 1100 * DT;
    }
    const oldX = s.x, oldY = s.y;
    s.x += s.vx * DT;
    for (const p of solids) if (overlap(s.x, s.y, p)) {
      if (s.vx > 0 && oldX + PW <= p.x + 3) s.x = p.x - PW;
      else if (s.vx < 0 && oldX >= p.x + p.w - 3) s.x = p.x + p.w;
      s.vx = 0;
    }
    s.y += s.vy * DT; s.grounded = false;
    for (const p of solids) if (overlap(s.x, s.y, p)) {
      if (s.vy > 0 && oldY + PH <= p.y + 4) { s.y = p.y - PH; s.vy = 0; s.grounded = true; }
      else if (s.vy < 0 && oldY >= p.y + p.h - 4) { s.y = p.y + p.h; s.vy = 0; }
    }
    history.push({ ...s });
    if (s.y > 720) break;
  }
  return history;
}

function runWithSearch(level: ReturnType<typeof generateLevel>) {
  const goal = level.platforms.find(p => p.kind === 'goal')!;
  let best: { history: State[]; lead: number; hold: number } | undefined;
  // Search discrete jump lead distances and jump-hold durations. Each candidate
  // replays the complete generated level, including every module transition.
  for (let lead = 20; lead <= 240; lead += 5) {
    for (let hold = 5; hold <= 121; hold += 2) {
      let target = -1, launchedAt = -100000;
      const history = trajectory(level.platforms, level.spawn, (step, s) => {
        const hurdle = level.platforms
          .filter(p => p.kind === 'solid' && p.y + p.h >= FLOOR_Y && p.x + p.w > s.x + PW && p.x >= s.x)
          .sort((a, b) => a.x - b.x)[0];
        if (hurdle && hurdle.x !== target && hurdle.x - (s.x + PW) <= lead) target = hurdle.x;
        const launch = !!hurdle && hurdle.x === target && hurdle.x - (s.x + PW) <= lead && step - launchedAt > hold + 5 && s.grounded;
        if (launch) launchedAt = step;
        const jump = launchedAt >= 0 && step - launchedAt < hold;
        // Ceiling grabs are part of the production controls. Traverse a roof, then
        // use the slide/drop input only when the player reaches its far edge.
        const roof = s.ceiling ? level.platforms.find(p => p.kind === 'solid' && Math.abs(p.y + p.h - s.y) < 1 && p.w > 80) : undefined;
        const drop = !!roof && s.x + PW >= roof.x + roof.w - 4;
        return { dir: 1, jump, drop };
      });
      if (!best || history.at(-1)!.x > best.history.at(-1)!.x) best = { history, lead, hold };
      if (history.some(s => overlap(s.x, s.y, goal))) return { reached: true, history, lead, hold };
    }
  }
  return { reached: false, ...best! };
}

function modules(level: ReturnType<typeof generateLevel>) {
  const floors = level.platforms.filter(p => p.kind === 'solid' && p.h === 120).sort((a, b) => a.x - b.x);
  return floors.slice(1).map((floor, i) => {
    const end = floor.x + floor.w;
    const obstacles = level.platforms.filter(p => p.kind === 'solid' && p.h !== 120 && p.x >= floor.x && p.x < end);
    const profile = obstacles.map(p => `${Math.round(p.x - floor.x)}:${p.w}x${p.h}`).sort().join('|') || 'clear';
    return { index: i + 1, x: floor.x, end, profile };
  });
}

const floor = (x: number, y: number, w: number): Platform => ({ x, y, w, h: 120, kind: 'solid' });
const routeFixture: ModuleDefinition = {
  format: MODULE_FORMAT, version: MODULE_VERSION, id: 'route-fixture', name: 'Route fixture', width: 840,
  platforms: [{ kind: 'solid', x: 400, y: -40, w: 28, h: 40 }],
};

describe('independent fixed-step feature checks', () => {
  it('crosses a representative 156-unit floor gap and lands on the exit runway', () => {
    const platforms = [floor(0, 500, 500), floor(656, 500, 500)];
    const h = trajectory(platforms, { x: 80, y: 458 }, step => ({ dir: 1, jump: step >= 65 && step < 130 }));
    expect(h.some(s => s.grounded && s.x >= 656 - PW && s.x < 1156)).toBe(true);
  });

  it('can wall-jump at a central wall with a low overhead roof', () => {
    const platforms: Platform[] = [floor(0, 500, 700), { x: 350, y: 445, w: 28, h: 55, kind: 'solid' },
      { x: 330, y: 390, w: 110, h: 20, kind: 'solid' }];
    const h = trajectory(platforms, { x: 100, y: 458 }, step => ({ dir: 1, jump: step >= 75 && step < 77 }), 240);
    expect(h.some(s => s.wall === -1)).toBe(true);
    expect(h.some(s => s.vy < -300 && s.x < 350)).toBe(true);
    expect(h.every(s => Number.isFinite(s.x) && Number.isFinite(s.y))).toBe(true);
  });

  it('enters ceiling grip, traverses to the roof edge, releases, and lands beyond it', () => {
    const platforms: Platform[] = [floor(0, 500, 700), { x: 100, y: 350, w: 150, h: 20, kind: 'solid' }];
    let sawGrip = false, landedBeyond = false;
    const h = trajectory(platforms, { x: 20, y: 458 }, (step, s) => ({
      dir: 1, jump: step < 30, drop: s.ceiling && s.x >= 260,
    }), 420);
    for (const s of h) { if (s.ceiling) sawGrip = true; if (s.grounded && s.x > 300) landedBeyond = true; }
    expect(sawGrip).toBe(true);
    expect(landedBeyond).toBe(true);
  });
});

describe('generated module route replay', () => {
  it('reaches the generated goal across seeded modules and transitions', () => {
    const seeds = [1, 2, 42, 2025, 0x5eed1234];
    for (const seed of seeds) {
      const level = generateLevel(seed, [routeFixture]), courseModules = modules(level);
      expect(level.modules.some(m => m.name === routeFixture.name)).toBe(true);
      const result = runWithSearch(level);
      const furthest = Math.max(...result.history.map(s => s.x));
      const failedModule = courseModules.find(m => furthest < m.end) ?? courseModules.at(-1)!;
      expect(result.reached, `seed ${seed}, module ${failedModule.index} (${failedModule.profile}), furthest x=${furthest.toFixed(1)}, search lead=${result.lead}, hold=${result.hold}`).toBe(true);
      expect(result.history.every(s => Number.isFinite(s.x) && Number.isFinite(s.y)), `seed ${seed}: non-finite state`).toBe(true);
      // The generated floor is continuous; this guards module-to-module transitions.
      for (let i = 0; i < courseModules.length - 1; i++) {
        expect(courseModules[i].end).toBe(courseModules[i + 1].x);
      }
    }
  });
});
