# Plan 7: Expense Splitting

> **Prerequisite:** Plan 5 (Data Layer — `tripService.addExpense` and `useTripStore` must be in place).

This plan implements both the equal-split screen and the advanced custom-split screen, and wires the "Save Split" action to persist an expense in Firestore via `tripService`.

> **NativeWind v5 import rule:** Import `View`, `Text`, `ScrollView`, `Pressable`, `TextInput` from `@/tw` (not `react-native`). Import `Image` from `@/tw/image`. Raw React Native components silently ignore `className`.
>
> **No `expo-linear-gradient`:** Use `experimental_backgroundImage` CSS gradients on `View`.
>
> **Rounded containers:** Add `borderCurve: 'continuous'` to `style` on any rounded View.
>
> **Safe area:** Use `contentInsetAdjustmentBehavior="automatic"` on `ScrollView`/`FlatList`.

---

## Context

- `formatCurrency(amount)` is available from `src/utils/format.ts` (extracted as part of Plan 06 or earlier).
- The `splitStore.ts` in `src/stores/` currently holds a placeholder scaffold from Plan 01. This plan replaces that scaffold with the full implementation.
- When `saveSplit()` is called, the expense is written to Firestore under `trips/{tripId}/expenses/{expenseId}` via `tripService.addExpense`. Other trip members receive the update via their real-time listener automatically.

---

## Screen Overview

Two splitting modes accessible from the "Split" tab:
1. **Basic Split** — Equal division among selected participants
2. **Advanced Split** — Custom amounts per participant with shared item selection

---

## Step 1: Split Tab Entry Screen

File: `app/(tabs)/split.tsx`

Shows the active or most recent split. If no split is active, show an empty state.

### Empty state:
- Centered icon
- "No active splits" message
- "Create Split" primary button

### Active split:
- Renders the split detail (Steps 2–7 below)

---

## Step 2: Hero Amount Section

Top of the split screen:

1. **Context label:** "Roadtrip - Shopping split." — `text-xs uppercase tracking-[0.2em] text-on-surface-variant font-semibold`
2. **Amount:** `$150.00` — `text-6xl font-black text-primary tracking-tighter`
   - Editable — tapping opens a number input or inline editing
3. **Subtitle:** "Total Bill Amount" — `text-on-surface-variant/70 text-sm font-medium`

---

## Step 3: Participant Selection Grid

### Header row:
- "Select Participants" title — `text-xl font-bold`
- Count pill: "4 IN TRIP" — `text-primary text-[10px] font-black bg-primary-container px-3 py-1 rounded-full uppercase`

### 2-column grid of participant cards:

**Active (sharing) participant:**
- `bg-white p-4 rounded-2xl ring-2 ring-primary shadow-sm`
- Avatar (40x40 rounded-full) with green checkmark overlay at bottom-right
- Name in bold + "SHARING" label in primary color

**Inactive (excluded) participant:**
- `bg-surface-variant/40 p-4 rounded-2xl opacity-60`
- Grayscale avatar
- Name + "EXCLUDING" label in muted color

### Interaction:
- Tapping toggles the participant between sharing/excluded
- The split amount automatically recalculates

### Mock participants:
| Name | Status |
|------|--------|
| Alex | Sharing |
| Sam | Sharing |
| Jamie | Sharing |
| Chris | Excluding |

---

## Step 4: Split Summary Card

A prominent card showing the calculated per-person amount:

1. **Container:** `bg-primary p-7 rounded-3xl text-white shadow-xl shadow-primary/20`
2. **Decorative element:** Large semi-transparent circle in top-right (`bg-white/10 rounded-full`, absolute positioned)
3. **Left content:**
   - Label: "Calculated Split" — `text-white/80 text-[10px] font-black uppercase tracking-[0.2em]`
   - Amount: `$50.00 each` — `text-4xl font-black` with "each" in lighter weight
4. **Right content:** Frosted glass container — `BlurView` from `expo-blur` with `bg-white/20 p-4 rounded-2xl` and a `groups` icon (CSS `backdrop-blur` is not supported in React Native)

The amount updates reactively: `totalAmount / activeParticipantCount`

---

## Step 5: "Who Paid?" Section

1. **Title:** "Who Paid?" — `text-xl font-bold`
2. **Payer card:** `bg-white rounded-3xl p-5 shadow-sm border border-surface-variant`
   - Left: Avatar (48x48, `rounded-2xl ring-4 ring-primary/10`)
   - Center: Name (bold) + "Primary Payer" subtitle
   - Right: Amount in primary bold + "Change" edit link
3. **Interaction:** Tapping "Change" opens a participant picker bottom sheet

---

## Step 6: Mode Switcher (Basic ↔ Advanced)

Segmented control above the participant section:

1. Two options: "Equal Split" and "Custom Split"
2. **Container:** `bg-surface-container-high rounded-full p-1`
3. **Active pill:** `bg-primary text-on-primary rounded-full px-6 py-2 font-bold text-sm`
4. **Inactive:** `text-on-surface-variant px-6 py-2`

Switching to "Custom Split" reveals the advanced features (Step 7).

---

## Step 7: Advanced Split — Shared Items Section

Only visible in "Custom Split" mode.

### Shared Items List:
- Section title: "Shared Items" with item count
- Each item card:
  - Item name + price
  - Participant avatars showing who shares this item
  - Toggle to include/exclude from split
- "Add Item" button to manually add items

### Per-Participant Custom Amounts:

Each participant row:
- Avatar + name
- Editable amount input (`keyboardType="decimal-pad"`)
- Percentage of total
- Include/exclude toggle

The split summary card updates to show individual amounts.

### Auto-Balance Feature:
- Button to auto-distribute remaining amount equally among participants without a custom amount
- Visual warning when amounts don't sum to the total

---

## Step 8: Save Split Action

```typescript
// app/(tabs)/split.tsx — handleSaveSplit
import { addExpense } from "@/services/tripService";
import { useAuthStore } from "@/stores/authStore";

async function handleSaveSplit(): Promise<void> {
  const { totalAmount, splitMode, participants, paidBy, sharedItems } = useSplitStore.getState();
  const activeTripId = useTripStore.getState().getAllTrips()[0]?.id; // or from route params

  // Validate
  const activeParticipants = participants.filter(p => p.isIncluded);
  if (activeParticipants.length < 2) {
    showToast("At least 2 participants required");
    return;
  }
  if (totalAmount <= 0) {
    showToast("Enter an amount greater than 0");
    return;
  }
  if (splitMode === "custom") {
    const customTotal = activeParticipants.reduce((s, p) => s + (p.customAmount ?? 0), 0);
    if (Math.abs(customTotal - totalAmount) > 0.01) {
      showToast("Custom amounts must sum to the total");
      return;
    }
  }

  // Build expense
  const expense = {
    description: "Split expense",
    amount: totalAmount,
    paidBy,
    splitAmong: activeParticipants.map(p => p.id),
    splitType: splitMode === "equal" ? "equal" as const : "custom" as const,
    customAmounts: splitMode === "custom"
      ? Object.fromEntries(activeParticipants.map(p => [p.id, p.customAmount ?? 0]))
      : undefined,
  };

  if (activeTripId) {
    await addExpense(activeTripId, expense);
  }

  useSplitStore.getState().resetSplit();
  showToast("Split saved!");
}
```

Bottom CTA button:
- **Style:** `w-full bg-primary text-on-primary font-black py-5 rounded-3xl shadow-lg shadow-primary/30`
- **Label:** "Save Split" with `receipt_long` icon

---

## Step 9: State Management

Replace the stub in `src/stores/splitStore.ts` with the full implementation:

```typescript
import { create } from "zustand";
import { generateUUID } from "@/utils/uuid";

interface SplitParticipant {
  id: string;
  name: string;
  avatarUri?: string;
  isIncluded: boolean;
  customAmount?: number;
}

interface SplitState {
  totalAmount: number;
  splitMode: "equal" | "custom";
  participants: SplitParticipant[];
  paidBy: string;
  sharedItems: Array<{
    id: string;
    name: string;
    price: number;
    sharedBy: string[];
  }>;

  setTotalAmount: (amount: number) => void;
  toggleParticipant: (id: string) => void;
  setSplitMode: (mode: "equal" | "custom") => void;
  setPaidBy: (id: string) => void;
  setCustomAmount: (participantId: string, amount: number) => void;
  addSharedItem: (item: { name: string; price: number }) => void;
  getPerPersonAmount: () => number;
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

  setTotalAmount: amount => set({ totalAmount: amount }),
  toggleParticipant: id =>
    set(s => ({
      participants: s.participants.map(p =>
        p.id === id ? { ...p, isIncluded: !p.isIncluded } : p
      ),
    })),
  setSplitMode: mode => set({ splitMode: mode }),
  setPaidBy: id => set({ paidBy: id }),
  setCustomAmount: (participantId, amount) =>
    set(s => ({
      participants: s.participants.map(p =>
        p.id === participantId ? { ...p, customAmount: amount } : p
      ),
    })),
  addSharedItem: item =>
    set(s => ({
      sharedItems: [...s.sharedItems, { id: generateUUID(), ...item, sharedBy: [] }],
    })),
  getPerPersonAmount: () => {
    const { totalAmount, participants } = get();
    const active = participants.filter(p => p.isIncluded).length;
    return active > 0 ? totalAmount / active : 0;
  },
  resetSplit: () =>
    set({
      totalAmount: 0,
      splitMode: "equal",
      participants: defaultParticipants.map(p => ({ ...p, customAmount: undefined })),
      sharedItems: [],
    }),
}));
```

---

## Step 10: Validation & Edge Cases

1. At least 2 participants must be sharing
2. Total amount must be > 0
3. In custom mode, warn if individual amounts don't sum to the total
4. Currency always formatted to 2 decimal places (use `formatCurrency` from `src/utils/format.ts`)
5. Payer must be one of the included participants

---

## Deliverables Checklist

- [ ] `app/(tabs)/split.tsx` — entry screen with empty state or active split
- [ ] Hero amount section with editable total
- [ ] Participant selection grid with toggle interaction and reactive calculation
- [ ] Split summary card (`BlurView` for frosted glass — not CSS `backdrop-blur`)
- [ ] "Who Paid?" section with payer selection
- [ ] Mode switcher between Equal and Custom
- [ ] Advanced: shared items section
- [ ] Advanced: per-participant custom amounts with auto-balance
- [ ] `src/stores/splitStore.ts` — full implementation replacing Plan 01 scaffold
- [ ] Save Split calls `tripService.addExpense` to persist to Firestore
- [ ] Validation: min 2 participants, total > 0, custom amounts match total
