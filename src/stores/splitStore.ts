import { create } from "zustand";
import { generateUUID } from "@/utils/uuid";
import type { TripParticipant } from "@/types";

interface SplitParticipant {
  id: string;
  name: string;
  avatarUri?: string;
  isIncluded: boolean;
  customAmount?: number;
}

interface SharedItem {
  id: string;
  name: string;
  price: number;
  sharedBy: string[];
}

interface SplitState {
  totalAmount: number;
  splitMode: "equal" | "custom";
  participants: SplitParticipant[];
  paidBy: string;
  sharedItems: SharedItem[];

  // Actions
  setTotalAmount: (amount: number) => void;
  toggleParticipant: (id: string) => void;
  setSplitMode: (mode: "equal" | "custom") => void;
  setPaidBy: (id: string) => void;
  setCustomAmount: (participantId: string, amount: number) => void;
  addSharedItem: (item: { name: string; price: number }) => void;
  removeSharedItem: (id: string) => void;
  toggleSharedItemParticipant: (itemId: string, participantId: string) => void;
  loadFromTrip: (participants: TripParticipant[]) => void;

  // Computed
  getPerPersonAmount: () => number;
  getCustomTotal: () => number;

  // Helpers
  autoBalance: () => void;
  resetSplit: () => void;
}

const defaultParticipants: SplitParticipant[] = [
  { id: "p1", name: "Alex", isIncluded: true },
  { id: "p2", name: "Sam", isIncluded: true },
  { id: "p3", name: "Jamie", isIncluded: true },
  { id: "p4", name: "Chris", isIncluded: false },
];

export const useSplitStore = create<SplitState>((set, get) => ({
  totalAmount: 150,
  splitMode: "equal",
  participants: defaultParticipants,
  paidBy: "p1",
  sharedItems: [],

  setTotalAmount: (amount) => set({ totalAmount: amount }),

  toggleParticipant: (id) =>
    set((s) => ({
      participants: s.participants.map((p) =>
        p.id === id ? { ...p, isIncluded: !p.isIncluded } : p
      ),
    })),

  setSplitMode: (mode) => set({ splitMode: mode }),

  setPaidBy: (id) => set({ paidBy: id }),

  setCustomAmount: (participantId, amount) =>
    set((s) => ({
      participants: s.participants.map((p) =>
        p.id === participantId ? { ...p, customAmount: amount } : p
      ),
    })),

  addSharedItem: (item) =>
    set((s) => ({
      sharedItems: [
        ...s.sharedItems,
        { id: generateUUID(), ...item, sharedBy: [] },
      ],
    })),

  removeSharedItem: (id) =>
    set((s) => ({
      sharedItems: s.sharedItems.filter((item) => item.id !== id),
    })),

  toggleSharedItemParticipant: (itemId, participantId) =>
    set((s) => ({
      sharedItems: s.sharedItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              sharedBy: item.sharedBy.includes(participantId)
                ? item.sharedBy.filter((id) => id !== participantId)
                : [...item.sharedBy, participantId],
            }
          : item
      ),
    })),

  loadFromTrip: (tripParticipants) => {
    const participants: SplitParticipant[] = tripParticipants.map((tp) => ({
      id: tp.id,
      name: tp.name,
      avatarUri: tp.avatarUri,
      isIncluded: true,
      customAmount: undefined,
    }));
    set({
      participants,
      paidBy: participants[0]?.id ?? "",
      sharedItems: [],
      totalAmount: 0,
      splitMode: "equal",
    });
  },

  getPerPersonAmount: () => {
    const { totalAmount, participants } = get();
    const activeCount = participants.filter((p) => p.isIncluded).length;
    return activeCount > 0 ? totalAmount / activeCount : 0;
  },

  getCustomTotal: () => {
    const { participants } = get();
    return participants
      .filter((p) => p.isIncluded)
      .reduce((sum, p) => sum + (p.customAmount ?? 0), 0);
  },

  autoBalance: () => {
    const { totalAmount, participants } = get();
    const included = participants.filter((p) => p.isIncluded);
    const withCustom = included.filter((p) => p.customAmount !== undefined);
    const withoutCustom = included.filter((p) => p.customAmount === undefined);

    const customTotal = withCustom.reduce(
      (sum, p) => sum + (p.customAmount ?? 0),
      0
    );
    const remaining = totalAmount - customTotal;
    const share =
      withoutCustom.length > 0 ? remaining / withoutCustom.length : 0;

    set((s) => ({
      participants: s.participants.map((p) => {
        if (!p.isIncluded) return p;
        if (p.customAmount !== undefined) return p;
        return { ...p, customAmount: share };
      }),
    }));
  },

  resetSplit: () =>
    set({
      totalAmount: 0,
      splitMode: "equal",
      participants: defaultParticipants.map((p) => ({
        ...p,
        customAmount: undefined,
      })),
      paidBy: "p1",
      sharedItems: [],
    }),
}));
