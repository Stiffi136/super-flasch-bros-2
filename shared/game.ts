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

type Module = { name: string; width: number; build: (x: number, floorY: number, platforms: Platform[]) => void };

/**
 * Generate a seeded, continuous speed course from authored modules.
 * Each module connects to the next with level ground and a clear entry/exit.
 * Obstacles include ceilings, blocks, steps and hazards; checkpoint placement
 * stays clear of them. These design bounds are not a proof of reachability.
 */
export function generateLevel(seed: number): Level {
  const rand = rngFor(seed);
  const platforms: Platform[] = [];
  const addFloor = (x: number, y: number, w: number): void => {
    platforms.push({ x, y, w, h: 120, kind: 'solid' });
    platforms.push({ x, y, w, h: 18, kind: 'grip' });
  };
  const modules: Module[] = [
    {
      name: 'Überkopfrahmen + Mittelwand',
      width: 820,
      build: (x, y, out) => {
        // An overhead beam and a central floor wall; no hanging side pieces.
        const roofX = x + 245, roofW = 300, roofY = y - 140, roofH = 18;
        out.push({ x: roofX, y: roofY, w: roofW, h: roofH, kind: 'solid' });
        out.push({ x: roofX, y: roofY + roofH, w: roofW, h: 12, kind: 'grip' });
        out.push({ x: x + 396, y: y - 66, w: 28, h: 66, kind: 'solid' });
      },
    },
    {
      name: 'Erhöhte Stufe + fallende Blockstufen',
      width: 840,
      build: (x, y, out) => {
        // The raised block and 3 separate lower blocks are jumpable AABBs, not a ramp.
        out.push({ x: x + 250, y: y - 42, w: 82, h: 42, kind: 'solid' });
        for (const [offset, rise, width] of [[348, 31, 48], [430, 19, 48], [512, 7, 48]]) {
          out.push({ x: x + offset, y: y - rise, w: width, h: rise, kind: 'solid' });
        }
        // Short overhead shelf makes the route readable, but leaves a clear bypass.
        out.push({ x: x + 470, y: y - 132, w: 116, h: 14, kind: 'solid' });
        out.push({ x: x + 470, y: y - 118, w: 116, h: 10, kind: 'grip' });
      },
    },
    {
      name: 'Blockstufe + versetzter Dachüberhang',
      width: 840,
      build: (x, y, out) => {
        // A broad, 70-unit block is jumpable from the floor. A high roof starts
        // behind its approach; its left lip descends without closing the ground route.
        // From the block, the player can jump to the grip underside and traverse right.
        out.push({ x: x + 360, y: y - 70, w: 150, h: 70, kind: 'solid' });
        const roofX = x + 250, roofY = y - 180, roofW = 300, roofH = 18;
        out.push({ x: roofX, y: roofY, w: roofW, h: roofH, kind: 'solid' });
        out.push({ x: roofX, y: roofY + roofH, w: roofW, h: 12, kind: 'grip' });
        out.push({ x: roofX, y: roofY + roofH, w: 18, h: 42, kind: 'solid' });
      },
    },
    {
      name: 'Stachelgrube',
      width: 840,
      build: (x, y, out) => {
        // Low floor spikes are separate from the safe entry, exit and checkpoints.
        out.push({ x: x + 365, y: y - 20, w: 86, h: 20, kind: 'hazard' });
      },
    },
    {
      name: 'Aufsteigende Treppen',
      width: 860,
      build: (x, y, out) => {
        // 3 broad, separated AABB platforms form a jumpable stair sequence, not a slope.
        for (const [offset, rise] of [[250, 28], [365, 50], [480, 72]]) {
          out.push({ x: x + offset, y: y - rise, w: 56, h: rise, kind: 'solid' });
        }
        // Low separated speed gates provide a faster, jump-through line beside the stairs.
        out.push({ x: x + 610, y: y - 24, w: 24, h: 24, kind: 'solid' });
        out.push({ x: x + 700, y: y - 32, w: 24, h: 32, kind: 'solid' });
      },
    },
    {
      name: 'Abfallende Blockstufen + Deckenregal',
      width: 880,
      build: (x, y, out) => {
        // 3 separate descending AABBs suggest a curve visually; they do not provide slope collision.
        for (const [offset, rise] of [[270, 49], [365, 31], [460, 13]]) {
          out.push({ x: x + offset, y: y - rise, w: 58, h: rise, kind: 'solid' });
        }
        out.push({ x: x + 505, y: y - 155, w: 190, h: 16, kind: 'solid' });
        out.push({ x: x + 505, y: y - 139, w: 190, h: 12, kind: 'grip' });
        // A low, isolated step adds an optional speed-line obstacle after the shelf.
        out.push({ x: x + 730, y: y - 28, w: 32, h: 28, kind: 'solid' });
      },
    },
  ];

  // Long safe start to build speed. Every authored module is used once before
  // seeded repeats; shuffling changes order without making courses all alike.
  let x = -300;
  const floorY = 500;
  const startWidth = 1200;
  addFloor(x, floorY, startWidth);
  x += startWidth;
  // Keep the original frame immediately after the long start runway; shuffle the
  // newer obstacle families with the seeded PRNG so the first course read is fair.
  const order = [modules[0], ...modules.slice(1)];
  for (let i = order.length - 1; i > 1; i--) {
    const j = 1 + Math.floor(rand() * i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const moduleCount = 24;
  const moduleMetadata: ModuleMetadata[] = [];
  for (let i = 0; i < moduleCount; i++) {
    const module = order[i % order.length];
    const moduleStartX = x;
    addFloor(x, floorY, module.width);
    module.build(x, floorY, platforms);
    moduleMetadata.push({ name: module.name, startX: moduleStartX, endX: moduleStartX + module.width });

    // Trigger spans the standing player at floor level and checkpointSpawn can
    // resolve it against the supporting solid floor section.
    if ((i + 1) % 3 === 0 || (i === 7 && rand() < 0.35)) {
      const checkpointX = x + 58;
      platforms.push({ x: checkpointX, y: floorY - 48, w: 96, h: 48, kind: 'checkpoint' });
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
