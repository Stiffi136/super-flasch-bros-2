import { describe, expect, it } from 'vitest';
import { computeModuleSetHash, GENERATOR_PROTOCOL_VERSION, MAX_CUSTOM_MODULE_FILES, moduleSetHash, validateCustomModules } from './custom-modules';

const moduleData = (id: string, name = id) => ({
  format: 'super-flasch-module',
  version: 1,
  id,
  name,
  width: 100,
  platforms: [{ kind: 'solid', x: 0, y: -10, w: 20, h: 5 }],
});

describe('custom module loader validation', () => {
  it('returns validated definitions in deterministic filename order', () => {
    const loaded = validateCustomModules({
      '../modules/zeta.json': moduleData('zeta'),
      '../modules/alpha.json': moduleData('alpha'),
    });

    expect(loaded.map(module => module.id)).toEqual(['alpha', 'zeta']);
  });

  it('rejects duplicate module IDs and names both filenames', () => {
    expect(() => validateCustomModules({
      '../modules/first.json': moduleData('shared-id'),
      '../modules/second.json': moduleData('shared-id'),
    })).toThrow(/Duplicate module id "shared-id".*first\.json.*second\.json/);
  });

  it('rejects invalid module data and includes its filename', () => {
    expect(() => validateCustomModules({
      '../modules/broken-module.json': { ...moduleData('broken'), width: 0 },
    })).toThrow(/broken-module\.json.*width.*finite number/);
  });

  it('rejects malformed values and includes the source filename', () => {
    expect(() => validateCustomModules({ '../modules/not-an-object.json': null }))
      .toThrow(/not-an-object\.json.*expected an object/);
  });

  it('fingerprints canonical validated content and sorted filenames', () => {
    const a = { '../modules/z.json': moduleData('z'), '../modules/a.json': moduleData('a') };
    const b = { '../modules/a.json': moduleData('a'), '../modules/z.json': moduleData('z') };
    expect(computeModuleSetHash(a)).toBe(computeModuleSetHash(b));
    expect(computeModuleSetHash({ '../modules/renamed.json': moduleData('z') }))
      .not.toBe(computeModuleSetHash({ '../modules/z.json': moduleData('z') }));
  });

  it('gives the empty set a generator-versioned fingerprint and caps file count', () => {
    expect(computeModuleSetHash({})).toMatch(new RegExp(`^generator-${GENERATOR_PROTOCOL_VERSION}-sha256-[a-f0-9]{64}$`));
    expect(moduleSetHash).toMatch(new RegExp(`^generator-${GENERATOR_PROTOCOL_VERSION}-sha256-[a-f0-9]{64}$`));
    const tooMany = Object.fromEntries(Array.from({ length: MAX_CUSTOM_MODULE_FILES + 1 }, (_, i) => [`${i}.json`, moduleData(String(i))]));
    expect(() => validateCustomModules(tooMany)).toThrow(/Too many custom module files/);
  });
});
