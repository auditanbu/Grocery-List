/**
 * Dividing money between people, and working out who is left owing whom.
 *
 * Kept free of the database — the same shape as prisma/price-audit.ts — so the
 * arithmetic can be reasoned about on made-up rows rather than only through a
 * running app. Everything here works in **paise as integers**: a third of ₹100
 * is not representable in floating point, and a ledger that loses a paisa per
 * split stops adding up by the end of the month.
 */

/** Rupees in, paise out — the only place money crosses into integer maths. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function toRupees(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * Splits an amount evenly, giving the remainder to whoever paid.
 *
 * ₹100 three ways is 33.34 / 33.33 / 33.33, not three times 33.33 with a
 * paisa unaccounted for. The payer absorbs it because they are the one who
 * handed over the odd amount in the first place; falling back to the first
 * person keeps the total right even when nobody is named as payer.
 */
export function allocateEqually(
  amountPaise: number,
  personIds: number[],
  payerId: number | null,
): Map<number, number> {
  const out = new Map<number, number>();
  if (personIds.length === 0) return out;

  const base = Math.floor(amountPaise / personIds.length);
  let remainder = amountPaise - base * personIds.length;
  const absorber = payerId !== null && personIds.includes(payerId) ? payerId : personIds[0];

  for (const id of personIds) out.set(id, base);
  out.set(absorber, (out.get(absorber) ?? 0) + remainder);
  remainder = 0;
  return out;
}

/**
 * Splits an amount by weight — two shares to one — with the remainder going
 * the same way as an equal split. Percentages are this with the weights
 * adding up to 100, which is why there is no separate method for them.
 */
export function allocateByShares(
  amountPaise: number,
  units: Map<number, number>,
  payerId: number | null,
): Map<number, number> {
  const entries = [...units.entries()].filter(([, weight]) => weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const out = new Map<number, number>();
  if (entries.length === 0 || total <= 0) return out;

  let assigned = 0;
  for (const [id, weight] of entries) {
    const part = Math.floor((amountPaise * weight) / total);
    out.set(id, part);
    assigned += part;
  }

  const ids = entries.map(([id]) => id);
  const absorber = payerId !== null && ids.includes(payerId) ? payerId : ids[0];
  out.set(absorber, (out.get(absorber) ?? 0) + (amountPaise - assigned));
  return out;
}

export type BalanceInput = {
  /** Only split expenses matter: unsplit, the payer owes themselves. */
  expenses: {
    paidById: number | null;
    shares: { personId: number; amountPaise: number }[];
  }[];
  settlements: { fromPersonId: number; toPersonId: number; amountPaise: number }[];
};

/**
 * What each person is owed (positive) or owes (negative), in paise.
 *
 * Paid minus owed, then settlements: handing money over cancels debt, it is
 * not a new expense, which is why a settlement never reaches a category or a
 * budget. An expense with no shares nets to zero for its payer, so a household
 * that never splits has no balances at all.
 */
export function netBalances(input: BalanceInput): Map<number, number> {
  const net = new Map<number, number>();
  const add = (id: number, paise: number) => net.set(id, (net.get(id) ?? 0) + paise);

  for (const expense of input.expenses) {
    if (expense.shares.length === 0) continue;
    const total = expense.shares.reduce((sum, share) => sum + share.amountPaise, 0);
    if (expense.paidById !== null) add(expense.paidById, total);
    for (const share of expense.shares) add(share.personId, -share.amountPaise);
  }

  for (const settlement of input.settlements) {
    add(settlement.fromPersonId, settlement.amountPaise);
    add(settlement.toPersonId, -settlement.amountPaise);
  }

  return net;
}

export type Transfer = { fromPersonId: number; toPersonId: number; amountPaise: number };

/**
 * The fewest payments that clear the board — Splitwise's "simplify debts".
 *
 * Repeatedly sends the largest debtor's money to the largest creditor, which
 * settles at least one of the two every time and so finishes in at most
 * (people − 1) transfers. Nobody needs to know who the money was originally
 * owed to: the balances are what is true, and three people paying each other
 * in a circle is work for no reason.
 */
export function simplify(net: Map<number, number>): Transfer[] {
  const creditors = [...net.entries()].filter(([, paise]) => paise > 0).map(([id, paise]) => ({ id, paise }));
  const debtors = [...net.entries()].filter(([, paise]) => paise < 0).map(([id, paise]) => ({ id, paise: -paise }));
  creditors.sort((a, b) => b.paise - a.paise);
  debtors.sort((a, b) => b.paise - a.paise);

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].paise, debtors[di].paise);
    if (amount > 0) {
      transfers.push({
        fromPersonId: debtors[di].id,
        toPersonId: creditors[ci].id,
        amountPaise: amount,
      });
    }
    creditors[ci].paise -= amount;
    debtors[di].paise -= amount;
    if (creditors[ci].paise === 0) ci += 1;
    if (debtors[di].paise === 0) di += 1;
  }
  return transfers;
}
