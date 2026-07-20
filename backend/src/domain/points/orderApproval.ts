// Order-approval bonus planner (PRD §6.3, tech-spec §6.1). Emits the F-wallet drafts credited
// when the Super Admin approves a "customer went abroad" order. Exactly one referral level.
import { POINTS } from './constants'
import type { LedgerDraft } from './types'

export function planOrderApprovalBonuses(input: {
  orderId: string
  orderUserId: string
  referrerId: string | null
}): LedgerDraft[] {
  const drafts: LedgerDraft[] = [
    {
      userId: input.orderUserId,
      wallet: 'F',
      type: 'CUSTOMER_REWARD',
      points: POINTS.CUSTOMER_REWARD,
      orderId: input.orderId,
    },
  ]

  if (input.referrerId) {
    drafts.push({
      userId: input.referrerId,
      wallet: 'F',
      type: 'CUSTOMER_REFERRAL_BONUS',
      points: POINTS.CUSTOMER_REFERRAL,
      orderId: input.orderId,
    })
  }

  return drafts
}
