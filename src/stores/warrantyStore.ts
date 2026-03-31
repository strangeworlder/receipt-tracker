import { create } from "zustand";
import type { Warranty } from "@/types";

interface WarrantyState {
  warranties: Warranty[];
  loading: boolean;
  error: string | null;
  addWarranty: (warranty: Warranty) => void;
  updateWarranty: (id: string, updates: Partial<Warranty>) => void;
  deleteWarranty: (id: string) => void;
  getWarrantyById: (id: string) => Warranty | undefined;
  getExpiringWarranties: (withinDays: number) => Warranty[];
}

const mockWarranties: Warranty[] = [
  {
    id: "w1",
    receiptId: "r3",
    productName: "MacBook Pro 16-inch",
    manufacturer: "Apple",
    purchaseDate: "2026-03-20",
    expirationDate: "2027-03-20",
    coverageType: "AppleCare+",
  },
  {
    id: "w2",
    receiptId: "r4",
    productName: "KALLAX Shelf Unit",
    manufacturer: "IKEA",
    purchaseDate: "2026-03-15",
    expirationDate: "2031-03-15",
    coverageType: "Limited Warranty",
  },
];

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1).getTime();
  const d2 = new Date(date2).getTime();
  return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
}

export const useWarrantyStore = create<WarrantyState>((set, get) => ({
  warranties: mockWarranties,
  loading: false,
  error: null,

  addWarranty: (warranty) =>
    set((state) => ({ warranties: [warranty, ...state.warranties] })),

  updateWarranty: (id, updates) =>
    set((state) => ({
      warranties: state.warranties.map((w) =>
        w.id === id ? { ...w, ...updates } : w
      ),
    })),

  deleteWarranty: (id) =>
    set((state) => ({
      warranties: state.warranties.filter((w) => w.id !== id),
    })),

  getWarrantyById: (id) => get().warranties.find((w) => w.id === id),

  getExpiringWarranties: (withinDays) => {
    const today = new Date().toISOString().split("T")[0];
    return get().warranties.filter(
      (w) => daysBetween(today, w.expirationDate) <= withinDays
    );
  },
}));
