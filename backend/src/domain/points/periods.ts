// Registration-anniversary period math (tech-spec §5). All instants are UTC. The registration
// timestamp is `users.created_at`. These functions are pure and take `now` explicitly so that
// domain tests are fully deterministic.

/**
 * 00:00:00.000 UTC on registration's month + n, day clamped to the target month's length.
 * n >= 0. Clamping is per-month and never sticky — it re-reads the original registration day
 * each time (e.g. registered Jan 31 → n=1 Feb 28, n=2 Mar 31, n=3 Apr 30, n=4 May 31).
 */
export function anniversaryDate(registeredAt: Date, n: number): Date {
  const day = registeredAt.getUTCDate()
  // Date.UTC handles month overflow, giving the 1st of the target month with year rollover.
  const target = new Date(Date.UTC(registeredAt.getUTCFullYear(), registeredAt.getUTCMonth() + n, 1))
  const year = target.getUTCFullYear()
  const month = target.getUTCMonth()
  // Day 0 of the next month = last day of the target month.
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(day, daysInMonth)))
}

/**
 * Largest n >= 0 with anniversaryDate(registeredAt, n) <= now. On the registration day this is 0;
 * it becomes 1 exactly at the first monthly boundary.
 */
export function periodIndex(registeredAt: Date, now: Date): number {
  const t = now.getTime()
  let n = 0
  while (anniversaryDate(registeredAt, n + 1).getTime() <= t) {
    n++
  }
  return n
}

/**
 * Ascending list of maintenance periods owed: [lastAccruedPeriod+1 .. periodIndex(now)], each
 * >= 1. Returns [] when up to date. Period 0 (registration itself) never accrues.
 */
export function duePeriods(registeredAt: Date, lastAccruedPeriod: number, now: Date): number[] {
  const current = periodIndex(registeredAt, now)
  const start = Math.max(lastAccruedPeriod + 1, 1)
  const periods: number[] = []
  for (let n = start; n <= current; n++) {
    periods.push(n)
  }
  return periods
}
