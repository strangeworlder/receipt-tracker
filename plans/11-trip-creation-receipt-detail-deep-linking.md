# Plan 11: Trip Creation, Receipt Detail & Deep Linking

> **Prerequisite:** Plan 08 (Auth & Users), Plan 09 (Data Layer).
> **Blocks:** Nothing — these are standalone additions that other plans reference but never define.

This plan covers three gaps identified in the deep analysis:
1. **Trip Creation Flow** — the entry point for new trips with participant invitation.
2. **Receipt Detail Screen** — the screen reached by tapping a receipt anywhere in the app.
3. **Deep Linking** — scheme configuration and the invite landing route required for ghost-to-AppUser upgrades.

> **NativeWind v5 import rule:** All `View`, `Text`, `ScrollView`, `Pressable`, `TextInput` imports **must** come from `@/tw`, **not** from `react-native`. `Image` imports come from `@/tw/image` (uses `expo-image` internally).

> **Dependencies required for this plan (if not already installed from Plan 01):**
> ```bash
> npx expo install expo-image                              # Receipt detail image display
> npx expo install @react-native-community/datetimepicker  # Trip creation date pickers
> npx expo install @react-native-firebase/functions        # resolveGhostParticipant callable
> ```

---

## Part A: Trip Creation Flow

### New Files

```
app/
  trips/
    new.tsx          # Create trip form (name, dates, add participants)
```

### Step A1: "New Trip" Entry Points

The trip creation screen is reachable from two places:
- The Trips tab (`app/trips/index.tsx`) empty state — "Create Your First Trip" button.
- The FAB on the Trips tab — replaces the "Add Carpool" FAB from Plan 06 Step A6 for users with no trips. When at least one trip exists the FAB creates a new carpool instead.

### Step A2: Create Trip Form

File: `app/trips/new.tsx`

#### Layout (ScrollView, 3 sections):

**Section 1 — Trip Details:**
- Trip name input: `bg-surface-container-low rounded-2xl px-4 py-4 text-on-surface font-semibold`
- Start date picker: row with `calendar_today` icon + date display; tapping opens a date sheet
- End date picker: same pattern
- Use `@react-native-community/datetimepicker` (already installed from Plan 01) in modal/bottom-sheet mode

**Section 2 — Participants:**
- Header: "Who's coming?" with "Add Person" button
- Existing participant chips (added participants listed as removable pills)
- **Add AppUser:** Text input for email — looks up the user in Firestore `users` collection by email. If found, shows their avatar + name for confirmation. If not found, offers to add as a ghost.
- **Add GhostParticipant:** If email lookup fails, show "Add [name] as a guest (no account needed)" — just ask for their name and optionally phone number.
- The current user is always included as the first participant (cannot be removed).

**Section 3 — Invite Link:**
- After adding participants, show a "Generate Invite Link" button.
- Tapping creates a `tripInvitations` document and shows a shareable deep link.
- The share sheet opens via React Native's `Share.share()` API.

#### State management (local `useState`, not Zustand):

```typescript
interface NewTripFormState {
  name: string;
  startDate: string;
  endDate: string;
  participants: Array<
    | { type: "app_user"; uid: string; displayName: string; avatarUrl?: string }
    | { type: "ghost"; displayName: string; email?: string; phone?: string }
  >;
}
```

#### Save action:

```typescript
async function handleCreateTrip(form: NewTripFormState): Promise<void> {
  // 1. Map local form participants to TripParticipant shape
  const uid = requireAuth();
  const participants: TripParticipant[] = [
    // Current user is always first
    { id: uid, type: "app_user", displayName: currentUser.displayName, ... },
    ...form.participants.map(p =>
      p.type === "app_user"
        ? { id: p.uid, type: "app_user", displayName: p.displayName, ... }
        : createGhostParticipant(p.displayName, { email: p.email, phone: p.phone })
    ),
  ];

  // 2. Create the trip in Firestore
  const tripId = await tripService.createTrip({
    name: form.name,
    startDate: form.startDate,
    endDate: form.endDate,
    participants,
  });

  // 3. Create invite invitations for each AppUser participant (not ghost)
  const appUserParticipants = form.participants.filter(p => p.type === "app_user");
  await Promise.all(
    appUserParticipants.map(p =>
      tripService.createInvitation(tripId, (p as any).uid, (p as any).email)
    )
  );

  // 4. Navigate to the new trip
  router.replace(`/trips/${tripId}`);
}
```

### Step A3: `tripService.createInvitation`

Add to `src/services/tripService.ts`:

```typescript
export async function createInvitation(
  tripId: string,
  invitedByUid: string,
  inviteeEmail?: string
): Promise<string> {
  const uid = requireAuth();
  const inviteId = generateUUID();
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 7); // invites expire in 7 days

  await firestore().collection("tripInvitations").doc(inviteId).set({
    tripId,
    tripName: (await firestore().collection("trips").doc(tripId).get()).data()?.name ?? "",
    invitedByUid: uid,
    invitedByName: (await getUserProfile(uid))?.displayName ?? "Someone",
    inviteeEmail,
    status: "pending",
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  return inviteId;
}

export function buildInviteLink(inviteId: string, tripId: string): string {
  // Uses the deep link scheme defined in app.config.ts
  return `triptrack://invite/${inviteId}?tripId=${tripId}`;
}
```

---

## Part B: Receipt Detail Screen

### New File

```
app/
  receipts/
    [receiptId].tsx    # Receipt detail — image, OCR data, edit, linked warranty/expense
```

This is the screen reached by tapping any receipt row throughout the app (Dashboard recent scans, Trip Summary recent receipts, Scans tab list).

### Step B1: Screen Layout

File: `app/receipts/[receiptId].tsx`

```typescript
import { useLocalSearchParams } from "expo-router";

export default function ReceiptDetailScreen() {
  const { receiptId } = useLocalSearchParams<{ receiptId: string }>();
  // Load receipt from store: useReceiptStore(state => state.receipts.find(r => r.id === receiptId))
}
```

#### Layout (ScrollView):

**Section 1 — Image viewer:**
- Full-width image: `w-full aspect-[3/4] rounded-3xl` using `<Image>` from `@/tw/image` (which wraps `expo-image`)
- If `firebaseStorageUrl` is available, load from URL; otherwise load from local filesystem URI.
- If no image available, show a placeholder with `receipt_long` icon.
- Overlay at bottom: `syncStatus` badge — "Saved locally", "Syncing…", "Synced" with appropriate icon.

**Section 2 — Receipt data card:**
- `bg-surface-container-low rounded-3xl p-6`
- Merchant name: `text-2xl font-extrabold text-primary` (editable — tap to edit)
- Date: `text-sm text-on-surface-variant` with `calendar_today` icon (editable)
- Amount: `text-xl font-bold text-on-surface` with `payments` icon (editable)
- Category: dropdown/chip (editable, same options as scanner)
- OCR confidence badge: shown if `confidence < 0.7` — `bg-error-container text-on-error-container text-xs rounded-full px-3 py-1` "Low confidence — please verify"

**Section 3 — Warranty link (conditional):**
- Only shown if `receipt.isWarranty === true`
- `bg-secondary-container rounded-2xl p-5`
- `verified_user` icon + "Warranty Tracked" headline
- Product name, expiration date
- "Edit Warranty" link — navigates to the warranty detail (bottom sheet or modal)

**Section 4 — Linked expense (conditional):**
- Only shown if the receipt is linked to a trip expense (`receipt.tripId` is set)
- `bg-primary-container rounded-2xl p-5`
- `folder_shared` icon + trip name
- "View in Trip" link — navigates to `app/trips/[tripId].tsx`

**Section 5 — Actions row:**
- "Edit" button (secondary) — puts all fields into edit mode
- "Delete" button (destructive, text-only) — shows confirmation dialog before calling `receiptService.deleteReceipt()`
- "Share" button — opens native share sheet for the receipt image

### Step B2: Inline Editing

When the user taps "Edit":
- Each field switches from display text to an editable `TextInput`
- Amount field uses `keyboardType="decimal-pad"`
- Save button appears at the bottom: calls `receiptService.updateReceipt(receiptId, updates)`
- On save, navigate back or show a success toast

### Step B3: Delete Flow

```typescript
async function handleDelete(): Promise<void> {
  // Show confirmation Alert
  Alert.alert(
    "Delete Receipt",
    "This will permanently delete the receipt and its image. This cannot be undone.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await receiptService.deleteReceipt(receiptId);
          // If linked to warranty, delete that too
          if (receipt.isWarranty) {
            const warranty = warrantyStore.warranties.find(w => w.receiptId === receiptId);
            if (warranty) await warrantyService.deleteWarranty(warranty.id);
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

### Step C1: Configure Deep Link Scheme

The `app.config.ts` (Plan 01 Step 10) already sets `scheme: "triptrack"`. expo-router handles URL routing automatically when the scheme is configured.

Supported deep link URLs:
- `triptrack://invite/[inviteId]?tripId=[tripId]` — trip invitation landing
- `triptrack://receipts/[receiptId]` — open a specific receipt (for notification deep links)
- `triptrack://trips/[tripId]` — open a specific trip

### Step C2: Invite Landing Route

File: `app/invite/[inviteId].tsx`

```typescript
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import functions from "@react-native-firebase/functions";
import { PrimaryButton, SecondaryButton } from "../../src/components";

export default function InviteLandingScreen() {
  const { inviteId } = useLocalSearchParams<{ inviteId: string; tripId: string }>();
  const tripId = useLocalSearchParams<{ tripId: string }>().tripId;
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
      const resolveGhost = functions().httpsCallable("resolveGhostParticipant");
      await resolveGhost({ tripId, inviteId });
      router.replace(`/trips/${tripId}`);
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
      {/* Hero */}
      <View className="flex-1 items-center justify-center gap-4">
        <View className="w-20 h-20 bg-primary-container rounded-3xl items-center justify-center">
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

      {/* Action buttons */}
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

### Step C3: Redirect After Sign-In

When a user taps "Sign In to Join" from the invite landing screen, the onboarding screen receives a `redirect` query param. After successful sign-in:

```typescript
// app/(auth)/onboarding.tsx — amended sign-in success handler
const redirect = useLocalSearchParams<{ redirect?: string }>().redirect;

async function onSignInSuccess() {
  if (redirect) {
    router.replace(redirect as any);
  } else {
    router.replace("/(tabs)/");
  }
}
```

### Step C4: Verify `@react-native-firebase/functions` is installed

This should already be installed from Plan 01 Step 2. Verify it is in `package.json`. If not:
```bash
npx expo install @react-native-firebase/functions
npx expo prebuild  # regenerate native dirs
```

The base `@react-native-firebase/app` plugin in `app.config.ts` covers Cloud Functions automatically.

---

## Firestore Index Addition

Add to `firestore.indexes.json` for the invitation lookup by email:

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
- [ ] `app/trips/new.tsx` — create trip form with name, dates, participant search/add
- [ ] AppUser participant search by email (Firestore `users` collection lookup)
- [ ] GhostParticipant add flow (name + optional contact)
- [ ] `tripService.createInvitation()` — creates `tripInvitations` document + returns invite link
- [ ] `tripService.buildInviteLink()` — generates `triptrack://invite/[id]` deep link
- [ ] Share sheet on invite link generation (React Native `Share.share()`)

### Part B: Receipt Detail
- [ ] `app/receipts/[receiptId].tsx` — detail screen with image viewer, data card, linked warranty/expense
- [ ] Inline editing for all OCR-extracted fields
- [ ] Delete flow with confirmation dialog
- [ ] `receiptService.deleteReceipt()` — deletes Firestore doc, Storage file, and linked local file
- [ ] Low-confidence OCR badge when `confidence < 0.7`
- [ ] All receipt taps throughout the app navigate to `app/receipts/[receiptId]`

### Part C: Deep Linking
- [ ] `app.config.ts` has `scheme: "triptrack"` (already in Plan 01 Step 10)
- [ ] `app/invite/[inviteId].tsx` — invite landing screen with join + sign-in flows
- [ ] `@react-native-firebase/functions` installed
- [ ] `resolveGhostParticipant` Cloud Function deployed (see Plan 08 Step 9)
- [ ] Onboarding screen handles `redirect` query param for post-sign-in navigation
- [ ] Additional composite index for `tripInvitations` email+status query added to `firestore.indexes.json`
