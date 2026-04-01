# Plan 10: Trip Creation, Receipt Detail & Deep Linking

> **Prerequisite:** Plan 4 (Auth — `resolveGhostParticipant` Cloud Function deployed), Plan 5 (Data Layer — `tripService` implementations), Plan 9 (Trip Management — all trip screens implemented).
> **Completes:** These are the last three standalone additions that Plans 07–09 reference but do not implement themselves.

This plan covers:
1. **Trip Creation Flow** — the entry point for new trips with participant invitation
2. **Receipt Detail Screen** — the screen reached by tapping a receipt anywhere in the app
3. **Deep Linking** — the scheme configuration and the invite landing route required for ghost-to-AppUser upgrades

> **NativeWind v5 import rule:** Import `View`, `Text`, `ScrollView`, `Pressable`, `TextInput` from `@/tw` (not `react-native`). Import `Image` from `@/tw/image`. Raw React Native components silently ignore `className`.
>
> **`expo-blur` already installed:** `expo-blur ~15.0.8` is a project dependency — no `npx expo install` needed.
>
> **No toast utility:** The project has no `showToast` helper. Use `Alert.alert()` from `react-native` for user-facing messages.

---

## Context

- `formatCurrency(amount)`, `formatDate(dateString)`, and `daysUntil(dateString)` are in `src/utils/format.ts`.
- `@react-native-firebase/functions` is installed from Plan 01.
- `app.config.ts` already has `scheme: "triptrack"` (Plan 01 Step 10).
- `resolveGhostParticipant` Cloud Function is deployed from Plan 04 Step 10.
- `TripParticipant` uses `isGhost: boolean`, `name: string`, `uid?: string` — not `type`/`displayName`.
- `app/(tabs)/trips/index.tsx` entry points (empty state + FAB) reference `router.push('/trips/new')` — already implemented in Plan 09.
- `app/_layout.tsx` already has `trips/carpool-new` registered (Plan 09). The `trips/new` and `receipts/[receiptId]` routes are also already registered from Plan 01.

---

## Part A: Trip Creation Flow

### New file

```
app/
  trips/
    new.tsx     # Create trip form (already registered in app/_layout.tsx)
```

Already registered in root layout (Plan 01). `app/_layout.tsx` now also has `trips/carpool-new` (Plan 09):
```typescript
<Stack.Screen name="trips/new" options={{ presentation: "modal", headerShown: false }} />
<Stack.Screen name="trips/carpool-new" options={{ presentation: "modal", headerShown: false }} />
```

### Step A1: Entry Points

Trip creation is reachable from:
- `app/(tabs)/trips/index.tsx` empty state "Create First Trip" button
- The FAB on the Trips tab

### Step A2: Create Trip Form

File: `app/trips/new.tsx`

#### Layout (ScrollView, 3 sections):

**Section 1 — Trip Details:**
- Trip name input: `bg-surface-container-low rounded-2xl px-4 py-4 text-on-surface font-semibold`
- Start date picker: row with `calendar_today` icon + date display; tapping opens native date picker
- End date picker: same pattern
- Use `@react-native-community/datetimepicker` (installed from Plan 01) in modal mode

**Section 2 — Participants:**
- Header: "Who's coming?" with "Add Person" button
- Existing participant chips: removable pills for each added participant
- **Add Participant (ghost only):** Inline form collects name (required) + optional email + optional phone → always stored as `{ isGhost: true, name, email?, phone? }`
  - **No email lookup.** The system does not query the `users` collection to check if the invitee has an account. All added participants are ghost participants at creation time.
  - Ghost → AppUser resolution happens later when the invitee taps the deep link and `resolveGhostParticipant` Cloud Function matches by email.
- The current user is always the first participant (non-ghost, non-removable)

**Section 3 — Invite Link:**
- "Generate Invite Link" button → calls `tripService.createInvitation` → shows shareable link
- Share sheet opens via `Share.share()` from `react-native`

#### Local form state:

```typescript
interface NewTripFormState {
  name: string;
  startDate: string;
  endDate: string;
  // All added participants are ghost type — no email lookup performed
  participants: Array<{ isGhost: true; name: string; email?: string; phone?: string }>;
}
```

#### Save action:

```typescript
import { requireAuth } from "@/services/utils";
import { createTrip, createInvitation, buildInviteLink } from "@/services/tripService";
import { getUserProfile } from "@/services/userService";
import { generateUUID } from "@/utils/uuid";
import type { TripParticipant } from "@/types";

async function handleCreateTrip(form: NewTripFormState): Promise<void> {
  const uid = requireAuth();
  const currentUserProfile = await getUserProfile(uid);

  const participants: TripParticipant[] = [
    // Current user always first (isGhost: false)
    {
      id: uid,
      uid,
      name: currentUserProfile?.displayName ?? "You",
      avatarUri: currentUserProfile?.avatarUrl,
      isGhost: false,
      amountPaid: 0,
      amountOwed: 0,
    },
    // All added participants are ghost — no AppUser lookup
    ...form.participants.map(p => ({
      id: generateUUID(),
      name: p.name,
      email: p.email,
      phone: p.phone,
      isGhost: true as const,
      managedBy: uid,
      amountPaid: 0,
      amountOwed: 0,
    })),
  ];

  const tripId = await createTrip({
    name: form.name,
    startDate: form.startDate,
    endDate: form.endDate,
    participants,
  });

  // Create invitations for ghost participants that have an email
  const emailParticipants = form.participants.filter(p => p.email);
  for (const p of emailParticipants) {
    await createInvitation(tripId, uid, p.email!);
  }

  router.replace(`/(tabs)/trips/${tripId}`);
}
```

### Step A3: `tripService.createInvitation` and `buildInviteLink`

These are fully implemented in Plan 05 (`src/services/tripService.ts`). They produce:

```typescript
// Invite link format:
`triptrack://invite/${inviteId}?tripId=${tripId}`
```

Share it with React Native's built-in `Share`:

```typescript
import { Share } from "react-native";

async function shareInviteLink(inviteId: string, tripId: string): Promise<void> {
  const link = buildInviteLink(inviteId, tripId);
  await Share.share({
    message: `Join my trip on TripTrack: ${link}`,
    url: link,
  });
}
```

> **Note:** As of Plan 06 implementation, `deleteReceipt()` in `receiptService.ts` now automatically handles Firebase Storage file cleanup in addition to Firestore doc and local file deletion. No separate Storage deletion step is needed here.

> **Implementation Amendment (Plan 10):** The `updateReceipt` function signature was changed from `Partial<Pick<FirestoreReceipt, ...>>` to a plain object `{ merchant?, date?: string, amount?, category?, isWarranty? }` to avoid requiring callers to pass Firestore `Timestamp` objects for the `date` field. The client always works with ISO date strings.

> **Implementation Amendment (Plan 10):** An optional `confidence?: number` field was added to `FirestoreReceipt`, `Receipt` (UI type), and the `receiptService` persistence/listener pipeline. `OCRResult` already included this field from Plan 06 but it was not being stored in Firestore. Two TDD tests were added covering both the persistence and mapping paths.

---

## Part B: Receipt Detail Screen

### New file

```
app/
  receipts/
    [receiptId].tsx    # Already registered in app/_layout.tsx
```

Already registered:
```typescript
<Stack.Screen name="receipts/[receiptId]" options={{ headerShown: false }} />
```

### Step B1: Screen Layout

File: `app/receipts/[receiptId].tsx`

```typescript
import { useLocalSearchParams } from "expo-router";
import { useReceiptStore } from "@/stores/receiptStore";

export default function ReceiptDetailScreen() {
  const { receiptId } = useLocalSearchParams<{ receiptId: string }>();
  const receipt = useReceiptStore(state => state.receipts.find(r => r.id === receiptId));
  // ...
}
```

#### Layout (ScrollView):

**Section 1 — Image viewer:**
- `<Image>` from `@/tw/image` (wraps `expo-image`): `w-full aspect-[3/4] rounded-3xl`
- If `receipt.imageUri` (firebaseStorageUrl) is available, load from URL; otherwise load from local filesystem URI (`${FileSystem.documentDirectory}receipts/${receiptId}.jpg`)
- If no image: placeholder with `receipt_long` icon
- Overlay: `syncStatus` badge — "Saved locally" | "Syncing…" | "Synced" with appropriate icon

**Section 2 — Receipt data card:**
- `bg-surface-container-low rounded-3xl p-6`
- Merchant name: `text-2xl font-extrabold text-primary` (editable)
- Date: `formatDate(receipt.date)` with `calendar_today` icon (editable)
- Amount: `formatCurrency(receipt.amount)` with `payments` icon (editable)
- Category: dropdown/chip (editable)
- Low-confidence badge: if `confidence < 0.7` — `bg-error-container text-on-error-container text-xs rounded-full px-3 py-1` "Low confidence — please verify"

**Section 3 — Warranty link (conditional, when `receipt.isWarranty === true`):**
- `bg-secondary-container rounded-2xl p-5`
- `verified_user` icon + "Warranty Tracked" headline
- Product name, expiration date
- "Edit Warranty" link → navigate to warranty detail or bottom sheet

**Section 4 — Linked expense (conditional, when `receipt.tripId` is set):**
- `bg-primary-container rounded-2xl p-5`
- `folder_shared` icon + trip name
- "View in Trip" link → `router.push(`/(tabs)/trips/${receipt.tripId}`)`

**Section 5 — Actions row:**
- "Edit" (secondary) — puts all fields into edit mode
- "Delete" (destructive, text-only) — confirmation dialog
- "Share" — opens native share sheet for the receipt image

### Step B2: Inline Editing

When the user taps "Edit":
- Fields switch from display text to `TextInput`
- Amount uses `keyboardType="decimal-pad"`
- Category uses a horizontal ScrollView of Pressable chip buttons (not `@react-native-picker/picker`)
- Save button: calls `receiptService.updateReceipt(receiptId, updates)` from Plan 05
- On save, show `Alert.alert("Saved", "Receipt updated.")`

### Step B3: Delete Flow

```typescript
import { Alert } from "react-native";
import { deleteReceipt } from "@/services/receiptService";
import { deleteWarranty } from "@/services/warrantyService";
import { useWarrantyStore } from "@/stores/warrantyStore";

async function handleDelete(): Promise<void> {
  Alert.alert(
    "Delete Receipt",
    "This will permanently delete the receipt and its image. This cannot be undone.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteReceipt(receiptId);
          // Also delete linked warranty
          if (receipt?.isWarranty) {
            const warranty = useWarrantyStore.getState().warranties.find(
              w => w.receiptId === receiptId
            );
            if (warranty) await deleteWarranty(warranty.id);
          }
          router.back();
        },
      },
    ]
  );
}
```

---

## Part C: Deep Linking

### Step C1: Deep Link Scheme

`app.config.ts` already has `scheme: "triptrack"` (Plan 01). expo-router handles URL routing automatically.

Supported deep link URLs:
- `triptrack://invite/[inviteId]?tripId=[tripId]` — trip invitation landing
- `triptrack://receipts/[receiptId]` — open a specific receipt (for notification deep links)
- `triptrack://trips/[tripId]` — open a specific trip

### Step C2: Invite Landing Route

File: `app/invite/[inviteId].tsx`

This screen is reached when a user taps a `triptrack://invite/...` link.

```typescript
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { View, Text } from "@/tw";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import functions from "@react-native-firebase/functions";
import { PrimaryButton, SecondaryButton } from "@/components";

export default function InviteLandingScreen() {
  const { inviteId } = useLocalSearchParams<{ inviteId: string; tripId: string }>();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();

  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    firestore()
      .collection("tripInvitations")
      .doc(inviteId)
      .get()
      .then(doc => {
        if (!doc.exists) {
          setError("This invitation link is invalid or has expired.");
        } else {
          setInvite(doc.data());
        }
        setLoading(false);
      });
  }, [inviteId]);

  async function handleJoin() {
    setJoining(true);
    try {
      // resolveGhostParticipant Cloud Function (implemented in Plan 04 Step 10):
      // 1. Verifies the invite is valid and not expired
      // 2. Checks if the caller's email matches a ghost participant (isGhost: true, email match)
      // 3. If matched: atomically updates participants array (sets isGhost: false, uid: caller.uid)
      //    and adds uid to memberUids, migrates expenses and settlements
      // 4. If no ghost match: adds caller as a new participant
      const resolveGhost = functions().httpsCallable("resolveGhostParticipant");
      await resolveGhost({ tripId, inviteId });
      router.replace(`/(tabs)/trips/${tripId}`);
    } catch (e: any) {
      setError(e.message ?? "Failed to join trip. Please try again.");
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color="#02ba41" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-surface px-6">
        <Text className="text-2xl font-extrabold text-on-surface mb-2">Invalid Invite</Text>
        <Text className="text-on-surface-variant text-center mb-8">{error}</Text>
        <SecondaryButton label="Go Home" onPress={() => router.replace("/(tabs)/")} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface px-6">
      <View className="flex-1 items-center justify-center gap-4">
        <View
          className="w-20 h-20 bg-primary-container rounded-3xl items-center justify-center"
          style={{ borderCurve: "continuous" }}
        >
          {/* terrain / map icon */}
        </View>
        <Text className="text-3xl font-extrabold text-on-surface text-center">
          You're invited!
        </Text>
        <Text className="text-on-surface-variant text-center text-base">
          <Text className="font-bold text-on-surface">{invite.invitedByName}</Text>
          {" "}invited you to join{" "}
          <Text className="font-bold text-on-surface">{invite.tripName}</Text>.
        </Text>
      </View>

      <View className="gap-4 pb-12">
        {!auth().currentUser ? (
          <>
            <Text className="text-center text-on-surface-variant text-sm">
              Sign in to join this trip and track expenses together.
            </Text>
            <PrimaryButton
              label="Sign In to Join"
              onPress={() => router.push(`/(auth)/onboarding?redirect=/invite/${inviteId}`)}
            />
          </>
        ) : (
          <PrimaryButton
            label={joining ? "Joining…" : "Join Trip"}
            onPress={handleJoin}
            disabled={joining}
          />
        )}
        <SecondaryButton label="Maybe Later" onPress={() => router.replace("/(tabs)/")} />
      </View>
    </View>
  );
}
```

> **Ghost resolution recap (implemented in Plan 04 Step 10):** The `resolveGhostParticipant` Cloud Function checks if the authenticated caller's email matches a participant in the trip where `isGhost === true`. If matched, it replaces the ghost entry with `{ isGhost: false, uid: callerUid }` and migrates all expenses/settlements referencing the old ghost ID. If no match, it adds the caller as a new participant. All operations are in a single Firestore batch.

### Step C3: Redirect After Sign-In

When a user taps "Sign In to Join" from the invite screen, the onboarding screen receives a `redirect` query param. The onboarding screen (Plan 04 Step 3) already handles this:

```typescript
// app/(auth)/onboarding.tsx — already implemented in Plan 04
const redirect = useLocalSearchParams<{ redirect?: string }>().redirect;

async function onSignInSuccess() {
  if (redirect) {
    router.replace(redirect as any);
  } else {
    router.replace("/(tabs)/");
  }
}
```

### Step C4: Invite Route Registration

Register `app/invite/[inviteId].tsx` in `app/_layout.tsx`:

```typescript
<Stack.Screen name="invite/[inviteId]" options={{ headerShown: false }} />
```

---

## Firestore Index Addition

Add to `firestore.indexes.json` (already covered in Plan 05):

```json
{
  "collectionGroup": "tripInvitations",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "inviteeEmail", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

---

## Deliverables Checklist

### Part A: Trip Creation
- [x] `app/trips/new.tsx` — create trip form with name, dates, participant add
- [x] ~~AppUser participant search by email~~ **Not implemented** — all added participants are ghost. Ghost → AppUser resolution happens via deep link / `resolveGhostParticipant`.
- [x] GhostParticipant add flow (name + optional email/phone); uses `isGhost: true`
- [x] `handleCreateTrip` maps form state to `TripParticipant[]` with correct field names
- [x] Invite link generated post-save and shared via `Share.share()`

### Part B: Receipt Detail
- [x] `app/receipts/[receiptId].tsx` — image viewer, data card, linked warranty/expense sections
- [x] Image loads from `receipt.imageUri` (Firebase Storage URL) or local filesystem fallback (conditional render — not `placeholder` prop)
- [x] Inline editing for all OCR-extracted fields; category uses chip row not `@react-native-picker/picker`
- [x] Low-confidence OCR badge when `confidence < 0.7` (requires `confidence` field added to `Receipt` + `FirestoreReceipt`)
- [x] Delete flow with confirmation dialog; also deletes linked warranty if `isWarranty === true`; Google Drive backup preserved
- [x] All receipt row taps throughout the app navigate to `app/receipts/[receiptId]`

### Part C: Deep Linking
- [x] `app/invite/[inviteId].tsx` — invite landing with join + sign-in flows
- [x] `invite/[inviteId]` Stack.Screen registered in `app/_layout.tsx`
- [x] `handleJoin` calls `resolveGhostParticipant` Cloud Function (deployed in Plan 04)
- [x] Onboarding `redirect` param handled for post-sign-in navigation (implemented in Plan 04)
- [x] `tripInvitations` composite index in `firestore.indexes.json` (Plan 05)
