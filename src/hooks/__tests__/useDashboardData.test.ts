import { renderHook } from "@testing-library/react-native";
import { useReceiptStore } from "@/stores/receiptStore";
import { useWarrantyStore } from "@/stores/warrantyStore";
import { useDashboardData } from "@/hooks/useDashboardData";
import type { Receipt, Warranty } from "@/types";

// Freeze time so date-dependent tests are deterministic.
// Tests run as if today is 2026-03-31 (within the mock data month).
const FROZEN_DATE = new Date("2026-03-31T12:00:00.000Z");

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FROZEN_DATE);
});

afterAll(() => {
  jest.useRealTimers();
});

// Helper to seed stores with controlled data and reset after each test.
function seedReceipts(receipts: Receipt[]) {
  useReceiptStore.setState({ receipts });
}

function seedWarranties(warranties: Warranty[]) {
  useWarrantyStore.setState({ warranties });
}

afterEach(() => {
  useReceiptStore.setState({ receipts: [] });
  useWarrantyStore.setState({ warranties: [] });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeReceipt = (overrides: Partial<Receipt> & { id: string }): Receipt => ({
  merchant: "Test Merchant",
  date: "2026-03-15",
  amount: 100,
  category: "food",
  isWarranty: false,
  ...overrides,
});

const makeWarranty = (overrides: Partial<Warranty> & { id: string }): Warranty => ({
  receiptId: "r1",
  productName: "Test Product",
  manufacturer: "Test Co",
  purchaseDate: "2026-01-01",
  expirationDate: "2027-01-01",
  coverageType: "Standard",
  ...overrides,
});

// ─── totalMonthlySpend ───────────────────────────────────────────────────────

test("totalMonthlySpend sums only receipts from the current month", () => {
  seedReceipts([
    makeReceipt({ id: "r1", date: "2026-03-10", amount: 50 }),
    makeReceipt({ id: "r2", date: "2026-03-20", amount: 75 }),
    makeReceipt({ id: "r3", date: "2026-02-28", amount: 999 }), // prior month — excluded
  ]);
  seedWarranties([]);

  const { result } = renderHook(() => useDashboardData());
  expect(result.current.totalMonthlySpend).toBe(125);
});

test("totalMonthlySpend is 0 when there are no receipts this month", () => {
  seedReceipts([
    makeReceipt({ id: "r1", date: "2025-12-31", amount: 200 }),
  ]);
  seedWarranties([]);

  const { result } = renderHook(() => useDashboardData());
  expect(result.current.totalMonthlySpend).toBe(0);
});

// ─── spendChangePercent ──────────────────────────────────────────────────────

test("spendChangePercent is 0 when there are no prior-month receipts", () => {
  seedReceipts([
    makeReceipt({ id: "r1", date: "2026-03-10", amount: 100 }),
  ]);
  seedWarranties([]);

  const { result } = renderHook(() => useDashboardData());
  expect(result.current.spendChangePercent).toBe(0);
});

test("spendChangePercent computes correct percentage increase", () => {
  seedReceipts([
    makeReceipt({ id: "r1", date: "2026-03-10", amount: 150 }), // this month
    makeReceipt({ id: "r2", date: "2026-02-15", amount: 100 }), // last month
  ]);
  seedWarranties([]);

  const { result } = renderHook(() => useDashboardData());
  // (150 - 100) / 100 * 100 = 50%
  expect(result.current.spendChangePercent).toBe(50);
});

test("spendChangePercent computes correct percentage decrease", () => {
  seedReceipts([
    makeReceipt({ id: "r1", date: "2026-03-10", amount: 80 }), // this month
    makeReceipt({ id: "r2", date: "2026-02-15", amount: 100 }), // last month
  ]);
  seedWarranties([]);

  const { result } = renderHook(() => useDashboardData());
  // (80 - 100) / 100 * 100 = -20%
  expect(result.current.spendChangePercent).toBe(-20);
});

// ─── budgetUtilization ───────────────────────────────────────────────────────

test("budgetUtilization reflects fraction of $2000 monthly budget", () => {
  seedReceipts([
    makeReceipt({ id: "r1", date: "2026-03-10", amount: 1000 }),
  ]);
  seedWarranties([]);

  const { result } = renderHook(() => useDashboardData());
  expect(result.current.budgetUtilization).toBe(0.5);
});

test("budgetUtilization is clamped to 1 when spend exceeds budget", () => {
  seedReceipts([
    makeReceipt({ id: "r1", date: "2026-03-10", amount: 5000 }),
  ]);
  seedWarranties([]);

  const { result } = renderHook(() => useDashboardData());
  expect(result.current.budgetUtilization).toBe(1);
});

// ─── categoryBreakdown ───────────────────────────────────────────────────────

test("categoryBreakdown returns at most 4 categories", () => {
  seedReceipts([
    makeReceipt({ id: "r1", date: "2026-03-01", amount: 100, category: "food" }),
    makeReceipt({ id: "r2", date: "2026-03-01", amount: 200, category: "travel" }),
    makeReceipt({ id: "r3", date: "2026-03-01", amount: 300, category: "utility" }),
    makeReceipt({ id: "r4", date: "2026-03-01", amount: 400, category: "warranty" }),
    makeReceipt({ id: "r5", date: "2026-03-01", amount: 500, category: "shopping" }),
  ]);
  seedWarranties([]);

  const { result } = renderHook(() => useDashboardData());
  expect(result.current.categoryBreakdown).toHaveLength(4);
});

test("categoryBreakdown marks the highest-spend category as highlighted", () => {
  seedReceipts([
    makeReceipt({ id: "r1", date: "2026-03-01", amount: 100, category: "food" }),
    makeReceipt({ id: "r2", date: "2026-03-01", amount: 500, category: "travel" }),
    makeReceipt({ id: "r3", date: "2026-03-01", amount: 200, category: "utility" }),
  ]);
  seedWarranties([]);

  const { result } = renderHook(() => useDashboardData());
  const highlighted = result.current.categoryBreakdown.find((c) => c.highlighted);
  expect(highlighted?.category).toBe("Travel");
});

test("categoryBreakdown only marks one category as highlighted", () => {
  seedReceipts([
    makeReceipt({ id: "r1", date: "2026-03-01", amount: 100, category: "food" }),
    makeReceipt({ id: "r2", date: "2026-03-01", amount: 200, category: "travel" }),
  ]);
  seedWarranties([]);

  const { result } = renderHook(() => useDashboardData());
  const highlightedCount = result.current.categoryBreakdown.filter((c) => c.highlighted).length;
  expect(highlightedCount).toBe(1);
});

// ─── expiringWarranty ────────────────────────────────────────────────────────

test("expiringWarranty is null when no warranties expire within 30 days", () => {
  seedReceipts([]);
  seedWarranties([
    makeWarranty({ id: "w1", expirationDate: "2027-06-01" }),
  ]);

  const { result } = renderHook(() => useDashboardData());
  expect(result.current.expiringWarranty).toBeNull();
});

test("expiringWarranty returns the warranty expiring soonest within 30 days", () => {
  seedReceipts([]);
  // 2026-04-10 is 10 days after FROZEN_DATE (2026-03-31) — within 30 days
  // 2026-04-25 is 25 days after — also within 30 days; April 10 should win
  seedWarranties([
    makeWarranty({ id: "w1", productName: "Far Product", expirationDate: "2027-06-01" }),
    makeWarranty({ id: "w2", productName: "Near Product", expirationDate: "2026-04-10" }),
    makeWarranty({ id: "w3", productName: "Mid Product", expirationDate: "2026-04-25" }),
  ]);

  const { result } = renderHook(() => useDashboardData());
  expect(result.current.expiringWarranty?.productName).toBe("Near Product");
});

test("expiringWarranty excludes already-expired warranties", () => {
  seedReceipts([]);
  seedWarranties([
    makeWarranty({ id: "w1", expirationDate: "2026-03-01" }), // already expired
  ]);

  const { result } = renderHook(() => useDashboardData());
  expect(result.current.expiringWarranty).toBeNull();
});

// ─── recentScans ────────────────────────────────────────────────────────────

test("recentScans returns at most 3 receipts", () => {
  seedReceipts([
    makeReceipt({ id: "r1", date: "2026-03-28" }),
    makeReceipt({ id: "r2", date: "2026-03-27" }),
    makeReceipt({ id: "r3", date: "2026-03-26" }),
    makeReceipt({ id: "r4", date: "2026-03-25" }),
  ]);
  seedWarranties([]);

  const { result } = renderHook(() => useDashboardData());
  expect(result.current.recentScans).toHaveLength(3);
});

test("recentScans returns the first 3 items from the store", () => {
  const receipts = [
    makeReceipt({ id: "r1", merchant: "First", date: "2026-03-28" }),
    makeReceipt({ id: "r2", merchant: "Second", date: "2026-03-27" }),
    makeReceipt({ id: "r3", merchant: "Third", date: "2026-03-26" }),
    makeReceipt({ id: "r4", merchant: "Fourth", date: "2026-03-25" }),
  ];
  seedReceipts(receipts);
  seedWarranties([]);

  const { result } = renderHook(() => useDashboardData());
  expect(result.current.recentScans.map((r) => r.merchant)).toEqual([
    "First",
    "Second",
    "Third",
  ]);
});
