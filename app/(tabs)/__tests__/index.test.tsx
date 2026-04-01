import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import "@/test-utils/mocks";
import { useReceiptStore } from "@/stores/receiptStore";
import { useWarrantyStore } from "@/stores/warrantyStore";
import HomeScreen from "../index";
import type { Receipt, Warranty } from "@/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

const FROZEN_DATE = new Date("2026-03-31T12:00:00.000Z");

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FROZEN_DATE);
});

afterAll(() => {
  jest.useRealTimers();
});

function makeReceipt(overrides: Partial<Receipt> & { id: string }): Receipt {
  return {
    merchant: "Test Merchant",
    date: "2026-03-15",
    amount: 100,
    category: "food",
    isWarranty: false,
    ...overrides,
  };
}

function makeWarranty(overrides: Partial<Warranty> & { id: string }): Warranty {
  return {
    receiptId: "r1",
    productName: "Test Product",
    manufacturer: "Test Co",
    purchaseDate: "2026-01-01",
    expirationDate: "2027-01-01",
    coverageType: "Standard",
    ...overrides,
  };
}

function seedStores(receipts: Receipt[], warranties: Warranty[]) {
  useReceiptStore.setState({ receipts });
  useWarrantyStore.setState({ warranties });
}

afterEach(() => {
  useReceiptStore.setState({ receipts: [] });
  useWarrantyStore.setState({ warranties: [] });
  jest.clearAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

test("dashboard renders the hero spending section", () => {
  seedStores(
    [makeReceipt({ id: "r1", date: "2026-03-15", amount: 250 })],
    []
  );

  render(<HomeScreen />);

  expect(screen.getByText("Total spending this month")).toBeTruthy();
  // Amount may appear in both hero and recent scans; getAllByText checks it exists at least once
  expect(screen.getAllByText("$250.00").length).toBeGreaterThan(0);
});

test("dashboard renders category cards when receipts exist", () => {
  seedStores(
    [
      makeReceipt({ id: "r1", category: "food", amount: 100 }),
      makeReceipt({ id: "r2", category: "travel", amount: 200 }),
    ],
    []
  );

  render(<HomeScreen />);

  expect(screen.getByText("Food")).toBeTruthy();
  expect(screen.getByText("Travel")).toBeTruthy();
});

test("warranty alert is hidden when no warranties are expiring within 30 days", () => {
  seedStores(
    [],
    [makeWarranty({ id: "w1", expirationDate: "2027-06-01" })]
  );

  render(<HomeScreen />);

  expect(screen.queryByText("Expiring Soon")).toBeNull();
});

test("warranty alert renders when a warranty expires within 30 days", () => {
  seedStores(
    [],
    [makeWarranty({ id: "w1", productName: "MacBook AppleCare", expirationDate: "2026-04-10" })]
  );

  render(<HomeScreen />);

  expect(screen.getByText("Expiring Soon")).toBeTruthy();
  expect(screen.getByText(/MacBook AppleCare/)).toBeTruthy();
});

test("recent scans section renders when receipts exist", () => {
  seedStores(
    [makeReceipt({ id: "r1", merchant: "Whole Foods Market", date: "2026-03-28", amount: 84.32 })],
    []
  );

  render(<HomeScreen />);

  expect(screen.getByText("Recent Scans")).toBeTruthy();
  expect(screen.getByText("Whole Foods Market")).toBeTruthy();
});

test("FAB renders with correct accessibility label", () => {
  seedStores([], []);

  render(<HomeScreen />);

  expect(screen.getByRole("button", { name: "Scan receipt" })).toBeTruthy();
});

test("tapping FAB navigates to scanner", () => {
  const { router } = require("expo-router");
  seedStores([], []);

  render(<HomeScreen />);

  fireEvent.press(screen.getByRole("button", { name: "Scan receipt" }));

  expect(router.push).toHaveBeenCalledWith("/scanner");
});

test("tapping 'View All' navigates to scans tab", () => {
  const { router } = require("expo-router");
  seedStores(
    [makeReceipt({ id: "r1", merchant: "Test", date: "2026-03-15", amount: 10 })],
    []
  );

  render(<HomeScreen />);

  fireEvent.press(screen.getByText("View All"));

  expect(router.push).toHaveBeenCalledWith("/(tabs)/scans");
});

test("tapping 'Renew' on warranty alert navigates to warranty tab", () => {
  const { router } = require("expo-router");
  seedStores(
    [],
    [makeWarranty({ id: "w1", productName: "Test Product", expirationDate: "2026-04-10" })]
  );

  render(<HomeScreen />);

  fireEvent.press(screen.getByText("Renew"));

  expect(router.push).toHaveBeenCalledWith("/(tabs)/warranty");
});
