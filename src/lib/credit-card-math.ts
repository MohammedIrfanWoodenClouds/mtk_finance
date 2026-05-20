/**
 * Credit card ledger uses a signed balance on the account:
 *   balance ≥ 0 → balance owed (used limit)
 *   balance < 0 → credit on card (overpayment)
 *
 * Issuer-style formulas:
 *   used limit = max(0, balance)
 *   within limit = min(used limit, limit)
 *   over limit = max(0, used limit − limit)
 *   available credit = limit − used limit (negative when over limit)
 */

export function creditCardUsedLimit(balance: number): number {
  return Math.max(0, balance);
}

export function creditCardCreditBalance(balance: number): number {
  return Math.max(0, -balance);
}

export function creditCardWithinLimitUsed(limit: number, balance: number): number {
  const used = creditCardUsedLimit(balance);
  if (limit <= 0) return used;
  return Math.min(used, limit);
}

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

export function creditCardIsOverLimit(limit: number | null, balance: number): boolean {
  if (limit == null || limit <= 0) return false;
  return creditCardUsedLimit(balance) > limit;
}

export function creditCardUtilizationPct(limit: number, balance: number): number | null {
  if (limit <= 0) return null;
  const used = creditCardUsedLimit(balance);
  if (used <= 0) return 0;
  return Math.round((used / limit) * 100);
}

export function signedBalanceFromCardInputs(
  usedLimit: number,
  creditOnCard: number
): number {
  if (creditOnCard > 0) return -Math.abs(creditOnCard);
  return Math.max(0, usedLimit);
}

export function signedBalanceFromLimitAndOver(
  limit: number,
  overLimit: number,
  creditOnCard: number
): number {
  const used = limit > 0 ? limit + Math.max(0, overLimit) : Math.max(0, overLimit);
  return signedBalanceFromCardInputs(used, creditOnCard);
}

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
  withinLimitUsed: number;
  available: number | null;
  creditOnCard: number;
  overLimit: number;
  isOverLimit: boolean;
  utilizationPct: number | null;
  signedBalance: number;
};

export function creditCardDisplayFromAccount(
  limit: number | null,
  signedBalance: number
): CreditCardDisplay {
  const usedLimit = creditCardUsedLimit(signedBalance);
  const creditOnCard = creditCardCreditBalance(signedBalance);
  const lim = limit != null && limit > 0 ? limit : null;
  const available =
    lim != null ? creditCardAvailableFrom(lim, signedBalance) : null;
  const overLimit = lim != null ? creditCardOverLimit(lim, signedBalance) : 0;
  const withinLimitUsed =
    lim != null ? creditCardWithinLimitUsed(lim, signedBalance) : usedLimit;
  const utilizationPct =
    lim != null ? creditCardUtilizationPct(lim, signedBalance) : null;

  return {
    limit: lim,
    usedLimit,
    withinLimitUsed,
    available,
    creditOnCard,
    overLimit,
    isOverLimit: lim != null && overLimit > 0,
    utilizationPct,
    signedBalance,
  };
}

export type CreditCardMetricsFields = {
  used_limit: string;
  within_limit_used: string;
  credit_on_card: string;
  available: string | null;
  over_limit: string;
  is_over_limit: boolean;
  utilization_pct: number | null;
  signed_balance: string;
};

function parseApiMoney(value: string | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function resolveCreditCardDisplay(account: {
  account_type: string;
  credit_limit: string | null;
  current_balance: string;
  credit_card?: CreditCardMetricsFields | null;
}): CreditCardDisplay | null {
  if (account.account_type !== "credit_card") return null;

  if (account.credit_card) {
    const m = account.credit_card;
    const limitRaw = account.credit_limit
      ? parseFloat(account.credit_limit)
      : null;
    const limit =
      limitRaw != null && limitRaw > 0 && Number.isFinite(limitRaw)
        ? limitRaw
        : null;
    return {
      limit,
      usedLimit: parseApiMoney(m.used_limit),
      withinLimitUsed: parseApiMoney(m.within_limit_used),
      available:
        m.available != null ? parseApiMoney(m.available) : null,
      creditOnCard: parseApiMoney(m.credit_on_card),
      overLimit: parseApiMoney(m.over_limit),
      isOverLimit: m.is_over_limit,
      utilizationPct: m.utilization_pct,
      signedBalance: parseApiMoney(m.signed_balance),
    };
  }

  return creditCardDisplay(account);
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

/** Bar width for utilization UI (caps at 100% visually when over limit). */
export function utilizationBarWidthPct(utilizationPct: number | null): number {
  if (utilizationPct == null) return 0;
  return Math.min(100, utilizationPct);
}
