import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import "@/test-utils/mocks";
import { useWarrantyStore } from "@/stores/warrantyStore";
import WarrantyScreen from "../warranty";

// ─── Additional mocks ─────────────────────────────────────────────────────────

jest.mock("@/services/warrantyService", () => ({
  deleteWarranty: jest.fn().mockResolvedValue(undefined),
  updateWarranty: jest.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FROZEN_DATE = new Date("2026-04-01T12:00:00.000Z");

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FROZEN_DATE);
});

afterAll(() => {
  jest.useRealTimers();
});

function seedWarranties() {
  useWarrantyStore.setState({
    warranties: [
      {
        id: "w1",
        receiptId: "r1",
        productName: "Samsung TV",
        manufacturer: "Samsung",
        purchaseDate: "2026-01-01",
        expirationDate: "2026-04-15", // expiring soon
        coverageType: "Standard 1-year",
      },
    ],
  });
}

afterEach(() => {
  useWarrantyStore.setState({ warranties: [] });
  jest.clearAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

test("tapping more_vert opens action sheet with View Receipt option", () => {
  const alertSpy = jest.spyOn(Alert, "alert");
  seedWarranties();

  render(<WarrantyScreen />);

  // Find more_vert button and press it
  fireEvent.press(screen.getByAccessibilityHint("warranty-options-w1"));

  expect(alertSpy).toHaveBeenCalledWith(
    "Warranty Options",
    expect.any(String),
    expect.arrayContaining([
      expect.objectContaining({ text: "View Receipt" }),
    ])
  );
});

test("tapping more_vert shows Delete Warranty option", () => {
  const alertSpy = jest.spyOn(Alert, "alert");
  seedWarranties();

  render(<WarrantyScreen />);

  fireEvent.press(screen.getByAccessibilityHint("warranty-options-w1"));

  expect(alertSpy).toHaveBeenCalledWith(
    "Warranty Options",
    expect.any(String),
    expect.arrayContaining([
      expect.objectContaining({ text: "Delete Warranty", style: "destructive" }),
    ])
  );
});

test("tapping more_vert shows Edit Warranty option", () => {
  const alertSpy = jest.spyOn(Alert, "alert");
  seedWarranties();

  render(<WarrantyScreen />);

  fireEvent.press(screen.getByAccessibilityHint("warranty-options-w1"));

  expect(alertSpy).toHaveBeenCalledWith(
    "Warranty Options",
    expect.any(String),
    expect.arrayContaining([
      expect.objectContaining({ text: "Edit Warranty" }),
    ])
  );
});
