/** Timers for leaving an automatically grabbed surface without instantly reattaching. */
export const RELEASE_LOCK_SECONDS = 0.2;
export const WALL_JUMP_LOCK_SECONDS = 0.16;

// World units per second. Keep these values shared with tests and animation.
export const RUN_SPEED = 480;
export const MAX_RUN_SPEED = 720;
/** Ceiling swings can temporarily exceed the running speed cap. */
export const MAX_SWING_SPEED = 900;
export const RUN_BOOST_PER_SECOND = 24;
export const SLIDE_SPEED = 55;
const RUN_ACCELERATION = 3200;
const AIR_ACCELERATION = 2400;
const SLIDE_DRAG = 0.8;
const SLIDE_STEER_ACCELERATION = 210;

/** Accumulated running bonus in seconds. A brief wall contact retains most of
 * the bonus, while prolonged wall contact dissipates it exponentially. */
export function advanceRunTime(runTime: number, velocity: number, direction: number, grounded: boolean, sliding: boolean, wallContact: boolean, dt: number): number {
  if (wallContact) return runTime * Math.exp(-3 * dt);
  if (direction === 0 || Math.abs(velocity) < 1 || Math.sign(velocity) !== direction) return 0;
  if (grounded && sliding) return runTime;
  return Math.min((MAX_RUN_SPEED - RUN_SPEED) / RUN_BOOST_PER_SECOND, runTime + dt);
}

export function runningSpeed(runTime: number): number {
  return Math.min(MAX_RUN_SPEED, RUN_SPEED + Math.max(0, runTime) * RUN_BOOST_PER_SECOND);
}

/** A wall jump redirects the remaining speed bonus away from the contacted wall. */
export function wallJumpVelocity(wall: -1 | 1, runTime: number): number {
  return (wall === -1 ? -1 : 1) * (390 + runningSpeed(runTime) - RUN_SPEED);
}

/** Horizontal release speed after a ceiling grab. A longer grip loses swing energy. */
export function ceilingSwingVelocity(entryVelocity: number, direction: number, facing: number, gripSeconds: number): number {
  const sign = Math.sign(direction) || Math.sign(entryVelocity) || Math.sign(facing) || 1;
  const boost = 360 * Math.exp(-3 * Math.max(0, gripSeconds));
  const carried = Math.min(MAX_SWING_SPEED, Math.abs(entryVelocity)) * Math.exp(-2 * Math.max(0, gripSeconds));
  return sign * Math.min(MAX_SWING_SPEED, Math.max(190, carried) + boost);
}

/** Horizontal movement in one physics step, independent of rendering. */
export function horizontalVelocity(velocity: number, direction: number, grounded: boolean, sliding: boolean, dt: number, runLimit = RUN_SPEED): number {
  if (grounded && sliding) {
    // Momentum decays smoothly, even while steering. Steering cannot add speed beyond
    // the slow crawl target, but it can brake and reverse an existing slide.
    const damped = velocity * Math.exp(-SLIDE_DRAG * dt);
    const target = direction * SLIDE_SPEED;
    const maxChange = SLIDE_STEER_ACCELERATION * dt;
    if (direction === 0 || Math.sign(damped) === direction && Math.abs(damped) >= SLIDE_SPEED) return damped;
    return damped + Math.max(-maxChange, Math.min(maxChange, target - damped));
  }
  const acceleration = grounded ? RUN_ACCELERATION : AIR_ACCELERATION;
  let next = velocity + direction * acceleration * dt;
  if (grounded && direction === 0) next *= Math.pow(0.78, dt * 60);
  // A wall jump may exceed run speed briefly; do not erase its impulse in mid-air.
  // Do not erase extra momentum in the air or on landing after a fast slide.
  const limit = Math.max(RUN_SPEED, runLimit, Math.abs(velocity));
  return Math.max(-limit, Math.min(limit, next));
}

export type GrabContacts = { wall: -1 | 0 | 1; ceiling: boolean };
export type GrabDecision = { wall: -1 | 0 | 1; ceiling: boolean; jump: 'ground' | 'wall' | 'ceiling' | 'drop' | null };

/** Slide releases a grip; wall jumps take priority over coyote time. */
export function decideGrab(contacts: GrabContacts, grounded: boolean, coyote: number, buffered: boolean, releaseLock: number, dropHeld: boolean): GrabDecision {
  const canGrab = !grounded && releaseLock <= 0 && !dropHeld;
  const wall = canGrab ? contacts.wall : 0;
  const ceiling = canGrab && contacts.ceiling;
  if (!grounded && dropHeld && contacts.wall && buffered) return { wall: 0, ceiling: false, jump: 'wall' };
  if (!grounded && dropHeld && (contacts.ceiling || contacts.wall)) return { wall: 0, ceiling: false, jump: 'drop' };
  if (!buffered) return { wall, ceiling, jump: null };
  if (wall) return { wall: 0, ceiling: false, jump: 'wall' };
  if (ceiling) return { wall: 0, ceiling: false, jump: 'ceiling' };
  if (grounded || coyote > 0) return { wall: 0, ceiling: false, jump: 'ground' };
  return { wall, ceiling, jump: null };
}
