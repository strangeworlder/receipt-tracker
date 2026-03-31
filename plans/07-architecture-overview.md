# Plan 7: Architecture Overview

> **Prerequisite:** Plan 1 (Project Foundation) must be completed first.
> **Blocks:** Plans 08, 09, 10 build on the decisions made here.

This document defines the full system architecture for TripTrack as a multi-user, offline-capable mobile app. It covers technology choices, the service layer design, the hybrid participant model, the offline-first strategy, and the specific amendments required to the existing plans (01–06).

---

## 1. System Architecture

TripTrack is structured in three tiers: the React Native frontend, the Firebase backend, and optional third-party APIs (Google Drive and on-device OCR).

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Native App (Expo)                     │
│                                                                 │
│  ┌──────────────┐   ┌──────────────────┐   ┌───────────────┐   │
│  │  UI Layer    │   │  Zustand Stores  │   │ Service Layer │   │
│  │  expo-router │──▶│  (local cache,   │──▶│ (Firebase SDK,│   │
│  │  NativeWind  │   │   reactive state)│   │  Drive API,   │   │
│  └──────────────┘   └──────────────────┘   │  ML Kit OCR)  │   │
│                                            └───────┬───────┘   │
└────────────────────────────────────────────────────┼───────────┘
                                                     │
              ┌──────────────────────────────────────┼───────────┐
              │             Firebase                 │           │
              │  ┌───────────┐  ┌───────────────┐   │           │
              │  │  Auth     │  │  Firestore    │◀──┘           │
              │  │  (Google, │  │  (structured  │               │
              │  │   Apple)  │  │   data +      │               │
              │  └───────────┘  │   offline)    │               │
              │                 └───────────────┘               │
              │  ┌───────────┐  ┌───────────────┐               │
              │  │  Storage  │  │  Cloud        │               │
              │  │  (receipt │  │  Messaging    │               │
              │  │  images)  │  │  (FCM push    │               │
              │  └───────────┘  │  notifications│               │
              │                 └───────────────┘               │
              └─────────────────────────────────────────────────┘
                      │                          │
         ┌────────────┘                          └────────────┐
         │                                                    │
┌────────▼──────────┐                            ┌───────────▼──────┐
│  Google Drive API │                            │  ML Kit (on-     │
│  (personal receipt│                            │  device OCR,     │
│   backup, user-   │                            │  no network      │
│   owned storage)  │                            │  required)       │
└───────────────────┘                            └──────────────────┘
```

---

## 2. Technology Choices

### 2.1 Firebase (core backend)

Firebase is chosen as the single backend platform for the following reasons:

| Requirement | Firebase Solution |
|---|---|
| Real-time collaboration on trips | Firestore real-time listeners |
| Offline use during trips (poor signal) | Firestore offline persistence (built-in) |
| Receipt image sharing within trips | Firebase Storage with security rules |
| Google Sign-In for auth AND Drive API | Firebase Auth + Google OAuth (single token flow) |
| Apple Sign-In (App Store requirement) | Firebase Auth with Apple provider |
| Push notifications for settlement reminders | Firebase Cloud Messaging (FCM) |
| Generous free tier for small-group apps | Spark plan: 50K reads/day, 1GB Firestore, 5GB Storage |

**Firebase packages required** (add to Plan 01 Step 2):

```bash
npx expo install @react-native-firebase/app @react-native-firebase/auth \
  @react-native-firebase/firestore @react-native-firebase/storage \
  @react-native-firebase/messaging

# Google Sign-In (also used for Drive OAuth scopes)
npm install @react-native-google-signin/google-signin

# Apple Sign-In (required by App Store when offering any social login)
npx expo install expo-apple-authentication
```

> **Note:** `@react-native-firebase` requires a bare Expo workflow (not Expo Go). The project must be initialized with `npx create-expo-app --template bare-minimum` or ejected. Add `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) to the project root — these are obtained from the Firebase Console and must never be committed to version control.

### 2.2 Google ML Kit (on-device OCR)

ML Kit's Text Recognition runs entirely on-device — no network required. This is critical because receipts are often scanned somewhere with poor connectivity (a restaurant, a gas station on a road trip).

> **Package choice for Expo SDK 53+:** Use `@infinitered/react-native-mlkit-text-recognition` (v4.0.0+ for SDK 53) — the official Expo-compatible wrapper. The separate `@react-native-ml-kit/text-recognition` package exists but is less actively maintained for Expo CNG projects.

```bash
npx expo install @infinitered/react-native-mlkit-text-recognition
```

This replaces the mock `ocrService.ts` defined in Plan 03 Step 6. The interface remains identical, so the UI code in Plan 03 does not change.

### 2.3 Google Drive API (personal receipt backup)

Google Drive is used as a **personal, user-owned backup** for receipt images — not as primary storage. The receipt always lives in Firebase Storage first; Drive is a secondary copy the user controls and can access outside the app.

- Requires the `https://www.googleapis.com/auth/drive.file` OAuth scope, added to the Google Sign-In flow
- Accessed via the Drive REST API (`https://www.googleapis.com/upload/drive/v3/files`)
- No additional package needed beyond `@react-native-google-signin/google-signin` which provides the access token

---

## 3. Hybrid Participant Model

Trips can include two types of participants:

### AppUser
- Has a Firebase Auth account (`uid`)
- Installed the app and joined/created the trip
- Sees the trip in their Trips tab in real-time
- Can enter expenses, claim planner items, settle debts
- Receives push notifications for reminders and settlement requests
- Owns their own receipts and can back them up to their Google Drive

### GhostParticipant
- Just a name and optional contact info (email, phone)
- Created by an AppUser when adding someone who doesn't have the app
- Expenses, planner items, and settlements are managed on their behalf by any AppUser in the trip
- Cannot log in or see the app
- Settlement reminders are surfaced to the AppUser who manages them ("You need to collect $50 from Jordan")
- **Upgrade path:** if a GhostParticipant later installs the app, an AppUser can link them by sharing a trip invite link. When they sign in, the app detects that their email matches a ghost entry and merges the records

### TypeScript types (add to `src/types/index.ts`):

```typescript
export interface AppUser {
  uid: string;                  // Firebase Auth uid
  displayName: string;
  email: string;
  avatarUrl?: string;
  fcmToken?: string;            // for push notifications
  googleDriveLinked: boolean;
  createdAt: string;
}

export type ParticipantType = "app_user" | "ghost";

export interface TripParticipant {
  id: string;                   // uid for app_user, generated uuid for ghost
  type: ParticipantType;
  displayName: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  amountPaid: number;
  amountOwed: number;
  managedBy?: string;           // uid of the AppUser who created this ghost
}

export interface TripInvitation {
  id: string;
  tripId: string;
  tripName: string;
  invitedByUid: string;
  invitedByName: string;
  inviteeEmail?: string;
  status: "pending" | "accepted" | "declined" | "expired";
  createdAt: string;
  expiresAt: string;
}
```

---

## 4. Service Layer Design

The service layer sits between the Zustand stores and Firebase. Stores hold reactive UI state; services handle all I/O. This separation means:

- Stores can be unit-tested without Firebase
- Services can be swapped (e.g., replace Firebase with Supabase) without touching UI code
- Offline behavior is handled once in the service layer, not scattered across screens

### File structure:

```
src/
  services/
    firebase.ts          # Firebase app initialization, export db/auth/storage instances
    utils.ts             # Shared helpers: requireAuth(), etc.
    authService.ts       # Sign-in, sign-out, session, token management
    userService.ts       # User profile CRUD in Firestore
    receiptService.ts    # Receipt CRUD, local save, Storage upload
    warrantyService.ts   # Warranty CRUD, notification scheduling
    tripService.ts       # Trip CRUD, participant management, invitations + expense CRUD
    settlementService.ts # Settlement optimization, status updates
    driveService.ts      # Google Drive backup queue management
    ocrService.ts        # ML Kit OCR (replaces Plan 03 placeholder)
    syncService.ts       # Firestore real-time listener setup/teardown
```

> **Note:** `expenseService.ts` is intentionally omitted — expense functions live in `tripService.ts` since expenses are always subcollections of a trip document.

### Pattern: service writes to Firestore, listener updates Zustand

> **API note:** This project uses `@react-native-firebase` (not the Firebase JS Web SDK). The API uses `firestore()` factory functions, not `getFirestore()` / `collection()` imports from `firebase/firestore`.

```typescript
import firestore from "@react-native-firebase/firestore";

// Services write to Firestore:
await expenseService.addExpense(tripId, expenseData);

// syncService sets up a listener (called once at app start or trip open):
const unsubscribe = firestore()
  .collection("trips")
  .doc(tripId)
  .collection("expenses")
  .onSnapshot(snapshot => {
    const expenses = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    useTripStore.getState().setExpenses(tripId, expenses);
  });

// UI reads from Zustand (no direct Firebase access in components):
const expenses = useTripStore(state => state.trips[tripId]?.expenses);
```

**Never** use the Web SDK pattern (`import { getFirestore, collection, doc } from "firebase/firestore"`) — it will not work with the native Firebase modules.

---

## 5. Offline-First Strategy

### Firestore offline persistence

Firestore's offline cache is enabled by default in the React Native Firebase SDK. All reads serve from cache when offline; all writes are queued and applied when connectivity returns. No extra configuration is required.

```typescript
// src/services/firebase.ts — disable long-polling to improve offline perf on mobile
import firestore from "@react-native-firebase/firestore";
firestore().settings({ persistence: true, cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED });
```

### What works offline:

| Feature | Offline behavior |
|---|---|
| View trip expenses | Reads from Firestore cache |
| Add/edit an expense | Queued locally, synced on reconnect |
| View planner items | Reads from Firestore cache |
| Claim a planner item | Optimistic update, queued for sync |
| Scan and save a receipt | Saves locally; Firestore + Storage upload queued |
| View warranties | Reads from Firestore cache |

### What requires connectivity:

| Feature | Why |
|---|---|
| Trip invitation acceptance | Must verify invite code against server |
| Push notification delivery | Requires FCM connection |
| Google Drive backup | REST API requires network |
| First-time sign-in | Firebase Auth token exchange |

### Upload queue for images

Receipt images (Firebase Storage + Google Drive) are queued in `AsyncStorage` when offline and processed in the background by `driveService.ts` and `receiptService.ts` on reconnect. See Plan 10 for the full queue implementation.

---

## 6. Environment Setup

### 6.1 Firebase project

1. Create a new Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** — add Google and Apple providers
3. Enable **Firestore Database** — start in production mode (security rules in Plan 09)
4. Enable **Storage** — default bucket
5. Enable **Cloud Messaging** — for push notifications
6. Download `google-services.json` and place in `android/app/`
7. Download `GoogleService-Info.plist` and place in `ios/`

### 6.2 Google Cloud Console (for Drive API)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) (same project as Firebase)
2. Enable the **Google Drive API**
3. Add OAuth scope `https://www.googleapis.com/auth/drive.file` to the consent screen
4. Add the SHA-1 certificate fingerprint for Android in the OAuth 2.0 client

### 6.3 Environment variables

Store sensitive config in `.env` (never commit):

```
GOOGLE_SERVICES_JSON_BASE64=...
GOOGLE_WEB_CLIENT_ID=...          # from Google Cloud Console OAuth client
FIREBASE_PROJECT_ID=...
```

Add `.env` and both native config files to `.gitignore`:

```
.env
android/app/google-services.json
ios/GoogleService-Info.plist
```

---

## 7. Amendments to Existing Plans

### Plan 01 — Project Foundation

**Step 2 (dependencies):** Add the Firebase, Google Sign-In, Apple Auth, and ML Kit packages listed in Section 2 above.

**Step 7 (TypeScript types):** Add `AppUser`, `TripParticipant`, and `TripInvitation` types from Section 3. Replace the existing `Participant` type with `TripParticipant`. Update `Receipt` to include:
```typescript
userId: string;              // owner's Firebase uid
firebaseStorageUrl?: string; // uploaded image URL
driveFileId?: string;        // Google Drive file ID after backup
syncStatus: "local" | "syncing" | "synced" | "error";
```

**Step 8 (Zustand stores):** Each store now has a dual responsibility — hold reactive UI state AND be the target for Firestore real-time listener updates. The mock data scaffolds remain valid for development; `syncService.ts` replaces them with live data in production.

**New Step 10 — Service layer scaffold:** Create all `src/services/` files with empty function stubs and exported types. This ensures TypeScript compilation passes before each service is fully implemented.

**Important — `expenseService.ts` resolution:** Plan 09 places expense CRUD inside `tripService.ts` (since expenses are always subcollections of a trip). Do **not** create a separate `expenseService.ts` — consolidate all expense functions in `tripService.ts` and remove `expenseService.ts` from the service file structure above.

### Plan 03 — Receipt Scanner

**Step 6 (OCR):** Replace the mock delay with ML Kit. The `OCRResult` interface stays the same:
```typescript
// src/services/ocrService.ts
import TextRecognition from "@infinitered/react-native-mlkit-text-recognition";

export async function processReceiptImage(imageUri: string): Promise<OCRResult> {
  const result = await TextRecognition.recognize(imageUri);
  return parseOCRResult(result); // parse blocks into merchant/date/amount
}
```

**Step 7 (Save flow):** After `useReceiptStore.addReceipt(receipt)`, the service layer queues uploads to Firebase Storage and Google Drive. The UI does not wait for uploads — the receipt is immediately usable locally.

### Plan 04 — Expense Splitting

**Step 9 (state management):** After `saveSplit()`, the expense is written to Firestore under `trips/{tripId}/expenses/{expenseId}`. Other trip members' apps receive the update via their real-time listener and their Zustand store updates automatically.

### Plan 06 — Trip Management

**Step A (Trip Summary):** The trip document and all sub-collections are loaded via real-time listeners when the user enters the Trips tab. A new "Create Trip" flow (not in original plan) is the entry point for new trips and handles participant invitation.

**Settlement "Remind" action:** For AppUser participants, tapping "Remind" sends an FCM push notification. For GhostParticipants, it shows a share sheet with a pre-filled message the managing AppUser can send via SMS/WhatsApp.

---

---

## 8. `syncService.ts` — All Listeners

> **⚠️ SUPERSEDED:** The implementation previously in this section has been removed. **Plan 09 Section 6 is the canonical `syncService.ts`.** It uses a **delegation pattern** (calling listener functions exported from the service layer) rather than calling Firestore directly. This is more testable, DRY, and consistent with the service layer architecture.
>
> Plan 09 Section 6 has been extended to cover all collections (receipts, warranties, trip, expenses, carpools, settlements, plannerItems) matching the full scope originally described here. See Plan 09 for the authoritative implementation.

### Where to call each sync function:

| Listener | Start | Stop |
|---|---|---|
| `startReceiptSync()` | `app/_layout.tsx` after auth confirmed (non-anonymous) | `teardownAll()` on sign-out |
| `startWarrantySync()` | `app/_layout.tsx` after auth confirmed (non-anonymous) | `teardownAll()` on sign-out |
| `startTripSync(tripId)` | `app/(tabs)/trips/[tripId].tsx` `useEffect` mount | Same screen `useEffect` cleanup |

---

## Deliverables Checklist

- [ ] Firebase project created and configured
- [ ] Google Cloud Console project set up with Drive API and OAuth
- [ ] Native config files (`google-services.json`, `GoogleService-Info.plist`) added
- [ ] `.gitignore` updated to exclude secrets (see Plan 01 Step 11 for full content)
- [ ] All Firebase packages installed
- [ ] `src/services/` directory created with stubbed service files (no `expenseService.ts`)
- [ ] `src/services/utils.ts` with `requireAuth()` created (see Plan 01 Step 9)
- [ ] Updated TypeScript types in `src/types/index.ts`
- [ ] `syncService.ts` implemented per Plan 09 Section 6 (delegation pattern, all collections covered)
- [ ] Amendments to Plans 01, 03, 04, 06 documented and understood
