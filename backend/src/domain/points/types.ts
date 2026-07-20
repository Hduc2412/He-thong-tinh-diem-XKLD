// Shared domain types for the points core. No framework, no I/O — plain data only.

export type Wallet = 'F' | 'G'

export type LedgerType =
  | 'REGISTRATION_BONUS'
  | 'REFERRAL_SIGNUP_BONUS'
  | 'MAINTENANCE_ACCRUAL'
  | 'MAINTENANCE_RESET'
  | 'CUSTOMER_REWARD'
  | 'CUSTOMER_REFERRAL_BONUS'
  | 'REDEMPTION'

export type OrderStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/**
 * What planners emit; `lib/` turns these into SQL statements. Fixed-amount rows only —
 * resets are NOT drafts (their amount depends on the live G balance at commit time; see
 * tech-spec §1.1 rule 2).
 */
export interface LedgerDraft {
  userId: string // wallet owner (beneficiary)
  wallet: Wallet
  type: LedgerType
  points: number // positive, fixed amount
  orderId?: string // CUSTOMER_* rows only
  subjectUserId?: string // registration rows only: the new registrant
}

/** One due maintenance period and whether it must reset G before accruing. */
export interface MaintenancePlanItem {
  periodIndex: number
  resetRequired: boolean
}
