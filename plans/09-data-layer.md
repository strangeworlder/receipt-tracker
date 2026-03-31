# Plan 9: Data Layer — Firestore & Zustand

> **Prerequisite:** Plan 7 (Architecture Overview), Plan 8 (Auth & Users).
> **Blocks:** Plans 03–06 cannot be fully wired to real data until this plan is complete.

This plan defines the full Firestore data model, security rules, real-time listener setup, the integration pattern between Firestore and Zustand, offline behavior, and the composite indexes needed for the queries the UI performs.

---

## 1. Firestore Collection Structure

```
firestore/
  users/
    {uid}/                          # One doc per signed-in user
      displayName, email, avatarUrl, fcmToken, googleDriveLinked, createdAt

  receipts/
    {receiptId}/                    # One doc per scanned receipt
      userId, merchant, date, amount, category, isWarranty,
      firebaseStorageUrl, driveFileId, syncStatus, tripId?,
      items[], createdAt

  warranties/
    {warrantyId}/                   # One doc per warranty
      userId, receiptId, productName, manufacturer,
      purchaseDate, expirationDate, coverageType, notificationIds[]

  trips/
    {tripId}/                       # One doc per trip
      name, createdByUid, startDate, endDate,
      memberUids[],                 # array of uid strings (for security rules)
      participants[],               # full TripParticipant objects (includes ghosts)
      totalPot, categoryBreakdown{},
      createdAt, updatedAt

    {tripId}/expenses/
      {expenseId}/                  # One doc per shared expense
        tripId, receiptId?, amount, paidBy, splitAmong[],
        splitType, customAmounts{}, createdByUid, createdAt

    {tripId}/carpools/
      {carpoolId}/                  # One doc per carpool leg
        tripId, name, route, distance, fuelCost,
        passengers[], createdAt

    {tripId}/settlements/
      {settlementId}/               # One doc per settlement transaction
        tripId, fromParticipantId, toParticipantId,
        amount, status, createdAt, settledAt?

    {tripId}/plannerItems/
      {itemId}/                     # One doc per "who brings what" item
        tripId, name, description, category, categoryId,
        assignedTo?, status, createdByUid, createdAt

  tripInvitations/
    {inviteId}/                     # One doc per pending invitation
      tripId, tripName, invitedByUid, invitedByName,
      inviteeEmail?, status, createdAt, expiresAt
```

---

## 2. Document Schemas (TypeScript)

These extend the types defined in Plan 01 and amended in Plan 07.

```typescript
// src/types/firestore.ts

export interface FirestoreUser {
  uid: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  fcmToken?: string;
  googleDriveLinked: boolean;
  createdAt: string;
}

export interface FirestoreReceipt {
  userId: string;
  merchant: string;
  date: string;
  amount: number;
  category: ReceiptCategory;
  isWarranty: boolean;
  items?: ReceiptItem[];
  firebaseStorageUrl?: string;
  driveFileId?: string;
  syncStatus: "local" | "syncing" | "synced" | "error";
  tripId?: string;
  createdAt: string;
}

export interface FirestoreWarranty {
  userId: string;
  receiptId: string;
  productName: string;
  manufacturer: string;
  purchaseDate: string;
  expirationDate: string;
  coverageType: string;
  notificationIds: string[];
}

export interface FirestoreTrip {
  name: string;
  createdByUid: string;
  startDate: string;
  endDate: string;
  memberUids: string[];
  participants: TripParticipant[];
  totalPot: number;
  categoryBreakdown: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreExpense {
  tripId: string;
  receiptId?: string;
  description: string;          // human-readable label, e.g. "Dinner at The Lobster Shack"
  amount: number;
  paidBy: string;               // participantId
  splitAmong: string[];         // participantIds
  splitType: "equal" | "custom" | "percentage";
  customAmounts?: Record<string, number>;
  createdByUid: string;
  createdAt: string;
}

export interface FirestoreCarpool {
  tripId: string;
  name: string;
  route: string;
  distance: number;
  fuelCost: number;
  passengers: CarpoolPassenger[];
  createdAt: string;
}

export interface FirestoreSettlement {
  tripId: string;
  fromParticipantId: string;
  toParticipantId: string;
  amount: number;
  status: "pending" | "settled";
  createdAt: string;
  settledAt?: string;
}

export interface FirestorePlannerItem {
  tripId: string;
  name: string;
  description: string;
  category: string;
  categoryId: string;
  assignedTo?: string;
  status: "unassigned" | "assigned" | "brought";
  createdByUid: string;
  createdAt: string;
}
```

---

## 3. Security Rules

File: `firestore.rules` (deployed via Firebase CLI: `firebase deploy --only firestore:rules`)

> **Rules design notes:**
> - `write` is intentionally split into `create`, `update`, `delete` throughout — this makes it explicit which operations are allowed and prevents accidentally authorizing creates with `resource.data` (which is null for new documents).
> - Anonymous users (`request.auth != null` but `request.auth.token.firebase.sign_in_provider == "anonymous"`) can create/read their own receipts and warranties for offline mode, but can never be in `memberUids` so they have no trip access.
> - Ghost participant resolution is handled by a Cloud Function (not by client rules) — see Plan 08.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper: is the request from any signed-in user (including anonymous)?
    function isAuthed() {
      return request.auth != null;
    }

    // Helper: does the requesting user belong to this trip?
    function isTripMember(tripId) {
      return isAuthed() &&
        request.auth.uid in get(/databases/$(database)/documents/trips/$(tripId)).data.memberUids;
    }

    // Helper: is the requesting user the trip creator?
    function isTripCreator(tripId) {
      return isAuthed() &&
        request.auth.uid == get(/databases/$(database)/documents/trips/$(tripId)).data.createdByUid;
    }

    // Users: only the owner can read/write their own profile
    match /users/{uid} {
      allow read, update, delete: if isAuthed() && request.auth.uid == uid;
      allow create: if isAuthed() && request.auth.uid == uid;
    }

    // Receipts: only the owning user can read/write (anonymous users allowed for offline mode)
    match /receipts/{receiptId} {
      allow read, update, delete: if isAuthed() && request.auth.uid == resource.data.userId;
      allow create: if isAuthed() && request.auth.uid == request.resource.data.userId;
    }

    // Warranties: only the owning user can read/write
    match /warranties/{warrantyId} {
      allow read, update, delete: if isAuthed() && request.auth.uid == resource.data.userId;
      allow create: if isAuthed() && request.auth.uid == request.resource.data.userId;
    }

    // Trips: members can read; members can write sub-collections; creator can delete
    match /trips/{tripId} {
      allow read: if isTripMember(tripId);
      allow create: if isAuthed() && request.auth.uid == request.resource.data.createdByUid;
      allow update: if isTripMember(tripId);
      allow delete: if isTripCreator(tripId);

      // Expenses: any trip member can create/read/update; only creator of the expense can delete
      match /expenses/{expenseId} {
        allow read, create, update: if isTripMember(tripId);
        allow delete: if isTripMember(tripId) &&
          request.auth.uid == resource.data.createdByUid;
      }

      // Carpools: any trip member can create/read/update; only creator can delete
      match /carpools/{carpoolId} {
        allow read, create, update: if isTripMember(tripId);
        allow delete: if isTripMember(tripId) &&
          request.auth.uid == resource.data.createdByUid;
      }

      // Settlements: any trip member can read/create.
      // Update: allowed by the payer, the payee, or the trip creator (all have legitimate reasons to mark settled).
      // Delete: only the trip creator (settlements should not be unilaterally deleted by participants).
      match /settlements/{settlementId} {
        allow read, create: if isTripMember(tripId);
        allow update: if isTripMember(tripId) && (
          request.auth.uid == resource.data.fromParticipantId ||
          request.auth.uid == resource.data.toParticipantId ||
          isTripCreator(tripId)
        );
        allow delete: if isTripCreator(tripId);
      }

      // Planner items: any trip member can create/read/update (for claiming items); creator can delete
      match /plannerItems/{itemId} {
        allow read, create, update: if isTripMember(tripId);
        allow delete: if isTripMember(tripId) &&
          request.auth.uid == resource.data.createdByUid;
      }
    }

    // Invitations: anyone auth'd can create; inviter and invitee can read
    // Update (accept/decline) is handled by the resolveGhostParticipant Cloud Function
    // with admin privileges — client rules here are for direct reads only.
    match /tripInvitations/{inviteId} {
      allow create: if isAuthed();
      allow read: if isAuthed() &&
        (request.auth.uid == resource.data.invitedByUid ||
         request.auth.token.email == resource.data.inviteeEmail);
      // Invitee can update status (accept/decline) directly if not using Cloud Function
      allow update: if isAuthed() &&
        request.auth.token.email == resource.data.inviteeEmail &&
        request.resource.data.status in ["accepted", "declined"];
    }
  }
}
```

---

## 4. Composite Indexes

Required for the compound queries the UI performs. Create these in the Firebase Console under Firestore > Indexes, or add them to `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "receipts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "receipts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "category", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "warranties",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "expirationDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "expenses",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "tripId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "settlements",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "tripId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## 5. Service Layer Implementations

> **Note on `expenseService.ts`:** Per Plan 07 amendments, there is no separate `expenseService.ts`. All expense functions are consolidated in `tripService.ts` since expenses are always subcollections of a trip.

### `src/services/receiptService.ts`

```typescript
import firestore from "@react-native-firebase/firestore";
import { requireAuth } from "./utils";
import type { FirestoreReceipt } from "../types/firestore";
import { generateUUID } from "../utils/uuid";

const receiptsCol = firestore().collection("receipts");

export async function addReceipt(data: Omit<FirestoreReceipt, "userId" | "createdAt">): Promise<string> {
  const uid = requireAuth();
  const receiptId = generateUUID();
  await receiptsCol.doc(receiptId).set({
    ...data,
    userId: uid,
    syncStatus: "local",
    createdAt: new Date().toISOString(),
  });
  return receiptId;
}

export async function updateReceipt(
  receiptId: string,
  updates: Partial<FirestoreReceipt>
): Promise<void> {
  requireAuth();
  await receiptsCol.doc(receiptId).update(updates);
}

export async function deleteReceipt(receiptId: string): Promise<void> {
  requireAuth();
  await receiptsCol.doc(receiptId).delete();
  // Also delete from Firebase Storage — see receiptService implementation in Plan 10
}

export async function getRecentReceipts(limit = 10): Promise<Array<FirestoreReceipt & { id: string }>> {
  const uid = requireAuth();
  const snap = await receiptsCol
    .where("userId", "==", uid)
    .orderBy("date", "desc")
    .limit(limit)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() as FirestoreReceipt }));
}

export function listenToReceipts(
  onUpdate: (receipts: Array<FirestoreReceipt & { id: string; _pendingWrite: boolean }>) => void
): () => void {
  const uid = requireAuth();
  return receiptsCol
    .where("userId", "==", uid)
    .orderBy("date", "desc")
    .limit(50)
    .onSnapshot(snap => {
      onUpdate(snap.docs.map(d => ({
        id: d.id,
        _pendingWrite: d.metadata.hasPendingWrites,
        ...d.data() as FirestoreReceipt,
      })));
    });
}
```

### `src/services/tripService.ts`

```typescript
import firestore from "@react-native-firebase/firestore";
import { requireAuth } from "./utils";
import { generateUUID } from "../utils/uuid";
import type { FirestoreTrip, FirestoreExpense, FirestoreCarpool, FirestoreSettlement, FirestorePlannerItem } from "../types/firestore";
import type { TripParticipant } from "../types";

const tripsCol = firestore().collection("trips");

// --- Trip CRUD ---

export async function createTrip(
  data: Omit<FirestoreTrip, "createdByUid" | "memberUids" | "createdAt" | "updatedAt">
): Promise<string> {
  const uid = requireAuth();
  const tripId = generateUUID();
  const now = new Date().toISOString();
  await tripsCol.doc(tripId).set({
    ...data,
    createdByUid: uid,
    memberUids: [uid],
    totalPot: 0,
    categoryBreakdown: {},
    createdAt: now,
    updatedAt: now,
  });
  return tripId;
}

export async function updateTrip(
  tripId: string,
  updates: Partial<Omit<FirestoreTrip, "createdByUid" | "createdAt">>
): Promise<void> {
  requireAuth();
  await tripsCol.doc(tripId).update({ ...updates, updatedAt: new Date().toISOString() });
}

export async function deleteTrip(tripId: string): Promise<void> {
  requireAuth();
  await tripsCol.doc(tripId).delete();
}

// --- Participant management ---

export async function addGhostParticipant(
  tripId: string,
  name: string,
  contact?: { email?: string; phone?: string }
): Promise<void> {
  const uid = requireAuth();
  const ghost: TripParticipant = {
    id: generateUUID(),
    type: "ghost",
    displayName: name,
    email: contact?.email,
    phone: contact?.phone,
    avatarUrl: undefined,
    amountPaid: 0,
    amountOwed: 0,
    managedBy: uid,
  };
  await tripsCol.doc(tripId).update({
    participants: firestore.FieldValue.arrayUnion(ghost),
  });
}

// --- Expense CRUD (consolidated from expenseService.ts) ---

export async function addExpense(
  tripId: string,
  data: Omit<FirestoreExpense, "tripId" | "createdByUid" | "createdAt">
): Promise<string> {
  const uid = requireAuth();
  const expenseId = generateUUID();
  await tripsCol.doc(tripId).collection("expenses").doc(expenseId).set({
    ...data,
    tripId,
    createdByUid: uid,
    createdAt: new Date().toISOString(),
  });
  return expenseId;
}

export async function updateExpense(
  tripId: string,
  expenseId: string,
  updates: Partial<Omit<FirestoreExpense, "tripId" | "createdByUid" | "createdAt">>
): Promise<void> {
  requireAuth();
  await tripsCol.doc(tripId).collection("expenses").doc(expenseId).update(updates);
}

export async function deleteExpense(tripId: string, expenseId: string): Promise<void> {
  requireAuth();
  await tripsCol.doc(tripId).collection("expenses").doc(expenseId).delete();
}

// --- Listeners ---

export function listenToTrip(
  tripId: string,
  onUpdate: (trip: FirestoreTrip & { id: string }) => void
): () => void {
  return tripsCol.doc(tripId).onSnapshot(snap => {
    if (snap.exists) onUpdate({ id: snap.id, ...snap.data() as FirestoreTrip });
  });
}

export function listenToExpenses(
  tripId: string,
  onUpdate: (expenses: Array<FirestoreExpense & { id: string; _pendingWrite: boolean }>) => void
): () => void {
  return tripsCol
    .doc(tripId)
    .collection("expenses")
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      onUpdate(snap.docs.map(d => ({
        id: d.id,
        _pendingWrite: d.metadata.hasPendingWrites,
        ...d.data() as FirestoreExpense,
      })));
    });
}

export function listenToCarpools(
  tripId: string,
  onUpdate: (carpools: Array<FirestoreCarpool & { id: string }>) => void
): () => void {
  return tripsCol.doc(tripId).collection("carpools")
    .orderBy("createdAt", "asc")
    .onSnapshot(snap => {
      onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() as FirestoreCarpool })));
    });
}

export function listenToSettlements(
  tripId: string,
  onUpdate: (settlements: Array<FirestoreSettlement & { id: string }>) => void
): () => void {
  return tripsCol.doc(tripId).collection("settlements")
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() as FirestoreSettlement })));
    });
}

export function listenToPlannerItems(
  tripId: string,
  onUpdate: (items: Array<FirestorePlannerItem & { id: string }>) => void
): () => void {
  return tripsCol.doc(tripId).collection("plannerItems")
    .orderBy("createdAt", "asc")
    .onSnapshot(snap => {
      onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() as FirestorePlannerItem })));
    });
}
```

### `src/services/warrantyService.ts`

```typescript
import firestore from "@react-native-firebase/firestore";
import * as Notifications from "expo-notifications";
import { requireAuth } from "./utils";
import type { FirestoreWarranty } from "../types/firestore";
import type { OCRResult } from "./ocrService";
import { generateUUID } from "../utils/uuid";

const warrantiesCol = firestore().collection("warranties");

export async function createWarranty(
  data: Omit<FirestoreWarranty, "userId" | "notificationIds">
): Promise<string> {
  const uid = requireAuth();
  const warrantyId = generateUUID();
  const notificationIds = await scheduleExpirationNotifications(
    warrantyId,
    data.productName,
    data.expirationDate
  );

  await warrantiesCol.doc(warrantyId).set({
    ...data,
    userId: uid,
    notificationIds,
  });

  return warrantyId;
}

/**
 * Called from receiptService.createReceiptRecord() when isWarranty is true.
 * Creates a warranty with sensible defaults derived from OCR data.
 */
export async function createFromReceipt(
  receiptId: string,
  ocrResult: OCRResult
): Promise<string> {
  // Default to 1-year warranty from purchase date
  const purchaseDate = ocrResult.date;
  const expirationDate = new Date(ocrResult.date);
  expirationDate.setFullYear(expirationDate.getFullYear() + 1);

  return createWarranty({
    receiptId,
    productName: ocrResult.merchant,
    manufacturer: "Unknown",
    purchaseDate,
    expirationDate: expirationDate.toISOString().split("T")[0],
    coverageType: "Standard 1-year",
  });
}

export async function updateWarranty(
  warrantyId: string,
  updates: Partial<Omit<FirestoreWarranty, "userId">>
): Promise<void> {
  requireAuth();
  // If expiration date changed, reschedule notifications
  if (updates.expirationDate) {
    const doc = await warrantiesCol.doc(warrantyId).get();
    const existing = doc.data() as FirestoreWarranty;

    // Cancel old notifications
    await cancelNotifications(existing.notificationIds ?? []);

    // Schedule new notifications
    const notificationIds = await scheduleExpirationNotifications(
      warrantyId,
      updates.productName ?? existing.productName,
      updates.expirationDate
    );

    updates = { ...updates, notificationIds };
  }

  await warrantiesCol.doc(warrantyId).update(updates);
}

export async function deleteWarranty(warrantyId: string): Promise<void> {
  requireAuth();
  const doc = await warrantiesCol.doc(warrantyId).get();
  const data = doc.data() as FirestoreWarranty;
  await cancelNotifications(data.notificationIds ?? []);
  await warrantiesCol.doc(warrantyId).delete();
}

export function listenToWarranties(
  onUpdate: (warranties: Array<FirestoreWarranty & { id: string }>) => void
): () => void {
  const uid = requireAuth();
  return warrantiesCol
    .where("userId", "==", uid)
    .orderBy("expirationDate", "asc")
    .onSnapshot(snap => {
      onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() as FirestoreWarranty })));
    });
}

// --- Notification helpers ---

async function scheduleExpirationNotifications(
  warrantyId: string,
  productName: string,
  expirationDate: string
): Promise<string[]> {
  const expiry = new Date(expirationDate);
  const notificationIds: string[] = [];

  for (const daysBefore of [30, 7, 0]) {
    const triggerDate = new Date(expiry);
    triggerDate.setDate(triggerDate.getDate() - daysBefore);

    if (triggerDate > new Date()) {
      const body =
        daysBefore === 0
          ? `Your ${productName} warranty expires today.`
          : `Your ${productName} warranty expires in ${daysBefore} days.`;

      // SDK 53+: triggers require an explicit `type` property
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Warranty Expiring",
          body,
          data: { warrantyId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });
      notificationIds.push(id);
    }
  }

  return notificationIds;
}

async function cancelNotifications(notificationIds: string[]): Promise<void> {
  await Promise.all(
    notificationIds.map(id => Notifications.cancelScheduledNotificationAsync(id))
  );
}
```

---

## 6. Real-Time Listener Setup (`syncService.ts`)

> **This is the canonical `syncService.ts`.** Plan 07 Section 8 previously contained a conflicting direct-Firestore implementation — that has been superseded by this file. This service uses the **delegation pattern**: it calls listener functions exported from the service layer rather than calling Firestore directly. This keeps `syncService` thin (a lifecycle coordinator only) and keeps query logic in the services where it can be tested independently.

Listeners are established when the user enters a relevant screen and torn down when they leave.

```typescript
// src/services/syncService.ts
import { listenToReceipts } from "./receiptService";
import { listenToWarranties } from "./warrantyService";
import {
  listenToTrip,
  listenToExpenses,
  listenToCarpools,
  listenToSettlements,
  listenToPlannerItems,
} from "./tripService";
import { useReceiptStore } from "../stores/receiptStore";
import { useWarrantyStore } from "../stores/warrantyStore";
import { useTripStore } from "../stores/tripStore";

type UnsubscribeFn = () => void;
const activeListeners: Map<string, UnsubscribeFn> = new Map();

function register(key: string, unsubscribe: UnsubscribeFn) {
  // Tear down any existing listener with the same key before registering a new one
  activeListeners.get(key)?.();
  activeListeners.set(key, unsubscribe);
}

// --- Start on auth confirmed (non-anonymous) ---

export function startReceiptSync() {
  register("receipts", listenToReceipts(receipts => {
    useReceiptStore.getState().setReceipts(receipts);
  }));
}

export function startWarrantySync() {
  register("warranties", listenToWarranties(warranties => {
    useWarrantyStore.getState().setWarranties(warranties);
  }));
}

// --- Start when user enters a specific trip ---

export function startTripSync(tripId: string) {
  register(`trip:${tripId}`, listenToTrip(tripId, trip => {
    useTripStore.getState().upsertTrip(trip);
  }));
  register(`expenses:${tripId}`, listenToExpenses(tripId, expenses => {
    useTripStore.getState().setExpenses(tripId, expenses);
  }));
  register(`carpools:${tripId}`, listenToCarpools(tripId, carpools => {
    useTripStore.getState().setCarpools(tripId, carpools);
  }));
  register(`settlements:${tripId}`, listenToSettlements(tripId, settlements => {
    useTripStore.getState().setSettlements(tripId, settlements);
  }));
  register(`plannerItems:${tripId}`, listenToPlannerItems(tripId, items => {
    useTripStore.getState().setPlannerItems(tripId, items);
  }));
}

export function stopTripSync(tripId: string) {
  ["trip", "expenses", "carpools", "settlements", "plannerItems"].forEach(prefix => {
    const key = `${prefix}:${tripId}`;
    activeListeners.get(key)?.();
    activeListeners.delete(key);
  });
}

export function teardownAll() {
  activeListeners.forEach(fn => fn());
  activeListeners.clear();
}
```

Each service must export its corresponding listener function. For example, `warrantyService.ts` must export:
```typescript
export function listenToWarranties(
  callback: (warranties: Array<FirestoreWarranty & { id: string }>) => void
): UnsubscribeFn {
  const uid = requireAuth();
  return firestore()
    .collection("warranties")
    .where("userId", "==", uid)
    .orderBy("expirationDate", "asc")
    .onSnapshot(snap => {
      callback(snap.docs.map(d => ({
        id: d.id,
        _pendingWrite: d.metadata.hasPendingWrites,
        ...d.data() as FirestoreWarranty,
      })));
    });
}
```

Similarly, `tripService.ts` must export `listenToCarpools`, `listenToSettlements`, and `listenToPlannerItems` alongside the existing `listenToTrip` and `listenToExpenses`.

### Where to call sync functions:

| Listener | Where to start | Where to stop |
|---|---|---|
| `startReceiptSync()` | `app/_layout.tsx` on auth confirmed | `teardownAll()` on sign-out |
| `startWarrantySync()` | `app/_layout.tsx` on auth confirmed | `teardownAll()` on sign-out |
| `startTripSync(tripId)` | `app/(tabs)/trips/[tripId].tsx` `useEffect` | Same screen `useEffect` cleanup — `stopTripSync(tripId)` |

---

## 7. Zustand Store Amendments

Each store in `src/stores/` gains a setter action that the sync service calls. The UI never calls Firestore directly — it reads from the store and dispatches to the service layer.

### `src/stores/receiptStore.ts` (amended):

```typescript
import { create } from "zustand";
import type { FirestoreReceipt } from "../types/firestore";

type Receipt = FirestoreReceipt & { id: string };

interface ReceiptState {
  receipts: Receipt[];
  setReceipts: (receipts: Receipt[]) => void;
  addReceipt: (receipt: Receipt) => void;
  // Aggregation selectors
  totalMonthlySpend: () => number;
  categoryBreakdown: () => Record<string, number>;
  recentReceipts: (limit?: number) => Receipt[];
}

export const useReceiptStore = create<ReceiptState>((set, get) => ({
  receipts: [],
  setReceipts: receipts => set({ receipts }),
  addReceipt: receipt => set(s => ({ receipts: [receipt, ...s.receipts] })),
  totalMonthlySpend: () => {
    const now = new Date();
    return get().receipts
      .filter(r => {
        const d = new Date(r.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, r) => sum + r.amount, 0);
  },
  categoryBreakdown: () => {
    const now = new Date();
    return get().receipts
      .filter(r => {
        const d = new Date(r.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((acc, r) => ({ ...acc, [r.category]: (acc[r.category] ?? 0) + r.amount }), {} as Record<string, number>);
  },
  recentReceipts: (limit = 10) => get().receipts.slice(0, limit),
}));
```

### `src/stores/tripStore.ts` (amended):

```typescript
import { create } from "zustand";
import type { FirestoreTrip, FirestoreExpense, FirestoreCarpool, FirestoreSettlement, FirestorePlannerItem } from "../types/firestore";

type Trip = FirestoreTrip & { id: string };
type Expense = FirestoreExpense & { id: string; _pendingWrite?: boolean };
type Carpool = FirestoreCarpool & { id: string };
type Settlement = FirestoreSettlement & { id: string };
type PlannerItem = FirestorePlannerItem & { id: string };

interface TripState {
  trips: Record<string, Trip>;
  expenses: Record<string, Expense[]>;         // keyed by tripId
  carpools: Record<string, Carpool[]>;         // keyed by tripId
  settlements: Record<string, Settlement[]>;   // keyed by tripId
  plannerItems: Record<string, PlannerItem[]>; // keyed by tripId

  upsertTrip: (trip: Trip) => void;
  setExpenses: (tripId: string, expenses: Expense[]) => void;
  setCarpools: (tripId: string, carpools: Carpool[]) => void;
  setSettlements: (tripId: string, settlements: Settlement[]) => void;
  setPlannerItems: (tripId: string, items: PlannerItem[]) => void;
  getTrip: (tripId: string) => Trip | undefined;
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: {},
  expenses: {},
  carpools: {},
  settlements: {},
  plannerItems: {},

  upsertTrip: trip => set(s => ({ trips: { ...s.trips, [trip.id]: trip } })),
  setExpenses: (tripId, expenses) => set(s => ({ expenses: { ...s.expenses, [tripId]: expenses } })),
  setCarpools: (tripId, carpools) => set(s => ({ carpools: { ...s.carpools, [tripId]: carpools } })),
  setSettlements: (tripId, settlements) => set(s => ({ settlements: { ...s.settlements, [tripId]: settlements } })),
  setPlannerItems: (tripId, items) => set(s => ({ plannerItems: { ...s.plannerItems, [tripId]: items } })),
  getTrip: tripId => get().trips[tripId],
}));
```

---

## 8. Offline Behavior

### How Firestore offline persistence works in practice:

- Firestore SDK caches the last-fetched version of every document the app has read
- All `onSnapshot` listeners serve from cache immediately (no loading state on subsequent opens)
- All writes (add, update, delete) are applied to the local cache instantly and queued for server sync
- When connectivity returns, the queue flushes automatically — no code required

### Handling pending writes in the UI:

Firestore documents have a `metadata.hasPendingWrites` flag. Use it to show a subtle "syncing" indicator on receipts or trip expenses that haven't reached the server yet:

```typescript
snap.docs.map(d => ({
  id: d.id,
  ...d.data(),
  _pendingWrite: d.metadata.hasPendingWrites,
}));
```

Add a small sync icon (spinning `sync` icon from Plan 01's MaterialIcon component) to `ListItem` rows where `_pendingWrite` is true.

### Conflict resolution:

Firestore uses "last write wins" for field updates. For the data shapes in TripTrack this is acceptable because:
- Expenses and planner items are mostly independent documents (not arrays being modified in place)
- The `participants` array on the trip document is the one sensitive case — use `arrayUnion` / `arrayRemove` Firestore field transforms instead of overwriting the full array

```typescript
// Adding a participant without overwriting the array
await tripsCol.doc(tripId).update({
  participants: firestore.FieldValue.arrayUnion(newParticipant),
  memberUids: firestore.FieldValue.arrayUnion(newUid),
});
```

### Known limitation: `participants` array on the trip document

Full `TripParticipant` objects (including `amountPaid` and `amountOwed`) are stored as an embedded array on the trip document. This means:

1. **Updating a single participant's balance** requires reading and rewriting the entire `participants` array — `arrayUnion`/`arrayRemove` only works for adding/removing whole objects, not for updating a field inside one.
2. **Every expense addition** that changes a participant's `amountOwed` requires a trip-document write in addition to the expense subcollection write.
3. **Practical ceiling:** Groups of up to ~20 participants are fine (the array stays well under Firestore's 1 MB document limit). If the app ever needs to support larger groups, migrate participant financial data to a `participants/{participantId}` subcollection.

For the MVP this trade-off is acceptable — trips are small groups (5-10 people). To minimize array rewrites, recalculate `amountPaid`/`amountOwed` in a single batch after expense changes rather than on every individual write.

---

## 9. Settlement Optimization

The settlement algorithm reduces N debts to the minimum number of transactions. This runs client-side on the trip creator's device (not in Cloud Functions for MVP).

```typescript
// src/services/settlementService.ts
export function optimizeSettlements(participants: TripParticipant[]): SettlementTransaction[] {
  // Calculate net balance for each participant
  const balances = participants.map(p => ({
    id: p.id,
    balance: p.amountPaid - p.amountOwed,  // positive = is owed money, negative = owes money
  }));

  const transactions: SettlementTransaction[] = [];
  const creditors = balances.filter(b => b.balance > 0.01).sort((a, b) => b.balance - a.balance);
  const debtors = balances.filter(b => b.balance < -0.01).sort((a, b) => a.balance - b.balance);

  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci];
    const debt = debtors[di];
    const amount = Math.min(credit.balance, -debt.balance);

    transactions.push({
      id: generateUUID(),
      tripId: "",   // filled in by caller
      fromParticipantId: debt.id,
      toParticipantId: credit.id,
      amount: Math.round(amount * 100) / 100,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    credit.balance -= amount;
    debt.balance += amount;
    if (Math.abs(credit.balance) < 0.01) ci++;
    if (Math.abs(debt.balance) < 0.01) di++;
  }

  return transactions;
}
```

---

## Deliverables Checklist

- [ ] `src/types/firestore.ts` — full Firestore document schemas
- [ ] `firestore.rules` — rewritten security rules with explicit create/update/delete (no catch-all `write`)
- [ ] `firestore.indexes.json` — composite indexes deployed to Firebase
- [ ] `src/services/receiptService.ts` — CRUD + real-time listener; uses `requireAuth()` (no `!` assertions)
- [ ] `src/services/warrantyService.ts` — full CRUD, `createFromReceipt`, notification scheduling/cancellation
- [ ] `src/services/tripService.ts` — trip CRUD, participant management, expense CRUD + all listeners (no separate `expenseService.ts`)
- [ ] `src/services/syncService.ts` — full listener set: receipts, warranties, trip + expenses + carpools + settlements + plannerItems
- [ ] `src/services/settlementService.ts` — settlement optimization algorithm; guarded so only trip creator can trigger recalculation
- [ ] `src/stores/receiptStore.ts` amended — `setReceipts` action + aggregation selectors
- [ ] `src/stores/tripStore.ts` amended — all subcollection setters (expenses, carpools, settlements, plannerItems)
- [ ] `src/stores/warrantyStore.ts` amended — `setWarranties` action + status selectors
- [ ] Offline `_pendingWrite` indicator in `ListItem` component
- [ ] `arrayUnion`/`arrayRemove` used for participant array updates (no full-array overwrites)
