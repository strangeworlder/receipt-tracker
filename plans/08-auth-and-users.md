# Plan 8: Authentication & User Management

> **Prerequisite:** Plan 7 (Architecture Overview) — Firebase project must be set up.
> **Blocks:** Plans 09, 10 (data layer and receipt pipeline both depend on auth being in place).

This plan covers the full authentication flow, user profile management in Firestore, the onboarding screen (a new screen not in plans 01–06), token management for both Firebase and Google Drive, and the ghost participant lifecycle.

---

## Screen Map (new screens added by this plan)

```
app/
  (auth)/
    _layout.tsx          # Auth-gated layout (redirect authenticated users away from auth screens)
    onboarding.tsx       # Sign-in screen (Google + Apple)
  settings.tsx           # User profile, Drive link status, sign out (modal route — NOT in tabs)
```

The root `app/_layout.tsx` (from Plan 01) is amended to check auth state and redirect accordingly.

### `app/(auth)/_layout.tsx`

```typescript
import { Stack } from "expo-router";

export default function AuthLayout() {
  // This layout intentionally has no auth guard — the root _layout.tsx handles
  // redirecting authenticated users away from /(auth)/ routes.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
```

---

## Step 1: Auth State Guard in Root Layout

Amend `app/_layout.tsx` to wrap the app in an auth state observer. Before rendering any tab, verify the user is signed in.

```typescript
// app/_layout.tsx (amended)
import auth from "@react-native-firebase/auth";
import { useEffect, useState } from "react";
import { useRouter, useSegments } from "expo-router";

export default function RootLayout() {
  const [user, setUser] = useState(auth().currentUser);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async newUser => {
      if (newUser && !newUser.isAnonymous) {
        // Upsert Firestore profile and register FCM token
        await upsertUserProfile();
        await registerForPushNotifications();
        // Start real-time sync listeners
        startReceiptSync();
        startWarrantySync();
        // Start Drive queue processor
        startQueueProcessor();
        // Update auth store with profile
        const profile = await getUserProfile(newUser.uid);
        useAuthStore.getState().setUser(profile, false);
      } else {
        useAuthStore.getState().setUser(null, newUser?.isAnonymous ?? false);
      }
      setUser(newUser);
      setLoading(false);
    });
    return () => {
      unsubscribe();
      teardownAll();
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/onboarding");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)/");
    }
  }, [user, loading, segments]);

  if (loading) return <SplashScreen />;
  return <Stack />;
}
```

---

## Step 2: Onboarding Screen

File: `app/(auth)/onboarding.tsx`

This is the only screen visible to unauthenticated users. It introduces the app and offers two sign-in methods.

### Layout:

1. **Hero section** — top half of the screen:
   - App logo mark (the `terrain` icon from the mockup in a large `bg-primary rounded-3xl` container)
   - App name: "TripTrack" — `text-5xl font-extrabold text-primary`
   - Tagline: "Track receipts, split expenses, plan trips." — `text-on-surface-variant text-lg text-center`

2. **Sign-in section** — bottom half, inside a `bg-surface-container-lowest rounded-t-3xl` card:
   - Heading: "Get started" — `text-2xl font-bold`
   - Subtext: "Sign in to sync your data and collaborate with friends."
   - **Google Sign-In button** — primary action:
     - White background, Google logo icon, "Continue with Google" label
     - `bg-white border border-outline/20 rounded-2xl py-4 shadow-sm`
   - **Apple Sign-In button** — iOS only (conditionally rendered with `process.env.EXPO_OS === "ios"`):
     - Black background, Apple logo icon, "Continue with Apple" label
     - `bg-black rounded-2xl py-4`
     - **Do NOT use `Platform.OS`** — use `process.env.EXPO_OS` per project conventions
   - **Divider:** "or" — `text-on-surface-variant text-xs`
   - **Continue without account** — text link at bottom:
     - "Use offline (no sync)" — `text-primary text-sm font-semibold`
     - Creates an anonymous Firebase Auth session; user can link an account later

3. **Privacy note** at the very bottom:
   - `text-xs text-on-surface-variant text-center`
   - "By continuing you agree to our Terms of Service and Privacy Policy."

---

## Step 3: Google Sign-In Flow

Google Sign-In is the primary auth method. It provides both a Firebase credential **and** a Google OAuth access token in a single user action. The access token is saved and later used to call the Google Drive API.

File: `src/services/authService.ts`

> **API update (v13+):** `@react-native-google-signin/google-signin` v13 changed the `signIn()` return type. It now returns a union `SignInSuccessResponse | CancelledResponse`. Use the `isSuccessResponse()` type predicate to check for success, then access `response.data.idToken`. The legacy pattern of destructuring `{ idToken }` directly from `signIn()` no longer works.
>
> **Two modules available:** The package now offers "Original Google Sign In" (free, uses legacy Android SDK) and "Universal Sign In" (`GoogleOneTapSignIn`, paid, uses Android Credential Manager). The code below uses the free Original module. Google deprecated the legacy Android Sign-In SDK in 2025 — for long-term support, consider the Universal module.

```typescript
import auth from "@react-native-firebase/auth";
import {
  GoogleSignin,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";

// Call once at app startup (e.g., in app/_layout.tsx)
export function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    scopes: [
      "https://www.googleapis.com/auth/drive.file", // Drive backup scope
    ],
    offlineAccess: true, // needed to get serverAuthCode
  });
}

export async function signInWithGoogle(): Promise<void> {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();

  // v13+: signIn() returns a union type — check for success before accessing data
  if (!isSuccessResponse(response)) {
    throw new Error("Google Sign-In was cancelled");
  }

  const { idToken, serverAuthCode } = response.data;

  // Firebase credential
  const credential = auth.GoogleAuthProvider.credential(idToken);
  await auth().signInWithCredential(credential);

  // Store the Google OAuth tokens for Drive API use
  const { accessToken } = await GoogleSignin.getTokens();
  await saveGoogleTokens({ accessToken, serverAuthCode });
}
```

### Token storage:

Google OAuth tokens are sensitive and must not go in AsyncStorage unencrypted. Use `expo-secure-store`:

```bash
npx expo install expo-secure-store
```

```typescript
import * as SecureStore from "expo-secure-store";

export async function saveGoogleTokens(tokens: { accessToken: string; serverAuthCode?: string | null }) {
  await SecureStore.setItemAsync("google_access_token", tokens.accessToken);
}

export async function getGoogleAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync("google_access_token");
}

export async function refreshGoogleAccessToken(): Promise<string> {
  // GoogleSignin.getTokens() returns a fresh access token, refreshing if expired
  const { accessToken } = await GoogleSignin.getTokens();
  await saveGoogleTokens({ accessToken });
  return accessToken;
}
```

---

## Step 4: Apple Sign-In Flow (iOS only)

Required by App Store guidelines whenever Google Sign-In or any other third-party social login is offered.

```typescript
import * as AppleAuthentication from "expo-apple-authentication";

export async function signInWithApple(): Promise<void> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  const { identityToken, fullName } = credential;
  if (!identityToken) throw new Error("Apple Sign-In failed: no identity token");

  const appleCredential = auth.AppleAuthProvider.credential(identityToken);
  const result = await auth().signInWithCredential(appleCredential);

  // Apple only sends the name on first sign-in; persist it immediately
  if (fullName?.givenName) {
    await result.user.updateProfile({
      displayName: `${fullName.givenName} ${fullName.familyName ?? ""}`.trim(),
    });
  }
}
```

> **Note:** Apple Sign-In does not provide a Google OAuth token. Users who sign in with Apple will not have Google Drive backup available until they explicitly link their Google account in Settings.

---

## Step 5: Anonymous (Offline) Sign-In

When a user taps "Use offline", create an anonymous Firebase Auth session. This allows:
- Full local app functionality
- Firestore writes (with security rules allowing anonymous write to their own data)
- Upgrading to a real account later without losing data

```typescript
export async function signInAnonymously(): Promise<void> {
  await auth().signInAnonymously();
}

export async function linkWithGoogle(): Promise<void> {
  // Called from Settings when an anonymous user wants to enable sync
  const { idToken } = await GoogleSignin.signIn();
  const credential = auth.GoogleAuthProvider.credential(idToken);
  await auth().currentUser?.linkWithCredential(credential);
  // Auth state observer fires; user profile is created in Firestore
}
```

---

## Step 6: User Profile in Firestore

After every sign-in, create or update the user's profile document. This is the single source of truth for display names and avatar URLs across the app.

File: `src/services/userService.ts`

```typescript
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import type { AppUser } from "../types";

const usersCollection = firestore().collection("users");

export async function upsertUserProfile(): Promise<void> {
  const firebaseUser = auth().currentUser;
  if (!firebaseUser || firebaseUser.isAnonymous) return;

  const profile: Partial<AppUser> = {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName ?? "Anonymous",
    email: firebaseUser.email ?? "",
    avatarUrl: firebaseUser.photoURL ?? undefined,
    googleDriveLinked: firebaseUser.providerData.some(p => p.providerId === "google.com"),
  };

  // merge: true so we don't overwrite fields like fcmToken on every login
  await usersCollection.doc(firebaseUser.uid).set(profile, { merge: true });
}

export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const doc = await usersCollection.doc(uid).get();
  return doc.exists ? (doc.data() as AppUser) : null;
}

export async function updateFcmToken(token: string): Promise<void> {
  const uid = auth().currentUser?.uid;
  if (!uid) return;
  await usersCollection.doc(uid).update({ fcmToken: token });
}
```

### When to call `upsertUserProfile`:

Call it in `app/_layout.tsx` inside the `onAuthStateChanged` observer, after the user state is confirmed non-null and non-anonymous.

---

## Step 7: FCM Token Registration

Push notifications require the device's FCM registration token to be stored in the user's Firestore document.

```typescript
// src/services/authService.ts (addition)
import messaging from "@react-native-firebase/messaging";

export async function registerForPushNotifications(): Promise<void> {
  const permission = await messaging().requestPermission();
  const granted =
    permission === messaging.AuthorizationStatus.AUTHORIZED ||
    permission === messaging.AuthorizationStatus.PROVISIONAL;

  if (!granted) return;

  const token = await messaging().getToken();
  await updateFcmToken(token);

  // Refresh token listener
  messaging().onTokenRefresh(newToken => updateFcmToken(newToken));
}
```

Call `registerForPushNotifications()` after `upsertUserProfile()` on sign-in.

---

## Step 8: Sign-Out

```typescript
export async function signOut(): Promise<void> {
  // Clear Google tokens
  await SecureStore.deleteItemAsync("google_access_token");
  try {
    await GoogleSignin.signOut();
  } catch {
    // May fail if user signed in with Apple — ignore
  }
  await auth().signOut();
  // Auth state observer fires; root layout redirects to onboarding
}
```

---

## Step 9: Ghost Participant Lifecycle

Ghost participants are managed entirely through `tripService.ts` (Plan 09). This section defines the lifecycle events and the upgrade path.

### Creating a ghost participant (in trip creation or editing):

```typescript
// src/services/tripService.ts
export function createGhostParticipant(
  name: string,
  contact?: { email?: string; phone?: string },
  managedBy?: string
): TripParticipant {
  return {
    id: generateUUID(),
    type: "ghost",
    displayName: name,
    email: contact?.email,
    phone: contact?.phone,
    avatarUrl: undefined,
    amountPaid: 0,
    amountOwed: 0,
    managedBy: managedBy ?? auth().currentUser?.uid,
  };
}
```

### Ghost participant upgrade flow:

> **Security note:** A newly-joining user is NOT yet in the trip's `memberUids` array. Firestore rules (`allow read: if isTripMember(tripId)`) will **deny** any attempt to read the trip document client-side before the user is added. This means the ghost resolution **cannot** be done entirely on the client.

**Recommended approach — Firebase Cloud Function:**

Create a callable Cloud Function `resolveGhostParticipant` that:
1. Receives `{ tripId, inviteId }` from the client.
2. Verifies the invite document (`tripInvitations/{inviteId}`) is valid, not expired, and belongs to this trip.
3. Checks if the caller's email matches a ghost participant in the trip.
4. Atomically updates the `participants` array (replaces ghost entry with AppUser data) and adds `uid` to `memberUids`.
5. Migrates all expenses and settlements referencing the old ghost UUID to the new `uid`.

> **firebase-functions v6+ uses the v2 API by default.** The v2 `onCall` handler receives a single `request` parameter (with `request.data` and `request.auth`) instead of v1's separate `(data, context)` parameters. Import `onCall` and `HttpsError` from `"firebase-functions/v2/https"`.

```typescript
// functions/src/resolveGhostParticipant.ts (Cloud Functions v2)
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const resolveGhostParticipant = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");

  const { tripId, inviteId } = request.data;
  const uid = request.auth.uid;
  const email = request.auth.token.email;

  // Validate the invitation
  const inviteDoc = await admin.firestore().collection("tripInvitations").doc(inviteId).get();
  if (!inviteDoc.exists) throw new HttpsError("not-found", "Invitation not found");
  const invite = inviteDoc.data()!;
  if (invite.status !== "pending") throw new HttpsError("failed-precondition", "Invitation already used");
  if (invite.tripId !== tripId) throw new HttpsError("invalid-argument", "Trip/invite mismatch");
  if (new Date(invite.expiresAt) < new Date()) throw new HttpsError("deadline-exceeded", "Invitation expired");

  // Find the matching ghost participant
  const tripRef = admin.firestore().collection("trips").doc(tripId);
  const tripDoc = await tripRef.get();
  if (!tripDoc.exists) throw new HttpsError("not-found", "Trip not found");
  const trip = tripDoc.data()!;

  const ghostIndex = trip.participants?.findIndex(
    (p: any) => p.type === "ghost" && p.email === email
  ) ?? -1;

  if (ghostIndex === -1) {
    // No ghost match — just add the user as a new participant
    await tripRef.update({
      memberUids: admin.firestore.FieldValue.arrayUnion(uid),
    });
    await inviteDoc.ref.update({ status: "accepted" });
    return { merged: false };
  }

  const oldGhostId = trip.participants[ghostIndex].id;
  const updatedParticipants = [...trip.participants];
  updatedParticipants[ghostIndex] = {
    ...updatedParticipants[ghostIndex],
    id: uid,
    type: "app_user",
    managedBy: null,
  };

  // Atomic batch: update trip + migrate all subcollection documents referencing oldGhostId
  const batch = admin.firestore().batch();
  batch.update(tripRef, {
    participants: updatedParticipants,
    memberUids: admin.firestore.FieldValue.arrayUnion(uid),
  });

  // Migrate expenses
  const expenses = await tripRef.collection("expenses").get();
  expenses.docs.forEach(expenseDoc => {
    const expenseData = expenseDoc.data();
    const needsUpdate =
      expenseData.paidBy === oldGhostId ||
      (expenseData.splitAmong as string[]).includes(oldGhostId);
    if (needsUpdate) {
      batch.update(expenseDoc.ref, {
        paidBy: expenseData.paidBy === oldGhostId ? uid : expenseData.paidBy,
        splitAmong: (expenseData.splitAmong as string[]).map((id: string) => id === oldGhostId ? uid : id),
        ...(expenseData.customAmounts?.[oldGhostId] !== undefined && {
          [`customAmounts.${uid}`]: expenseData.customAmounts[oldGhostId],
          [`customAmounts.${oldGhostId}`]: admin.firestore.FieldValue.delete(),
        }),
      });
    }
  });

  // Migrate settlements
  const settlements = await tripRef.collection("settlements").get();
  settlements.docs.forEach(settlementDoc => {
    const settlementData = settlementDoc.data();
    if (settlementData.fromParticipantId === oldGhostId || settlementData.toParticipantId === oldGhostId) {
      batch.update(settlementDoc.ref, {
        fromParticipantId: settlementData.fromParticipantId === oldGhostId ? uid : settlementData.fromParticipantId,
        toParticipantId: settlementData.toParticipantId === oldGhostId ? uid : settlementData.toParticipantId,
      });
    }
  });

  batch.update(inviteDoc.ref, { status: "accepted" });
  await batch.commit();

  return { merged: true, oldGhostId };
});
```

**Client-side call (in `app/invite/[inviteId].tsx`):**

```typescript
import functions from "@react-native-firebase/functions";

export async function joinTripViaInvite(tripId: string, inviteId: string): Promise<void> {
  const resolveGhost = functions().httpsCallable("resolveGhostParticipant");
  await resolveGhost({ tripId, inviteId });
  // Auth state observer will fire and update stores automatically
}
```

---

## Step 9.5: Firebase Cloud Functions Setup

The `resolveGhostParticipant` function defined in Step 9 requires the Firebase Cloud Functions runtime. This step covers the one-time setup.

### Initialize the Functions directory

```bash
# From the project root
firebase init functions
# Select: TypeScript, ESLint: yes, install dependencies: yes
```

This creates a `functions/` directory with its own `package.json`, `tsconfig.json`, and `src/index.ts`.

### Install server-side dependencies

```bash
cd functions
npm install firebase-functions@^6 firebase-admin@^13
npm install --save-dev @types/node
```

### `functions/src/index.ts`

> **v6 uses v2 API by default.** Imports from `firebase-functions/v2/https` instead of the top-level `firebase-functions`.

```typescript
import * as admin from "firebase-admin";
admin.initializeApp();

export { resolveGhostParticipant } from "./resolveGhostParticipant";
```

Move the `resolveGhostParticipant` function body from Step 9 into `functions/src/resolveGhostParticipant.ts`:

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const resolveGhostParticipant = onCall(async (request) => {
  // ... (full implementation from Step 9)
});
```

### Deploy

```bash
# Deploy only Cloud Functions (run from project root)
firebase deploy --only functions

# Test locally with Firebase emulator before deploying
firebase emulators:start --only functions
```

### Client-side: add `@react-native-firebase/functions`

This package should already be in `package.json` from Plan 01 Step 2. If not:
```bash
npx expo install @react-native-firebase/functions
npx expo prebuild  # regenerate native dirs
```

### `.firebaserc` and `firebase.json`

```json
// firebase.json — ensure functions are configured
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  }
}
```

---

## Step 10: Settings Screen

File: `app/settings.tsx` (modal route — NOT `app/(tabs)/settings.tsx`)

> **Routing:** Settings is accessed via the TopAppBar gear icon — it is NOT a visible tab in the bottom nav. Register it in the root `app/_layout.tsx`:
> ```typescript
> <Stack.Screen name="settings" options={{ presentation: "modal", title: "Settings" }} />
> ```
> The `TopAppBar` settings icon navigates via `router.push('/settings')`.
> 
> The 5-tab navigator (`(tabs)/_layout.tsx`) should contain only: Home, Scans, Split, Warranty, Trips.

This screen is referenced in the TopAppBar settings icon (Plan 01) but not implemented in existing plans. Add it here.

### Sections:

1. **Profile card** — avatar, display name, email, sign-in provider badge ("Google" / "Apple" / "Offline")
2. **Google Drive sync status:**
   - If Drive is linked: "Google Drive Backup: Active" with green dot + "View folder" link
   - If Drive is not linked (Apple sign-in user): "Link Google Account" button to enable backup
   - If anonymous: "Sign in to enable backup"
3. **Notifications toggle** — enable/disable expiry reminders and settlement push notifications
4. **Sign out** button — red text, confirmation dialog before signing out

---

## Zustand Auth Store

Create `src/stores/authStore.ts`:

```typescript
import { create } from "zustand";
import type { AppUser } from "../types";

interface AuthState {
  user: AppUser | null;
  isAnonymous: boolean;
  driveLinked: boolean;
  setUser: (user: AppUser | null, isAnonymous: boolean) => void;
  setDriveLinked: (linked: boolean) => void;
}

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  isAnonymous: false,
  driveLinked: false,
  // isAnonymous is passed explicitly from the Firebase auth state change observer
  // so the store correctly distinguishes: signed-out (user=null, isAnon=false) vs
  // anonymous session (user=null, isAnon=true) vs real user (user=AppUser, isAnon=false)
  setUser: (user, isAnonymous) => set({ user, isAnonymous }),
  setDriveLinked: linked => set({ driveLinked: linked }),
}));
```

The auth state observer in `app/_layout.tsx` calls `useAuthStore.getState().setUser(profile)` after fetching the Firestore profile.

---

## Deliverables Checklist

- [ ] `app/(auth)/_layout.tsx` — simple Stack layout for auth screens
- [ ] `app/(auth)/onboarding.tsx` — onboarding screen with Google + Apple + offline options
- [ ] `app/_layout.tsx` amended — auth state guard, redirect logic, starts sync on login, tears down on logout
- [ ] `src/services/authService.ts` — Google Sign-In, Apple Sign-In, anonymous sign-in, sign-out, token storage
- [ ] `src/services/userService.ts` — Firestore user profile CRUD, FCM token management
- [ ] `expo-secure-store` installed and used for Google OAuth token storage
- [ ] `src/stores/authStore.ts` — Zustand auth state with corrected `setUser(user, isAnonymous)` signature
- [ ] `app/settings.tsx` — profile, Drive sync status, notifications, sign-out (modal route, NOT a tab)
- [ ] Ghost participant creation helper in `tripService.ts`
- [ ] Ghost upgrade uses `resolveGhostParticipant` Cloud Function (NOT client-side direct Firestore write)
- [ ] `functions/` directory initialized (`firebase init functions`)
- [ ] `functions/src/resolveGhostParticipant.ts` Cloud Function deployed (`firebase deploy --only functions`)
- [ ] `@react-native-firebase/functions` installed for callable function invocation
- [ ] FCM token registration called on sign-in
- [ ] Apple Sign-In conditionally rendered using `process.env.EXPO_OS === "ios"` (NOT `Platform.OS`)
