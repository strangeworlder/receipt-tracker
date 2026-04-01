# Plan 11: Deferred Features & Polish

> **Prerequisite:** Plan 10 (Trip Creation, Receipt Detail & Deep Linking) — all prior plans must be completed or in progress.
> **Depends on:** Plans 01–10 (this plan sweeps up every item deferred, stubbed, or left as a dead end during previous implementations).

This plan catalogues and implements every feature that was deferred, stubbed out, or left as a "coming soon" dead end across Plans 01–10. Items are grouped by feature area and ordered by impact.

> **NativeWind v5 import rule:** Import `View`, `Text`, `ScrollView`, `Pressable`, `TextInput` from `@/tw` (not `react-native`). Import `Image` from `@/tw/image`. Raw React Native components silently ignore `className`.
>
> **No `expo-linear-gradient`:** Use `experimental_backgroundImage` CSS gradients on `View`.
>
> **Rounded containers:** Add `borderCurve: 'continuous'` to `style` on any rounded View.
>
> **Safe area:** Use `contentInsetAdjustmentBehavior="automatic"` on `ScrollView`/`FlatList`.
>
> **Shadow:** Use `boxShadow` CSS strings (not legacy `shadowColor`/`shadowOffset` props).
>
> **No toast utility:** The project has no `showToast` helper. Use `Alert.alert()` from `react-native` for user-facing messages.

---

## Origin Tracking

Each item references the plan or file where the deferral was documented.

---

## Part A: Receipt Detail Screen — Full Implementation

> **Origin:** Plan 10 Part B defines the full receipt detail screen. The current `app/receipts/[receiptId].tsx` (63 lines) is a minimal skeleton showing only date, amount, and category in a single Card. Plan 10 specifies image viewer, inline editing, warranty link, trip link, delete flow, and share action.

File: `app/receipts/[receiptId].tsx`

### Step A1: Image Viewer Section

1. Load image from `receipt.imageUri` (Firebase Storage URL) if available
2. Fallback to local filesystem: `${FileSystem.documentDirectory}receipts/${receiptId}.jpg`
3. If no image at all: placeholder with `receipt_long` icon at 64px in `text-on-surface-variant`
4. Container: `w-full aspect-[3/4] rounded-3xl overflow-hidden` with `borderCurve: 'continuous'`
5. Overlay sync status badge:
   - `syncStatus === "pending"` → `bg-primary-container text-on-primary-container` — "Syncing…" with `sync` icon
   - `syncStatus === "synced"` → `bg-primary/10 text-primary` — "Synced" with `cloud_done` icon
   - Default → `bg-surface-container text-on-surface-variant` — "Saved locally" with `save` icon

### Step A2: Receipt Data Card (Editable)

1. Container: `bg-surface-container-low rounded-3xl p-6`
2. All fields display as read-only by default:
   - Merchant: `text-2xl font-extrabold text-primary`
   - Date: `formatDate(receipt.date)` with `calendar_today` icon
   - Amount: `formatCurrency(receipt.amount)` with `payments` icon
   - Category: capitalized badge
3. Low-confidence badge: if `receipt.confidence < 0.7` — `bg-error-container text-on-error-container text-xs rounded-full px-3 py-1` "Low confidence — please verify"

### Step A3: Inline Editing Mode

1. "Edit" button toggles all fields into editable `TextInput` components
2. Amount uses `keyboardType="decimal-pad"`
3. Category uses `@react-native-picker/picker` dropdown
4. "Save" button calls `receiptService.updateReceipt(receiptId, updates)`
5. "Cancel" reverts to saved values

### Step A4: Warranty Link Section (Conditional)

1. Visible only when `receipt.isWarranty === true`
2. Container: `bg-secondary-container rounded-2xl p-5`
3. `verified_user` icon + "Warranty Tracked" headline
4. Product name and expiration date from linked warranty (look up via `useWarrantyStore.warranties.find(w => w.receiptId === receiptId)`)
5. "View Warranty" link → `router.push("/(tabs)/warranty")`

### Step A5: Trip Link Section (Conditional)

1. Visible only when receipt has a `tripId`
2. Container: `bg-primary-container rounded-2xl p-5`
3. `folder_shared` icon + trip name (from `useTripStore.getTrip(receipt.tripId)`)
4. "View in Trip" → `router.push(`/(tabs)/trips/${receipt.tripId}`)`

### Step A6: Actions Row

1. **Edit** (secondary): puts fields into edit mode (Step A3)
2. **Share**: opens native `Share.share()` with receipt image
3. **Delete** (destructive, text-only): confirmation dialog using `Alert.alert()`, then calls `deleteReceipt(receiptId)` + deletes linked warranty if `receipt.isWarranty`

---

## Part B: Warranty Card Context Menu

> **Origin:** Plan 08 Implementation Note #4 — `more_vert` button on warranty cards shows `Alert.alert("Options", "Coming soon.")`. A context menu (delete, extend warranty, file claim) was deferred.

File: `app/(tabs)/warranty.tsx`

### Step B1: Wire the `more_vert` Menu

Replace the `Alert.alert("Options", "Coming soon.")` on both `ExpiringCard` and `HealthyCard` `more_vert` buttons with an `Alert.alert` action sheet presenting:

1. **View Receipt** — navigate to `app/receipts/[receipt.receiptId]`
2. **Edit Warranty** — navigate to a warranty edit bottom sheet or inline edit mode
3. **Delete Warranty** — confirmation dialog → `warrantyService.deleteWarranty(warrantyId)` (also cancels scheduled notifications via the existing `notificationIds[]` cleanup)
4. **Cancel**

### Step B2: Warranty Detail Bottom Sheet (Optional Enhancement)

> **Origin:** Plan 08 Step 8 — documented as "future enhancement"

If time permits, implement a bottom sheet showing:
- Receipt image (if available via `receipt.imageUri`)
- Full product details + warranty terms
- Coverage start and end dates with visual timeline
- "File Claim" and "Extend Warranty" buttons (UI only — backend for claim management is out of scope)

---

## Part C: Settlement Reminders — FCM Cloud Function

> **Origin:** Plan 09 Part C (Step C4) references "Remind" actions. `sendReminder()` in `tripService.ts` (line 370) is a no-op stub. The settlement screen and planner both call it but no actual push notification is sent.

### Step C1: Cloud Function — `sendSettlementReminder`

File: `functions/src/sendSettlementReminder.ts`

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const sendSettlementReminder = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");

  const { tripId, toParticipantId } = request.data;
  const uid = request.auth.uid;

  // Look up the trip
  const tripDoc = await admin.firestore().collection("trips").doc(tripId).get();
  if (!tripDoc.exists) throw new HttpsError("not-found", "Trip not found");
  const trip = tripDoc.data()!;

  // Verify caller is a trip member
  if (!trip.memberUids?.includes(uid)) {
    throw new HttpsError("permission-denied", "Not a trip member");
  }

  // Find target participant's FCM token
  const targetUser = await admin.firestore().collection("users").doc(toParticipantId).get();
  if (!targetUser.exists) throw new HttpsError("not-found", "User not found");
  const fcmToken = targetUser.data()?.fcmToken;
  if (!fcmToken) return { sent: false, reason: "no_fcm_token" };

  // Send FCM push
  const senderProfile = await admin.firestore().collection("users").doc(uid).get();
  const senderName = senderProfile.data()?.displayName ?? "Someone";

  await admin.messaging().send({
    token: fcmToken,
    notification: {
      title: "Settlement Reminder",
      body: `${senderName} is reminding you about an outstanding balance on "${trip.name}".`,
    },
    data: { tripId, type: "settlement_reminder" },
  });

  return { sent: true };
});
```

### Step C2: Wire Client-Side `sendReminder`

Replace the stub in `src/services/tripService.ts`:

```typescript
import functions from "@react-native-firebase/functions";

export async function sendReminder(
  tripId: string,
  toParticipantId: string
): Promise<void> {
  const sendFn = functions().httpsCallable("sendSettlementReminder");
  await sendFn({ tripId, toParticipantId });
}
```

### Step C3: Ghost Participant Reminder via Share Sheet

> **Origin:** Plan 09 Part C4 — `handleRemindGhost` for ghost participants should open a native share sheet with a pre-filled message.

In `app/(tabs)/trips/settlement.tsx`, update `handleRemindGhost`:

```typescript
import { Share } from "react-native";

const handleRemindGhost = async (ghost: any) => {
  const message = `Hey ${ghost.name}, you have an outstanding balance of $${Math.abs(ghost.amountPaid - ghost.amountOwed).toFixed(2)} for our trip "${trip.name}". Download TripTrack to settle up!`;
  await Share.share({ message });
};
```

### Step C4: Planner "Remind Everyone"

> **Origin:** Plan 09 Part D4 — `Alert.alert("Remind Everyone", "Reminders will be sent to all participants.")` in `planner.tsx` is a no-op.

Wire this to iterate through all trip participants with a `uid` and call `sendReminder` for each, with a summary alert showing how many were notified.

### Step C5: Export and Deploy

Update `functions/src/index.ts` to export `sendSettlementReminder`:
```typescript
export { sendSettlementReminder } from "./sendSettlementReminder";
```

Deploy: `firebase deploy --only functions`

---

## Part D: Deep Link — Invite Landing Route

> **Origin:** Plan 10 Part C defines the invite landing screen `app/invite/[inviteId].tsx`. The route is not yet registered in `app/_layout.tsx` and the file does not exist.

### Step D1: Create `app/invite/[inviteId].tsx`

Implement the full invite landing screen per Plan 10 Part C Step C2:
- Loading spinner while fetching invitation from Firestore
- Error state for invalid/expired invitations
- "You're invited!" UI with inviter name and trip name
- "Join Trip" button calls `resolveGhostParticipant` Cloud Function
- Unauthenticated users see "Sign In to Join" → redirects to onboarding with `redirect` param

### Step D2: Register Route

Add to `app/_layout.tsx` Stack:
```typescript
<Stack.Screen name="invite/[inviteId]" options={{ headerShown: false }} />
```

---

## Part E: Toast / Snackbar Utility

> **Origin:** Plan 06 (line 578) — "toast deferred — no toast utility available yet". Plan 06 checklist (line 649) — `showToast` deferred. Multiple screens use `Alert.alert()` for transient feedback where a toast would be more appropriate.

### Step E1: Create `src/components/Toast.tsx`

A lightweight, animated toast component:
1. Positioned at top of screen with `position: "absolute"` + safe area insets
2. Slides down from top using Reanimated `FadeInDown` / `FadeOutUp`
3. Auto-dismisses after 3 seconds
4. Variants: `success` (primary bg), `error` (error bg), `info` (surface-container bg)
5. Props: `message: string`, `variant: "success" | "error" | "info"`, `onDismiss?: () => void`

### Step E2: Create `src/hooks/useToast.ts`

A Zustand-based toast manager:

```typescript
import { create } from "zustand";

interface ToastState {
  visible: boolean;
  message: string;
  variant: "success" | "error" | "info";
  showToast: (message: string, variant?: "success" | "error" | "info") => void;
  hideToast: () => void;
}
```

### Step E3: Mount Toast in Root Layout

Add `<Toast />` component to `app/_layout.tsx` rendered above the `Stack`, so it's visible across all screens.

### Step E4: Replace Key `Alert.alert` Calls

Replace transient success messages with `showToast`:
- `split.tsx` — "Split saved!" (line 782)
- `settlement.tsx` — "Reminder Sent" (line 164)
- `scanner.tsx` — after save success (currently navigates back with no feedback)

Leave destructive confirmation dialogs (`Alert.alert`) as-is — those require explicit user action.

---

## Part F: Receipt Search

> **Origin:** Plan 06 Step A1 — `headerSearchBarOptions` on the Scans tab was deferred. Checklist line 648 marks it as `[ ] ~~deferred~~`.

File: `app/(tabs)/scans.tsx`

### Step F1: Add Search Input

Add a search `TextInput` above the filter pills:
1. `bg-surface-container rounded-2xl px-4 py-3` with `search` icon
2. Placeholder: "Search receipts…"
3. Filters the receipt list by merchant name (case-insensitive substring match)
4. Debounce the input by 300ms to avoid excessive re-renders

### Step F2: Update Filter Logic

Combine search query with category filter:
```typescript
const filteredReceipts = receipts.filter(r => {
  const matchesCategory = activeFilter === "all" || r.category === activeFilter;
  const matchesSearch = !searchQuery || r.merchant.toLowerCase().includes(searchQuery.toLowerCase());
  return matchesCategory && matchesSearch;
});
```

---

## Part G: Settings Screen — Notifications Toggle Wiring

> **Origin:** Plan 04 Step 12 specifies a notifications toggle in Settings. The toggle exists in `app/settings.tsx` (line 190) but is purely cosmetic — it manages local `useState` and does not persist or affect actual notification behavior.

### Step G1: Persist Notification Preference

1. Store the preference in Firestore user profile: add `notificationsEnabled: boolean` to `FirestoreUser`
2. On toggle change, call `userService.updateNotificationPreference(enabled)`
3. On mount, read from `useAuthStore` or fetch from user profile

### Step G2: Gate Notification Scheduling

In `warrantyService.scheduleExpirationNotifications()`, check the user's notification preference before scheduling. If disabled, skip scheduling and store an empty `notificationIds[]`.

### Step G3: Gate FCM Token Registration

In `authService.registerForPushNotifications()`, respect the notification preference. If disabled, skip token registration (or revoke the token).

---

## Part H: Dashboard Shadow Convention Consistency

> **Origin:** Plan 02 Implementation Amendment — "The dashboard uses legacy `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius` props instead of the `boxShadow` CSS string convention stated in `CLAUDE.md`. Future screens should use `boxShadow` strings, or this deviation should be applied project-wide as the standard."

File: `app/(tabs)/index.tsx`

### Step H1: Migrate Dashboard Shadows

Replace all legacy shadow props in `app/(tabs)/index.tsx` with `boxShadow` CSS strings per the `CLAUDE.md` convention:

```typescript
// Before (legacy):
style={{ shadowColor: '#02ba41', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 }}

// After (boxShadow):
style={{ boxShadow: '0 4px 12px rgba(2, 186, 65, 0.2)' }}
```

---

## Part I: Shared Test Helper Extraction

> **Origin:** Plan 02 Implementation Amendment — "Mock patterns should be extracted to a shared test helper before Plan 03."

### Step I1: Create `src/test-utils/mocks.ts`

Extract the common mock patterns that were established in `app/(tabs)/__tests__/index.test.tsx`:
- `expo-router` mock (with `Link`, `router.push`, `useRouter`)
- `expo-blur` mock (`BlurView` pass-through)
- `react-native-reanimated` mock (plain `RN.View` substitutes + chainable no-op `FadeInDown`)
- `@expo/vector-icons/*` (string mocks)

### Step I2: Create `src/test-utils/render.tsx`

A custom `render` wrapper that includes any providers needed for testing. Re-export `render`, `fireEvent`, `screen` from `@testing-library/react-native` for convenience.

### Step I3: Update `jest.config.ts`

Add module name mapping: `"^@/test-utils/(.*)$": "<rootDir>/src/test-utils/$1"`

### Step I4: Migrate Existing Tests

Update all existing `__tests__/` files to import mocks from the shared helper instead of declaring them inline.

---

## Part J: Trip Map Preview — `react-native-maps` Integration

> **Origin:** Plan 09 Part B Step B6 — "Placeholder for a future `react-native-maps` MapView" in the carpool detail screen. Currently uses a colored rectangle placeholder.

File: `app/(tabs)/trips/carpool/[carpoolId].tsx`

### Step J1: Install `react-native-maps`

```bash
npx expo install react-native-maps
```

Re-run `npx expo prebuild` after installation.

### Step J2: Replace Map Placeholder

Replace the static placeholder `View` with a real `MapView`:
1. Show a styled `MapView` with `rounded-2xl overflow-hidden h-48`
2. If route coordinates are available, render a polyline
3. Fallback: center map on a default location with a marker
4. "Live Tracking" badge with pulsing green dot (decorative for MVP)

---

## Part K: Eco Impact — Real Calculations

> **Origin:** Plan 09 Part A Step A3 — the Eco Impact card uses hardcoded "Saved 1.2 Tons CO2" and "42% fuel savings". These values should be computed from actual carpool data.

File: `app/(tabs)/trips/[tripId].tsx`

### Step K1: Add Eco Impact Computation to `tripStore`

Add a derived selector to `tripStore.ts`:

```typescript
getEcoImpact: (tripId: string) => {
  const carpools = get().carpools[tripId] ?? [];
  const totalMiles = carpools.reduce((sum, c) => sum + c.distance, 0);
  const totalPassengers = carpools.reduce((sum, c) => sum + c.passengers.length, 0);
  const avgPassengers = totalPassengers / (carpools.length || 1);
  
  // EPA estimate: 0.404 kg CO2 per mile for avg passenger car
  const soloEmissions = totalMiles * 0.404 * totalPassengers;
  const carpoolEmissions = totalMiles * 0.404 * carpools.length;
  const savedKg = soloEmissions - carpoolEmissions;
  const savedTons = savedKg / 1000;
  
  const fuelSavingsPercent = avgPassengers > 1
    ? Math.round((1 - 1 / avgPassengers) * 100)
    : 0;
  
  return { savedTons: Math.round(savedTons * 10) / 10, fuelSavingsPercent };
}
```

### Step K2: Wire into Trip Detail

Replace hardcoded Eco Impact values with `getEcoImpact(tripId)`.

---

## Part L: `CLAUDE.md` Plan Table Update

> **Origin:** `CLAUDE.md` line 264 lists plans 01–10. Several show incorrect status ("Pending" when they're done). Add Plan 11 and update all statuses.

File: `CLAUDE.md`

### Step L1: Update Plan Status Table

Update the "Implementation Plans" table to reflect reality:
- Plans 01–09: **Done**
- Plan 10: **In Progress**
- Plan 11: **Pending** (this plan)

---

## Deliverables Checklist

### Part A: Receipt Detail — Full Implementation
- [ ] `app/receipts/[receiptId].tsx` rewritten with image viewer, data card, warranty/trip links, actions row
- [ ] Inline editing for merchant, date, amount, category
- [ ] Delete flow with warranty cascade
- [ ] Share action via `Share.share()`
- [ ] Sync status badge overlay on image

### Part B: Warranty Card Context Menu
- [ ] `more_vert` wired to action sheet (View Receipt, Edit, Delete, Cancel)
- [ ] Delete calls `warrantyService.deleteWarranty()` with notification cleanup

### Part C: Settlement Reminders
- [ ] `functions/src/sendSettlementReminder.ts` — Cloud Function for FCM push
- [ ] `tripService.sendReminder` wired to call the Cloud Function
- [ ] Ghost participant reminder uses native `Share.share()` sheet
- [ ] Planner "Remind Everyone" iterates participants and sends reminders
- [ ] Cloud Function deployed

### Part D: Deep Link — Invite Landing
- [ ] `app/invite/[inviteId].tsx` created per Plan 10 Part C
- [ ] Route registered in `app/_layout.tsx`

### Part E: Toast/Snackbar Utility
- [ ] `src/components/Toast.tsx` with animated slide-down + auto-dismiss
- [ ] `src/hooks/useToast.ts` (Zustand-based)
- [ ] Mounted in root layout
- [ ] Key `Alert.alert` success messages replaced with `showToast`

### Part F: Receipt Search
- [ ] Search `TextInput` added to `app/(tabs)/scans.tsx`
- [ ] Debounced merchant name search combined with category filter

### Part G: Notifications Toggle Wiring
- [ ] Preference persisted to Firestore user profile
- [ ] Notification scheduling gated on preference
- [ ] FCM registration gated on preference

### Part H: Dashboard Shadow Migration
- [ ] All legacy shadow props in `app/(tabs)/index.tsx` replaced with `boxShadow` strings

### Part I: Shared Test Helpers
- [ ] `src/test-utils/mocks.ts` with extracted mock patterns
- [ ] `src/test-utils/render.tsx` with custom render wrapper
- [ ] Module alias added to `jest.config.ts`
- [ ] Existing tests migrated to use shared helpers

### Part J: Trip Map Preview
- [ ] `react-native-maps` installed
- [ ] Map placeholder in carpool detail replaced with real `MapView`

### Part K: Eco Impact Calculations
- [ ] `getEcoImpact()` selector added to `tripStore`
- [ ] Hardcoded Eco Impact card values replaced with computed data

### Part L: CLAUDE.md Update
- [ ] Plan status table updated with correct statuses and Plan 11 added
