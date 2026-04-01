# Plan 9: Trip Management

> **Prerequisite:** Plan 5 (Data Layer), Plan 7 (Expense Splitting — for split integration).

This plan covers the entire Trips tab with 5 interconnected sub-screens: the trip list, trip detail, carpool detail, settlement screen, and the "Who Brings What" planner. Real-time sync is wired via `startTripSync(tripId)` / `stopTripSync(tripId)` from `syncService`. Also includes carpool creation — a modal form for adding new carpools to a trip.

> **NativeWind v5 import rule:** Import `View`, `Text`, `ScrollView`, `Pressable`, `TextInput` from `@/tw` (not `react-native`). Import `Image` from `@/tw/image`. Raw React Native components silently ignore `className`.
>
> **No `expo-linear-gradient`:** Use `experimental_backgroundImage` CSS gradients on `View`.
>
> **Rounded containers:** Add `borderCurve: 'continuous'` to `style` on any rounded View.
>
> **Safe area:** Use `contentInsetAdjustmentBehavior="automatic"` on `ScrollView`/`FlatList`.
>
> **Shadow:** Use `boxShadow` CSS strings (e.g., `style={{ boxShadow: '0 4px 12px rgba(2, 186, 65, 0.4)' }}`), not legacy `shadowColor`/`shadowOffset` props.
>
> **`expo-blur`:** `BlurView` from `expo-blur ~15.0.8` is installed. It only works on native — use `process.env.EXPO_OS === 'web'` to render a plain semi-transparent `View` fallback on web.
>
> **No toast utility:** Use `Alert.alert()` from `react-native` for all user-facing messages.

---

## Context

- `formatCurrency(amount)` and `formatDate(dateString)` are available from `src/utils/format.ts`.
- `useTripStore` now holds `trips: Record<string, Trip>`. Use `getAllTrips()` or `Object.values(trips)` for list rendering.
- The `optimizeSettlements(participants, tripId)` function is available from `src/services/settlementService.ts` (Plan 05).
- The trip creation route (`app/trips/new.tsx`) is implemented in Plan 10.
- **Split integration (Plan 07):** `useSplitStore` exposes `loadFromTrip(participants: TripParticipant[])`. When navigating into a trip detail screen, call this to seed the Split tab with that trip's real participants. Call it in the same `useEffect` that starts sync:
  ```typescript
  import { useSplitStore } from "@/stores/splitStore";
  useEffect(() => {
    startTripSync(tripId);
    const trip = useTripStore.getState().getTrip(tripId);
    if (trip) useSplitStore.getState().loadFromTrip(trip.participants);
    return () => stopTripSync(tripId);
  }, [tripId]);
  ```

---

## Implementation Notes — What Changed

The following sections describe the design spec. During implementation, the following divergences from the original spec were made:

### Store selectors added to `tripStore.ts`

5 derived selectors were added (not in original spec but required by the screens):
- `getCarpools(tripId)` → `Carpool[]` (or `[]`)
- `getExpenses(tripId)` → `Expense[]` (or `[]`)
- `getSettlements(tripId)` → `SettlementTransaction[]` (or `[]`)
- `getPlannerItems(tripId)` → `PlannerItem[]` (or `[]`)
- `getPlannerProgress(tripId)` → `{ total, assigned, percentage }`

All TDD-tested in `src/stores/__tests__/tripStore.test.ts` (11 new tests).

### Service functions added to `tripService.ts`

- `createCarpool(tripId, data)` — writes to `trips/{tripId}/carpools/{carpoolId}` subcollection. TDD-tested (2 tests).
- `claimPlannerItem(tripId, itemId)` — sets `assignedTo: uid, status: "assigned"`. TDD-tested (2 tests).
- `unclaimPlannerItem(tripId, itemId)` — clears `assignedTo: null, status: "unassigned"`. TDD-tested (1 test).
- `sendReminder(tripId, toParticipantId)` — no-op stub for future FCM Cloud Function. TDD-tested (1 test).

The original spec referenced `tripService.updatePlannerItem` — this was split into the more specific `claimPlannerItem`/`unclaimPlannerItem` pair.

### MaterialIcon mappings added

6 new icon mappings in `src/components/MaterialIcon.tsx`:

| Mockup name | Community icon | Used in |
|---|---|---|
| `route` | `road-variant` | Carpool stats |
| `eco` | `leaf` | Eco impact card |
| `toll` | `boom-gate` | Quick action |
| `local_parking` | `parking` | Quick action |
| `camping` | `tent` | Planner category |
| `add_road` | `road-variant` | Trip detail FAB |

### Carpool creation (not in original spec)

The original spec left carpool creation as an undefined "bottom sheet or separate screen." This was implemented as:
- `app/trips/carpool-new.tsx` — root-level modal (matching `trips/new.tsx` pattern)
- Registered in `app/_layout.tsx` with `presentation: "modal"`
- FAB on Trip Detail navigates to `/trips/carpool-new?tripId=...`

### Settlement screen BlurView

`BlurView` from `expo-blur` is used in the "Your Share" card. A required web fallback renders a plain `View` with `backgroundColor: "rgba(255,255,255,0.2)"` when `process.env.EXPO_OS === 'web'`.

### Ghost participant reminders

- **AppUser participants:** `sendReminder()` stub called + `Alert.alert("Reminder Sent", ...)` shown to user
- **Ghost participants (`isGhost === true`):** React Native `Share.share()` opens the native share sheet with a pre-filled message

---

## Screen Map

```
Trips Tab
├── Trip List (app/(tabs)/trips/index.tsx)
│   └── Trip Detail (app/(tabs)/trips/[tripId].tsx)
│       ├── Carpool Detail (app/(tabs)/trips/carpool/[carpoolId].tsx)
│       ├── Settlement & Balances (app/(tabs)/trips/settlement.tsx)
│       └── Trip Planner: Who Brings What (app/(tabs)/trips/planner.tsx)
│
Modal Routes (registered in app/_layout.tsx)
├── Carpool Creation (app/trips/carpool-new.tsx)  ← Plan 09
└── Trip Creation (app/trips/new.tsx)             ← Plan 10
```

---

## Part A0: Trip List Screen

File: `app/(tabs)/trips/index.tsx`

Entry point for the Trips tab. Shows all trips the current user belongs to.

### Step A0.1: Screen Layout

- `ScrollView` with `contentInsetAdjustmentBehavior="automatic"`
- `TopAppBar` at the top
- Page title: "My Trips" — `text-4xl font-extrabold text-on-surface`
- Subtitle: "Shared adventures, settled together."

### Step A0.2: Trip Card

Each trip renders as a `Card` (`variant="low"`, `rounded="2xl"`, `bordered`) with:
1. Trip name — `font-bold text-lg text-on-surface`
2. Date range — `text-sm text-on-surface-variant`
3. Duration pills: Travelers count (`bg-secondary-container`) + Nights count (`bg-primary-container`)
4. Participant avatars — `AvatarStack` component (max 4 visible)
5. Total spend — `text-primary font-bold text-base` aligned right
6. Pending write: if `_pendingWrite`, show `ActivityIndicator`

Tapping navigates to `router.push(`/(tabs)/trips/${trip.id}`)`.

### Step A0.3: Empty State

- `MaterialIcon` "folder_shared" at 40px in a `w-20 h-20 bg-surface-container rounded-full` container
- "No Trips Yet" — `font-semibold text-xl text-on-surface`
- "Create a trip to start splitting expenses with friends" — `text-sm text-on-surface-variant text-center`
- "Create First Trip" button (`bg-primary rounded-full`) → `router.push('/trips/new')`

### Step A0.4: FAB

- `absolute bottom-6 right-6`, `bg-primary rounded-full w-14 h-14` with `add` icon
- `style={{ boxShadow: '0 4px 12px rgba(2, 186, 65, 0.4)' }}`
- Navigates to `router.push('/trips/new')`

### Step A0.5: Data source

```typescript
const getAllTrips = useTripStore(state => state.getAllTrips);
const trips = getAllTrips().sort(
  (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
);
```

---

## Part A: Trip Detail Screen

File: `app/(tabs)/trips/[tripId].tsx`

### Sync lifecycle + Split integration

```typescript
import { startTripSync, stopTripSync } from "@/services/syncService";
import { useSplitStore } from "@/stores/splitStore";

useEffect(() => {
  if (!tripId) return;
  startTripSync(tripId);
  const t = useTripStore.getState().getTrip(tripId);
  if (t) useSplitStore.getState().loadFromTrip(t.participants);
  return () => stopTripSync(tripId);
}, [tripId]);
```

### Step A1: Hero Section

1. Context label: `trip.name` — `text-xs uppercase tracking-widest text-on-surface-variant font-extrabold`
2. Total amount: `formatCurrency(trip.totalPot)` — `font-extrabold tracking-tighter`
   - Uses `useWindowDimensions` to scale font size: 64px on tablets (≥768), 48px on phones
3. Info pills row:
   - Travelers: `bg-secondary-container rounded-full` — "N Travelers" with `group` icon
   - Duration: `bg-primary-container rounded-full` — "N Days" with `calendar_today` icon

### Step A2: Active Carpools Section

1. Header: "Active Carpools" + "View All" link
2. Horizontal scroll of carpool cards (280px min-width, 176px min-height):
   - "CARPOOL" label with `directions_car` icon
   - Title (carpool name) + route subtitle
   - Bottom stats: distance, cost, passenger avatars
   - `bg-surface-container-lowest rounded-2xl border border-outline/10 p-5`
3. Tapping navigates to `/(tabs)/trips/carpool/${carpool.id}`

### Step A3: Eco Impact Card

1. `bg-primary text-on-primary p-6 rounded-2xl` with green box shadow
2. "Eco Impact" uppercase label + "Saved 1.2 Tons CO₂" headline
3. Progress bar: `rgba(255,255,255,0.2)` container with white fill
4. Subtitle: "Carpooling reduced fuel costs by 42%."
5. Decorative faded `eco` icon in bottom-right (`opacity: 0.12`)

### Step A4: Recent Receipts Section

1. Header: "Recent Receipts"
2. `bg-surface-container-low rounded-2xl border border-outline/10` with dividers
3. Each row: `receipt_long` icon in `bg-primary-container`, description + payer/split info, amount
4. Shows first 5 expenses from `getExpenses(tripId)`

### Step A5: Settlement Summary

1. Two cards in 2-column grid:
   - "You Owe" card: `border-l-4 border-l-error` — amount + "Tap to settle up"
   - "Owed to You" card: `border-l-4 border-l-primary` — amount + "Tap to remind"
2. Tapping either navigates to the Settlement screen with `{ pathname, params: { tripId } }`

### Step A6: FAB — Carpool Creation

- `bg-primary rounded-2xl w-14 h-14`, icon: `add_road`
- Navigates to `/trips/carpool-new?tripId=...` (root-level modal)

---

## Part A-Extra: Carpool Creation Modal

File: `app/trips/carpool-new.tsx` (root-level, registered in `app/_layout.tsx` with `presentation: "modal"`)

### Form Sections

**Section 1 — Carpool Details:**
- Name input (`TextInput`, placeholder "e.g. Highway 1 Road Trip")
- Route input (placeholder "e.g. San Francisco → Big Sur")
- Distance + Fuel Cost side by side (`keyboardType="decimal-pad"`)
- All inputs: `bg-surface-container-low rounded-2xl px-4 py-4 text-on-surface font-semibold`

**Section 2 — Passengers:**
- Shows all trip participants as toggleable cards
- Selected participants get `bg-primary-container border-primary/30` styling + green check avatar
- Each selected participant has an inline role picker with 3 pill buttons: Driver / Nav / Rider
- Status line: "N selected · ✓ driver" or "⚠ need a driver"

**Per-person preview:** Shown when passengers selected + fuel cost entered — `$XX.XX` per person (equal split)

### Validation
- Name and route required
- Distance > 0, fuel cost > 0
- At least 2 passengers selected
- At least 1 driver assigned

### Save action
```typescript
import { createCarpool } from "@/services/tripService";

const passengers: CarpoolPassenger[] = selected.map(s => ({
  participantId: s.participantId,
  role: s.role,
  amountOwed: Math.round(perPerson * 100) / 100,
  settled: false,
}));
await createCarpool(tripId, { name, route, distance, fuelCost, passengers });
router.back(); // listenToCarpools picks up the new doc automatically
```

---

## Part B: Carpool Detail Screen

File: `app/(tabs)/trips/carpool/[carpoolId].tsx`

### Step B1: Navigation Header

Back button + "Trip Intelligence" title in primary + settings icon

### Step B2: Editorial Header

1. Context: trip name — small uppercase primary label
2. Title: carpool name — `text-4xl font-extrabold`
3. Status badge: "ACTIVE VOYAGE" — `bg-primary-container rounded-lg` with `check_circle` icon

### Step B3: Stats Bento Grid (flex layout)

**Distance card (flex: 2):**
- `bg-surface-container-low rounded-2xl p-5 min-h-[160px] border border-outline/10`
- "Total Distance" label + `route` icon
- Distance value in large font + route description

**Fuel cost card (flex: 1):**
- CSS gradient: `experimental_backgroundImage: 'linear-gradient(135deg, #02ba41, #026b25)'`
- "Fuel Expense" label + amount + budget progress bar

**Per person card (full width):**
- Shows `fuelCost / passengers.length`

### Step B4: Quick Actions Row

Three buttons:
- "Add Toll" — `bg-secondary-container` with `toll` icon
- "Add Parking" — `bg-secondary-container` with `local_parking` icon
- "Sync" — `bg-primary` with `sync` icon

### Step B5: Passenger Split Section

1. Header: "Passenger Split" + "Per Person: $XX.XX" on the right
2. `bg-surface-container-low rounded-2xl border border-outline/10` with dividers
3. Passenger rows:
   - Avatar (driver = `directions_car` icon, others = `person` icon) in `bg-primary-container`
   - Name + role label ("Primary Driver", "Navigator", "Passenger")
   - Amount per person + `StatusPill` ("Settled" / "Pending")

### Step B6: Trip Map Preview

Placeholder `View` (no `react-native-maps` dependency):
- `rounded-2xl overflow-hidden h-48 border border-outline/10`
- Background: `experimental_backgroundImage: 'linear-gradient(160deg, #d5e8cf, #bcebf1)'`
- Dark gradient overlay at bottom
- "Next Stop: Base Camp" text + "Live Tracking" badge with green dot

---

## Part C: Trip Settlement & Balances Screen

File: `app/(tabs)/trips/settlement.tsx` (receives `tripId` via query params)

### Step C1: Hero Section

1. Breadcrumb: "Trips > [trip name]"
2. Title: "Settlement" — `text-4xl font-extrabold`
3. Subtitle: "Finalizing the books for your [N]-day journey."
4. Status indicator: green dot + "Settlement Active" text

### Step C2: Trip Pot Summary Card

1. `bg-surface-container-low border border-outline/10 rounded-2xl p-6`
2. "Total Trip Pot" label + total amount in large primary text + `receipt_long` icon
3. Category breakdown grid: flex-wrap row of `bg-surface-container-lowest rounded-lg border p-3` cards

### Step C3: Your Share Card

1. `bg-primary text-on-primary rounded-2xl p-6` with green box shadow
2. "Your Personal Share" label + your share amount (large)
3. Frosted glass detail section:
   - **Native:** `BlurView` from `expo-blur` (intensity 20, tint "light")
   - **Web fallback:** Plain `View` with `backgroundColor: "rgba(255,255,255,0.2)"`
   - Shows "Paid by You" + "Net Refund/Owed" rows

### Step C4: Optimized Settlement Transactions

```typescript
import { optimizeSettlements } from "@/services/settlementService";
const transactions = optimizeSettlements(trip.participants, trip.id);
```

1. Header: "Optimization Logic" with `border-l-4 border-primary pl-4`
2. Badge: "M Transactions Needed" (`bg-primary-container rounded-full`)
3. Transaction cards with status-dependent styling:

| Status | Styling |
|--------|---------|
| Pending | `bg-surface-container-low border border-outline/10` |
| Incoming (to you) | `border-l-4 border-primary` + box shadow |
| Settled | `opacity: 0.6` |

Row content: From → To arrows, amount, status dot, action button

4. "Remind" actions:
   - **AppUser:** calls `sendReminder()` stub + `Alert.alert("Reminder Sent", ...)`
   - **GhostParticipant (`isGhost === true`):** `Share.share()` with pre-filled message
5. Empty state: green check icon + "All Settled!" when no transactions

### Step C5: Individual Balance Sheets

1. Title: "Individual Balance Sheets" with `border-l-4 border-primary pl-4`
2. Flex-wrap grid of balance cards:
   - Avatar initials circle in `bg-primary-container`
   - Spent / Owes / Balance rows
   - Positive balance: `text-primary font-bold`
   - Negative balance: `text-error font-bold`

---

## Part D: Trip Planner — Who Brings What

File: `app/(tabs)/trips/planner.tsx` (receives `tripId` via query params)

### Step D1: Hero Section

1. "Trip Planner" uppercase label in primary
2. Trip name — `text-4xl font-extrabold`
3. "Who Brings What: Essential Logistics" subtitle
4. `AvatarStack` showing trip participants

### Step D2: Category Sections — Bento Grid

Use `flexDirection: "row"` + `flexWrap: "wrap"` (not CSS grid, not `md:` prefixes):

**Camping Gear (large, ~66% width):**
- `bg-surface-container rounded-3xl p-5` with `flex: 2`
- `camping` icon + "Camping Gear" title + item count pill + progress bar

**Navigation (side, ~33% width):**
- `bg-tertiary text-on-tertiary rounded-3xl p-5` with `flex: 1`
- Decorative circle in top-right: `rgba(255,255,255,0.1)` circle
- Progress bar with `onTertiary` color

**Food & Snacks (full width):**
- `bg-surface-container rounded-3xl p-5` with `width: "100%"`
- 3-column card grid using `flexDirection: "row"` + `flexWrap: "wrap"` with `flex: 1` per card

Each category shows a progress bar and progress percentage.

### Step D3: Item Cards

Three states:

**Assigned item (current user):**
- `check_circle` green icon
- Item name + description
- "Brought By You ✓" — tappable to unclaim

**Unassigned item:**
- `check_circle_outline` outline icon
- Item name + description
- "Claim Item" `bg-primary rounded-lg` button

**Assigned to someone else:**
- `person` icon in secondary color
- "Assigned To [id]" label

All cards: `bg-surface-container-lowest rounded-xl border border-outline/10 p-4`

### Step D4: Progress Summary Banner

Full-width card at bottom:
- `bg-primary rounded-3xl p-6 text-on-primary` with green box shadow
- Left: `ProgressRing` showing percentage complete
- Right: "Ready for Adventure?" headline + unassigned item count
- Two buttons: "See All Open Items" (`bg-on-primary text-primary`) + "Remind Everyone" (`border border-on-primary/40`)

### Step D5: Item Claiming Flow

1. Tapping "Claim Item" calls `claimPlannerItem(tripId, itemId)` from `tripService`
2. Tapping "Brought By You ✓" calls `unclaimPlannerItem(tripId, itemId)`
3. Both use optimistic local state via `useState` refresh counter
4. Error handling: `Alert.alert("Error", "Could not claim item.")`

### Step D6: Tablet Navigation Drawer

Detect tablet via `useWindowDimensions` — show a sidebar drawer when `width >= 768`:
- Always-visible `View` column on the left (`width: 240`, `bg-surface-container-low border-r`)
- Navigation links: Personal Ledger, Trip History, Trip Planner, Currency Settings
- Each link: `MaterialIcon` + label in a `rounded-xl px-3 py-2.5` pressable

---

## Deliverables Checklist

### Store & Service Layer (TDD)
- [x] `tripStore.ts` — 5 derived selectors: `getCarpools`, `getExpenses`, `getSettlements`, `getPlannerItems`, `getPlannerProgress`
- [x] `tripStore.test.ts` — 11 new tests (all green)
- [x] `tripService.ts` — `createCarpool`, `claimPlannerItem`, `unclaimPlannerItem`, `sendReminder`
- [x] `tripService.test.ts` — 6 new tests (all green)
- [x] `MaterialIcon.tsx` — 6 new icon mappings (`route`, `eco`, `toll`, `local_parking`, `camping`, `add_road`)

### Part A0: Trip List
- [x] `app/(tabs)/trips/index.tsx` — list of all trips, card UI, empty state, FAB

### Part A: Trip Detail
- [x] `app/(tabs)/trips/[tripId].tsx` — `startTripSync` / `stopTripSync` + `loadFromTrip` in `useEffect`
- [x] Hero section with dynamic trip name + spend
- [x] Horizontal carpool card scroll
- [x] Eco impact card
- [x] Recent receipts list (first 5 expenses)
- [x] Settlement summary cards (2-column grid)
- [x] FAB navigates to carpool creation modal

### Part A-Extra: Carpool Creation
- [x] `app/trips/carpool-new.tsx` — modal form with participant picker + role selector
- [x] `trips/carpool-new` registered in `app/_layout.tsx` with `presentation: "modal"`
- [x] `createCarpool()` in `tripService.ts` (TDD-tested)

### Part B: Carpool Detail
- [x] `app/(tabs)/trips/carpool/[carpoolId].tsx` — stats bento grid, quick actions, passenger split, map placeholder

### Part C: Settlement
- [x] `app/(tabs)/trips/settlement.tsx` — pot summary, your share (BlurView + web fallback), transaction rows from `optimizeSettlements`
- [x] "Remind" action: `sendReminder` stub + `Alert.alert` for AppUser, `Share.share()` for ghost
- [x] Individual balance sheets grid

### Part D: Trip Planner
- [x] `app/(tabs)/trips/planner.tsx` — flex-based bento grid
- [x] Three item card variants (assigned/unassigned/other)
- [x] `claimPlannerItem` / `unclaimPlannerItem` interaction
- [x] `ProgressRing` in progress summary banner
- [x] Tablet navigation drawer (`width >= 768`)

### Verification
- [x] `npx jest` — 204/204 tests passing
- [x] `npx tsc --noEmit` — 0 type errors
