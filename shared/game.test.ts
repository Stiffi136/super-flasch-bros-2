import { describe, expect, it } from 'vitest';
import { generateLevel, rngFor } from './game';

const floorsOf = (seed: number) => generateLevel(seed).platforms.filter(p => p.kind === 'solid' && p.h === 120).sort((a, b) => a.x - b.x);

describe('seeded modular levels', () => {
  it('reproduces the same level and varies module order across seeds', () => {
    for (const seed of [0, 1, 12345, 0xffffffff]) expect(generateLevel(seed)).toEqual(generateLevel(seed));
    const orders = new Set(Array.from({ length: 20 }, (_, seed) => generateLevel(seed).modules.map(m => m.name).join('|')));
    expect(orders.size).toBeGreaterThan(1);
  });
  it('composes continuous ground-level module exits with room to accelerate', () => {
    for (let seed = 0; seed < 100; seed++) {
      const level = generateLevel(seed), floors = floorsOf(seed);
      expect(level.width).toBeGreaterThan(6000);
      expect(floors).toHaveLength(25);
      expect(level.modules).toHaveLength(24);
      for (let i = 0; i < level.modules.length; i++) {
        expect(level.modules[i].startX).toBe(floors[i + 1].x);
        expect(level.modules[i].endX).toBe(floors[i + 1].x + floors[i + 1].w);
        expect(level.modules[i].name.length).toBeGreaterThan(0);
      }
      expect(floors[0]).toMatchObject({ x: -300, y: 500, w: 1200 });
      for (let i = 1; i < floors.length; i++) {
        const floor = floors[i];
        expect(floor.x).toBe(floors[i - 1].x + floors[i - 1].w);
        expect(floor.y).toBe(500);
        expect(floor.w).toBeGreaterThanOrEqual(760);
        for (const edge of [floor.x, floor.x + floor.w - 100]) {
          const blockers = level.platforms.filter(p => p.kind === 'solid' && p.h !== 120 && p.x < edge + 100 && p.x + p.w > edge && p.y < 500 && p.y + p.h > 458);
          expect(blockers).toEqual([]);
        }
      }
    }
  });
  it('adds a reachable broad block and a non-blocking offset roof route', () => {
    const playerHeight = 42, jumpImpulse = 590, gravity = 1550;
    const maxRise = jumpImpulse * jumpImpulse / (2 * gravity);
    for (let seed = 0; seed < 100; seed++) {
      const level = generateLevel(seed);
      const module = level.modules.find(m => m.name === 'Blockstufe + versetzter Dachüberhang');
      expect(module).toBeDefined();
      const floor = floorsOf(seed).find(f => f.x === module!.startX)!;
      const local = level.platforms.filter(p => p.x >= module!.startX && p.x < module!.endX);
      const block = local.find(p => p.kind === 'solid' && p.w === 150 && p.h === 70)!;
      const roof = local.find(p => p.kind === 'solid' && p.w === 300 && p.h === 18)!;
      const grip = local.find(p => p.kind === 'grip' && p.w === 300 && p.h === 12)!;
      const lip = local.find(p => p.kind === 'solid' && p.w === 18 && p.h === 42)!;
      expect(block).toMatchObject({ x: floor.x + 360, y: floor.y - 70 });
      expect(roof).toMatchObject({ x: floor.x + 250, y: floor.y - 180 });
      expect(grip).toMatchObject({ x: roof.x, y: roof.y + roof.h });
      expect(lip).toMatchObject({ x: roof.x, y: roof.y + roof.h, h: 42 });
      // Production jump reaches the block top and can touch the roof from the block.
      expect(maxRise).toBeGreaterThan(70);
      expect(maxRise).toBeGreaterThanOrEqual((floor.y - playerHeight) - (block.y - playerHeight));
      expect(maxRise).toBeGreaterThanOrEqual((block.y - playerHeight) - (roof.y + roof.h));
      // The approach remains walkable under the lip; the raised block has headroom.
      expect(floor.y - playerHeight).toBeGreaterThan(lip.y + lip.h);
      expect(block.y - playerHeight).toBeGreaterThan(roof.y + roof.h);
      // Roof ends well before the safe module exit, with unobstructed floor beyond it.
      expect(roof.x + roof.w + playerHeight).toBeLessThan(module!.endX);
      expect(local.filter(p => p.kind === 'solid' && p.h !== 120 && p.x >= roof.x + roof.w && p.x < module!.endX)).toEqual([]);
    }
  });
  it('contains the framed central obstacle and safe checkpoints in all seeds', () => {
    for (let seed = 0; seed < 100; seed++) {
      const level = generateLevel(seed), floors = floorsOf(seed);
      const roofs = level.platforms.filter(p => p.kind === 'solid' && p.w === 300 && p.h === 18);
      expect(roofs.length).toBeGreaterThanOrEqual(3);
      for (const roof of roofs) {
        const supports = level.platforms.filter(p => p.kind === 'solid' && p.w === 18 && p.x >= roof.x && p.x < roof.x + roof.w && p.y === roof.y + roof.h);
        if (supports.length === 0) {
          expect(level.platforms.some(p => p.kind === 'solid' && p.w === 28 && p.h === 66 && p.x > roof.x && p.x + p.w < roof.x + roof.w)).toBe(true);
        } else {
          expect(supports).toHaveLength(1); // The overhang has one left/downward lip.
          expect(supports[0].h).toBe(42);
        }
      }
      for (const cp of level.platforms.filter(p => p.kind === 'checkpoint')) {
        expect(floors.some(f => cp.x >= f.x && cp.x + cp.w <= f.x + f.w && cp.y + cp.h === f.y)).toBe(true);
      }
      expect(level.platforms.filter(p => p.kind === 'checkpoint').length).toBeGreaterThanOrEqual(4);
      expect(level.platforms.filter(p => p.kind === 'goal')).toHaveLength(1);
    }
  });
  it('places spikes on safe-floor modules away from checkpoints and exits', () => {
    for (let seed = 0; seed < 100; seed++) {
      const level = generateLevel(seed);
      const spikeModules = level.modules.filter(m => m.name === 'Stachelgrube');
      expect(spikeModules.length).toBeGreaterThan(0);
      for (const m of spikeModules) {
        const spikes = level.platforms.find(p => p.kind === 'hazard' && p.x >= m.startX && p.x < m.endX);
        expect(spikes).toMatchObject({ x: m.startX + 365, y: 480, w: 86, h: 20 });
        expect(spikes!.x - m.startX).toBeGreaterThan(150);
        expect(m.endX - (spikes!.x + spikes!.w)).toBeGreaterThan(150);
        expect(level.platforms.filter(p => p.kind === 'checkpoint' && p.x < spikes!.x + spikes!.w && p.x + p.w > spikes!.x)).toEqual([]);
      }
    }
  });
  it('produces bounded deterministic random numbers', () => {
    const a = rngFor(42), b = rngFor(42);
    for (let i = 0; i < 100; i++) { const n = a(); expect(n).toBe(b()); expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThan(1); }
  });
});
