/** World-space look-ahead of the follow camera. Smaller than the old ±150 offset. */
export const CAMERA_LOOK_AHEAD = 80;
/** Time constant in seconds; reversing the input no longer reverses the offset at once. */
export const CAMERA_LOOK_AHEAD_TIME = 0.55;

/** Smoothly approach the look-ahead target independently of the physics tick rate. */
export function smoothCameraOffset(current: number, facing: number, dt: number): number {
  const target = -Math.sign(facing) * CAMERA_LOOK_AHEAD;
  return current + (target - current) * (1 - Math.exp(-Math.max(0, dt) / CAMERA_LOOK_AHEAD_TIME));
}
