import { describe, expect, it } from 'vitest';
import { generateLevel } from './game';
import { checkpointSpawn } from './checkpoint';
import type { ModuleDefinition } from './module-format';

const module: ModuleDefinition = {format:'super-flasch-module',version:1,id:'checkpoint-test',name:'Checkpoint-Test',width:840,platforms:[]};

describe('checkpoint spawn', () => {
  it('lands on a supporting runway for each generated checkpoint', () => {
    for (let seed = 0; seed < 100; seed++) {
      const level = generateLevel(seed, [module]);
      const solids = level.platforms.filter(p => p.kind === 'solid');
      for (const cp of level.platforms.filter(p => p.kind === 'checkpoint')) {
        const spawn = checkpointSpawn(cp, solids, 25, 42);
        expect(spawn).toBeDefined();
        expect(solids.some(s => s.h >= 80 && spawn!.x >= s.x && spawn!.x + 25 <= s.x + s.w && spawn!.y + 42 === s.y)).toBe(true);
      }
    }
  });
  it('rejects a checkpoint without a supporting runway', () => {
    expect(checkpointSpawn({kind:'checkpoint',x:0,y:0,w:96,h:48}, [], 25, 42)).toBeUndefined();
  });
});
