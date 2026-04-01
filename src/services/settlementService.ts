import { generateUUID } from "../utils/uuid";
import type { TripParticipant, SettlementTransaction } from "../types";

export function optimizeSettlements(
  participants: TripParticipant[],
  tripId: string
): SettlementTransaction[] {
  const balances = participants.map((p) => ({
    id: p.id,
    balance: p.amountPaid - p.amountOwed,
  }));

  const transactions: SettlementTransaction[] = [];
  const creditors = balances
    .filter((b) => b.balance > 0.01)
    .sort((a, b) => b.balance - a.balance);
  const debtors = balances
    .filter((b) => b.balance < -0.01)
    .sort((a, b) => a.balance - b.balance);

  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci];
    const debt = debtors[di];
    const amount = Math.min(credit.balance, -debt.balance);

    transactions.push({
      id: generateUUID(),
      tripId,
      fromParticipantId: debt.id,
      toParticipantId: credit.id,
      amount: Math.round(amount * 100) / 100,
      status: "pending",
    });

    credit.balance -= amount;
    debt.balance += amount;
    if (Math.abs(credit.balance) < 0.01) ci++;
    if (Math.abs(debt.balance) < 0.01) di++;
  }

  return transactions;
}
