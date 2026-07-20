import { describe, it, expect } from 'vitest'
import { anniversaryDate, periodIndex, duePeriods } from './periods'

const iso = (d: Date) => d.toISOString()

describe('anniversaryDate', () => {
  it('n=0 is registration day at 00:00:00.000 UTC', () => {
    const reg = new Date('2026-01-15T14:30:00.000Z')
    expect(iso(anniversaryDate(reg, 0))).toBe('2026-01-15T00:00:00.000Z')
  })

  it('clamps a Jan-31 registration per month, never sticky', () => {
    const reg = new Date('2026-01-31T00:00:00.000Z')
    expect(iso(anniversaryDate(reg, 1))).toBe('2026-02-28T00:00:00.000Z')
    expect(iso(anniversaryDate(reg, 2))).toBe('2026-03-31T00:00:00.000Z')
    expect(iso(anniversaryDate(reg, 3))).toBe('2026-04-30T00:00:00.000Z')
    expect(iso(anniversaryDate(reg, 4))).toBe('2026-05-31T00:00:00.000Z')
  })

  it('handles a leap-day registration (2028-02-29 → n=12 = 2029-02-28)', () => {
    const reg = new Date('2028-02-29T00:00:00.000Z')
    expect(iso(anniversaryDate(reg, 12))).toBe('2029-02-28T00:00:00.000Z')
  })

  it('rolls over the year', () => {
    const reg = new Date('2026-11-10T00:00:00.000Z')
    expect(iso(anniversaryDate(reg, 3))).toBe('2027-02-10T00:00:00.000Z')
  })
})

describe('periodIndex', () => {
  const reg = new Date('2026-01-15T14:30:00.000Z')

  it('registration instant → 0', () => {
    expect(periodIndex(reg, reg)).toBe(0)
  })

  it('later the same day → 0', () => {
    expect(periodIndex(reg, new Date('2026-01-15T23:59:59.999Z'))).toBe(0)
  })

  it('exactly the +1 month boundary → 1', () => {
    expect(periodIndex(reg, anniversaryDate(reg, 1))).toBe(1)
  })

  it('one ms before the +1 month boundary → 0', () => {
    const oneMsBefore = new Date(anniversaryDate(reg, 1).getTime() - 1)
    expect(periodIndex(reg, oneMsBefore)).toBe(0)
  })

  it('several months later', () => {
    expect(periodIndex(reg, anniversaryDate(reg, 5))).toBe(5)
  })
})

describe('duePeriods', () => {
  const reg = new Date('2026-01-15T00:00:00.000Z')

  it('empty when already up to date', () => {
    expect(duePeriods(reg, 3, anniversaryDate(reg, 3))).toEqual([])
  })

  it('[3,4,5] after three missed months (lastAccrued=2, now at period 5)', () => {
    expect(duePeriods(reg, 2, anniversaryDate(reg, 5))).toEqual([3, 4, 5])
  })

  it('never emits 0 (fresh user, first period just due)', () => {
    expect(duePeriods(reg, 0, anniversaryDate(reg, 1))).toEqual([1])
  })

  it('empty for a brand-new user before the first anniversary', () => {
    expect(duePeriods(reg, 0, new Date('2026-01-20T00:00:00.000Z'))).toEqual([])
  })
})
