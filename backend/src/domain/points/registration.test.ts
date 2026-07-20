import { describe, it, expect } from 'vitest'
import { planRegistrationBonuses } from './registration'

describe('planRegistrationBonuses', () => {
  it('with a referrer → 2 drafts (self +10 F, referrer +2 F), both carry subjectUserId', () => {
    const drafts = planRegistrationBonuses({ userId: 'u1', referrerId: 'r1' })
    expect(drafts).toEqual([
      { userId: 'u1', wallet: 'F', type: 'REGISTRATION_BONUS', points: 10, subjectUserId: 'u1' },
      { userId: 'r1', wallet: 'F', type: 'REFERRAL_SIGNUP_BONUS', points: 2, subjectUserId: 'u1' },
    ])
  })

  it('without a referrer (root user) → 1 draft', () => {
    const drafts = planRegistrationBonuses({ userId: 'u1', referrerId: null })
    expect(drafts).toEqual([
      { userId: 'u1', wallet: 'F', type: 'REGISTRATION_BONUS', points: 10, subjectUserId: 'u1' },
    ])
  })
})
