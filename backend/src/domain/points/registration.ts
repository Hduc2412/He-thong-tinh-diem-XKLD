// Registration-bonus planner (PRD §6.1, tech-spec §6.3). Emits the F-wallet drafts credited
// atomically with user creation.
import { POINTS } from './constants'
import type { LedgerDraft } from './types'

export function planRegistrationBonuses(input: {
  userId: string
  referrerId: string | null
}): LedgerDraft[] {
  const drafts: LedgerDraft[] = [
    {
      userId: input.userId,
      wallet: 'F',
      type: 'REGISTRATION_BONUS',
      points: POINTS.REGISTRATION,
      subjectUserId: input.userId,
    },
  ]

  // Root users (no referrer) get only the self bonus.
  if (input.referrerId) {
    drafts.push({
      userId: input.referrerId,
      wallet: 'F',
      type: 'REFERRAL_SIGNUP_BONUS',
      points: POINTS.REFERRAL_SIGNUP,
      subjectUserId: input.userId,
    })
  }

  return drafts
}
