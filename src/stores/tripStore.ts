import { create } from "zustand";
import type { Trip, Expense, Carpool, SettlementTransaction } from "@/types";
import type { FirestorePlannerItem } from "@/types/firestore";

type PlannerItem = FirestorePlannerItem & { id: string; _pendingWrite?: boolean };

interface TripState {
  trips: Record<string, Trip>;
  expenses: Record<string, Expense[]>;
  carpools: Record<string, Carpool[]>;
  settlements: Record<string, SettlementTransaction[]>;
  plannerItems: Record<string, PlannerItem[]>;
  loading: boolean;
  error: string | null;

  // Live data setters (called by syncService)
  upsertTrip: (trip: Trip) => void;
  setExpenses: (tripId: string, expenses: Expense[]) => void;
  setCarpools: (tripId: string, carpools: Carpool[]) => void;
  setSettlements: (tripId: string, settlements: SettlementTransaction[]) => void;
  setPlannerItems: (tripId: string, items: PlannerItem[]) => void;

  // Derived selectors (read-only views)
  getCarpools: (tripId: string) => Carpool[];
  getExpenses: (tripId: string) => Expense[];
  getSettlements: (tripId: string) => SettlementTransaction[];
  getPlannerItems: (tripId: string) => PlannerItem[];
  getPlannerProgress: (tripId: string) => { total: number; assigned: number; percentage: number };

  // UI actions
  addTrip: (trip: Trip) => void;
  updateTrip: (id: string, updates: Partial<Trip>) => void;
  deleteTrip: (id: string) => void;
  getTrip: (tripId: string) => Trip | undefined;
  getAllTrips: () => Trip[];
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: {},
  expenses: {},
  carpools: {},
  settlements: {},
  plannerItems: {},
  loading: false,
  error: null,

  upsertTrip: (trip) =>
    set((s) => ({ trips: { ...s.trips, [trip.id]: trip } })),

  setExpenses: (tripId, expenses) =>
    set((s) => ({ expenses: { ...s.expenses, [tripId]: expenses } })),

  setCarpools: (tripId, carpools) =>
    set((s) => ({ carpools: { ...s.carpools, [tripId]: carpools } })),

  setSettlements: (tripId, settlements) =>
    set((s) => ({ settlements: { ...s.settlements, [tripId]: settlements } })),

  setPlannerItems: (tripId, items) =>
    set((s) => ({ plannerItems: { ...s.plannerItems, [tripId]: items } })),

  getCarpools: (tripId) => get().carpools[tripId] ?? [],

  getExpenses: (tripId) => get().expenses[tripId] ?? [],

  getSettlements: (tripId) => get().settlements[tripId] ?? [],

  getPlannerItems: (tripId) => get().plannerItems[tripId] ?? [],

  getPlannerProgress: (tripId) => {
    const items = get().plannerItems[tripId] ?? [];
    const total = items.length;
    const assigned = items.filter((i) => i.status === "assigned" || i.status === "brought").length;
    const percentage = total === 0 ? 0 : Math.round((assigned / total) * 100);
    return { total, assigned, percentage };
  },

  addTrip: (trip) =>
    set((s) => ({ trips: { ...s.trips, [trip.id]: trip } })),

  updateTrip: (id, updates) =>
    set((s) => ({
      trips: { ...s.trips, [id]: { ...s.trips[id], ...updates } },
    })),

  deleteTrip: (id) =>
    set((s) => {
      const trips = { ...s.trips };
      delete trips[id];
      return { trips };
    }),

  getTrip: (tripId) => get().trips[tripId],

  getAllTrips: () => Object.values(get().trips),
}));
