export interface Point { x: number; y: number }

/** Solve a two-segment limb and bend its joint in the desired horizontal direction. */
export function solveLimb(anchor: Point, target: Point, upperLength: number, lowerLength: number, facing: number): { joint: Point; end: Point } {
  const dx = target.x - anchor.x;
  const dy = target.y - anchor.y;
  const distance = Math.hypot(dx, dy) || 1;
  const reach = Math.max(Math.abs(upperLength - lowerLength) + .25, Math.min(upperLength + lowerLength - .25, distance));
  const ux = dx / distance;
  const uy = dy / distance;
  const along = (upperLength * upperLength - lowerLength * lowerLength + reach * reach) / (2 * reach);
  const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  const side = (uy >= 0 ? -1 : 1) * (facing < 0 ? -1 : 1);
  return {
    joint: { x: anchor.x + ux * along - uy * height * side, y: anchor.y + uy * along + ux * height * side },
    end: { x: anchor.x + ux * reach, y: anchor.y + uy * reach },
  };
}
