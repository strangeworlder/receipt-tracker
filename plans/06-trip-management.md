# Plan 6: Trip Management

> **Prerequisite:** Plan 1 (Project Foundation), Plan 4 (Expense Splitting — for split integration)

This is the largest plan — it covers the entire Trips tab with 5 interconnected sub-screens. It can be further broken down if needed.

> **NativeWind v5 import rule:** All `View`, `Text`, `ScrollView`, `Pressable`, `TextInput` imports **must** come from `@/tw`, **not** from `react-native`. `Image` imports come from `@/tw/image`. Do not use `expo-linear-gradient` — use CSS `experimental_backgroundImage` gradients instead.

---

## Screen Map

```
Trips Tab
├── Trip List (index — all user trips)        ← NEW Part A0
│   └── Trip Detail (drill-down per trip)     ← renamed from "Trip Summary"
│       ├── Carpool Detail (drill-down)
│       ├── Settlement & Balances (drill-down)
│       └── Trip Planner: Who Brings What (drill-down)
```

---

## Part A0: Trip List Screen (NEW)

File: `app/(tabs)/trips/index.tsx`

This is the entry point for the Trips tab. It shows all trips the current user belongs to. Tapping a trip navigates to the Trip Detail screen (`[tripId].tsx`).

### Step A0.1: Screen Layout

- `ScrollView` with `contentInsetAdjustmentBehavior="automatic"` for safe area handling
- `TopAppBar` at the top (shared component)
- Page title: "My Trips" — `font-headline text-2xl font-bold text-on-surface`

### Step A0.2: Trip Card

Each trip renders as a `Card` component (`variant="low"`, `rounded="2xl"`) with:
1. **Trip name** — `font-headline font-bold text-lg text-on-surface`
2. **Date range** — `text-sm text-on-surface-variant` (e.g. "Jun 12 – Jun 26, 2024")
3. **Participant avatars** — `AvatarStack` component (max 4 visible + "+N" count)
4. **Total spend** — `text-primary font-bold text-base` aligned right
5. **Pending writes indicator** — if `_pendingWrite`, show spinning `sync` icon in `text-on-surface-variant`

Tapping the card navigates to `router.push(`/(tabs)/trips/${trip.id}`)`.

### Step A0.3: Empty State

When the user has no trips:
- Centered illustration (use a simple `MaterialIcon` with `folder_shared`, 80px, `text-on-surface-variant`)
- Heading: "No Trips Yet" — `font-headline font-semibold text-xl text-on-surface`
- Subtext: "Create a trip to start splitting expenses with friends" — `text-sm text-on-surface-variant text-center`
- Primary CTA: "Create First Trip" button → `router.push('/trips/new')`

### Step A0.4: FAB (Floating Action Button)

- Positioned bottom-right: `absolute bottom-6 right-6`
- `bg-primary rounded-full w-14 h-14` with `add` icon in `text-on-primary`
- Shadow: `boxShadow: '0 4px 12px rgba(2, 186, 65, 0.4)'`
- Navigates to `router.push('/trips/new')` (Trip Creation — Plan 11)

### Step A0.5: Data source

Read from `useTripStore`:
```typescript
const trips = useTripStore(state => state.trips);
```

Sort trips by most recent `startDate` descending. `syncService.startTripListSync()` or use the trip IDs from the user profile document to load trip stubs.

> **Note:** For the full data layer (Firestore queries for user's trips), see Plan 09 and Plan 11. In this plan, use mock data from `tripStore`.

---

## Part A: Trip Detail Screen

File: `app/(tabs)/trips/[tripId].tsx`

> **Renamed from "Trip Summary"** — the index route now shows the trip list; this route shows a single trip's details.

### Step A1: Hero Section — Total Spend

### Step A1: Hero Section — Total Spend

1. **Context label:** trip name from store (`trip.name`) — `text-xs uppercase tracking-widest text-on-surface-variant font-bold`
2. **Total amount:** `trip.totalSpend` formatted to 2 decimal places — `font-headline text-5xl font-extrabold tracking-tighter` (use `useWindowDimensions` to scale font size on tablets instead of `md:` responsive prefixes)
3. **Info pills row:**
   - Travelers pill: `bg-secondary-container rounded-full` — "5 Travelers" with `group` icon
   - Duration pill: `bg-primary-container rounded-full` — "14 Days" with `calendar_today` icon

### Step A2: Active Carpools Section

1. **Header:** "Active Carpools" title + "View All" link
2. **Horizontal scroll** of carpool cards (280px min-width each):
   - Title (route name) + subtitle (road name)
   - Car icon in top-right
   - Bottom stats grid (3 columns): Miles | Cost | Passenger avatars
   - Container: `bg-surface-container-lowest p-6 rounded-2xl border shadow-sm h-44`
3. Tapping a card navigates to Carpool Detail (Part B)

### Mock data:
| Name | Road | Miles | Cost |
|------|------|-------|------|
| Mountain Pass | Pacific Coast Hwy | 420 | $84 |
| Desert Stretch | Route 66 | 185 | $35 |

### Step A3: Eco Impact Card

1. **Container:** `bg-primary text-on-primary p-8 rounded-2xl shadow-lg shadow-primary/20`
2. **Content:**
   - Label: "Eco Impact" in primary-container color
   - Headline: "Saved 1.2 Tons CO2" — `text-3xl font-extrabold`
   - Progress bar: `bg-on-primary/20` container with white fill
   - Subtitle: "Carpooling reduced fuel costs by 42%."
3. **Decorative:** Large faded `eco` icon in bottom-right corner

### Step A4: Recent Receipts Section

1. **Header:** "Recent Receipts" title + filter pills ("Shopping", "Dining")
2. **List container:** `bg-surface-container-low rounded-2xl border` with dividers
3. **Each receipt row:**
   - Category icon (48x48, colored container)
   - Merchant name + "Paid by [name] · [date]"
   - Amount + "Shared by N" count
4. Tapping a receipt navigates to receipt detail (or split detail)

### Mock data:
| Merchant | Paid By | Date | Amount | Shared By |
|----------|---------|------|--------|-----------|
| The Lobster Shack | Sarah | Mar 29, 2026 | $248.15 | 5 |
| Whole Foods Market | Alex | Mar 28, 2026 | $112.40 | 3 |
| Shell Gas & Convenience | Marcus | Mar 27, 2026 | $65.00 | 2 |

### Step A5: Settlement Summary

1. **Title:** "Settlement Summary"
2. **Two cards** in a 2-column grid:
   - **You owe card:** `border-l-4 border-l-error` — "You owe Sarah $142.50" with "Pay Now" primary button
   - **Owed to you card:** `border-l-4 border-l-primary` — "Marcus owes you $85.20" with "Remind" text link
3. Tapping either card navigates to the full Settlement screen (Part C)

### Step A6: FAB — Add Carpool

1. Fixed bottom-right button (above tab bar): `bg-primary rounded-2xl shadow-2xl w-14 h-14`
2. Icon: `add_road`
3. Tapping opens a "New Carpool" form (bottom sheet or separate screen)

---

## Part B: Carpool Detail Screen

File: `app/(tabs)/trips/carpool/[carpoolId].tsx`

### Step B1: Navigation Header

1. Back button (arrow_back) + "Trip Intelligence" title in primary
2. Settings icon + user avatar on the right

### Step B2: Editorial Header

1. Context: "Summer Roadtrip 2024" — small uppercase primary label
2. Title: "The Green Machine - Van" — `text-4xl font-extrabold`
3. Status badge: "ACTIVE VOYAGE" — `bg-primary-container rounded-lg` with verified checkmark

### Step B3: Stats Bento Grid (3 columns)

**Distance card** (spans 2 columns):
- `bg-surface-container-low rounded-xl p-6 min-h-[160px] border`
- "Total Distance" label + `route` icon
- `450 miles` in huge font + route description

**Fuel cost card** (1 column):
- Use CSS gradient on View: `style={{ experimental_backgroundImage: 'linear-gradient(135deg, #02ba41, #026b25)' }}` wrapped in `rounded-xl p-6 shadow-lg` (do not use `expo-linear-gradient`)
- "Fuel Expense" label + `local_gas_station` icon
- `$65.00` + budget progress bar (75%) + "Budget Utilization: 75%"

### Step B4: Quick Actions Row

Three buttons in a row:
- "Add Toll" — secondary with `toll` icon
- "Add Parking" — secondary with `local_parking` icon
- "Sync with Expenses" — primary, flex-1, with `sync` icon

### Step B5: Passenger Split Section

1. **Header:** "Passenger Split" title + "Per Person: $21.67" on the right
2. **List of passenger rows:**
   - Avatar (48x48, rounded-full) with optional driver badge overlay
   - Name + role label ("Primary Driver", "Navigator", "Passenger")
   - Amount per person + status pill ("Settled" in green, "Pending" in error)

### Mock data:
| Name | Role | Amount | Status |
|------|------|--------|--------|
| Alex Rivera | Primary Driver | $21.67 | Settled |
| Sam Jenkins | Navigator | $21.67 | Pending |
| Jamie Lee | Passenger | $21.67 | Pending |

### Step B6: Trip Map Preview

1. **Container:** `rounded-2xl overflow-hidden h-48 border`
2. **Background:** Placeholder landscape image with dark gradient overlay at bottom
3. **Bottom overlay:** Location pin icon + "Next Stop: Kalispell, MT" text
4. **Top-right badge:** "Live Tracking" with pulsing green dot
5. Future: replace with actual `react-native-maps` MapView

---

## Part C: Trip Settlement & Balances Screen

File: `app/(tabs)/trips/settlement.tsx`

### Step C1: Hero Section

1. Breadcrumb: "Trips > Summer Roadtrip 2024"
2. Title: "Settlement" — `text-4xl font-extrabold` (scale with `useWindowDimensions` on tablet)
3. Subtitle: "Finalizing the books for your 14-day coastal journey."
4. Status pill: "Settlement Active" with pulsing green dot

### Step C2: Trip Pot Summary Card

1. **Container:** `bg-surface-container-low border rounded-xl p-8` (use a fixed or percentage-based height instead of `min-h-[320px]` with Dimensions API)
2. **Top:** "Total Trip Pot" label + `$4,850.24` in huge primary text + `receipt_long` icon
3. **Bottom grid** (4 columns): Category breakdowns
   - Fuel: $1,240 | Lodging: $2,100 | Food: $960 | Misc: $550
   - Each in a `bg-surface-container-lowest rounded-lg border p-4`

### Step C3: Your Share Card

1. **Container:** `bg-primary text-on-primary rounded-xl p-8 shadow-lg` (lay out C2 and C3 in a `flexDirection: "row"` with `flex: 2` / `flex: 1` proportions to replicate the 8-col / 4-col web layout)
2. "Your Personal Share" label + `$1,212.56` in huge text
3. Bottom section (border-top divider):
   - "Paid by You: $1,500.00"
   - "Net Refund: +$287.44" in a frosted glass container — use `BlurView` from `expo-blur` with `bg-white/20` tint

### Step C4: Optimization Summary

1. **Header:** "Optimization Logic" title + subtitle "Our algorithm reduced 12 potential debts into 3 direct transfers."
2. **Badge:** "3 Transactions Needed"
3. **Transaction rows** (3 rows):

| From | To | Amount | Status | Action |
|------|----|--------|--------|--------|
| Sam | Sarah | $150.00 | Pending (red dot) | "Notify" button |
| James | Alex (YOU) | $287.44 | Incoming (green dot) | "Wait" button |
| Elena | Sarah | $42.10 | Settled (green check) | — |

Row styling varies by status:
- Pending: standard card with `border border-outline-variant/10`
- Incoming (to you): highlighted with `border-l-4 border-primary shadow-sm`
- Settled: reduced opacity (`opacity-60`)

### Step C5: Individual Balance Sheets

1. **Title:** "Individual Balance Sheets" with `border-l-4 border-primary pl-4`
2. **3-column grid** of balance cards:

| Person | Spent | Owed | Balance |
|--------|-------|------|---------|
| Alex (YOU) | $1,500.00 | $1,212.56 | +$287.44 (primary) |
| Sarah Reed | $1,020.46 | $1,212.56 | -$192.10 (error) |
| James Nolan | $925.12 | $1,212.56 | -$287.44 (error) |

Each card: `bg-surface-container-low p-6 rounded-xl border` with avatar initials circle, breakdown rows, and colored balance at bottom.

---

## Part D: Trip Planner — Who Brings What

File: `app/(tabs)/trips/planner.tsx`

### Step D1: Hero Section

1. "Trip Planner" uppercase label in primary
2. Title: "Summer Roadtrip 2024" — `text-4xl font-extrabold` (scale with `useWindowDimensions` on tablet)
3. Subtitle: "Who Brings What: Essential Logistics"
4. Avatar stack showing trip participants (using shared `AvatarStack` component)

### Step D2: Category Sections — Bento Grid

Use a `flexDirection: "row"` + `flexWrap: "wrap"` layout to replicate the 12-column web grid on mobile:

**Camping Gear (large, ~66% width):**
- `bg-surface-container rounded-3xl p-6` with `flex: 2`
- Header: `camping` icon + "Camping Gear" title + "4 Items" count pill
- Item list (see Step D3)

**Navigation (side, ~33% width):**
- `bg-tertiary text-on-tertiary rounded-3xl p-6 shadow-xl` with `flex: 1`
- Decorative circle in top-right (use `View` with `bg-white/10 rounded-full`, no blur needed — decorative only)
- `map` icon + "Navigation" title
- Two compact item cards with semi-transparent styling (`bg-white/10 p-3 rounded-xl`)
- Progress bar at bottom: "Progress 50%"

**Food & Snacks (full width):**
- `bg-surface-container rounded-3xl p-6` with `width: "100%"`
- Header: `restaurant` icon + "Food & Snacks" title + dietary/budget pills
- 3-column card grid of food items using `flexDirection: "row"` with `flex: 1` per card

### Step D3: Item Cards

Three item states:

**Assigned item (with avatar):**
- Green check circle icon (filled)
- Item name + description
- "Brought By [name]" label + avatar image

**Unassigned item:**
- Empty circle icon (outline)
- Item name + description
- "Claim Item" primary button

**Assigned to someone else:**
- Person icon
- Item name + description
- "Assigned To [name]" label + avatar image

### Step D4: Progress Summary Banner

Full-width card at the bottom:
- `bg-primary rounded-3xl p-8 text-on-primary shadow-2xl`
- **Left:** Circular SVG progress ring (using shared `ProgressRing` component) showing 60%
- **Right content:**
  - "Ready for Adventure?" headline
  - "We still have 4 unassigned items that need owners."
  - Two buttons: "See All Open Items" (white bg) + "Remind Everyone" (transparent with border)

### Step D5: Item Claiming Flow

1. Tapping "Claim Item" assigns the item to the current user
2. Update the item card to show the assigned state with the user's avatar
3. Recalculate the progress percentage
4. Optionally show a brief success animation (confetti or checkmark)

### Step D6: Tablet Navigation Drawer

The mockup shows a sidebar drawer for tablet/desktop:
- User profile card at top
- Navigation links: Personal Ledger, Trip History, Trip Planner (active), Currency Settings
- Bottom links: Security, Help Center
- Detect tablet via `useWindowDimensions` — show the drawer when `width >= 768`, otherwise use the tab bar
- Implement as an always-visible `View` column on the left at tablet width, not a CSS `md:` responsive class

---

## Data Model for Trips

Extend the trip store (`src/stores/tripStore.ts`):

```typescript
interface TripItem {
  id: string;
  name: string;
  description: string;
  category: string;
  assignedTo: string | null;
  status: "unassigned" | "assigned" | "brought";
}

interface TripCategory {
  id: string;
  name: string;
  icon: string;
  variant: "default" | "tertiary" | "full-width";
  items: TripItem[];
}

// Add to Trip interface:
interface Trip {
  // ... existing fields
  categories: TripCategory[];
  carpools: Carpool[];
  settlements: SettlementTransaction[];
  totalPot: number;
  categoryBreakdown: Record<string, number>;
}
```

---

## Deliverables Checklist

### Part A0: Trip List (NEW)
- [ ] `app/(tabs)/trips/index.tsx` — scrollable list of all user trips
- [ ] Trip card with name, date range, participant avatars, total spend
- [ ] Empty state with "Create First Trip" CTA
- [ ] FAB navigating to `app/trips/new.tsx`

### Part A: Trip Detail (`[tripId].tsx`)
- [ ] Hero section with trip name (dynamic, not hardcoded) + total spend and info pills
- [ ] Horizontal carpool card scroll
- [ ] Eco impact card
- [ ] Recent receipts list with filters
- [ ] Settlement summary cards
- [ ] FAB for adding carpool

### Part B: Carpool Detail
- [ ] Stats bento grid (distance + fuel cost)
- [ ] Quick actions row
- [ ] Passenger split list with roles and status
- [ ] Map preview placeholder

### Part C: Settlement
- [ ] Trip pot summary with category breakdown
- [ ] Your share card with net refund
- [ ] Optimization logic with transaction rows
- [ ] Individual balance sheets grid

### Part D: Trip Planner
- [ ] Bento grid of category sections (flex-based, not CSS grid)
- [ ] Three item card variants (assigned, unassigned, other)
- [ ] Claim item interaction
- [ ] Progress summary banner with ring chart
- [ ] Tablet navigation drawer (width >= 768)
