# Plan 9: Trip Management

> **Prerequisite:** Plan 5 (Data Layer), Plan 7 (Expense Splitting — for split integration).

This plan covers the entire Trips tab with 5 interconnected sub-screens: the trip list, trip detail, carpool detail, settlement screen, and the "Who Brings What" planner. Real-time sync is wired via `startTripSync(tripId)` / `stopTripSync(tripId)` from `syncService`.

> **NativeWind v5 import rule:** Import `View`, `Text`, `ScrollView`, `Pressable`, `TextInput` from `@/tw` (not `react-native`). Import `Image` from `@/tw/image`. Raw React Native components silently ignore `className`.
>
> **No `expo-linear-gradient`:** Use `experimental_backgroundImage` CSS gradients on `View`.
>
> **Rounded containers:** Add `borderCurve: 'continuous'` to `style` on any rounded View.
>
> **Safe area:** Use `contentInsetAdjustmentBehavior="automatic"` on `ScrollView`/`FlatList`.
>
> **Shadow:** Use `boxShadow` CSS strings (e.g., `style={{ boxShadow: '0 4px 12px rgba(2, 186, 65, 0.4)' }}`), not legacy `shadowColor`/`shadowOffset` props.

---

## Context

- `formatCurrency(amount)` and `formatDate(dateString)` are available from `src/utils/format.ts`.
- `useTripStore` now holds `trips: Record<string, Trip>`. Use `getAllTrips()` or `Object.values(trips)` for list rendering.
- The `optimizeSettlements(participants, tripId)` function is available from `src/services/settlementService.ts` (Plan 05).
- The trip creation route (`app/trips/new.tsx`) is implemented in Plan 10.

---

## Screen Map

```
Trips Tab
├── Trip List (app/(tabs)/trips/index.tsx)
│   └── Trip Detail (app/(tabs)/trips/[tripId].tsx)
│       ├── Carpool Detail (app/(tabs)/trips/carpool/[carpoolId].tsx)
│       ├── Settlement & Balances (app/(tabs)/trips/settlement.tsx)
│       └── Trip Planner: Who Brings What (app/(tabs)/trips/planner.tsx)
```

---

## Part A0: Trip List Screen

File: `app/(tabs)/trips/index.tsx`

Entry point for the Trips tab. Shows all trips the current user belongs to.

### Step A0.1: Screen Layout

- `ScrollView` with `contentInsetAdjustmentBehavior="automatic"`
- `TopAppBar` at the top
- Page title: "My Trips" — `text-2xl font-bold text-on-surface`

### Step A0.2: Trip Card

Each trip renders as a `Card` (`variant="low"`, `rounded="2xl"`) with:
1. Trip name — `font-bold text-lg text-on-surface`
2. Date range — `text-sm text-on-surface-variant` (e.g., "Jul 10 – Jul 20, 2026")
3. Participant avatars — `AvatarStack` component (max 4 visible + "+N" count)
4. Total spend — `text-primary font-bold text-base` aligned right
5. Pending write: if `_pendingWrite`, show spinning `sync` icon

Tapping navigates to `router.push(`/(tabs)/trips/${trip.id}`)`.

### Step A0.3: Empty State

- `MaterialIcon` "folder_shared" at 80px in `text-on-surface-variant`
- "No Trips Yet" — `font-semibold text-xl text-on-surface`
- "Create a trip to start splitting expenses with friends" — `text-sm text-on-surface-variant text-center`
- "Create First Trip" button → `router.push('/trips/new')`

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

### Sync lifecycle

```typescript
import { startTripSync, stopTripSync } from "@/services/syncService";

useEffect(() => {
  startTripSync(tripId);
  return () => stopTripSync(tripId);
}, [tripId]);
```

### Step A1: Hero Section

1. Context label: `trip.name` — `text-xs uppercase tracking-widest text-on-surface-variant font-bold`
2. Total amount: `formatCurrency(trip.totalPot)` — `text-5xl font-extrabold tracking-tighter`
   - Use `useWindowDimensions` to scale font size on tablets (breakpoint: 768px)
3. Info pills row:
   - Travelers: `bg-secondary-container rounded-full` — "N Travelers" with `group` icon
   - Duration: `bg-primary-container rounded-full` — "N Days" with `calendar_today` icon

### Step A2: Active Carpools Section

1. Header: "Active Carpools" + "View All" link
2. Horizontal scroll of carpool cards (280px min-width):
   - Title (route name) + subtitle + car icon
   - Bottom stats grid (3 columns): Miles | Cost | Passenger avatars
   - `bg-surface-container-lowest p-6 rounded-2xl border shadow-sm h-44`
3. Tapping navigates to Carpool Detail

### Step A3: Eco Impact Card

1. `bg-primary text-on-primary p-8 rounded-2xl shadow-lg shadow-primary/20`
2. "Eco Impact" label + "Saved 1.2 Tons CO2" headline
3. Progress bar: `bg-on-primary/20` container with white fill
4. Subtitle: "Carpooling reduced fuel costs by 42%."
5. Decorative faded `eco` icon in bottom-right

### Step A4: Recent Receipts Section

1. Header: "Recent Receipts" + filter pills ("Shopping", "Dining")
2. `bg-surface-container-low rounded-2xl border` with dividers
3. Each row: category icon, merchant + "Paid by [name] · [date]", amount + "Shared by N"
4. Tapping navigates to receipt detail

### Step A5: Settlement Summary

1. Two cards in 2-column grid:
   - "You owe" card: `border-l-4 border-l-error` — "You owe [name] $X" + "Pay Now" button
   - "Owed to you" card: `border-l-4 border-l-primary` — "[name] owes you $X" + "Remind" link
2. Tapping either navigates to the Settlement screen

### Step A6: FAB

- `bg-primary rounded-2xl shadow-2xl w-14 h-14`, icon: `add_road`
- Opens "New Carpool" form (bottom sheet or separate screen)

---

## Part B: Carpool Detail Screen

File: `app/(tabs)/trips/carpool/[carpoolId].tsx`

### Step B1: Navigation Header

Back button + "Trip Intelligence" title in primary + settings icon + user avatar

### Step B2: Editorial Header

1. Context: trip name — small uppercase primary label
2. Title: carpool name — `text-4xl font-extrabold`
3. Status badge: "ACTIVE VOYAGE" — `bg-primary-container rounded-lg` with verified checkmark

### Step B3: Stats Bento Grid (3 columns)

**Distance card (2 columns wide):**
- `bg-surface-container-low rounded-xl p-6 min-h-[160px] border`
- "Total Distance" label + `route` icon
- `450 miles` in large font + route description

**Fuel cost card (1 column):**
- CSS gradient on View: `style={{ experimental_backgroundImage: 'linear-gradient(135deg, #02ba41, #026b25)' }}`
- "Fuel Expense" label + amount + budget progress bar

### Step B4: Quick Actions Row

Three buttons:
- "Add Toll" — secondary with `toll` icon
- "Add Parking" — secondary with `local_parking` icon
- "Sync with Expenses" — primary with `sync` icon

### Step B5: Passenger Split Section

1. Header: "Passenger Split" + "Per Person: $XX.XX" on the right
2. Passenger rows:
   - Avatar (48x48) with optional driver badge overlay
   - Name + role label ("Primary Driver", "Navigator", "Passenger")
   - Amount per person + `StatusPill` ("Settled" / "Pending")

### Step B6: Trip Map Preview

Placeholder for a future `react-native-maps` MapView:
- `rounded-2xl overflow-hidden h-48 border`
- Landscape placeholder image with dark gradient overlay
- "Next Stop: [location]" text at bottom
- "Live Tracking" badge with pulsing green dot at top-right

---

## Part C: Trip Settlement & Balances Screen

File: `app/(tabs)/trips/settlement.tsx`

### Step C1: Hero Section

1. Breadcrumb: "Trips > [trip name]"
2. Title: "Settlement" — `text-4xl font-extrabold`
3. Subtitle: "Finalizing the books for your [N]-day journey."
4. Status pill: "Settlement Active" with pulsing green dot

### Step C2: Trip Pot Summary Card

1. `bg-surface-container-low border rounded-xl p-8`
2. "Total Trip Pot" label + total amount in large primary text + `receipt_long` icon
3. Bottom grid (4 columns): Category breakdowns
   - Each in `bg-surface-container-lowest rounded-lg border p-4`

### Step C3: Your Share Card

1. `bg-primary text-on-primary rounded-xl p-8 shadow-lg`
2. "Your Personal Share" label + your share amount
3. Bottom section:
   - "Paid by You: $X"
   - "Net Refund / Net Owed: $X" in a frosted glass container — use `BlurView` from `expo-blur` with `bg-white/20`

### Step C4: Optimized Settlement Transactions

Display transactions from `optimizeSettlements(trip.participants, trip.id)`:

```typescript
import { optimizeSettlements } from "@/services/settlementService";

const trip = useTripStore(state => state.getTrip(tripId));
const transactions = trip ? optimizeSettlements(trip.participants, trip.id) : [];
```

1. Header: "Optimization Logic" + subtitle "Our algorithm reduced N potential debts into M direct transfers."
2. Badge: "M Transactions Needed"
3. Transaction rows:

| Status | Styling |
|--------|---------|
| Pending | Standard card with `border border-outline-variant/10` |
| Incoming (to you) | `border-l-4 border-primary shadow-sm` |
| Settled | `opacity-60` |

Row content: From → To arrows, amount, status dot, action button ("Notify" / "Wait" / settled check)

**"Remind" action for AppUser participants:** Send an FCM push notification.
**"Remind" action for GhostParticipants (where `isGhost === true`):** Show a share sheet with a pre-filled message the managing AppUser can send via SMS/WhatsApp.

### Step C5: Individual Balance Sheets

1. Title: "Individual Balance Sheets" with `border-l-4 border-primary pl-4`
2. 3-column grid of balance cards:
   - Each card: avatar initials circle, Spent / Owed / Balance rows
   - Positive balance: `text-primary font-bold`
   - Negative balance: `text-error font-bold`

---

## Part D: Trip Planner — Who Brings What

File: `app/(tabs)/trips/planner.tsx`

### Step D1: Hero Section

1. "Trip Planner" uppercase label in primary
2. Trip name — `text-4xl font-extrabold`
3. "Who Brings What: Essential Logistics" subtitle
4. `AvatarStack` showing trip participants

### Step D2: Category Sections — Bento Grid

Use `flexDirection: "row"` + `flexWrap: "wrap"` (not CSS grid, not `md:` prefixes):

**Camping Gear (large, ~66% width):**
- `bg-surface-container rounded-3xl p-6` with `flex: 2`
- `camping` icon + "Camping Gear" title + item count pill

**Navigation (side, ~33% width):**
- `bg-tertiary text-on-tertiary rounded-3xl p-6 shadow-xl` with `flex: 1`
- Decorative circle in top-right: `bg-white/10 rounded-full` (no blur needed — decorative only)
- Progress bar: "Progress 50%"

**Food & Snacks (full width):**
- `bg-surface-container rounded-3xl p-6` with `width: "100%"`
- 3-column card grid using `flexDirection: "row"` with `flex: 1` per card

### Step D3: Item Cards

Three states:

**Assigned item (current user):**
- Green check circle icon
- Item name + description
- "Brought By [name]" label + avatar

**Unassigned item:**
- Empty circle icon
- Item name + description
- "Claim Item" primary button

**Assigned to someone else:**
- Person icon
- "Assigned To [name]" label + avatar

### Step D4: Progress Summary Banner

Full-width card at bottom:
- `bg-primary rounded-3xl p-8 text-on-primary shadow-2xl`
- Left: `ProgressRing` (shared `src/components/ProgressRing.tsx`) showing % complete
- Right: "Ready for Adventure?" headline + unassigned item count
- Two buttons: "See All Open Items" (white bg) + "Remind Everyone" (transparent with border)

### Step D5: Item Claiming Flow

1. Tapping "Claim Item" assigns the item to the current user
2. Calls `tripService.updatePlannerItem` (or equivalent store action) to write to Firestore
3. Update the item card to show the assigned state
4. Recalculate the progress percentage

### Step D6: Tablet Navigation Drawer

Detect tablet via `useWindowDimensions` — show a sidebar drawer when `width >= 768`:
- Always-visible `View` column on the left
- User profile card, navigation links (Personal Ledger, Trip History, Trip Planner, Currency Settings)

---

## Deliverables Checklist

### Part A0: Trip List
- [ ] `app/(tabs)/trips/index.tsx` — list of all trips, card UI, empty state, FAB

### Part A: Trip Detail
- [ ] `app/(tabs)/trips/[tripId].tsx` — `startTripSync` / `stopTripSync` in `useEffect`
- [ ] Hero section with dynamic trip name + spend
- [ ] Horizontal carpool card scroll
- [ ] Eco impact card
- [ ] Recent receipts list
- [ ] Settlement summary cards
- [ ] FAB for adding carpool

### Part B: Carpool Detail
- [ ] `app/(tabs)/trips/carpool/[carpoolId].tsx` — stats bento grid, quick actions, passenger split, map placeholder

### Part C: Settlement
- [ ] `app/(tabs)/trips/settlement.tsx` — pot summary, your share, transaction rows from `optimizeSettlements`
- [ ] "Remind" action: FCM for AppUser, share sheet for ghost (`isGhost === true`)
- [ ] Individual balance sheets grid

### Part D: Trip Planner
- [ ] `app/(tabs)/trips/planner.tsx` — flex-based bento grid (not CSS grid)
- [ ] Three item card variants
- [ ] Claim item interaction
- [ ] `ProgressRing` in progress summary banner
- [ ] Tablet navigation drawer (`width >= 768`)
