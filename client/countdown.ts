export const COUNTDOWN_DURATION_SECONDS = 3;

/** Show remaining whole seconds; LOS is shown only after the actual release. */
export function countdownLabel(elapsedSeconds: number, durationSeconds = COUNTDOWN_DURATION_SECONDS): string | undefined {
  if (elapsedSeconds < 0 || elapsedSeconds >= durationSeconds || durationSeconds <= 0) return undefined;
  return String(Math.ceil(durationSeconds - elapsedSeconds));
}

/** Advance only from an explicit frame delta. Clamp invalid negative time. */
export function advanceCountdown(elapsedSeconds: number, deltaSeconds: number, durationSeconds = COUNTDOWN_DURATION_SECONDS): number {
  return Math.min(Math.max(0, durationSeconds), elapsedSeconds + Math.max(0, deltaSeconds));
}
