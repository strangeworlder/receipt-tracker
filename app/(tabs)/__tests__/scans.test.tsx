import React from "react";
import { act, render, screen, fireEvent } from "@testing-library/react-native";
import "@/test-utils/mocks";
import { useReceiptStore } from "@/stores/receiptStore";
import ScansScreen from "../scans";
import type { Receipt } from "@/types";

function makeReceipt(overrides: Partial<Receipt> & { id: string }): Receipt {
  return {
    merchant: "Generic Store",
    date: "2026-03-01",
    amount: 50,
    category: "food",
    isWarranty: false,
    ...overrides,
  };
}

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

afterEach(() => {
  useReceiptStore.setState({ receipts: [] });
  jest.clearAllMocks();
});

test("search input filters receipts by merchant name", () => {
  useReceiptStore.setState({
    receipts: [
      makeReceipt({ id: "r1", merchant: "Whole Foods" }),
      makeReceipt({ id: "r2", merchant: "Target" }),
      makeReceipt({ id: "r3", merchant: "Whole Earth" }),
    ],
  });

  render(<ScansScreen />);

  const searchInput = screen.getByPlaceholderText("Search receipts…");
  fireEvent.changeText(searchInput, "Whole");
  act(() => jest.runAllTimers());

  // Should show both "Whole" matches
  expect(screen.getByText("Whole Foods")).toBeTruthy();
  expect(screen.getByText("Whole Earth")).toBeTruthy();
  // Should hide non-matching
  expect(screen.queryByText("Target")).toBeNull();
});

test("search is case-insensitive", () => {
  useReceiptStore.setState({
    receipts: [
      makeReceipt({ id: "r1", merchant: "Starbucks" }),
    ],
  });

  render(<ScansScreen />);

  fireEvent.changeText(screen.getByPlaceholderText("Search receipts…"), "starbucks");
  act(() => jest.runAllTimers());

  expect(screen.getByText("Starbucks")).toBeTruthy();
});

test("search and category filter combine correctly", () => {
  useReceiptStore.setState({
    receipts: [
      makeReceipt({ id: "r1", merchant: "Pizza Hut", category: "food" }),
      makeReceipt({ id: "r2", merchant: "Pizza Express", category: "other" }),
    ],
  });

  render(<ScansScreen />);

  // Filter by "food" category first
  fireEvent.press(screen.getByText("Food"));

  // Then search for "pizza"
  fireEvent.changeText(screen.getByPlaceholderText("Search receipts…"), "pizza");
  act(() => jest.runAllTimers());

  // Only food+pizza match
  expect(screen.getByText("Pizza Hut")).toBeTruthy();
  expect(screen.queryByText("Pizza Express")).toBeNull();
});
