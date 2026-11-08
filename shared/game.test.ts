import { describe, expect, it } from 'vitest';
import { generateLevel, rngFor } from './game';
import { MODULE_FORMAT, MODULE_VERSION, type ModuleDefinition } from './module-format';

const fixture: ModuleDefinition = {
  format: MODULE_FORMAT, version: MODULE_VERSION, id: 'test-module', name: 'Testmodul', width: 840,
  platforms: [{ kind: 'solid', x: 400, y: -40, w: 28, h: 40 }],
};
const generate = (seed: number) => generateLevel(seed, [fixture]);
const floorsOf = (seed: number) => generate(seed).platforms.filter(p => p.kind === 'solid' && p.h === 120).sort((a, b) => a.x - b.x);

describe('seeded modular levels', () => {
  it('reproduces the same seeded level', () => {
    for (const seed of [0, 1, 12345, 0xffffffff]) expect(generate(seed)).toEqual(generate(seed));
  });

  it('composes continuous ground-level module exits with room to accelerate', () => {
    for (let seed = 0; seed < 100; seed++) {
      const level = generate(seed), floors = floorsOf(seed);
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

  it('places the explicit module fixture using its local JSON geometry', () => {
    for (let seed = 0; seed < 20; seed++) {
      const level = generate(seed);
      const placed = level.modules.filter(m => m.name === fixture.name);
      expect(placed.length).toBeGreaterThan(0);
      for (const module of placed) {
        expect(level.platforms).toContainEqual({ x: module.startX + 400, y: 460, w: 28, h: 40, kind: 'solid' });
        expect(module.endX - module.startX).toBe(fixture.width);
      }
    }
  });

  it('contains checkpoints on supporting floors and one goal', () => {
    for (let seed = 0; seed < 100; seed++) {
      const level = generate(seed), floors = floorsOf(seed);
      for (const cp of level.platforms.filter(p => p.kind === 'checkpoint')) {
        expect(floors.some(f => cp.x >= f.x && cp.x + cp.w <= f.x + f.w && cp.y + cp.h === f.y)).toBe(true);
      }
      expect(level.platforms.filter(p => p.kind === 'goal')).toHaveLength(1);
    }
  });

  it('produces bounded deterministic random numbers', () => {
    const a = rngFor(42), b = rngFor(42);
    for (let i = 0; i < 100; i++) { const n = a(); expect(n).toBe(b()); expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThan(1); }
  });
});
