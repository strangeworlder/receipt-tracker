# Plan 2: Dashboard / Home Screen

> **Prerequisite:** Plan 1 (Project Foundation & Design System)

This plan implements the main landing screen users see after launching the app.

> **NativeWind v5 import rule:** All `View`, `Text`, `ScrollView`, `Pressable`, `TextInput` imports **must** come from `@/tw` (the CSS-wrapped components from Plan 01 Step 6.5), **not** from `react-native`. `Image` imports come from `@/tw/image`. Raw React Native components silently ignore `className` in NativeWind v5. All code examples in this plan assume this import pattern.
>
> **No `expo-linear-gradient`:** Use CSS gradients via `experimental_backgroundImage` on `View` instead: `style={{ experimental_backgroundImage: 'linear-gradient(to bottom, ...)' }}`.
>
> **Rounded containers:** Add `borderCurve: 'continuous'` to `style` on any rounded View for the native iOS continuous corner curve.
>
> **Safe area:** Use `contentInsetAdjustmentBehavior="automatic"` on `ScrollView`/`FlatList` instead of wrapping in `SafeAreaView`.

---

## Screen Overview

The Ledger Dashboard displays:
- Total monthly spending with percentage change
- 2x2 bento grid of spending categories
- Expiring warranty alert card
- Recent scans list
- Floating action button for quick receipt scanning

---

## Step 1: Create the Dashboard Screen Layout

File: `app/(tabs)/index.tsx`

1. Wrap content in a `ScrollView` with `refreshControl` for pull-to-refresh
2. Use the shared `TopAppBar` component at the top
3. Apply `px-6 space-y-8 mt-4` padding/spacing to main content area
4. Ensure content has bottom padding to clear the tab bar

## Step 2: Hero Section — Total Spending

Build the hero section at the top of the dashboard:

1. **Label:** "Total spending this month" — `text-on-surface-variant font-medium text-sm`
2. **Amount:** Large primary-colored text — `text-5xl font-extrabold tracking-tight text-primary`
   - Value: `$1,250.00` (from mock data, later computed from receipt store)
3. **Percentage badge:** `+12%` pill — white text on primary background, `rounded-full text-xs font-bold px-3 py-1`
   - Position inline with the amount using `flexDirection: "row", alignItems: "baseline"`
4. **Progress bar:** Full-width bar below the amount
   - Container: `h-1.5 bg-surface-container-high rounded-full`
   - Fill: `h-full bg-primary` with width set as percentage (e.g., 65%)
   - Add `mt-4` margin above

## Step 3: Category Bento Grid

Build a 2-column grid with 4 category cards:

1. Use `flexDirection: "row", flexWrap: "wrap"` or a FlatList with `numColumns={2}`
2. Each card is ~132px tall with `p-5 rounded-2xl` and `gap-4` between cards

### Card layout:
- **Top row:** Material icon (left) + category label (right) — `flexDirection: "row", justifyContent: "space-between"`
- **Bottom:** Amount in bold — `text-xl font-extrabold`
- **Default variant:** `bg-surface-container-low border border-outline/10 text-on-surface`
- **Highlighted variant** (one card): `bg-primary text-on-primary shadow-lg shadow-primary/20`

### Categories with mock data:
| Category | Icon | Amount | Highlighted |
|----------|------|--------|-------------|
| Food | `restaurant` | $420.50 | No |
| Travel | `flight` | $315.00 | Yes (primary bg) |
| Warranty | `verified_user` | $180.00 | No |
| Utility | `bolt` | $334.50 | No |

## Step 4: Expiring Warranty Alert Card

Conditionally rendered when a warranty is expiring within a configurable threshold (e.g., 7 days).

1. **Container:** `bg-error-container text-on-error-container p-5 rounded-2xl border border-error/10`
2. **Left content:**
   - Row with `notification_important` icon (error color) + "Expiring Soon" title (bold, lg)
   - Subtitle: e.g., "MacBook Pro Warranty ends in 3 days" (`text-sm font-medium opacity-90`)
3. **Right content:** "Renew" button — `bg-error text-white text-xs font-bold py-2.5 px-5 rounded-full shadow-md`
4. **Decorative element:** Absolute-positioned circle in bottom-right corner (`bg-error/5 rounded-full w-24 h-24 -right-8 -bottom-8`)
5. Use `overflow: "hidden"` on the container to clip the decorative circle

### Data source:
- Query `useWarrantyStore` for the warranty with the nearest expiration date
- Only show if expiration is within 30 days
- Tapping "Renew" navigates to the Warranty tab

## Step 5: Recent Scans List

1. **Section header:** Row with "Recent Scans" (xl bold) on left, "View All" link (primary, sm bold) on right
2. **List container:** `space-y-3` vertical stack (not a FlatList since it's a short list)
3. **Each item** uses the shared `ListItem` component or a custom row:
   - Left: 48x48 `rounded-xl bg-primary-container` icon container with material icon in `text-primary`
   - Center column: merchant name (`font-extrabold text-on-surface`) + date/time (`text-xs text-on-surface-variant`)
   - Right: amount (`font-extrabold text-on-surface`)
   - Container: `p-4 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline/5`
4. Tapping a row navigates to a receipt detail screen (can be a placeholder for now)

### Mock data (matching the mockup):
| Merchant | Date | Amount | Icon |
|----------|------|--------|------|
| Whole Foods Market | Mar 24, 2026 · 2:14 PM | $84.32 | `shopping_bag` |
| Blue Bottle Coffee | Mar 23, 2026 · 9:45 AM | $12.50 | `local_cafe` |
| Shell Gas Station | Mar 22, 2026 · 6:30 PM | $55.00 | `directions_car` |

## Step 6: Floating Action Button (FAB)

1. **Position:** Fixed to bottom-right, above the tab bar — use `position: "absolute"` in the screen or a portal
   - `right: 24, bottom: 112` (above tab bar height)
2. **Size:** 64x64 (`w-16 h-16`)
3. **Style:** `bg-primary text-white rounded-2xl shadow-2xl` with `shadow-primary/30`
4. **Icon:** `photo_camera` (filled variant, 30px)
5. **Interaction:** `active:scale-95` press animation using `Pressable` + Reanimated
6. **Action:** Navigates to the Scans tab or opens the scanner directly

## Step 7: Data Hook

Create `src/hooks/useDashboardData.ts`:

```typescript
import { useMemo } from "react";
import { useReceiptStore } from "../stores/receiptStore";
import { useWarrantyStore } from "../stores/warrantyStore";
import type { FirestoreReceipt } from "../types/firestore";
import type { FirestoreWarranty } from "../types/firestore";

type Receipt = FirestoreReceipt & { id: string };
type Warranty = FirestoreWarranty & { id: string };

interface CategoryCard {
  category: string;
  icon: string;
  amount: number;
  highlighted: boolean;
}

interface DashboardData {
  totalMonthlySpend: number;
  spendChangePercent: number;
  budgetUtilization: number;
  categoryBreakdown: CategoryCard[];
  expiringWarranty: Warranty | null;
  recentScans: Receipt[];
}

const CATEGORY_ICONS: Record<string, string> = {
  food: "restaurant",
  travel: "flight",
  warranty: "verified_user",
  utility: "bolt",
  shopping: "shopping_bag",
  other: "receipt_long",
};

export function useDashboardData(): DashboardData {
  const receipts = useReceiptStore(state => state.receipts);
  const warranties = useWarrantyStore(state => state.warranties);

  return useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filter receipts for this month and last month
    const thisMonthReceipts = receipts.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const lastMonthReceipts = receipts.filter(r => {
      const d = new Date(r.date);
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });

    const totalMonthlySpend = thisMonthReceipts.reduce((sum, r) => sum + r.amount, 0);
    const lastMonthSpend = lastMonthReceipts.reduce((sum, r) => sum + r.amount, 0);
    const spendChangePercent = lastMonthSpend > 0
      ? Math.round(((totalMonthlySpend - lastMonthSpend) / lastMonthSpend) * 100)
      : 0;

    // Budget utilization (assume a soft monthly budget of $2,000 for MVP)
    const MONTHLY_BUDGET = 2000;
    const budgetUtilization = Math.min(totalMonthlySpend / MONTHLY_BUDGET, 1);

    // Category breakdown — aggregate this month's receipts by category
    const categoryTotals: Record<string, number> = {};
    thisMonthReceipts.forEach(r => {
      categoryTotals[r.category] = (categoryTotals[r.category] ?? 0) + r.amount;
    });

    // Find the highest-spend category to highlight it
    const maxCategory = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)[0]?.[0];

    const categoryBreakdown: CategoryCard[] = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([category, amount]) => ({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        icon: CATEGORY_ICONS[category] ?? "receipt_long",
        amount: Math.round(amount * 100) / 100,
        highlighted: category === maxCategory,
      }));

    // Expiring warranty — nearest expiration within 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringWarranty = warranties
      .filter(w => {
        const exp = new Date(w.expirationDate);
        return exp > now && exp <= thirtyDaysFromNow;
      })
      .sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime())[0] ?? null;

    // Recent scans — 3 most recent receipts
    const recentScans = receipts.slice(0, 3);

    return {
      totalMonthlySpend,
      spendChangePercent,
      budgetUtilization,
      categoryBreakdown,
      expiringWarranty,
      recentScans,
    };
  }, [receipts, warranties]);
}
```

- Subscribes to both `receiptStore` and `warrantyStore` via Zustand selectors.
- All derived values are memoized with `useMemo` keyed on the store arrays, so the dashboard only re-renders when underlying data changes.
- Initially works with mock data loaded into stores (Plan 01 Step 8); automatically switches to live data once `syncService` starts populating the stores (Plan 09).

## Step 8: Polish & Interactions

1. Pull-to-refresh refreshes the mock data (or later, re-fetches from storage)
2. Add subtle entrance animations for the cards (fade-in + slide-up using Reanimated)
3. Ensure the layout looks correct on both small phones (375px) and tablets
4. Test scrolling behavior — content should scroll behind the semi-transparent TopAppBar (blur is achieved via `BlurView` from `expo-blur`, not CSS `backdrop-blur`)

---

## Deliverables Checklist

- [ ] Dashboard screen renders all 4 sections
- [ ] Hero section shows total spending with progress bar
- [ ] Category grid displays 4 cards with correct styling
- [ ] Expiring warranty alert conditionally renders
- [ ] Recent scans list shows 3 receipt items
- [ ] FAB is positioned correctly and navigates to scanner
- [ ] Pull-to-refresh works
- [ ] Layout is responsive on different screen sizes
