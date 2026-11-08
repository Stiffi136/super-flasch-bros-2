import type { Platform } from './game';

/** A checkpoint's lower edge coincides with its safe supporting runway. */
export function checkpointSpawn(checkpoint: Platform, solids: Platform[], playerWidth: number, playerHeight: number): { x: number; y: number } | undefined {
  const floor = solids.find(s => s.kind === 'solid' && s.h >= 80 && checkpoint.x >= s.x && checkpoint.x < s.x + s.w && s.y >= checkpoint.y && s.y <= checkpoint.y + checkpoint.h + 8);
  if (!floor) return undefined;
  return { x: Math.max(floor.x, Math.min(checkpoint.x, floor.x + floor.w - playerWidth)), y: floor.y - playerHeight };
}
