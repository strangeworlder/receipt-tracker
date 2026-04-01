/**
 * ocrService.test.ts — TDD tests for receipt text parsing.
 *
 * These test parseReceiptText (a pure function) without ML Kit mocking.
 * processReceiptImage is thin glue over ML Kit and is tested manually on device.
 */

jest.mock("@infinitered/react-native-mlkit-text-recognition", () => ({
  __esModule: true,
  default: { recognize: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("parseReceiptText", () => {
  it("extracts the merchant from the first non-empty line", () => {
    const { parseReceiptText } = require("../ocrService");
    const result = parseReceiptText("Whole Foods Market\n123 Main St\nTotal $42.50");
    expect(result.merchant).toBe("Whole Foods Market");
  });

  it("finds a date in MM/DD/YYYY format", () => {
    const { parseReceiptText } = require("../ocrService");
    const result = parseReceiptText("Store\n03/28/2026\nTotal $10.00");
    expect(result.date).toBe("2026-03-28");
  });

  it("finds a date in Month DD, YYYY format", () => {
    const { parseReceiptText } = require("../ocrService");
    const result = parseReceiptText("Store\nMarch 28, 2026\nTotal $10.00");
    expect(result.date).toBe("2026-03-28");
  });

  it("finds the total amount near a 'total' keyword", () => {
    const { parseReceiptText } = require("../ocrService");
    const result = parseReceiptText("Store\nSubtotal $38.00\nTax $4.50\nTotal $42.50");
    expect(result.amount).toBe(42.5);
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("falls back to the largest dollar amount when no 'total' keyword", () => {
    const { parseReceiptText } = require("../ocrService");
    const result = parseReceiptText("Store\n$5.00\n$12.99\n$3.25");
    expect(result.amount).toBe(12.99);
    expect(result.confidence).toBeLessThan(0.7);
  });

  it("returns low confidence (0.5) when no explicit total match", () => {
    const { parseReceiptText } = require("../ocrService");
    const result = parseReceiptText("Store\n$9.99");
    expect(result.confidence).toBe(0.5);
  });

  it("handles empty text gracefully", () => {
    const { parseReceiptText } = require("../ocrService");
    const result = parseReceiptText("");
    expect(result.merchant).toBe("Unknown Merchant");
    expect(result.amount).toBe(0);
    expect(result.items).toEqual([]);
  });

  it("returns today's date when no date is found in the text", () => {
    const { parseReceiptText } = require("../ocrService");
    const result = parseReceiptText("Store\nTotal $10.00");
    const today = new Date().toISOString().split("T")[0];
    expect(result.date).toBe(today);
  });
});
