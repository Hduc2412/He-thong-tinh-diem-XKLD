// Redemption pre-flight (PRD §6.5, tech-spec §6.2). Produces a friendly, specific error BEFORE
// the SQL guard runs. The SQL batch (§6.2) is the authority on balance sufficiency; this mirrors
// its checks for a good message but is never the sole gatekeeper.

export type RedemptionError = 'LOCKED' | 'INSUFFICIENT_F' | 'INSUFFICIENT_G' | 'INVALID_AMOUNT'

export function validateRedemption(input: {
  hasCustomerReward: boolean // unlock condition: user ever had an APPROVED order
  balances: { f: number; g: number }
  amounts: { f?: number; g?: number } // positive integers; at least one present
}): { ok: true } | { ok: false; error: RedemptionError } {
  const { hasCustomerReward, balances, amounts } = input
  const { f, g } = amounts

  // Shape first (mirrors the ArkType schema layer): at least one wallet, positive integers only.
  if (f === undefined && g === undefined) return { ok: false, error: 'INVALID_AMOUNT' }
  for (const amount of [f, g]) {
    if (amount !== undefined && (!Number.isInteger(amount) || amount <= 0)) {
      return { ok: false, error: 'INVALID_AMOUNT' }
    }
  }

  // Unlock, then per-wallet sufficiency (F before G for a deterministic message).
  if (!hasCustomerReward) return { ok: false, error: 'LOCKED' }
  if (f !== undefined && f > balances.f) return { ok: false, error: 'INSUFFICIENT_F' }
  if (g !== undefined && g > balances.g) return { ok: false, error: 'INSUFFICIENT_G' }

  return { ok: true }
}
