import { describe, it, expect } from 'vitest'
import { validateRedemption } from './redemption'

describe('validateRedemption', () => {
  const balances = { f: 100, g: 50 }

  it('locked when the user never had a CUSTOMER_REWARD', () => {
    expect(validateRedemption({ hasCustomerReward: false, balances, amounts: { f: 10 } }))
      .toEqual({ ok: false, error: 'LOCKED' })
  })

  it('ok on an exact-balance withdrawal of both wallets', () => {
    expect(validateRedemption({ hasCustomerReward: true, balances, amounts: { f: 100, g: 50 } }))
      .toEqual({ ok: true })
  })

  it('ok on a single-wallet withdrawal', () => {
    expect(validateRedemption({ hasCustomerReward: true, balances, amounts: { f: 40 } }))
      .toEqual({ ok: true })
  })

  it('insufficient F (off by one)', () => {
    expect(validateRedemption({ hasCustomerReward: true, balances, amounts: { f: 101 } }))
      .toEqual({ ok: false, error: 'INSUFFICIENT_F' })
  })

  it('insufficient G (off by one)', () => {
    expect(validateRedemption({ hasCustomerReward: true, balances, amounts: { g: 51 } }))
      .toEqual({ ok: false, error: 'INSUFFICIENT_G' })
  })

  it('both wallets requested, G short → INSUFFICIENT_G', () => {
    expect(validateRedemption({ hasCustomerReward: true, balances, amounts: { f: 10, g: 51 } }))
      .toEqual({ ok: false, error: 'INSUFFICIENT_G' })
  })

  it('neither wallet present → INVALID_AMOUNT', () => {
    expect(validateRedemption({ hasCustomerReward: true, balances, amounts: {} }))
      .toEqual({ ok: false, error: 'INVALID_AMOUNT' })
  })

  it('zero / negative / non-integer → INVALID_AMOUNT, evaluated before the lock check', () => {
    expect(validateRedemption({ hasCustomerReward: false, balances, amounts: { f: 0 } }))
      .toEqual({ ok: false, error: 'INVALID_AMOUNT' })
    expect(validateRedemption({ hasCustomerReward: true, balances, amounts: { g: -5 } }))
      .toEqual({ ok: false, error: 'INVALID_AMOUNT' })
    expect(validateRedemption({ hasCustomerReward: true, balances, amounts: { f: 1.5 } }))
      .toEqual({ ok: false, error: 'INVALID_AMOUNT' })
  })
})
