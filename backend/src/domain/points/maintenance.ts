// Monthly maintenance planner (PRD §6.4, tech-spec §5). Decides, per due period, WHETHER a
// G-wallet reset is required. The reset AMOUNT is not computed here — it depends on the live G
// balance and is resolved inside the SQL transaction (tech-spec §1.1 rule 2).
import { WARMUP_PERIODS, WINDOW_PERIODS } from './constants'
import { anniversaryDate, duePeriods } from './periods'
import type { MaintenancePlanItem } from './types'

export function planMaintenance(input: {
  registeredAt: Date
  lastAccruedPeriod: number // 0 if no MAINTENANCE_ACCRUAL rows yet
  approvedOrderDates: Date[] // decided_at of the user's APPROVED orders
  now: Date
}): MaintenancePlanItem[] {
  const { registeredAt, lastAccruedPeriod, approvedOrderDates, now } = input

  return duePeriods(registeredAt, lastAccruedPeriod, now).map((n) => {
    // Warm-up: no reset for periods 1..WARMUP_PERIODS — there isn't a full window to evaluate yet.
    if (n <= WARMUP_PERIODS) {
      return { periodIndex: n, resetRequired: false }
    }

    // Rolling window, half-open on the right: [anniv(n-WINDOW), anniv(n)). An order approved at
    // exactly the closing anniversary belongs to the NEXT window, not this one.
    const windowStart = anniversaryDate(registeredAt, n - WINDOW_PERIODS).getTime()
    const windowEnd = anniversaryDate(registeredAt, n).getTime()
    const hasApprovedInWindow = approvedOrderDates.some((d) => {
      const t = d.getTime()
      return t >= windowStart && t < windowEnd
    })

    return { periodIndex: n, resetRequired: !hasApprovedInWindow }
  })
}
