import type { Platform } from './game';

export const MODULE_FORMAT = 'super-flasch-module' as const;
export const MODULE_VERSION = 1 as const;

export type ModulePlatform = {
  kind: 'solid' | 'hazard' | 'grip';
  /** Horizontal offset from the module's left edge. */
  x: number;
  /** Vertical offset from the floor; 0 is the floor and negative values are above it. */
  y: number;
  w: number;
  h: number;
};

export type ModuleDefinition = {
  format: typeof MODULE_FORMAT;
  version: typeof MODULE_VERSION;
  id: string;
  name: string;
  width: number;
  platforms: ModulePlatform[];
};

export const MODULE_LIMITS = {
  maxIdLength: 128,
  maxNameLength: 200,
  maxWidth: 10_000,
  maxPlatforms: 256,
  maxCoordinate: 10_000,
  maxDimension: 10_000,
} as const;

function fail(path: string, reason: string): never {
  throw new Error(`Invalid module ${path}: ${reason}`);
}

function record(value: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected an object');
  const result = value as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (!keys.includes(key)) fail(`${path}.${key}`, 'unknown key');
  }
  for (const key of keys) {
    if (!(key in result)) fail(`${path}.${key}`, 'required key is missing');
  }
  return result;
}

function string(value: unknown, path: string, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    fail(path, `expected a non-empty string of at most ${max} characters`);
  }
  return value;
}

function number(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    fail(path, `expected a finite number from ${min} to ${max}`);
  }
  return value;
}

/** Validate untrusted JSON and return a fresh, typed module. Throws a path-specific Error on failure. */
export function validateModule(value: unknown): ModuleDefinition {
  const root = record(value, 'root', ['format', 'version', 'id', 'name', 'width', 'platforms']);
  if (root.format !== MODULE_FORMAT) fail('format', `expected "${MODULE_FORMAT}"`);
  if (root.version !== MODULE_VERSION) fail('version', `unsupported version (expected ${MODULE_VERSION})`);
  const id = string(root.id, 'id', MODULE_LIMITS.maxIdLength);
  const name = string(root.name, 'name', MODULE_LIMITS.maxNameLength);
  const width = number(root.width, 'width', Number.MIN_VALUE, MODULE_LIMITS.maxWidth);
  if (!Array.isArray(root.platforms)) fail('platforms', 'expected an array');
  if (root.platforms.length > MODULE_LIMITS.maxPlatforms) fail('platforms', `maximum count is ${MODULE_LIMITS.maxPlatforms}`);

  const platforms = root.platforms.map((item, index): ModulePlatform => {
    const path = `platforms[${index}]`;
    const platform = record(item, path, ['kind', 'x', 'y', 'w', 'h']);
    if (platform.kind !== 'solid' && platform.kind !== 'hazard' && platform.kind !== 'grip') {
      fail(`${path}.kind`, 'expected solid, hazard, or grip; checkpoint and goal are not module content');
    }
    const x = number(platform.x, `${path}.x`, 0, MODULE_LIMITS.maxCoordinate);
    const y = number(platform.y, `${path}.y`, -MODULE_LIMITS.maxCoordinate, 0);
    const w = number(platform.w, `${path}.w`, Number.MIN_VALUE, MODULE_LIMITS.maxDimension);
    const h = number(platform.h, `${path}.h`, Number.MIN_VALUE, MODULE_LIMITS.maxDimension);
    if (x + w > width) fail(`${path}.w`, 'platform must fit horizontally inside the module');
    if (y + h > 0) fail(`${path}.h`, 'platform must not extend below the module floor');
    return { kind: platform.kind, x, y, w, h };
  });

  return { format: MODULE_FORMAT, version: MODULE_VERSION, id, name, width, platforms };
}

/** Convert validated local module geometry to world-space game platforms. */
export function modulePlatformsToWorld(module: ModuleDefinition, moduleStartX: number, floorY: number): Platform[] {
  if (!Number.isFinite(moduleStartX) || !Number.isFinite(floorY)) {
    throw new Error('Module offsets must be finite numbers');
  }
  return module.platforms.map(platform => ({
    kind: platform.kind,
    x: moduleStartX + platform.x,
    y: floorY + platform.y,
    w: platform.w,
    h: platform.h,
  }));
}
