/**
 * Credit card ledger uses a signed balance on the account:
 *   balance ≥ 0 → used limit (amount charged against the line)
 *   balance < 0 → credit on card (overpayment)
 *
 * Issuer-style formulas (see Capital One / standard available credit):
 *   used limit = max(0, balance)
 *   available credit = limit − used limit (full limit when credit on card)
 */

/** Amount of the credit line currently used (≥ 0). */
export function creditCardUsedLimit(balance: number): number {
  return Math.max(0, balance);
}

/** @deprecated Alias */
export function creditCardAmountOwed(balance: number): number {
  return creditCardUsedLimit(balance);
}

/** Overpayment sitting on the card (≥ 0). */
export function creditCardCreditBalance(balance: number): number {
  return Math.max(0, -balance);
}

/** Available headroom: limit − used limit. */
export function creditCardAvailableFrom(limit: number, balance: number): number {
  if (limit <= 0) return 0;
  if (balance < 0) return limit;
  return limit - creditCardUsedLimit(balance);
}

export function creditCardOverLimit(limit: number, balance: number): number {
  const used = creditCardUsedLimit(balance);
  if (limit <= 0 || used <= limit) return 0;
  return used - limit;
}

/** Convert UI fields to ledger signed balance. */
export function signedBalanceFromCardInputs(
  usedLimit: number,
  creditOnCard: number
): number {
  if (creditOnCard > 0) return -Math.abs(creditOnCard);
  return Math.max(0, usedLimit);
}

/** Split ledger balance into used limit and credit for forms. */
export function cardInputsFromSignedBalance(balance: number): {
  usedLimit: number;
  creditOnCard: number;
} {
  return {
    usedLimit: creditCardUsedLimit(balance),
    creditOnCard: creditCardCreditBalance(balance),
  };
}

export type CreditCardDisplay = {
  limit: number | null;
  usedLimit: number;
  available: number | null;
  creditOnCard: number;
  overLimit: number;
  utilizationPct: number | null;
  signedBalance: number;
};

export function creditCardDisplayFromAccount(
  limit: number | null,
  signedBalance: number
): CreditCardDisplay {
  const usedLimit = creditCardUsedLimit(signedBalance);
  const creditOnCard = creditCardCreditBalance(signedBalance);
  const available =
    limit != null && limit > 0
      ? creditCardAvailableFrom(limit, signedBalance)
      : null;
  const overLimit =
    limit != null && limit > 0 ? creditCardOverLimit(limit, signedBalance) : 0;
  const utilizationPct =
    limit != null && limit > 0 && usedLimit > 0
      ? Math.min(100, Math.round((usedLimit / limit) * 100))
      : null;

  return {
    limit,
    usedLimit,
    available,
    creditOnCard,
    overLimit,
    utilizationPct,
    signedBalance,
  };
}

export function creditCardDisplay(account: {
  account_type: string;
  credit_limit: string | null;
  current_balance: string;
}): CreditCardDisplay | null {
  if (account.account_type !== "credit_card") return null;
  const limitRaw = account.credit_limit
    ? parseFloat(account.credit_limit)
    : null;
  const limit =
    limitRaw != null && limitRaw > 0 && Number.isFinite(limitRaw)
      ? limitRaw
      : null;
  const signedBalance = parseFloat(account.current_balance) || 0;
  return creditCardDisplayFromAccount(limit, signedBalance);
}
