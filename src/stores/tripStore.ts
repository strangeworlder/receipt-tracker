import { create } from "zustand";
import type {
  Trip,
  TripParticipant,
  Expense,
  Carpool,
  SettlementTransaction,
} from "@/types";

interface TripState {
  trips: Trip[];
  loading: boolean;
  error: string | null;
  addTrip: (trip: Trip) => void;
  updateTrip: (id: string, updates: Partial<Trip>) => void;
  deleteTrip: (id: string) => void;
  getTripById: (id: string) => Trip | undefined;
  addExpense: (tripId: string, expense: Expense) => void;
  addCarpool: (tripId: string, carpool: Carpool) => void;
  addSettlement: (tripId: string, settlement: SettlementTransaction) => void;
}

const mockParticipants: TripParticipant[] = [
  {
    id: "p1",
    uid: "uid-alice",
    name: "Alice",
    avatarUri: undefined,
    isGhost: false,
    amountPaid: 340.0,
    amountOwed: 170.0,
  },
  {
    id: "p2",
    uid: "uid-bob",
    name: "Bob",
    avatarUri: undefined,
    isGhost: false,
    amountPaid: 85.0,
    amountOwed: 170.0,
  },
  {
    id: "p3",
    name: "Carol",
    avatarUri: undefined,
    isGhost: true,
    managedBy: "uid-alice",
    amountPaid: 0,
    amountOwed: 170.0,
  },
];

const mockExpenses: Expense[] = [
  {
    id: "e1",
    tripId: "t1",
    description: "Dinner at The Lobster Shack",
    amount: 255.0,
    paidBy: "p1",
    splitAmong: ["p1", "p2", "p3"],
    splitType: "equal",
  },
  {
    id: "e2",
    tripId: "t1",
    description: "Hotel deposit",
    amount: 170.0,
    paidBy: "p1",
    splitAmong: ["p1", "p2", "p3"],
    splitType: "equal",
  },
  {
    id: "e3",
    tripId: "t1",
    description: "Fuel",
    amount: 85.0,
    paidBy: "p2",
    splitAmong: ["p1", "p2", "p3"],
    splitType: "equal",
  },
];

const mockSettlements: SettlementTransaction[] = [
  {
    id: "s1",
    tripId: "t1",
    fromParticipantId: "p2",
    toParticipantId: "p1",
    amount: 85.0,
    status: "pending",
  },
  {
    id: "s2",
    tripId: "t1",
    fromParticipantId: "p3",
    toParticipantId: "p1",
    amount: 170.0,
    status: "pending",
  },
];

const mockTrips: Trip[] = [
  {
    id: "t1",
    name: "Barcelona Summer 2026",
    startDate: "2026-07-10",
    endDate: "2026-07-20",
    participants: mockParticipants,
    totalSpend: 510.0,
    categories: [],
    carpools: [],
    settlements: mockSettlements,
    totalPot: 600.0,
    categoryBreakdown: {
      food: 255.0,
      accommodation: 170.0,
      transport: 85.0,
    },
  },
];

export const useTripStore = create<TripState>((set, get) => ({
  trips: mockTrips,
  loading: false,
  error: null,

  addTrip: (trip) =>
    set((state) => ({ trips: [trip, ...state.trips] })),

  updateTrip: (id, updates) =>
    set((state) => ({
      trips: state.trips.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),

  deleteTrip: (id) =>
    set((state) => ({ trips: state.trips.filter((t) => t.id !== id) })),

  getTripById: (id) => get().trips.find((t) => t.id === id),

  addExpense: (tripId, expense) =>
    set((state) => ({
      trips: state.trips.map((t) =>
        t.id === tripId
          ? {
              ...t,
              totalSpend: t.totalSpend + expense.amount,
            }
          : t
      ),
    })),

  addCarpool: (tripId, carpool) =>
    set((state) => ({
      trips: state.trips.map((t) =>
        t.id === tripId
          ? { ...t, carpools: [...t.carpools, carpool] }
          : t
      ),
    })),

  addSettlement: (tripId, settlement) =>
    set((state) => ({
      trips: state.trips.map((t) =>
        t.id === tripId
          ? { ...t, settlements: [...t.settlements, settlement] }
          : t
      ),
    })),
}));

export { mockExpenses };
