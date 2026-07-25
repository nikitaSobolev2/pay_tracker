export const ACTIVE_SESSION_THRESHOLD_MS = 15 * 60 * 1000;

export function isSessionActive(
  updatedAt: Date,
  now = new Date(),
  thresholdMs = ACTIVE_SESSION_THRESHOLD_MS,
): boolean {
  return now.getTime() - updatedAt.getTime() <= thresholdMs;
}
