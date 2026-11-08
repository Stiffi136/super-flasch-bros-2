/** A world-space point used by the visual-only ceiling swing effect. */
export type SwingPosition = { x: number; y: number };

export type SwingTrailParticle = SwingPosition & {
  /** Opacity from 0 to 1. */
  alpha: number;
  /** Suggested visual radius in pixels. */
  size: number;
};

export type SwingEffectsFrame = {
  /** Smooth body lean, in radians. */
  lean: number;
  /** Smooth limb swing, in radians. */
  limbSwing: number;
  /** Warm, fading trail points in world coordinates. */
  trail: SwingTrailParticle[];
};

export type SwingEffectsOptions = {
  maxParticles?: number;
  particleLifetime?: number;
  particleInterval?: number;
  leanAmount?: number;
  limbAmount?: number;
};

type Particle = { x: number; y: number; age: number; size: number };

const DEFAULTS = {
  maxParticles: 16,
  particleLifetime: 0.42,
  particleInterval: 0.035,
  leanAmount: 0.32,
  limbAmount: 0.65,
};

/**
 * Produces render data only. Call trigger when a ceiling attachment ends, then
 * call update with seconds and the character's current world position each frame.
 * A caller can detect a remote `ceiling: true` to `false` transition and trigger it too.
 */
export class CeilingSwingEffects {
  private strength = 0;
  private direction = 1;
  private phase = 0;
  private lean = 0;
  private spawnClock = 0;
  private particles: Particle[] = [];
  private readonly maxParticles: number;
  private readonly lifetime: number;
  private readonly interval: number;
  private readonly leanAmount: number;
  private readonly limbAmount: number;

  constructor(options: SwingEffectsOptions = {}) {
    this.maxParticles = Math.max(0, Math.floor(positive(options.maxParticles, DEFAULTS.maxParticles)));
    this.lifetime = positive(options.particleLifetime, DEFAULTS.particleLifetime);
    this.interval = positive(options.particleInterval, DEFAULTS.particleInterval);
    this.leanAmount = positive(options.leanAmount, DEFAULTS.leanAmount);
    this.limbAmount = positive(options.limbAmount, DEFAULTS.limbAmount);
  }

  /** Starts or refreshes a swing. Direction is a horizontal sign: -1 or +1. */
  trigger(position: SwingPosition, direction: number): void {
    if (!validPosition(position)) return;
    this.direction = Number.isFinite(direction) && direction < 0 ? -1 : 1;
    this.strength = 1;
    this.spawnClock = 0;
    this.addParticle(position);
  }

  /** Advances the effect by `dt` seconds and returns render-only values. */
  update(dt: number, position: SwingPosition): SwingEffectsFrame {
    const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    const point = validPosition(position) ? position : { x: 0, y: 0 };

    this.strength *= Math.exp(-elapsed / 0.12);
    this.phase += elapsed * 15;
    const leanTarget = this.direction * this.leanAmount * this.strength;
    this.lean += (leanTarget - this.lean) * (1 - Math.exp(-elapsed / 0.075));

    if (this.strength > 0.035 && this.maxParticles > 0) {
      this.spawnClock += elapsed;
      let spawned = 0;
      while (this.spawnClock >= this.interval && spawned < this.maxParticles) {
        this.spawnClock -= this.interval;
        // Place the warm trail behind the motion, with a small oscillating offset.
        this.addParticle({ x: point.x - this.direction * (8 + 3 * Math.sin(this.phase)), y: point.y + 3 * Math.cos(this.phase) });
        spawned++;
      }
      if (spawned === this.maxParticles && this.spawnClock >= this.interval) this.spawnClock %= this.interval;
    } else {
      this.spawnClock = 0;
    }

    for (const particle of this.particles) particle.age += elapsed;
    this.particles = this.particles.filter((particle) => particle.age < this.lifetime);

    return {
      lean: finiteOrZero(this.lean),
      limbSwing: finiteOrZero(Math.sin(this.phase) * this.limbAmount * this.strength),
      trail: this.particles.map((particle) => ({
        x: particle.x,
        y: particle.y,
        alpha: Math.max(0, 1 - particle.age / this.lifetime),
        size: particle.size,
      })),
    };
  }

  /** Removes all effect state and trail particles. */
  reset(): void {
    this.strength = 0;
    this.direction = 1;
    this.phase = 0;
    this.lean = 0;
    this.spawnClock = 0;
    this.particles = [];
  }

  private addParticle(position: SwingPosition): void {
    if (this.maxParticles === 0) return;
    this.particles.push({ x: position.x, y: position.y, age: 0, size: 4 });
    if (this.particles.length > this.maxParticles) this.particles.splice(0, this.particles.length - this.maxParticles);
  }
}

function positive(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}
function validPosition(position: SwingPosition): boolean {
  return Number.isFinite(position?.x) && Number.isFinite(position?.y);
}
function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
