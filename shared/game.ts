import type { ModuleDefinition } from './module-format';

export type Platform = { x: number; y: number; w: number; h: number; kind: 'solid' | 'grip' | 'hazard' | 'checkpoint' | 'goal' };
export type ModuleMetadata = { name: string; startX: number; endX: number };
export type Level = { seed: number; width: number; height: number; platforms: Platform[]; spawn: { x: number; y: number }; modules: ModuleMetadata[] };

/** Small deterministic PRNG. Same seed and generator version produce the same course. */
export function rngFor(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Module = { name: string; width: number; platforms: readonly ModuleDefinition['platforms'][number][] };

/**
 * Generate a seeded course from supplied JSON module definitions only.
 * The runway, floor, checkpoints, and goal are generated automatically.
 */
export function generateLevel(seed: number, customModules: readonly ModuleDefinition[] = []): Level {
  if (customModules.length === 0) {
    throw new Error('Cannot generate level: at least one JSON module is required');
  }
  const rand = rngFor(seed);
  const platforms: Platform[] = [];
  const addFloor = (x: number, y: number, w: number): void => {
    platforms.push({ x, y, w, h: 120, kind: 'solid' });
    platforms.push({ x, y, w, h: 18, kind: 'grip' });
  };
  const modules: Module[] = customModules.map(definition => ({
    name: definition.name,
    width: definition.width,
    platforms: definition.platforms,
  }));

  // Keep a long, safe runway before the authored modules.
  let x = -300;
  const floorY = 500;
  const startWidth = 1200;
  addFloor(x, floorY, startWidth);
  x += startWidth;
  // Shuffle every supplied module, including the first position, then repeat the
  // shuffled list until the course has 24 segments.
  const order = [...modules];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const moduleCount = 24;
  const moduleMetadata: ModuleMetadata[] = [];
  for (let i = 0; i < moduleCount; i++) {
    const module = order[i % order.length];
    const moduleStartX = x;
    addFloor(x, floorY, module.width);
    const platformStart = platforms.length;
    for (const platform of module.platforms) {
      platforms.push({
        x: x + platform.x,
        y: floorY + platform.y,
        w: platform.w,
        h: platform.h,
        kind: platform.kind,
      });
    }
    moduleMetadata.push({ name: module.name, startX: moduleStartX, endX: moduleStartX + module.width });

    // Trigger spans the standing player at floor level and checkpointSpawn can
    // resolve it against the supporting solid floor section.
    if ((i + 1) % 3 === 0 || (i === 7 && rand() < 0.35)) {
      const checkpointX = x + 58;
      const blocked = platforms.slice(platformStart).some(platform =>
        (platform.kind === 'hazard' || platform.kind === 'solid') &&
        platform.x < checkpointX + 96 && platform.x + platform.w > checkpointX &&
        platform.y < floorY && platform.y + platform.h > floorY - 48,
      );
      if (!blocked) platforms.push({ x: checkpointX, y: floorY - 48, w: 96, h: 48, kind: 'checkpoint' });
    }
    x += module.width;
  }

  platforms.push({ x: x - 70, y: floorY - 42, w: 54, h: 42, kind: 'goal' });
  return {
    seed: seed >>> 0,
    width: x + 300,
    height: 720,
    platforms,
    spawn: { x: 40, y: 458 },
    modules: moduleMetadata,
  };
}

export const BOTTLES = [
  { id: 'amber', name: 'Klara Kola', color: 0xffc45c, cap: 0xf6a83e },
  { id: 'mint', name: 'Minz-Mats', color: 0x68d7a2, cap: 0xb7f2d4 },
  { id: 'berry', name: 'Beeren-Bert', color: 0xff7c91, cap: 0xffd1dc },
] as const;
export type BottleIndex = 0 | 1 | 2;
