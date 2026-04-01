# Plan 8: Warranty Tracker

> **Prerequisite:** Plan 5 (Data Layer — `warrantyService` and `useWarrantyStore.setWarranties` must be in place).

This plan implements the warranty management screen where users can view, filter, and manage product warranties extracted from scanned receipts. It also covers the `warrantyStore` selector additions needed by the UI.

> **Implementation status: Complete.** See divergences from this plan documented in the [Implementation Notes](#implementation-notes) section at the bottom.

> **NativeWind v5 import rule:** Import `View`, `Text`, `ScrollView`, `Pressable`, `TextInput` from `@/tw` (not `react-native`). Import `Image` from `@/tw/image`. Raw React Native components silently ignore `className`.
>
> **No `expo-linear-gradient`:** Use `experimental_backgroundImage` CSS gradients on `View`.
>
> **Rounded containers:** Add `borderCurve: 'continuous'` to `style` on any rounded View.
>
> **Safe area:** Use `contentInsetAdjustmentBehavior="automatic"` on `ScrollView`/`FlatList`.
>
> **No `AsyncStorage`:** Notification ID storage (for canceling scheduled notifications) uses `expo-sqlite localStorage`. The `warrantyService` in Plan 05 already handles this — IDs are stored in the Firestore `notificationIds[]` array, not in local storage directly.
>
> **`expo-blur` already installed:** `expo-blur ~15.0.8` is a project dependency — no `npx expo install` needed if you use `BlurView`.
>
> **No toast utility:** The project has no `showToast` helper. Use `Alert.alert()` from `react-native` for user-facing messages.

---

## Context

`warrantyStore` currently contains 3 mock warranties:
- `w1` — MacBook Pro 16-inch (Apple), expires 2027-03-20, status: healthy
- `w2` — KALLAX Shelf Unit (IKEA), expires 2031-03-15, status: healthy
- `w3` — MacBook Pro AppleCare, expires 2026-04-10, status: "action required" (within 30 days)

`formatDate(dateString)` and `daysUntil(dateString)` are available from `src/utils/format.ts`.

---

## Step 1: Warranty Tab Screen

File: `app/(tabs)/warranty.tsx`

### Layout:
1. Shared `TopAppBar` at the top
2. Editorial header:
   - "Warranty" — `text-4xl font-extrabold`
   - Subtitle: "Protect your investments and track expiration dates." — `text-on-surface-variant text-sm`
3. Filter bar (Step 2)
4. Warranty card list (Steps 3–5)
5. Bottom padding to clear tab bar

---

## Step 2: Filter Bar

Horizontal scrollable row of filter pills:

| Filter | Default |
|--------|---------|
| All | **Active** (selected) |
| Active | Inactive |
| Expired | Inactive |

- **Selected:** `bg-primary text-on-primary px-6 py-2.5 rounded-full text-sm font-bold`
- **Unselected:** `bg-surface-container-high text-on-surface-variant px-6 py-2.5 rounded-full text-sm font-bold`

### Behavior:
- Single-select filter pills
- "All" shows everything, "Active" shows non-expired, "Expired" shows past-due

---

## Step 3: Warranty Card — Expiring Soon Variant

For warranties expiring within 30 days.

### Structure:
1. **Container:** `bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline/10` with `overflow: "hidden"`
2. **Status badge** (absolute top-right corner):
   - `bg-error text-on-error px-4 py-1.5 rounded-bl-xl`
   - "Action Required" — `text-[10px] font-extrabold uppercase tracking-widest`
3. **Header row:**
   - Manufacturer: `text-[10px] font-extrabold uppercase tracking-widest text-primary`
   - Product name: `text-2xl font-bold text-on-surface`
   - Purchase date: `text-sm text-on-surface-variant`
4. **Warning banner:**
   - `bg-error-container p-4 rounded-lg` with `flexDirection: "row", gap: 16`
   - `warning` icon in error color
   - Text: "Expiring in X weeks" (bold) + "Coverage ends [date]" (smaller)
5. **Action buttons** row:
   - "View Receipt" — `flex-1 bg-primary text-on-primary py-3 rounded-lg font-bold text-sm` with `receipt_long` icon
   - More menu — `w-12 h-12 bg-surface-container rounded-lg` with `more_vert` icon

---

## Step 4: Warranty Card — Healthy Variant

For warranties with more than 30 days remaining.

### Differences from expiring variant:
- No "Action Required" badge
- Product icon: `w-12 h-12 bg-primary-container rounded-lg` with relevant icon
- **Status banner:** `bg-primary/5 p-4 rounded-lg border border-primary/10` (green-tinted)
  - `verified_user` icon in primary color
  - "X days left" in primary bold + coverage description
- **Action button:** "View Receipt" in secondary style (`bg-surface-container-high text-on-surface`)

### Mock data (for reference — replaced by live data when sync starts):
| Product | Manufacturer | Purchased | Days Left |
|---------|-------------|-----------|-----------|
| UltraSharp 27" | Dell Technologies | Jan 04, 2026 | 342 days |
| V15 Detect | Dyson | Dec 20, 2025 | 721 days |

---

## Step 5: Empty State / Add New Card

Always shown at the bottom of the list:

1. **Container:** `border-2 border-dashed border-outline/30 rounded-xl p-8 bg-surface-container-low/50`
2. **Centered content:**
   - `w-14 h-14 bg-primary-container rounded-full` with `add_shopping_cart` icon
   - Title: "Bought something new?" (bold)
   - Subtitle: "Scan a receipt to automatically track its warranty period." (sm, muted)
   - Link: "Scan Receipt" in primary bold → navigates to the Scans tab

---

## Step 6: Warranty Store Selectors

Add these selector functions to `src/stores/warrantyStore.ts`:

```typescript
// Type aliases added to warrantyStore.ts:
type WarrantyFilter = "all" | "active" | "expired";
type WarrantyStatus = "action_required" | "healthy" | "expired";

// Add to WarrantyState interface:
getWarranties: (filter: WarrantyFilter) => Warranty[];
getDaysRemaining: (warrantyId: string) => number;
getWarrantyStatus: (warrantyId: string) => WarrantyStatus;

// Add to create() implementation:
getWarranties: (filter) => {
  const now = new Date();
  const warranties = get().warranties;
  switch (filter) {
    case "active":
      return warranties.filter(w => new Date(w.expirationDate) > now);
    case "expired":
      // Most recently expired first
      return [...warranties.filter(w => new Date(w.expirationDate) <= now)].sort(
        (a, b) => new Date(b.expirationDate).getTime() - new Date(a.expirationDate).getTime()
      );
    default:
      // Soonest-expiring first; expired pushed to bottom
      return [...warranties].sort((a, b) => {
        const aExpired = new Date(a.expirationDate) <= now;
        const bExpired = new Date(b.expirationDate) <= now;
        if (aExpired && !bExpired) return 1;
        if (!aExpired && bExpired) return -1;
        return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
      });
  }
},

getDaysRemaining: (warrantyId) => {
  const warranty = get().warranties.find(w => w.id === warrantyId);
  if (!warranty) return 0;
  const today = new Date();
  const expiry = new Date(warranty.expirationDate);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
},

getWarrantyStatus: (warrantyId): WarrantyStatus => {
  const daysRemaining = get().getDaysRemaining(warrantyId);
  if (daysRemaining <= 0) return "expired";  // Note: <= 0, not < 0 (see Implementation Notes)
  if (daysRemaining <= 30) return "action_required";
  return "healthy";
},
```

### Sorting:
- Default: expiring soonest first (`warranties.sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime())`)
- Expired warranties sorted to the bottom unless "Expired" filter is active

---

## Step 7: Notification Scheduling

`expo-notifications` is already installed from Plan 01. The `warrantyService.createWarranty()` and `warrantyService.createFromReceipt()` implementations in Plan 05 automatically schedule notifications when a warranty is created. No additional notification setup is needed here.

**Notification schedule (already implemented in Plan 05 `warrantyService`):**
- 30 days before expiration
- 7 days before expiration
- On expiration day

Content: "Your [product] warranty expires in [X days]. Review now."

Tapping a notification should navigate to the warranty detail. Configure this in `app/_layout.tsx`:

```typescript
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";

// In root layout useEffect (after auth check):
const notificationSub = Notifications.addNotificationResponseReceivedListener(response => {
  const warrantyId = response.notification.request.content.data?.warrantyId;
  if (warrantyId) {
    router.push("/(tabs)/warranty");
  }
});
return () => notificationSub.remove();
```

---

## Step 8: Warranty Detail (Optional Enhancement)

When tapping "View Receipt" or a warranty card:

For MVP: navigate to the receipt detail screen (`app/receipts/[receiptId]`) using `warranty.receiptId`.

Full detail bottom sheet (future enhancement):
- Receipt image (if available)
- Full product details + warranty terms
- Coverage start and end dates with visual timeline
- "File Claim" and "Extend Warranty" buttons

---

## Step 9: Empty List States

1. **No warranties at all:** Show the add-new card as the only content with a more prominent message
2. **Filter returns empty:** "No [active/expired] warranties" message with suggestion to scan a receipt

---

## Deliverables Checklist

- [x] `app/(tabs)/warranty.tsx` — renders editorial header, filter bar, and warranty cards
- [x] Filter bar with All / Active / Expired pills (single-select)
- [x] Expiring-soon card variant with "Action Required" badge and warning banner
- [x] Healthy card variant with days-remaining indicator
- [x] Empty state / add-new card at bottom of list
- [x] Filter logic correctly filters warranties by status
- [x] Sorted by expiration urgency (soonest first, expired at bottom)
- [x] "View Receipt" navigates to `app/receipts/[receiptId]`
- [x] "Scan Receipt" link navigates to Scans tab
- [x] `warrantyStore` selector functions added (`getWarranties`, `getDaysRemaining`, `getWarrantyStatus`)
- [x] Notification tap handler in root layout navigates to Warranty tab
- [x] Empty list states for all filter combinations

---

## Implementation Notes

The following decisions were made during implementation that extend or diverge from the plan spec above:

### 1. Expired card variant (not specified in plan)

The plan defines "Expiring Soon" and "Healthy" card variants but does not specify how already-expired warranties should render. **Decision:** expired warranties reuse `ExpiringCard` with the badge text changed to "Expired" and `bg-outline` (muted grey) instead of `bg-error` (red). The warning banner uses `bg-surface-container-high` and muted text instead of `bg-error-container`. "View Receipt" button is rendered at 50% opacity to signal inactivity.

### 2. `getWarrantyStatus` boundary condition (`<= 0` not `< 0`)

The plan's code sample uses `if (daysRemaining < 0) return "expired"`. This causes a warranty expiring **today** (0 days remaining) to be returned as `"action_required"` for the entire day it expires. **Decision:** changed to `<= 0` so expiration-day warranties are immediately treated as expired, consistent with notification schedule (a notification fires on expiration day).

### 3. `getWarranties` sort order extended

The plan specifies "soonest first, expired at bottom" but provides only a basic `switch` implementation without the sort. **Implementation** uses a comparator that:
- For `"all"` / `"active"`: non-expired sorted ascending by date, all expired pushed to the end
- For `"expired"`: sorted descending (most recently expired first)

### 4. `more_vert` menu is a visual-only no-op

The plan shows a `more_vert` icon button on ExpiringSoon cards but defines no menu actions. **Decision:** the button is rendered and tappable but shows `Alert.alert("Options", "Coming soon.")`. A context menu (delete, extend warranty, file claim) can be wired up in a future enhancement.

### 5. `WarrantyFilter` and `WarrantyStatus` type aliases

Two explicit type aliases were added to `warrantyStore.ts` for type safety and reuse across the store and screen:
```typescript
type WarrantyFilter = "all" | "active" | "expired";
type WarrantyStatus = "action_required" | "healthy" | "expired";
```
