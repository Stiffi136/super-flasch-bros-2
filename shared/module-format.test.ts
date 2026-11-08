import { describe, expect, it } from 'vitest';
import { modulePlatformsToWorld, validateModule } from './module-format';

const valid = {
  format: 'super-flasch-module',
  version: 1,
  id: 'bridge-1',
  name: 'Fractional bridge',
  width: 120,
  platforms: [
    { kind: 'solid', x: 0.5, y: -20.25, w: 40.5, h: 8.25 },
    { kind: 'grip', x: 41, y: -12, w: 30, h: 2 },
    { kind: 'hazard', x: 90, y: -4, w: 10, h: 4 },
  ],
};

describe('module format validation', () => {
  it('accepts valid fractional local geometry and returns a fresh typed value', () => {
    const result = validateModule(valid);
    expect(result).toEqual(valid);
    expect(result).not.toBe(valid);
    expect(result.platforms).not.toBe(valid.platforms);
  });

  it('rejects non-objects, missing fields, unknown keys, and unsupported versions', () => {
    expect(() => validateModule(null)).toThrow(/expected an object/);
    const { id: _id, ...missingId } = valid;
    expect(() => validateModule(missingId)).toThrow(/id.*required key is missing/);
    expect(() => validateModule({ ...valid, extra: true })).toThrow(/extra.*unknown key/);
    expect(() => validateModule({ ...valid, version: 2 })).toThrow(/unsupported version/);
  });

  it('rejects invalid labels, widths, arrays, and excessive platform counts', () => {
    expect(() => validateModule({ ...valid, id: '   ' })).toThrow(/non-empty string/);
    expect(() => validateModule({ ...valid, width: Infinity })).toThrow(/finite number/);
    expect(() => validateModule({ ...valid, width: 0 })).toThrow(/finite number/);
    expect(() => validateModule({ ...valid, platforms: {} })).toThrow(/expected an array/);
    expect(() => validateModule({ ...valid, platforms: Array.from({ length: 257 }, () => valid.platforms[0]) })).toThrow(/maximum count/);
  });

  it('rejects non-finite, non-positive, malformed, and unsupported platform geometry', () => {
    const rejects = (patch: object, pattern: RegExp): void => {
      const platforms = [{ ...valid.platforms[0], ...patch }];
      expect(() => validateModule({ ...valid, platforms })).toThrow(pattern);
    };
    rejects({ kind: 'checkpoint' }, /checkpoint and goal/);
    rejects({ kind: 'goal' }, /checkpoint and goal/);
    rejects({ kind: 'lava' }, /expected solid, hazard, or grip/);
    rejects({ extra: 1 }, /unknown key/);
    rejects({ x: NaN }, /finite number/);
    rejects({ w: 0 }, /finite number/);
    rejects({ h: -1 }, /finite number/);
    rejects({ y: 1 }, /finite number/);
    rejects({ y: -10, h: 11 }, /must not extend below/);
  });

  it('rejects horizontal overflow, including a platform starting outside the module', () => {
    expect(() => validateModule({ ...valid, platforms: [{ kind: 'solid', x: 110, y: -10, w: 11, h: 2 }] })).toThrow(/fit horizontally/);
    expect(() => validateModule({ ...valid, platforms: [{ kind: 'solid', x: -1, y: -10, w: 2, h: 2 }] })).toThrow(/finite number/);
  });

  it('maps x from the module start and y from the floor without changing dimensions or kinds', () => {
    const parsed = validateModule(valid);
    expect(modulePlatformsToWorld(parsed, 500.5, 300)).toEqual([
      { kind: 'solid', x: 501, y: 279.75, w: 40.5, h: 8.25 },
      { kind: 'grip', x: 541.5, y: 288, w: 30, h: 2 },
      { kind: 'hazard', x: 590.5, y: 296, w: 10, h: 4 },
    ]);
  });

  it('rejects non-finite adapter offsets', () => {
    const parsed = validateModule(valid);
    expect(() => modulePlatformsToWorld(parsed, Infinity, 0)).toThrow(/finite numbers/);
    expect(() => modulePlatformsToWorld(parsed, 0, NaN)).toThrow(/finite numbers/);
  });
});
