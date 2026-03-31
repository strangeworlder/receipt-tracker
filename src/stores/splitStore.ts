import { create } from "zustand";
import type { Expense, TripParticipant } from "@/types";

interface SplitState {
  activeExpense: Partial<Expense> | null;
  participants: TripParticipant[];
  setActiveExpense: (expense: Partial<Expense> | null) => void;
  setParticipants: (participants: TripParticipant[]) => void;
  updateExpenseField: <K extends keyof Expense>(
    field: K,
    value: Expense[K]
  ) => void;
  resetSplit: () => void;
}

export const useSplitStore = create<SplitState>((set) => ({
  activeExpense: null,
  participants: [],

  setActiveExpense: (expense) => set({ activeExpense: expense }),

  setParticipants: (participants) => set({ participants }),

  updateExpenseField: (field, value) =>
    set((state) => ({
      activeExpense: state.activeExpense
        ? { ...state.activeExpense, [field]: value }
        : { [field]: value },
    })),

  resetSplit: () => set({ activeExpense: null, participants: [] }),
}));
