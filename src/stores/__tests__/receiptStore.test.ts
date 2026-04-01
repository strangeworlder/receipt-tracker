import { useReceiptStore } from "../receiptStore";
import type { Receipt } from "@/types";

const mockReceipt = (id: string): Receipt => ({
  id,
  merchant: `Store ${id}`,
  date: "2026-01-01",
  amount: 10,
  category: "food",
  isWarranty: false,
});

beforeEach(() => {
  // Reset store state between tests
  useReceiptStore.setState({ receipts: [], loading: false, error: null });
});

describe("setReceipts", () => {
  it("replaces the entire receipts array", () => {
    const initial = [mockReceipt("old-1"), mockReceipt("old-2")];
    useReceiptStore.setState({ receipts: initial });

    const newReceipts = [mockReceipt("new-1")];
    useReceiptStore.getState().setReceipts(newReceipts);

    expect(useReceiptStore.getState().receipts).toEqual(newReceipts);
  });

  it("can clear receipts with an empty array", () => {
    useReceiptStore.setState({ receipts: [mockReceipt("r1")] });
    useReceiptStore.getState().setReceipts([]);
    expect(useReceiptStore.getState().receipts).toHaveLength(0);
  });
});

describe("existing actions still work after adding setReceipts", () => {
  it("addReceipt prepends a receipt", () => {
    const r = mockReceipt("r1");
    useReceiptStore.getState().addReceipt(r);
    expect(useReceiptStore.getState().receipts[0]).toEqual(r);
  });
});
