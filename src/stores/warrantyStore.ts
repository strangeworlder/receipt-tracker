import { create } from "zustand";
import type { Warranty } from "@/types";

type WarrantyFilter = "all" | "active" | "expired";
type WarrantyStatus = "action_required" | "healthy" | "expired";

interface WarrantyState {
  warranties: Warranty[];
  loading: boolean;
  error: string | null;
  setWarranties: (warranties: Warranty[]) => void;
  addWarranty: (warranty: Warranty) => void;
  updateWarranty: (id: string, updates: Partial<Warranty>) => void;
  deleteWarranty: (id: string) => void;
  getWarrantyById: (id: string) => Warranty | undefined;
  getExpiringWarranties: (withinDays: number) => Warranty[];
  // Plan 08 selectors
  getWarranties: (filter: WarrantyFilter) => Warranty[];
  getDaysRemaining: (warrantyId: string) => number;
  getWarrantyStatus: (warrantyId: string) => WarrantyStatus;
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
  {
    id: "w3",
    receiptId: "r3",
    productName: "MacBook Pro AppleCare",
    manufacturer: "Apple",
    purchaseDate: "2025-04-10",
    expirationDate: "2026-04-10",
    coverageType: "AppleCare+",
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

  setWarranties: (warranties) => set({ warranties }),

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

  getWarranties: (filter) => {
    const now = new Date();
    const warranties = get().warranties;

    let filtered: Warranty[];
    switch (filter) {
      case "active":
        filtered = warranties.filter((w) => new Date(w.expirationDate) > now);
        break;
      case "expired":
        filtered = warranties.filter((w) => new Date(w.expirationDate) <= now);
        // Most recently expired first
        return [...filtered].sort(
          (a, b) =>
            new Date(b.expirationDate).getTime() -
            new Date(a.expirationDate).getTime()
        );
      default:
        filtered = warranties;
    }

    // For "all" and "active": sort soonest-expiring first, but push expired to bottom
    return [...filtered].sort((a, b) => {
      const aExpired = new Date(a.expirationDate) <= now;
      const bExpired = new Date(b.expirationDate) <= now;
      if (aExpired && !bExpired) return 1;
      if (!aExpired && bExpired) return -1;
      return (
        new Date(a.expirationDate).getTime() -
        new Date(b.expirationDate).getTime()
      );
    });
  },

  getDaysRemaining: (warrantyId) => {
    const warranty = get().warranties.find((w) => w.id === warrantyId);
    if (!warranty) return 0;
    const today = new Date();
    const expiry = new Date(warranty.expirationDate);
    return Math.ceil(
      (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
  },

  getWarrantyStatus: (warrantyId): WarrantyStatus => {
    const days = get().getDaysRemaining(warrantyId);
    if (days <= 0) return "expired";
    if (days <= 30) return "action_required";
    return "healthy";
  },
}));
