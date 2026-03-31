# Plan 4: Expense Splitting

> **Prerequisite:** Plan 1 (Project Foundation & Design System)

This plan implements both the basic equal-split screen and the advanced custom-split screen with shared items and per-item assignment.

> **NativeWind v5 import rule:** All `View`, `Text`, `ScrollView`, `Pressable`, `TextInput` imports **must** come from `@/tw` (the CSS-wrapped components from Plan 01 Step 6.5), **not** from `react-native`. `Image` imports come from `@/tw/image`. Raw React Native components silently ignore `className` in NativeWind v5.
>
> **No `expo-linear-gradient`:** Use CSS gradients via `experimental_backgroundImage` on `View` instead.
>
> **Rounded containers:** Add `borderCurve: 'continuous'` to `style` on any rounded View for the native iOS continuous corner curve.
>
> **Safe area:** Use `contentInsetAdjustmentBehavior="automatic"` on `ScrollView`/`FlatList` instead of wrapping in `SafeAreaView`.

---

## Screen Overview

There are two splitting modes:
1. **Basic Split** — Equal division among selected participants (simpler mockup)
2. **Advanced Split** — Custom amounts per participant with shared item selection (more complex mockup)

Both are accessible from the "Split" tab. The advanced mode is reached via a mode switcher.

---

## Step 1: Split Tab Entry Screen

File: `app/(tabs)/split.tsx`

This screen shows the active or most recent split. If no split is active, show an empty state with a "New Split" button.

### Empty state:
- Centered illustration or icon
- "No active splits" message
- "Create Split" primary button

### Active split:
- Renders the split detail (Steps 2–7 below)

## Step 2: Hero Amount Section

Top of the split screen:

1. **Context label:** "Roadtrip - Shopping split." — `text-xs uppercase tracking-[0.2em] text-on-surface-variant font-semibold`
2. **Amount:** `$150.00` — `font-headline text-6xl font-black text-primary tracking-tighter`
3. **Subtitle:** "Total Bill Amount" — `text-on-surface-variant/70 text-sm font-medium`

This amount is editable — tapping it should open a number input or inline editing.

## Step 3: Participant Selection Grid

### Header row:
- "Select Participants" title — `font-headline text-xl font-bold`
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
- Tapping an active participant excludes them (toggles to inactive)
- Tapping an inactive participant includes them (toggles to active)
- The split amount automatically recalculates

### Mock participants:
| Name | Status | Avatar |
|------|--------|--------|
| Alex | Sharing | (use placeholder) |
| Sam | Sharing | (use placeholder) |
| Jamie | Sharing | (use placeholder) |
| Chris | Excluding | (use placeholder) |

## Step 4: Split Summary Card

A prominent card showing the calculated per-person amount:

1. **Container:** `bg-primary p-7 rounded-3xl text-white shadow-xl shadow-primary/20`
2. **Decorative element:** Large semi-transparent circle in top-right (`bg-white/10 rounded-full` absolute positioned)
3. **Left content:**
   - Label: "Calculated Split" — `text-white/80 text-[10px] font-black uppercase tracking-[0.2em]`
   - Amount: `$50.00 each` — `font-headline text-4xl font-black` with "each" in lighter weight
4. **Right content:** Frosted glass container — use `BlurView` from `expo-blur` wrapped in a `View` with `bg-white/20 p-4 rounded-2xl` with `groups` icon (`backdrop-blur-md` is not supported in React Native)

The amount updates reactively: `totalAmount / activeParticipantCount`

## Step 5: "Who Paid?" Section

1. **Title:** "Who Paid?" — `font-headline text-xl font-bold`
2. **Payer card:** `bg-white rounded-3xl p-5 shadow-sm border border-surface-variant`
   - Left: Avatar (48x48, `rounded-2xl ring-4 ring-primary/10`)
   - Center: Name (bold) + "Primary Payer" subtitle
   - Right: Amount in primary bold + "Change" edit link
3. **Interaction:** Tapping "Change" opens a participant picker bottom sheet

## Step 6: Mode Switcher (Basic ↔ Advanced)

Add a segmented control / pill toggle between the hero and participant sections:

1. Two options: "Equal Split" and "Custom Split"
2. **Container:** `bg-surface-container-high rounded-full p-1`
3. **Active pill:** `bg-primary text-on-primary rounded-full px-6 py-2 font-bold text-sm`
4. **Inactive:** `text-on-surface-variant px-6 py-2`

Switching to "Custom Split" reveals the advanced features (Step 7).

## Step 7: Advanced Split — Shared Items Section

Only visible in "Custom Split" mode. Based on the "Advanced Expense Splitting" mockup.

### Shared Items List:
- Section title: "Shared Items" with item count
- Each item card:
  - Item name + price
  - Participant avatars showing who shares this item
  - Toggle to include/exclude from split
- "Add Item" button to manually add items

### Per-Participant Custom Amounts:
Replace the equal-split participant grid with editable amount fields:

Each participant row shows:
- Avatar + name
- Editable amount input field
- Percentage of total
- Include/exclude toggle

The split summary card updates to show individual amounts instead of a single "each" amount.

### Auto-Balance Feature:
- A button to auto-distribute remaining amount equally among participants who don't have a custom amount set
- Visual indicator when amounts don't add up to the total (warning state)

## Step 8: Save Split Action

Bottom CTA button (matching both mockups):

1. **Style:** `w-full bg-primary text-on-primary font-headline font-black py-5 rounded-3xl shadow-lg shadow-primary/30`
2. **Label:** "Save Split" with `receipt_long` icon
3. **Action:**
   - Validate that amounts add up to the total
   - Create an `Expense` record in the store
   - Associate with a trip if in trip context
   - Navigate back or show success state

## Step 9: State Management

> **Note:** Plan 1 scaffolds a minimal `splitStore.ts` placeholder. This step **replaces** that scaffold with the full implementation.

Create `src/stores/splitStore.ts`:

```typescript
interface SplitState {
  totalAmount: number;
  splitMode: "equal" | "custom";
  participants: Array<{
    id: string;
    name: string;
    avatarUri: string;
    isIncluded: boolean;
    customAmount?: number;
  }>;
  paidBy: string;
  sharedItems: Array<{
    name: string;
    price: number;
    sharedBy: string[];
  }>;

  // Actions
  setTotalAmount: (amount: number) => void;
  toggleParticipant: (id: string) => void;
  setSplitMode: (mode: "equal" | "custom") => void;
  setPaidBy: (id: string) => void;
  setCustomAmount: (participantId: string, amount: number) => void;
  addSharedItem: (item: { name: string; price: number }) => void;
  getPerPersonAmount: () => number;
  saveSplit: () => void;
}
```

## Step 10: Validation & Edge Cases

1. At least 2 participants must be sharing
2. Total amount must be > 0
3. In custom mode, warn if individual amounts don't sum to the total
4. Handle currency formatting consistently (2 decimal places)
5. Payer must be one of the trip participants

---

## Deliverables Checklist

- [ ] Split tab renders with empty state or active split
- [ ] Hero amount section with editable total
- [ ] Participant selection grid with toggle interaction
- [ ] Split summary card with reactive calculation
- [ ] "Who Paid?" section with payer selection
- [ ] Mode switcher between Equal and Custom
- [ ] Advanced: shared items section
- [ ] Advanced: per-participant custom amounts
- [ ] Save Split button validates and persists to store
- [ ] Split store with full state management
- [ ] Edge case validation (min participants, amount mismatch)
