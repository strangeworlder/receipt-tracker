import { optimizeSettlements } from "../settlementService";
import type { TripParticipant } from "@/types";

function makeParticipant(
  id: string,
  amountPaid: number,
  amountOwed: number
): TripParticipant {
  return { id, name: id, isGhost: false, amountPaid, amountOwed };
}

describe("optimizeSettlements", () => {
  it("returns empty array when all balances are zero", () => {
    const participants = [
      makeParticipant("p1", 100, 100),
      makeParticipant("p2", 100, 100),
    ];
    const result = optimizeSettlements(participants, "t1");
    expect(result).toHaveLength(0);
  });

  it("produces one transaction for a simple two-person split", () => {
    // p1 paid 200, owes 100 → net +100 (creditor)
    // p2 paid 0, owes 100 → net -100 (debtor)
    const participants = [
      makeParticipant("p1", 200, 100),
      makeParticipant("p2", 0, 100),
    ];
    const result = optimizeSettlements(participants, "t1");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      tripId: "t1",
      fromParticipantId: "p2",
      toParticipantId: "p1",
      amount: 100,
      status: "pending",
    });
  });

  it("produces two transactions for a three-person split where one person paid everything", () => {
    // p1 paid 300, owes 100 → net +200
    // p2 paid 0, owes 100 → net -100
    // p3 paid 0, owes 100 → net -100
    const participants = [
      makeParticipant("p1", 300, 100),
      makeParticipant("p2", 0, 100),
      makeParticipant("p3", 0, 100),
    ];
    const result = optimizeSettlements(participants, "t1");
    expect(result).toHaveLength(2);
    const total = result.reduce((sum, t) => sum + t.amount, 0);
    expect(total).toBeCloseTo(200);
    result.forEach((t) => expect(t.toParticipantId).toBe("p1"));
  });

  it("minimizes transactions for complex multi-person scenario", () => {
    // p1: paid 170, owes 170 → net 0
    // p2: paid 0, owes 85 → net -85
    // p3: paid 85, owes 0 → net +85
    // This reduces to one transaction: p2 → p3
    const participants = [
      makeParticipant("p1", 170, 170),
      makeParticipant("p2", 0, 85),
      makeParticipant("p3", 85, 0),
    ];
    const result = optimizeSettlements(participants, "t1");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      fromParticipantId: "p2",
      toParticipantId: "p3",
      amount: 85,
    });
  });

  it("rounds amounts to 2 decimal places", () => {
    // 10 split 3 ways: each owes 3.333...
    // p1 paid 10, owes 3.333 → net +6.667
    // p2 paid 0, owes 3.333 → net -3.333
    // p3 paid 0, owes 3.333 → net -3.333
    const participants = [
      makeParticipant("p1", 10, 10 / 3),
      makeParticipant("p2", 0, 10 / 3),
      makeParticipant("p3", 0, 10 / 3),
    ];
    const result = optimizeSettlements(participants, "t1");
    result.forEach((t) => {
      const str = t.amount.toString();
      const decimals = str.includes(".") ? str.split(".")[1].length : 0;
      expect(decimals).toBeLessThanOrEqual(2);
    });
  });

  it("each transaction has a unique id", () => {
    const participants = [
      makeParticipant("p1", 300, 100),
      makeParticipant("p2", 0, 100),
      makeParticipant("p3", 0, 100),
    ];
    const result = optimizeSettlements(participants, "t1");
    const ids = result.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes tripId on every transaction", () => {
    const participants = [
      makeParticipant("p1", 100, 50),
      makeParticipant("p2", 0, 50),
    ];
    const result = optimizeSettlements(participants, "trip-xyz");
    result.forEach((t) => expect(t.tripId).toBe("trip-xyz"));
  });
});
