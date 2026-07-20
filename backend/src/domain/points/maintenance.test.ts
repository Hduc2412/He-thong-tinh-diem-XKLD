import { describe, it, expect } from 'vitest'
import { planMaintenance } from './maintenance'
import { anniversaryDate } from './periods'

const reg = new Date('2026-01-15T00:00:00.000Z')

describe('planMaintenance', () => {
  it('no reset during warm-up (periods 1–3) regardless of orders', () => {
    const plan = planMaintenance({
      registeredAt: reg,
      lastAccruedPeriod: 0,
      approvedOrderDates: [],
      now: anniversaryDate(reg, 3),
    })
    expect(plan).toEqual([
      { periodIndex: 1, resetRequired: false },
      { periodIndex: 2, resetRequired: false },
      { periodIndex: 3, resetRequired: false },
    ])
  })

  it('reset at period 4 with an empty window', () => {
    const plan = planMaintenance({
      registeredAt: reg,
      lastAccruedPeriod: 3,
      approvedOrderDates: [],
      now: anniversaryDate(reg, 4),
    })
    expect(plan).toEqual([{ periodIndex: 4, resetRequired: true }])
  })

  it('no reset at 4 with an order exactly at anniv(1) — inclusive left edge', () => {
    const plan = planMaintenance({
      registeredAt: reg,
      lastAccruedPeriod: 3,
      approvedOrderDates: [anniversaryDate(reg, 1)],
      now: anniversaryDate(reg, 4),
    })
    expect(plan).toEqual([{ periodIndex: 4, resetRequired: false }])
  })

  it('reset at 4 with an order exactly at anniv(4) — exclusive right edge', () => {
    const plan = planMaintenance({
      registeredAt: reg,
      lastAccruedPeriod: 3,
      approvedOrderDates: [anniversaryDate(reg, 4)],
      now: anniversaryDate(reg, 4),
    })
    expect(plan).toEqual([{ periodIndex: 4, resetRequired: true }])
  })

  it('reset at 4 when the only order is older than the window', () => {
    const plan = planMaintenance({
      registeredAt: reg,
      lastAccruedPeriod: 3,
      approvedOrderDates: [new Date(anniversaryDate(reg, 1).getTime() - 1)],
      now: anniversaryDate(reg, 4),
    })
    expect(plan).toEqual([{ periodIndex: 4, resetRequired: true }])
  })

  it('catch-up flags resets only on periods whose own window is dry', () => {
    // One approved order at anniv(4). Windows:
    //   period 5 [anniv(2),anniv(5))  → contains it → no reset
    //   period 6 [anniv(3),anniv(6))  → contains it → no reset
    //   period 7 [anniv(4),anniv(7))  → contains it (inclusive left) → no reset
    //   period 8 [anniv(5),anniv(8))  → excludes it → reset
    const plan = planMaintenance({
      registeredAt: reg,
      lastAccruedPeriod: 4,
      approvedOrderDates: [anniversaryDate(reg, 4)],
      now: anniversaryDate(reg, 8),
    })
    expect(plan).toEqual([
      { periodIndex: 5, resetRequired: false },
      { periodIndex: 6, resetRequired: false },
      { periodIndex: 7, resetRequired: false },
      { periodIndex: 8, resetRequired: true },
    ])
  })

  it('empty plan when nothing is due', () => {
    const plan = planMaintenance({
      registeredAt: reg,
      lastAccruedPeriod: 4,
      approvedOrderDates: [],
      now: anniversaryDate(reg, 4),
    })
    expect(plan).toEqual([])
  })
})
