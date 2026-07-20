import { describe, it, expect } from 'vitest'
import { planOrderApprovalBonuses } from './orderApproval'

describe('planOrderApprovalBonuses', () => {
  it('with a referrer → +50 creator, +10 referrer (both F, carry orderId)', () => {
    const drafts = planOrderApprovalBonuses({ orderId: 'o1', orderUserId: 'u1', referrerId: 'r1' })
    expect(drafts).toEqual([
      { userId: 'u1', wallet: 'F', type: 'CUSTOMER_REWARD', points: 50, orderId: 'o1' },
      { userId: 'r1', wallet: 'F', type: 'CUSTOMER_REFERRAL_BONUS', points: 10, orderId: 'o1' },
    ])
  })

  it('without a referrer → only the +50 reward', () => {
    const drafts = planOrderApprovalBonuses({ orderId: 'o1', orderUserId: 'u1', referrerId: null })
    expect(drafts).toEqual([
      { userId: 'u1', wallet: 'F', type: 'CUSTOMER_REWARD', points: 50, orderId: 'o1' },
    ])
  })
})
