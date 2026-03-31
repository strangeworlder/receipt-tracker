# Plan 5: Warranty Tracker

> **Prerequisite:** Plan 1 (Project Foundation & Design System)

This plan implements the warranty management screen where users can view, filter, and manage product warranties extracted from scanned receipts.

> **NativeWind v5 import rule:** All `View`, `Text`, `ScrollView`, `Pressable`, `TextInput` imports **must** come from `@/tw` (the CSS-wrapped components from Plan 01 Step 6.5), **not** from `react-native`. `Image` imports come from `@/tw/image`. Raw React Native components silently ignore `className` in NativeWind v5.
>
> **No `expo-linear-gradient`:** Use CSS gradients via `experimental_backgroundImage` on `View` instead.
>
> **Rounded containers:** Add `borderCurve: 'continuous'` to `style` on any rounded View for the native iOS continuous corner curve.
>
> **Safe area:** Use `contentInsetAdjustmentBehavior="automatic"` on `ScrollView`/`FlatList` instead of wrapping in `SafeAreaView`.
>
> **No `AsyncStorage`:** Notification ID storage (for canceling scheduled notifications) must use `expo-sqlite` localStorage, not `@react-native-async-storage/async-storage`.

---

## Screen Overview

The Warranty Tracker is a filterable list of warranty cards, each showing:
- Product name and manufacturer
- Purchase date and time remaining
- Urgency status (expiring soon, healthy, expired)
- Quick actions (view receipt, renew, more options)
- An "add new" empty state card at the bottom

---

## Step 1: Warranty Tab Screen

File: `app/(tabs)/warranty.tsx`

### Layout:
1. Shared `TopAppBar` at the top
2. Editorial header: "Warranty" in `text-4xl font-extrabold` + subtitle "Protect your investments and track expiration dates."
3. Filter bar (Step 2)
4. Warranty card list (Step 3–5)
5. Bottom padding to clear tab bar

## Step 2: Filter Bar

Horizontal scrollable row of filter pills:

| Filter | Default State |
|--------|---------------|
| All | **Active** (selected) |
| Active | Inactive |
| Expired | Inactive |

### Styling:
- **Selected:** `bg-primary text-on-primary px-6 py-2.5 rounded-full text-sm font-bold`
- **Unselected:** `bg-surface-container-high text-on-surface-variant px-6 py-2.5 rounded-full text-sm font-bold`
- Container: `flexDirection: "row", gap: 8, marginBottom: 32` with horizontal scroll, no scrollbar

### Behavior:
- Tapping a filter pill selects it (single-select)
- The list below re-filters accordingly
- "All" shows everything, "Active" shows non-expired, "Expired" shows past-due

## Step 3: Warranty Card — Expiring Soon Variant

For warranties expiring within 30 days. This is the most prominent card type.

### Structure:
1. **Container:** `bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline/10` with `overflow: "hidden"`
2. **Status badge** (absolute top-right corner):
   - `bg-error text-on-error px-4 py-1.5 rounded-bl-xl`
   - Label: "Action Required" — `text-[10px] font-extrabold uppercase tracking-widest`
3. **Header row:**
   - Manufacturer label: `text-[10px] font-extrabold uppercase tracking-widest text-primary`
   - Product name: `text-2xl font-bold text-on-surface`
   - Purchase date: `text-sm text-on-surface-variant`
4. **Warning banner:**
   - `bg-error-container p-4 rounded-lg` with `flexDirection: "row", gap: 16`
   - Warning icon: `material-symbols warning` in error color (filled)
   - Text: "Expiring in X weeks" (bold) + "Coverage ends [date]" (smaller)
5. **Action buttons** row:
   - "View Receipt" — `flex-1 bg-primary text-on-primary py-3 rounded-lg font-bold text-sm` with `receipt_long` icon
   - More menu — `w-12 h-12 bg-surface-container rounded-lg` with `more_vert` icon

### Mock data:
- Apple Inc. — AirPods Pro — Purchased Mar 10, 2025 — Expiring in 2 weeks

## Step 4: Warranty Card — Healthy Variant

For warranties with plenty of time remaining.

### Differences from expiring variant:
- No "Action Required" status badge
- Product icon instead of badge: `w-12 h-12 bg-primary-container rounded-lg` with relevant icon (e.g., `monitor`, `vacuum`)
- **Status banner:** `bg-primary/5 p-4 rounded-lg border border-primary/10` (green-tinted instead of red)
  - `verified_user` icon in primary color (filled)
  - "X days left" in primary bold + coverage description
- **Action button:** "View Receipt" in secondary style (`bg-surface-container-high text-on-surface`)

### Mock data:
| Product | Manufacturer | Purchased | Days Left | Coverage |
|---------|-------------|-----------|-----------|----------|
| UltraSharp 27" | Dell Technologies | Jan 04, 2026 | 342 days | Standard 1-year |
| V15 Detect | Dyson | Dec 20, 2025 | 721 days | Extended 2-year |

## Step 5: Empty State / Add New Card

At the bottom of the list, always show an "add more" prompt:

1. **Container:** `border-2 border-dashed border-outline/30 rounded-xl p-8 bg-surface-container-low/50`
2. **Centered content:**
   - Icon: `w-14 h-14 bg-primary-container rounded-full` with `add_shopping_cart` icon
   - Title: "Bought something new?" (bold)
   - Subtitle: "Scan a receipt to automatically track its warranty period." (sm, muted, max-width: 200)
   - Link: "Scan Receipt" in primary bold — navigates to the Scans tab
3. This card encourages engagement with the receipt scanner

## Step 6: Warranty Detail Bottom Sheet (Optional Enhancement)

When tapping "View Receipt" or a warranty card:

1. Open a bottom sheet / modal with full details:
   - Receipt image (if available)
   - Full product details
   - Warranty terms and conditions
   - Coverage start and end dates with visual timeline
   - "File Claim" and "Extend Warranty" action buttons
2. This can be a future enhancement — for MVP, just navigate to a placeholder detail screen

## Step 7: Notification Scheduling

> **Note:** `expo-notifications` is already installed in Plan 1. No additional install needed here.

Set up local notifications for warranty expiration reminders:

1. When a warranty is saved, schedule notifications at:
   - 30 days before expiration
   - 7 days before expiration
   - On expiration day
2. Notification content: "Your [product] warranty expires in [X days]. Review now."
3. Tapping the notification opens the warranty detail

## Step 8: Data & Filtering Logic

### Warranty store queries needed:

```typescript
// In useWarrantyStore or as selectors:
getWarranties(filter: "all" | "active" | "expired"): Warranty[]
getExpiringWarranties(withinDays: number): Warranty[]
getDaysRemaining(warrantyId: string): number
getWarrantyStatus(warrantyId: string): "action_required" | "healthy" | "expired"
```

### Status determination:
- `action_required`: expires within 30 days
- `healthy`: more than 30 days remaining
- `expired`: past expiration date

### Sorting:
- Default sort: expiring soonest first
- Expired warranties sorted to the bottom (or hidden unless "All"/"Expired" filter is active)

## Step 9: Empty List States

1. **No warranties at all:** Show the add-new card as the only content with a more prominent message
2. **Filter returns empty:** "No [active/expired] warranties" message with suggestion to scan a receipt
3. **All expired:** Subtle message encouraging purchasing new items

---

## Deliverables Checklist

- [ ] Warranty tab renders with editorial header
- [ ] Filter bar with All / Active / Expired pills
- [ ] Expiring-soon card variant with warning banner and action buttons
- [ ] Healthy card variant with days-remaining indicator
- [ ] Empty state / add-new card at bottom of list
- [ ] Filter logic correctly filters warranties by status
- [ ] Sorted by expiration urgency
- [ ] "View Receipt" navigates to detail or shows bottom sheet
- [ ] "Scan Receipt" link navigates to Scans tab
- [ ] Notification scheduling for expiration reminders
- [ ] Empty list states for all filter combinations
