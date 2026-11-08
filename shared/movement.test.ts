import { describe, expect, it } from 'vitest';
import { advanceRunTime, ceilingSwingVelocity, decideGrab, horizontalVelocity, MAX_RUN_SPEED, MAX_SWING_SPEED, RUN_BOOST_PER_SECOND, RUN_SPEED, runningSpeed, SLIDE_SPEED, wallJumpVelocity } from './movement';

describe('running and sliding', () => {
  const simulate = (v: number, dir: number, grounded: boolean, sliding: boolean, seconds: number) => {
    for (let i = 0; i < seconds * 120; i++) v = horizontalVelocity(v, dir, grounded, sliding, 1 / 120);
    return v;
  };
  it('runs faster than the previous 370-unit speed', () => {
    expect(simulate(0, 1, true, false, 1)).toBe(RUN_SPEED);
    expect(RUN_SPEED).toBeGreaterThan(370);
  });
  it('carries most momentum into the first slide step', () => {
    const first = horizontalVelocity(RUN_SPEED, 1, true, true, 1 / 120);
    expect(first).toBeGreaterThan(RUN_SPEED * .97);
    expect(first).toBeLessThan(RUN_SPEED);
  });
  it('slows to a crawl while holding the direction', () => {
    expect(simulate(RUN_SPEED, 1, true, true, 1)).toBeGreaterThan(RUN_SPEED * .4);
    expect(simulate(RUN_SPEED, 1, true, true, 5)).toBeLessThan(SLIDE_SPEED + 2);
    expect(simulate(RUN_SPEED, 1, true, true, 5)).toBeGreaterThan(0);
  });
  it('slowly accelerates when sliding from rest', () => {
    expect(simulate(0, 1, true, true, 2)).toBeGreaterThan(0);
    expect(simulate(0, 1, true, true, 2)).toBeLessThanOrEqual(SLIDE_SPEED);
  });
  it('eventually stops without steering and can reverse', () => {
    expect(Math.abs(simulate(RUN_SPEED, 0, true, true, 9))).toBeLessThan(1);
    expect(simulate(RUN_SPEED, -1, true, true, 4)).toBeLessThan(0);
  });
  it('allows a decisive mid-air direction change', () => {
    const initialSpeed = RUN_SPEED;
    expect(simulate(initialSpeed, -1, false, false, .3)).toBeLessThan(0);
  });
  it('retains an airborne wall-jump impulse above run speed', () => {
    expect(horizontalVelocity(-390, 0, false, false, 1 / 120)).toBe(-390);
  });
});

describe('running speed buildup', () => {
  it('starts at the original speed and increases to a bounded maximum', () => {
    expect(runningSpeed(0)).toBe(RUN_SPEED);
    expect(runningSpeed(2)).toBe(RUN_SPEED + 2 * RUN_BOOST_PER_SECOND);
    expect(runningSpeed(100)).toBe(MAX_RUN_SPEED);
  });
  it('builds on the ground and in the air, and preserves the bonus while sliding', () => {
    const dt = 1 / 120;
    let runTime = 0, velocity = 0;
    for (let i = 0; i < 4 * 120; i++) {
      velocity = horizontalVelocity(velocity, 1, true, false, dt, runningSpeed(runTime));
      runTime = advanceRunTime(runTime, velocity, 1, true, false, false, dt);
    }
    expect(velocity).toBeGreaterThan(RUN_SPEED + 80);
    expect(advanceRunTime(runTime, velocity, 1, false, false, false, dt)).toBeCloseTo(runTime + dt);
    expect(advanceRunTime(runTime, velocity, 1, true, true, false, dt)).toBe(runTime);
    expect(horizontalVelocity(velocity, 1, true, true, dt)).toBeGreaterThan(velocity * .97);
  });
  it('clears buildup on stop or reversal, but not on a brief wall contact', () => {
    const step = (v: number, dir: number, blocked = false) => advanceRunTime(3, v, dir, true, false, blocked, 1 / 120);
    expect(step(500, 0)).toBe(0);
    expect(step(500, -1)).toBe(0);
    expect(step(0, 1, true)).toBeGreaterThan(2.9);
  });
  it('redirects the remaining bonus on a wall jump', () => {
    expect(wallJumpVelocity(-1, 0)).toBe(-390);
    expect(wallJumpVelocity(1, 10)).toBe(630);
    const afterBriefContact = advanceRunTime(10, 0, 0, false, false, true, .016);
    expect(wallJumpVelocity(1, afterBriefContact)).toBeGreaterThan(618);
  });
  it('decays rapidly while hanging, independent of frame step size', () => {
    const decay = (dt: number) => {
      let time = 10;
      for (let t = 0; t < Math.round(1 / dt); t++) time = advanceRunTime(time, 0, 0, false, false, true, dt);
      return time;
    };
    expect(decay(1 / 120)).toBeCloseTo(decay(1 / 60), 8);
    expect(decay(1 / 120)).toBeLessThan(.6);
    expect(advanceRunTime(10, 0, 0, false, false, true, .016)).toBeGreaterThan(9.5);
  });
});

describe('ceiling swing', () => {
  it('gives a larger boost on an early release and respects the speed cap', () => {
    const early = ceilingSwingVelocity(600, 1, 1, 0.03);
    const late = ceilingSwingVelocity(600, 1, 1, 1);
    expect(early).toBeGreaterThan(800);
    expect(early).toBeLessThanOrEqual(MAX_SWING_SPEED);
    expect(late).toBeLessThan(early);
    expect(ceilingSwingVelocity(600, -1, 1, 0.03)).toBe(-early);
    expect(ceilingSwingVelocity(-600, 0, 1, 0.03)).toBe(-early);
  });
  it('allows jumping from the ceiling without changing shift release or wall priority', () => {
    expect(decideGrab({ wall: 0, ceiling: true }, false, 0, true, 0, false).jump).toBe('ceiling');
    expect(decideGrab({ wall: 0, ceiling: true }, false, 0, true, 0, true).jump).toBe('drop');
    expect(decideGrab({ wall: -1, ceiling: true }, false, 0, true, 0, false).jump).toBe('wall');
  });
});

describe('automatic grip', () => {
  it('grabs a ceiling without a grip key', () => {
    expect(decideGrab({ wall: 0, ceiling: true }, false, 0, false, 0, false)).toEqual({ wall: 0, ceiling: true, jump: null });
  });
  it('releases a ceiling while slide is held', () => {
    expect(decideGrab({ wall: 0, ceiling: true }, false, 0, false, 0, true)).toEqual({ wall: 0, ceiling: false, jump: 'drop' });
  });
  it('releases a wall while slide is held', () => {
    expect(decideGrab({ wall: -1, ceiling: false }, false, 0, false, 0, true)).toEqual({ wall: 0, ceiling: false, jump: 'drop' });
  });
  it('does not grab during release lock', () => {
    expect(decideGrab({ wall: -1, ceiling: true }, false, 0, false, .1, false)).toEqual({ wall: 0, ceiling: false, jump: null });
  });
  it('prefers wall jump to coyote jump', () => {
    expect(decideGrab({ wall: -1, ceiling: false }, false, .05, true, 0, false).jump).toBe('wall');
  });
  it('allows a wall jump while sliding down a wall', () => {
    expect(decideGrab({ wall: -1, ceiling: false }, false, 0, true, .1, true).jump).toBe('wall');
  });
  it('still allows ground jumping while slide is held', () => {
    expect(decideGrab({ wall: 0, ceiling: false }, true, 0, true, 0, true).jump).toBe('ground');
  });
  it('never grabs a wall when standing on the ground', () => {
    expect(decideGrab({ wall: -1, ceiling: false }, true, 0, false, 0, false).wall).toBe(0);
  });
});
