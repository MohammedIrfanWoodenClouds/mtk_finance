/**
 * Signed card balance: + owed, − credit/overpayment.
 * Available = limit when balance < 0; else limit − balance (may be negative if over limit).
 */

export function creditCardAmountOwed(balance: number): number {
  return Math.max(0, balance);
}

export function creditCardCreditBalance(balance: number): number {
  return Math.max(0, -balance);
}

export function creditCardAvailableFrom(limit: number, balance: number): number {
  if (limit <= 0) return 0;
  if (balance < 0) return limit;
  return limit - balance;
}

export function creditCardOverLimit(limit: number, balance: number): number {
  if (limit <= 0 || balance <= limit) return 0;
  return balance - limit;
}

export type CreditCardDisplay = {
  available: number;
  owed: number;
  credit: number;
  overLimit: number;
  isOverLimit: boolean;
  hasCredit: boolean;
};

export function creditCardDisplay(limit: number, balance: number): CreditCardDisplay {
  const owed = creditCardAmountOwed(balance);
  const credit = creditCardCreditBalance(balance);
  const available = creditCardAvailableFrom(limit, balance);
  const overLimit = creditCardOverLimit(limit, balance);
  return {
    available,
    owed,
    credit,
    overLimit,
    isOverLimit: overLimit > 0,
    hasCredit: credit > 0,
  };
}
