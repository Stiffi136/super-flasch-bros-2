import { describe, expect, it } from 'vitest';
import { advanceCountdown, countdownLabel, COUNTDOWN_DURATION_SECONDS } from './countdown';

describe('start countdown', () => {
  it('uses a 3-second local countdown with one second per number', () => {
    expect(COUNTDOWN_DURATION_SECONDS).toBe(3);
    expect([0, .75, 1, 2.25].map(t => countdownLabel(t))).toEqual(['3', '3', '2', '1']);
    expect(countdownLabel(3)).toBeUndefined();
  });

  it('scales labels to a server-provided duration and clamps at completion', () => {
    expect([0, 1, 2, 3].map(t => countdownLabel(t, 4))).toEqual(['4', '3', '2', '1']);
    expect(advanceCountdown(1.8, .5, 4)).toBe(2.3);
    expect(advanceCountdown(2.3, 10, 4)).toBe(4);
    expect(advanceCountdown(1, -1)).toBe(1);
  });
});
