import type { MultiplayerState } from './scene';

export type InterpolationOptions = {
  playbackDelayMs?: number;
  maxExtrapolationMs?: number;
  maxSnapshots?: number;
  teleportDistance?: number;
};

type Snapshot = { state: MultiplayerState; time: number };

const DEFAULT_DELAY_MS = 120;
const DEFAULT_MAX_EXTRAPOLATION_MS = 100;
const DEFAULT_MAX_SNAPSHOTS = 32;
const DEFAULT_TELEPORT_DISTANCE = 300;
const MIN_TIME_STEP_MS = 1;

/** Interpolates remote states using local receipt time. All times are milliseconds. */
export class SnapshotInterpolator {
  private snapshots: Snapshot[] = [];
  private readonly delay: number;
  private readonly extrapolationLimit: number;
  private readonly capacity: number;
  private readonly teleportDistance: number;

  constructor(options: InterpolationOptions = {}) {
    this.delay = positive(options.playbackDelayMs, DEFAULT_DELAY_MS);
    this.extrapolationLimit = positive(options.maxExtrapolationMs, DEFAULT_MAX_EXTRAPOLATION_MS);
    this.capacity = Math.max(2, Math.floor(positive(options.maxSnapshots, DEFAULT_MAX_SNAPSHOTS)));
    this.teleportDistance = positive(options.teleportDistance, DEFAULT_TELEPORT_DISTANCE);
  }

  /** Adds a state with its local performance.now() receipt timestamp. */
  push(state: MultiplayerState, time: number): void {
    if (!Number.isFinite(time) || !Number.isFinite(state.seq)) return;
    const latest = this.snapshots[this.snapshots.length - 1];
    if (latest && state.seq <= latest.state.seq) return;

    let effectiveTime = time;
    if (latest && effectiveTime <= latest.time) effectiveTime = latest.time + MIN_TIME_STEP_MS;
    const copy = { ...state };
    let reset = false;
    if (latest) {
      if (copy.deaths !== latest.state.deaths) reset = true;
      else {
        const dt = (effectiveTime - latest.time) / 1000;
        const dx = copy.x - latest.state.x;
        const dy = copy.y - latest.state.y;
        const expectedTravel = Math.hypot(latest.state.vx, latest.state.vy) * dt;
        if (Math.hypot(dx, dy) > this.teleportDistance + expectedTravel) reset = true;
      }
    }

    if (reset) this.snapshots = [];
    this.snapshots.push({ state: copy, time: effectiveTime });
    if (this.snapshots.length > this.capacity) this.snapshots.splice(0, this.snapshots.length - this.capacity);
  }

  /** Samples the delayed playback timeline. */
  sample(time: number): MultiplayerState | undefined {
    if (!this.snapshots.length || !Number.isFinite(time)) return undefined;
    const target = time - this.delay;
    const first = this.snapshots[0];
    if (target <= first.time) return { ...first.state };

    for (let i = 1; i < this.snapshots.length; i++) {
      const right = this.snapshots[i];
      const left = this.snapshots[i - 1];
      if (target <= right.time) {
        const span = right.time - left.time;
        const t = span <= 0 ? 1 : Math.max(0, Math.min(1, (target - left.time) / span));
        return interpolate(left.state, right.state, t);
      }
    }

    const latest = this.snapshots[this.snapshots.length - 1];
    const elapsed = Math.max(0, Math.min(this.extrapolationLimit, target - latest.time)) / 1000;
    return { ...latest.state, x: latest.state.x + latest.state.vx * elapsed, y: latest.state.y + latest.state.vy * elapsed };
  }
}

function interpolate(a: MultiplayerState, b: MultiplayerState, t: number): MultiplayerState {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    ...a,
    x: lerp(a.x, b.x), y: lerp(a.y, b.y),
    vx: lerp(a.vx, b.vx), vy: lerp(a.vy, b.vy),
    lean: lerp(a.lean, b.lean), runPhase: lerp(a.runPhase, b.runPhase),
    // Keep all discrete fields, including sequence and life state, from the earlier snapshot.
  };
}

function positive(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}
