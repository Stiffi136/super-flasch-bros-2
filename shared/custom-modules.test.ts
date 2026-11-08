import { describe, expect, it } from 'vitest';
import { generateLevel } from './game';
import type { ModuleDefinition } from './module-format';

const custom: ModuleDefinition = {
  format: 'super-flasch-module',
  version: 1,
  id: 'custom-bridge',
  name: 'Custom bridge',
  width: 900,
  platforms: [
    { kind: 'solid', x: 125, y: -60, w: 180, h: 20 },
    { kind: 'grip', x: 125, y: -40, w: 180, h: 8 },
    { kind: 'hazard', x: 600, y: -18, w: 45, h: 18 },
  ],
};

const second: ModuleDefinition = {
  ...custom,
  id: 'custom-step',
  name: 'Custom step',
  width: 700,
  platforms: [{ kind: 'solid', x: 320, y: -35, w: 70, h: 35 }],
};

const floors = (level: ReturnType<typeof generateLevel>) =>
  level.platforms.filter(p => p.kind === 'solid' && p.h === 120).sort((a, b) => a.x - b.x);

describe('JSON-only level generation', () => {
  it('fails explicitly when no JSON modules are supplied', () => {
    expect(() => generateLevel(1, [])).toThrow('at least one JSON module is required');
    expect(() => generateLevel(1)).toThrow('at least one JSON module is required');
  });

  it('is deterministic and shuffles every supplied module into the first position', () => {
    const definitions = [custom, second];
    expect(generateLevel(2024, definitions)).toEqual(generateLevel(2024, definitions));
    const firstNames = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      firstNames.add(generateLevel(seed, definitions).modules[0].name);
    }
    expect(firstNames).toEqual(new Set(definitions.map(module => module.name)));
  });

  it('generates 24 segments from supplied modules only, with no built-in names', () => {
    const level = generateLevel(42, [custom]);
    expect(level.modules).toHaveLength(24);
    expect(new Set(level.modules.map(module => module.name))).toEqual(new Set([custom.name]));
    expect(level.modules.some(module => [
      'Überkopfrahmen + Mittelwand',
      'Erhöhte Stufe + fallende Blockstufen',
      'Blockstufe + versetzter Dachüberhang',
      'Stachelgrube',
      'Aufsteigende Treppen',
      'Abfallende Blockstufen + Deckenregal',
    ].includes(module.name))).toBe(false);
  });

  it('places JSON geometry in world space and keeps connected floor and automatic endpoints', () => {
    const level = generateLevel(42, [custom]);
    const module = level.modules[0];
    for (const local of custom.platforms) {
      expect(level.platforms).toContainEqual({
        kind: local.kind,
        x: module.startX + local.x,
        y: 500 + local.y,
        w: local.w,
        h: local.h,
      });
    }

    const courseFloors = floors(level);
    expect(courseFloors).toHaveLength(25);
    expect(courseFloors[0]).toMatchObject({ x: -300, y: 500, w: 1200 });
    for (let i = 1; i < courseFloors.length; i++) {
      expect(courseFloors[i].x).toBe(courseFloors[i - 1].x + courseFloors[i - 1].w);
      expect(courseFloors[i].y).toBe(500);
    }
    expect(level.platforms.some(platform => platform.kind === 'goal')).toBe(true);
    expect(generateLevel(42, [second]).platforms.some(platform => platform.kind === 'checkpoint')).toBe(true);
    expect(level.spawn).toEqual({ x: 40, y: 458 });
  });

  it('skips checkpoints when supplied module geometry blocks the trigger', () => {
    const unsafe: ModuleDefinition = {
      ...custom,
      id: 'unsafe-checkpoint',
      name: 'Unsafe checkpoint module',
      platforms: [{ kind: 'hazard', x: 0, y: -48, w: custom.width, h: 48 }],
    };
    for (let seed = 0; seed < 20; seed++) {
      const level = generateLevel(seed, [unsafe]);
      const module = level.modules.find(item => item.name === unsafe.name)!;
      expect(level.platforms.filter(platform => platform.kind === 'checkpoint' &&
        platform.x < module.startX + 154 && platform.x + platform.w > module.startX + 58)).toEqual([]);
    }
  });
});
