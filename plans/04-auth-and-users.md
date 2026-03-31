# Plan 4: Authentication & User Management

> **Prerequisite:** Plan 3 (Architecture & Firebase Setup) — Firebase project must be configured and service stubs created.
> **Blocks:** Plans 05, 06, 07, 08, 09, 10.

This plan covers the full authentication flow, user profile management in Firestore, the onboarding screen, token management for Firebase and Google Drive, the ghost participant upgrade path via Cloud Function, and the Settings screen.

---

## Screen Map

```
app/
  (auth)/
    _layout.tsx          # Auth-gated layout (no auth guard here — root handles it)
    onboarding.tsx       # Sign-in screen (Google + Apple + offline)
  settings.tsx           # User profile, Drive sync, sign out (modal route)
```

The root `app/_layout.tsx` is amended to check auth state and redirect accordingly.

---

## Step 1: Auth State Guard in Root Layout

Amend `app/_layout.tsx` to add an auth state observer. The current implementation only loads fonts. Add the following:

```typescript
// app/_layout.tsx (amended — add these imports at the top)
import auth from "@react-native-firebase/auth";
import { useEffect, useState } from "react";
import { useRouter, useSegments } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { upsertUserProfile, getUserProfile } from "@/services/userService";
import { registerForPushNotifications, configureGoogleSignIn } from "@/services/authService";
import { startReceiptSync, startWarrantySync, teardownAll } from "@/services/syncService";
import { startQueueProcessor } from "@/services/driveService";

// Inside RootLayout, after fontsLoaded check, add:
const [user, setUser] = useState(auth().currentUser);
const [authLoading, setAuthLoading] = useState(true);
const router = useRouter();
const segments = useSegments();

useEffect(() => {
  configureGoogleSignIn();

  const unsubscribe = auth().onAuthStateChanged(async newUser => {
    if (newUser && !newUser.isAnonymous) {
      await upsertUserProfile();
      await registerForPushNotifications();
      startReceiptSync();
      startWarrantySync();
      startQueueProcessor();
      const profile = await getUserProfile(newUser.uid);
      useAuthStore.getState().setUser(profile, false);
    } else {
      useAuthStore.getState().setUser(null, newUser?.isAnonymous ?? false);
    }
    setUser(newUser);
    setAuthLoading(false);
  });

  return () => {
    unsubscribe();
    teardownAll();
  };
}, []);

useEffect(() => {
  if (authLoading || !fontsLoaded) return;
  const inAuthGroup = segments[0] === "(auth)";
  if (!user && !inAuthGroup) {
    router.replace("/(auth)/onboarding");
  } else if (user && inAuthGroup) {
    router.replace("/(tabs)/");
  }
}, [user, authLoading, segments, fontsLoaded]);
```

Also add the `(auth)` Stack.Screen if not present (already in the current implementation):
```typescript
<Stack.Screen name="(auth)" options={{ headerShown: false }} />
```

---

## Step 2: `app/(auth)/_layout.tsx`

```typescript
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
```

---

## Step 3: Onboarding Screen

File: `app/(auth)/onboarding.tsx`

### Layout

1. **Hero section** — top half:
   - App logo mark (`terrain` icon, large `bg-primary rounded-3xl` container)
   - App name: "TripTrack" — `text-5xl font-extrabold text-primary`
   - Tagline: "Track receipts, split expenses, plan trips." — `text-on-surface-variant text-lg text-center`

2. **Sign-in section** — bottom half, inside a `bg-surface-container-lowest rounded-t-3xl` card:
   - Heading: "Get started" — `text-2xl font-bold`
   - Subtext: "Sign in to sync your data and collaborate with friends."
   - **Google Sign-In button:**
     - White background, Google logo, "Continue with Google"
     - `bg-white border border-outline/20 rounded-2xl py-4 shadow-sm`
   - **Apple Sign-In button** — iOS only:
     - Render conditionally: `process.env.EXPO_OS === "ios"` (never `Platform.OS`)
     - Black background, Apple logo, "Continue with Apple"
     - `bg-black rounded-2xl py-4`
   - **Divider:** "or" in `text-on-surface-variant text-xs`
   - **Offline option:** "Use offline (no sync)" — `text-primary text-sm font-semibold`
     - Creates an anonymous Firebase Auth session

3. **Privacy note** at bottom: "By continuing you agree to our Terms of Service and Privacy Policy." — `text-xs text-on-surface-variant text-center`

### Sign-in success redirect

```typescript
// Accept redirect param for post-sign-in navigation (used by invite landing screen)
const redirect = useLocalSearchParams<{ redirect?: string }>().redirect;

async function onSignInSuccess() {
  if (redirect) {
    router.replace(redirect as any);
  } else {
    router.replace("/(tabs)/");
  }
}
```

---

## Step 4: Google Sign-In Flow

File: `src/services/authService.ts`

> **API note (v13+):** `@react-native-google-signin/google-signin` v13 changed the return type of `signIn()`. It now returns a union `SignInSuccessResponse | CancelledResponse`. Use the `isSuccessResponse()` type predicate before accessing `response.data.idToken`. The old pattern of destructuring `{ idToken }` directly no longer works.

```typescript
import auth from "@react-native-firebase/auth";
import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import * as SecureStore from "expo-secure-store";

export function configureGoogleSignIn(): void {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
    offlineAccess: true,
  });
}

export async function signInWithGoogle(): Promise<void> {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();

  if (!isSuccessResponse(response)) {
    throw new Error("Google Sign-In was cancelled");
  }

  const { idToken } = response.data;
  const credential = auth.GoogleAuthProvider.credential(idToken);
  await auth().signInWithCredential(credential);

  const { accessToken } = await GoogleSignin.getTokens();
  await saveGoogleTokens({ accessToken });
}

export async function saveGoogleTokens(tokens: { accessToken: string }): Promise<void> {
  await SecureStore.setItemAsync("google_access_token", tokens.accessToken);
}

export async function getGoogleAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync("google_access_token");
}

export async function refreshGoogleAccessToken(): Promise<string> {
  const { accessToken } = await GoogleSignin.getTokens();
  await saveGoogleTokens({ accessToken });
  return accessToken;
}
```

---

## Step 5: Apple Sign-In Flow (iOS only)

```typescript
// src/services/authService.ts (addition)
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

> **Note:** Apple Sign-In does not provide a Google OAuth token. Users who sign in with Apple will not have Google Drive backup until they explicitly link their Google account in Settings.

---

## Step 6: Anonymous (Offline) Sign-In

```typescript
// src/services/authService.ts (addition)
export async function signInAnonymously(): Promise<void> {
  await auth().signInAnonymously();
}

export async function linkWithGoogle(): Promise<void> {
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) throw new Error("Cancelled");
  const { idToken } = response.data;
  const credential = auth.GoogleAuthProvider.credential(idToken);
  await auth().currentUser?.linkWithCredential(credential);
  // Auth state observer fires; user profile is created in Firestore
}
```

---

## Step 7: Sign-Out

```typescript
// src/services/authService.ts (addition)
import * as SecureStore from "expo-secure-store";

export async function signOut(): Promise<void> {
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

## Step 8: User Profile in Firestore

File: `src/services/userService.ts`

```typescript
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import messaging from "@react-native-firebase/messaging";
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

---

## Step 9: FCM Token Registration

```typescript
// src/services/authService.ts (addition)
import messaging from "@react-native-firebase/messaging";
import { updateFcmToken } from "./userService";

export async function registerForPushNotifications(): Promise<void> {
  const permission = await messaging().requestPermission();
  const granted =
    permission === messaging.AuthorizationStatus.AUTHORIZED ||
    permission === messaging.AuthorizationStatus.PROVISIONAL;

  if (!granted) return;

  const token = await messaging().getToken();
  await updateFcmToken(token);

  messaging().onTokenRefresh(newToken => updateFcmToken(newToken));
}
```

---

## Step 10: Ghost Participant Upgrade — Cloud Function

When a ghost participant later installs the app and accepts a trip invite, the app calls a callable Cloud Function that:
1. Verifies the invite is valid, not expired, and matches the trip
2. Checks if the caller's email matches a ghost participant
3. Atomically updates the `participants` array (replaces ghost entry with AppUser data) and adds `uid` to `memberUids`
4. Migrates all expenses and settlements referencing the old ghost UUID to the new `uid`

> **Security note:** A new user is NOT in the trip's `memberUids` array. Firestore rules deny reading the trip document until the user is added. This migration **cannot** be done entirely on the client — it must use a Cloud Function with admin privileges.

> **firebase-functions v6+ uses the v2 API.** Import `onCall` and `HttpsError` from `"firebase-functions/v2/https"`. The handler receives a single `request` parameter with `request.data` and `request.auth`.

File: `functions/src/resolveGhostParticipant.ts`

```typescript
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
  // Note: TripParticipant uses isGhost: boolean (not type: "ghost") in this codebase
  const tripRef = admin.firestore().collection("trips").doc(tripId);
  const tripDoc = await tripRef.get();
  if (!tripDoc.exists) throw new HttpsError("not-found", "Trip not found");
  const trip = tripDoc.data()!;

  const ghostIndex = trip.participants?.findIndex(
    (p: any) => p.isGhost === true && p.email === email
  ) ?? -1;

  if (ghostIndex === -1) {
    // No ghost match — add the user as a new participant
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
    uid,
    isGhost: false,
    managedBy: undefined,
  };

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
        splitAmong: (expenseData.splitAmong as string[]).map((id: string) =>
          id === oldGhostId ? uid : id
        ),
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
    const sd = settlementDoc.data();
    if (sd.fromParticipantId === oldGhostId || sd.toParticipantId === oldGhostId) {
      batch.update(settlementDoc.ref, {
        fromParticipantId: sd.fromParticipantId === oldGhostId ? uid : sd.fromParticipantId,
        toParticipantId: sd.toParticipantId === oldGhostId ? uid : sd.toParticipantId,
      });
    }
  });

  batch.update(inviteDoc.ref, { status: "accepted" });
  await batch.commit();

  return { merged: true, oldGhostId };
});
```

Update `functions/src/index.ts`:
```typescript
import * as admin from "firebase-admin";
admin.initializeApp();
export { resolveGhostParticipant } from "./resolveGhostParticipant";
```

### Deploy

```bash
firebase deploy --only functions
# Test locally first:
firebase emulators:start --only functions
```

### Client-side call (used in Plan 10 invite landing screen)

```typescript
import functions from "@react-native-firebase/functions";

export async function joinTripViaInvite(tripId: string, inviteId: string): Promise<void> {
  const resolveGhost = functions().httpsCallable("resolveGhostParticipant");
  await resolveGhost({ tripId, inviteId });
  // Auth state observer fires and updates stores automatically
}
```

---

## Step 11: Zustand Auth Store

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
  // isAnonymous is passed explicitly:
  //   signed-out  → user=null, isAnonymous=false
  //   anonymous   → user=null, isAnonymous=true
  //   real user   → user=AppUser, isAnonymous=false
  setUser: (user, isAnonymous) => set({ user, isAnonymous }),
  setDriveLinked: linked => set({ driveLinked: linked }),
}));
```

---

## Step 12: Settings Screen

File: `app/settings.tsx` (modal route — NOT a tab)

Accessed via the TopAppBar gear icon: `router.push('/settings')`.

Already registered in `app/_layout.tsx`:
```typescript
<Stack.Screen name="settings" options={{ presentation: "modal", headerShown: false }} />
```

### Sections

1. **Profile card** — avatar, display name, email, sign-in provider badge ("Google" / "Apple" / "Offline")

2. **Google Drive sync status:**
   - Drive linked: "Google Drive Backup: Active" with green dot + "View folder" link
   - Not linked (Apple user): "Link Google Account" button → calls `linkWithGoogle()`
   - Anonymous user: "Sign in to enable backup"

3. **Notifications toggle** — enable/disable expiry reminders and settlement push notifications

4. **Sign out** button — red text, confirmation dialog before calling `signOut()` from `authService`

---

## Deliverables Checklist

- [ ] `app/(auth)/_layout.tsx` — Stack layout for auth screens
- [ ] `app/(auth)/onboarding.tsx` — onboarding with Google + Apple + offline sign-in
- [ ] `app/_layout.tsx` amended — auth state guard, redirect logic, starts sync on login, tears down on logout
- [ ] `src/services/authService.ts` — Google Sign-In (v13 `isSuccessResponse` pattern), Apple Sign-In, anonymous sign-in, sign-out, token storage
- [ ] `src/services/userService.ts` — Firestore user profile CRUD, FCM token management
- [ ] `expo-secure-store` used for Google OAuth token storage (already installed in Plan 01)
- [ ] `src/stores/authStore.ts` — Zustand auth state
- [ ] `app/settings.tsx` — profile, Drive sync status, notifications, sign-out (modal route)
- [ ] `functions/src/resolveGhostParticipant.ts` — Cloud Function using `isGhost: boolean` field (not `type: "ghost"`)
- [ ] `functions/src/index.ts` updated to export `resolveGhostParticipant`
- [ ] Cloud Function deployed (`firebase deploy --only functions`)
- [ ] `@react-native-firebase/functions` installed (from Plan 01)
- [ ] FCM token registration called on sign-in
- [ ] Apple Sign-In rendered using `process.env.EXPO_OS === "ios"` (not `Platform.OS`)
