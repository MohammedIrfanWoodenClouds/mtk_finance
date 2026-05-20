import {
  accountTypeLabel,
  isLiabilityAccount,
} from "@/lib/account-types";
import type { Account } from "@/types";

export interface TransferPreview {
  principal: number;
  fee: number;
  totalFrom: number;
  scenario: string;
  warnings: string[];
}

export function describeTransfer(
  from: Account | undefined,
  to: Account | undefined
): TransferPreview {
  const warnings: string[] = [];
  let scenario =
    "Move money between your accounts. The amount is what the destination receives.";

  if (!from || !to) {
    return { principal: 0, fee: 0, totalFrom: 0, scenario, warnings };
  }

  const fromType = from.account_type;
  const toType = to.account_type;
  const fromLiab = isLiabilityAccount(fromType);
  const toLiab = isLiabilityAccount(toType);

  if (!fromLiab && toLiab) {
    if (toType === "credit_card") {
      scenario =
        "Credit card payment: cash leaves your bank and reduces the card balance owed.";
    } else {
      scenario =
        "Loan payment: cash leaves your asset account and reduces what you owe.";
    }
  } else if (fromLiab && !toLiab) {
    scenario =
      "Cash advance or draw on credit: increases what you owe and adds cash to the destination.";
    warnings.push(
      "Borrowing from a credit line increases liability and may incur interest."
    );
  } else if (!fromLiab && !toLiab) {
    scenario =
      "Internal transfer between asset accounts (e.g. bank to bank or bank to cash).";
  } else if (fromLiab && toLiab) {
    scenario =
      "Balance shift between liabilities (e.g. balance transfer between cards).";
  }

  return { principal: 0, fee: 0, totalFrom: 0, scenario, warnings };
}

export function buildTransferPreview(
  from: Account | undefined,
  to: Account | undefined,
  principalStr: string,
  feeStr: string
): TransferPreview {
  const base = describeTransfer(from, to);
  const principal = parseFloat(principalStr) || 0;
  const fee = parseFloat(feeStr) || 0;
  const totalFrom = principal + fee;

  const lines: string[] = [];
  if (from && principal > 0) {
    lines.push(`${from.name}: −${totalFrom.toFixed(2)} from source`);
  }
  if (to && principal > 0) {
    const label = isLiabilityAccount(to.account_type) ? "owed" : "balance";
    lines.push(`${to.name}: −${principal.toFixed(2)} on ${label}`);
  }
  if (fee > 0) {
    lines.push(`Fee: ${fee.toFixed(2)} (expense)`);
  }

  return {
    ...base,
    principal,
    fee,
    totalFrom,
    scenario:
      lines.length > 0
        ? `${base.scenario} Preview: ${lines.join(" · ")}.`
        : base.scenario,
  };
}

export function transferConfirmMessage(
  from: Account,
  to: Account,
  principal: number,
  fee: number
): string {
  const total = principal + fee;
  let msg = `Move ${principal.toFixed(2)} from ${from.name} (${accountTypeLabel(from.account_type)}) to ${to.name} (${accountTypeLabel(to.account_type)})`;
  if (fee > 0) {
    msg += ` with ${fee.toFixed(2)} fee (${total.toFixed(2)} total from source)`;
  }
  msg += "?";
  if (isLiabilityAccount(to.account_type)) {
    msg += " This reduces debt on the destination.";
  } else if (isLiabilityAccount(from.account_type)) {
    msg += " This increases what you owe on the source.";
  }
  return msg;
}
