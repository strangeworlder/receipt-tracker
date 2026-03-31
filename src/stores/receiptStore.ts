import { create } from "zustand";
import type { Receipt, ReceiptCategory } from "@/types";

interface ReceiptState {
  receipts: Receipt[];
  loading: boolean;
  error: string | null;
  addReceipt: (receipt: Receipt) => void;
  updateReceipt: (id: string, updates: Partial<Receipt>) => void;
  deleteReceipt: (id: string) => void;
  getReceiptById: (id: string) => Receipt | undefined;
  getCategoryTotal: (category: ReceiptCategory) => number;
}

const mockReceipts: Receipt[] = [
  {
    id: "r1",
    merchant: "Whole Foods Market",
    date: "2026-03-28",
    amount: 84.32,
    category: "food",
    isWarranty: false,
    syncStatus: "synced",
  },
  {
    id: "r2",
    merchant: "Delta Airlines",
    date: "2026-03-25",
    amount: 420.0,
    category: "travel",
    isWarranty: false,
    syncStatus: "synced",
  },
  {
    id: "r3",
    merchant: "Best Buy",
    date: "2026-03-20",
    amount: 1249.99,
    category: "warranty",
    isWarranty: true,
    syncStatus: "pending",
  },
  {
    id: "r4",
    merchant: "IKEA",
    date: "2026-03-15",
    amount: 312.45,
    category: "shopping",
    isWarranty: false,
    syncStatus: "synced",
  },
];

export const useReceiptStore = create<ReceiptState>((set, get) => ({
  receipts: mockReceipts,
  loading: false,
  error: null,

  addReceipt: (receipt) =>
    set((state) => ({ receipts: [receipt, ...state.receipts] })),

  updateReceipt: (id, updates) =>
    set((state) => ({
      receipts: state.receipts.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    })),

  deleteReceipt: (id) =>
    set((state) => ({
      receipts: state.receipts.filter((r) => r.id !== id),
    })),

  getReceiptById: (id) => get().receipts.find((r) => r.id === id),

  getCategoryTotal: (category) =>
    get()
      .receipts.filter((r) => r.category === category)
      .reduce((sum, r) => sum + r.amount, 0),
}));
