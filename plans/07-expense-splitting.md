# Plan 7: Expense Splitting

> **Prerequisite:** Plan 5 (Data Layer — `tripService.addExpense` and `useTripStore` must be in place).
>
> **Implementation status:** Complete. Implemented in `app/(tabs)/split.tsx` and `src/stores/splitStore.ts`.

This plan implements both the equal-split screen and the advanced custom-split screen, and wires the "Save Split" action to persist an expense in Firestore via `tripService`.

> **NativeWind v5 import rule:** Import `View`, `Text`, `ScrollView`, `Pressable`, `TextInput` from `@/tw` (not `react-native`). Import `Image` from `@/tw/image`. Raw React Native components silently ignore `className`.
>
> **No `expo-linear-gradient`:** Use `experimental_backgroundImage` CSS gradients on `View`.
>
> **Rounded containers:** Add `borderCurve: 'continuous'` to `style` on any rounded View.
>
> **Safe area:** Use `contentInsetAdjustmentBehavior="automatic"` on `ScrollView`/`FlatList`.
>
> **`expo-blur` already installed:** `expo-blur ~15.0.8` is a project dependency — no `npx expo install expo-blur` needed. Import `BlurView` directly from `expo-blur`.
>
> **No toast utility:** The project has no `showToast` helper. Use `Alert.alert()` from `react-native` for user-facing validation and success messages.

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

**Empty-state trigger:** `totalAmount === 0`. The "Create Split" button seeds `totalAmount` to 150 (demo). After `saveSplit()` completes, `resetSplit()` sets `totalAmount` back to 0, which returns the screen to the empty state.

### Empty state:
- Centered `call_split` icon in `bg-primary-container` circle
- "No active splits" message
- "Create Split" `PrimaryButton` — sets `totalAmount` to 150 to show the full split UI

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
4. **Right content:** Frosted glass container — `BlurView` from `expo-blur` with `backgroundColor: 'rgba(255,255,255,0.2)'`, width/height 60, `borderRadius: 16` and a `groups` icon. CSS `backdrop-blur` is not supported in React Native — always use `BlurView`.

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
import { Alert } from "react-native";
import { addExpense } from "@/services/tripService";

async function handleSaveSplit(): Promise<void> {
  const { totalAmount, splitMode, participants, paidBy } = useSplitStore.getState();
  const activeTripId = useTripStore.getState().getAllTrips()[0]?.id; // or from route params

  // Validate
  const activeParticipants = participants.filter(p => p.isIncluded);
  if (activeParticipants.length < 2) {
    Alert.alert("Not enough participants", "At least 2 participants required.");
    return;
  }
  if (totalAmount <= 0) {
    Alert.alert("No amount", "Enter an amount greater than 0.");
    return;
  }
  if (splitMode === "custom") {
    const customTotal = useSplitStore.getState().getCustomTotal();
    if (Math.abs(customTotal - totalAmount) > 0.01) {
      Alert.alert(
        "Amounts don't match",
        `Custom amounts total $${customTotal.toFixed(2)} but bill is $${totalAmount.toFixed(2)}.`
      );
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
  Alert.alert("Split saved!", "The expense has been recorded.");
}
```

> **No `showToast` in this project.** Use `Alert.alert()` from `react-native` for all user-facing messages.

Bottom CTA button:
- **Style:** `w-full bg-primary text-on-primary font-black py-5 rounded-3xl shadow-lg shadow-primary/30`
- **Label:** "Save Split" with `receipt_long` icon

---

## Step 9: State Management

Replace the stub in `src/stores/splitStore.ts` with the full implementation:

> **`SplitParticipant` is store-internal.** It is defined as a private interface inside `splitStore.ts` and is not exported to `src/types/index.ts`. It is distinct from `TripParticipant` — it carries split-specific fields (`isIncluded`, `customAmount`) that have no meaning outside the split flow.

```typescript
import { create } from "zustand";
import { generateUUID } from "@/utils/uuid";
import type { TripParticipant } from "@/types";

// Store-internal — not exported to types/index.ts
interface SplitParticipant {
  id: string;
  name: string;
  avatarUri?: string;
  isIncluded: boolean;
  customAmount?: number;
}

// Store-internal — not exported to types/index.ts
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

  // Wires trip participants into the store (used by Plan 09 trip integration)
  loadFromTrip: (participants: TripParticipant[]) => void;

  // Computed helpers
  getPerPersonAmount: () => number;   // totalAmount / includedCount
  getCustomTotal: () => number;        // sum of customAmount for included participants

  // Auto-distributes remaining amount among participants without custom amounts
  autoBalance: () => void;

  resetSplit: () => void;              // sets totalAmount → 0, clears customAmounts + sharedItems
}

const defaultParticipants: SplitParticipant[] = [
  { id: "p1", name: "Alex", isIncluded: true },
  { id: "p2", name: "Sam", isIncluded: true },
  { id: "p3", name: "Jamie", isIncluded: true },
  { id: "p4", name: "Chris", isIncluded: false },
];

export const useSplitStore = create<SplitState>((set, get) => ({
  // Initial store creation default: 150 (demo). resetSplit() sets to 0.
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
  removeSharedItem: id =>
    set(s => ({ sharedItems: s.sharedItems.filter(item => item.id !== id) })),
  toggleSharedItemParticipant: (itemId, participantId) =>
    set(s => ({
      sharedItems: s.sharedItems.map(item =>
        item.id === itemId
          ? {
              ...item,
              sharedBy: item.sharedBy.includes(participantId)
                ? item.sharedBy.filter(id => id !== participantId)
                : [...item.sharedBy, participantId],
            }
          : item
      ),
    })),
  loadFromTrip: (tripParticipants) => {
    const participants: SplitParticipant[] = tripParticipants.map(tp => ({
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
    const active = participants.filter(p => p.isIncluded).length;
    return active > 0 ? totalAmount / active : 0;
  },
  getCustomTotal: () => {
    const { participants } = get();
    return participants
      .filter(p => p.isIncluded)
      .reduce((sum, p) => sum + (p.customAmount ?? 0), 0);
  },
  autoBalance: () => {
    const { totalAmount, participants } = get();
    const included = participants.filter(p => p.isIncluded);
    const withCustom = included.filter(p => p.customAmount !== undefined);
    const withoutCustom = included.filter(p => p.customAmount === undefined);
    const customTotal = withCustom.reduce((sum, p) => sum + (p.customAmount ?? 0), 0);
    const remaining = totalAmount - customTotal;
    const share = withoutCustom.length > 0 ? remaining / withoutCustom.length : 0;
    set(s => ({
      participants: s.participants.map(p => {
        if (!p.isIncluded || p.customAmount !== undefined) return p;
        return { ...p, customAmount: share };
      }),
    }));
  },
  resetSplit: () =>
    set({
      totalAmount: 0,  // ← 0, not 150; triggers the empty state on next render
      splitMode: "equal",
      participants: defaultParticipants.map(p => ({ ...p, customAmount: undefined })),
      paidBy: "p1",
      sharedItems: [],
    }),
}));
```

---

## Step 10: Validation & Edge Cases

1. At least 2 participants must be sharing
2. Total amount must be > 0
3. In custom mode, warn if individual amounts don't sum to the total (use `getCustomTotal()` from the store)
4. Currency always formatted to 2 decimal places (use `formatCurrency` from `src/utils/format.ts`)
5. Payer must be one of the included participants — enforced at UI level: the payer picker modal only shows included participants
6. All validation errors shown via `Alert.alert()` — no toast utility exists in the project

---

## Deliverables Checklist

- [x] `app/(tabs)/split.tsx` — entry screen with empty state or active split
- [x] Hero amount section with editable total (inline `TextInput`, commits on blur)
- [x] Participant selection grid with toggle interaction and reactive calculation
- [x] Split summary card (`BlurView` for frosted glass — not CSS `backdrop-blur`)
- [x] "Who Paid?" section with payer selection (bottom-sheet modal)
- [x] Mode switcher between Equal and Custom
- [x] Advanced: shared items section (add/remove items)
- [x] Advanced: per-participant custom amounts with auto-balance
- [x] `src/stores/splitStore.ts` — full implementation replacing Plan 01 scaffold
- [x] Save Split calls `tripService.addExpense` to persist to Firestore
- [x] Validation: min 2 participants, total > 0, custom amounts match total (via `Alert.alert`)
- [x] `src/stores/__tests__/splitStore.test.ts` — 39 unit tests, all passing
- [x] New icon mappings in `MaterialIcon.tsx`: `groups`, `balance`, `savings`, `person_add`, `check_circle_outline`
