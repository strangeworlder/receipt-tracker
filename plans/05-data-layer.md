# Plan 5: Data Layer — Firestore & Zustand

> **Prerequisite:** Plan 3 (Architecture & Firebase Setup), Plan 4 (Auth & Users).
> **Blocks:** Plans 06, 07, 08, 09, 10 — the full service layer and real-time sync are required before any screen can connect to live data.

This plan defines the complete Firestore data model, security rules, composite indexes, the full service layer implementations (replacing the stubs from Plan 03), the real-time listener setup via `syncService`, Zustand store amendments, and offline behavior.

---

## Context

The Zustand stores in `src/stores/` currently contain mock data from Plan 01. After this plan is implemented, `syncService.ts` will populate those stores from Firestore in real time.

**Type system rules (important):**
- Stores hold **UI types** (`Receipt`, `Warranty`, `Trip` from `src/types/index.ts`) with string dates
- `syncService` converts Firestore `Timestamp` fields to ISO date strings before calling store setters
- Firestore document schemas (in `src/types/firestore.ts`) use `Timestamp` for all date fields — the conversion is the listener's responsibility
- Never store raw `Timestamp` objects in Zustand

---

## 1. Firestore Collection Structure

```
firestore/
  users/
    {uid}/
      displayName, email, avatarUrl, fcmToken, googleDriveLinked, createdAt

  receipts/
    {receiptId}/
      userId, merchant, date, amount, category, isWarranty,
      firebaseStorageUrl?, driveFileId?, syncStatus, tripId?,
      items[], createdAt

  warranties/
    {warrantyId}/
      userId, receiptId, productName, manufacturer,
      purchaseDate, expirationDate, coverageType, notificationIds[]

  trips/
    {tripId}/
      name, createdByUid, startDate, endDate,
      memberUids[],       # array of uid strings — used in security rules
      participants[],     # TripParticipant objects (includes ghosts)
      totalPot, categoryBreakdown{}, createdAt, updatedAt

    {tripId}/expenses/
      {expenseId}/
        tripId, receiptId?, description, amount, paidBy, splitAmong[],
        splitType, customAmounts{}, createdByUid, createdAt

    {tripId}/carpools/
      {carpoolId}/
        tripId, name, route, distance, fuelCost, passengers[], createdAt

    {tripId}/settlements/
      {settlementId}/
        tripId, fromParticipantId, toParticipantId,
        amount, status, createdAt, settledAt?

    {tripId}/plannerItems/
      {itemId}/
        tripId, name, description, category, categoryId,
        assignedTo?, status, createdByUid, createdAt

  tripInvitations/
    {inviteId}/
      tripId, tripName, invitedByUid, invitedByName,
      inviteeEmail?, status, createdAt, expiresAt
```

---

## 2. Firestore Document Schemas

Replace the contents of `src/types/firestore.ts` with the following. This aligns the schema with the service implementations and fixes field names (`memberUids`, `createdByUid`) to match the security rules.

> **Schema change notes vs Plan 01 scaffold:**
> - `FirestoreTrip`: `participantIds` → `memberUids`, `createdBy` → `createdByUid` (more explicit, matches security rules)
> - `FirestoreReceipt.syncStatus`: extended from `"synced"|"pending"|"error"` to `"local"|"pending"|"synced"|"error"` (`"local"` = saved to device only, not yet in Firestore; `"pending"` = in Firestore but Storage upload pending; `"synced"` = Storage upload complete)
> - `FirestoreReceipt`: added `firebaseStorageUrl?`, `driveFileId?`, removed `storagePath` (superseded)
> - `FirestoreWarranty`: removed per-warranty `createdAt`/`updatedAt` (not needed for query patterns); added `notificationIds[]`
> - `FirestoreExpense`: added `description` field
> - `FirestorePlannerItem`: new type (was missing from Plan 01)

```typescript
// src/types/firestore.ts
import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import type { ReceiptCategory, CarpoolPassenger } from "./index";

type Timestamp = FirebaseFirestoreTypes.Timestamp;

export interface FirestoreUser {
  uid: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  fcmToken?: string;
  googleDriveLinked: boolean;
  createdAt: Timestamp;
}

export interface FirestoreReceipt {
  userId: string;
  merchant: string;
  date: Timestamp;
  amount: number;
  category: ReceiptCategory;
  isWarranty: boolean;
  items?: Array<{ name: string; quantity: number; price: number }>;
  firebaseStorageUrl?: string;
  driveFileId?: string;
  syncStatus: "local" | "pending" | "synced" | "error";
  tripId?: string;
  createdAt: Timestamp;
}

export interface FirestoreWarranty {
  userId: string;
  receiptId: string;
  productName: string;
  manufacturer: string;
  purchaseDate: Timestamp;
  expirationDate: Timestamp;
  coverageType: string;
  notificationIds: string[];
}

export interface FirestoreTrip {
  name: string;
  createdByUid: string;
  startDate: Timestamp;
  endDate: Timestamp;
  memberUids: string[];        // used for security rules
  participants: FirestoreParticipant[];
  totalPot: number;
  categoryBreakdown: Record<string, number>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Stored embedded in the FirestoreTrip document
export interface FirestoreParticipant {
  id: string;
  uid?: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUri?: string;
  isGhost: boolean;
  managedBy?: string;
  amountPaid: number;
  amountOwed: number;
}

export interface FirestoreExpense {
  tripId: string;
  receiptId?: string;
  description: string;
  amount: number;
  paidBy: string;             // participantId
  splitAmong: string[];       // participantIds
  splitType: "equal" | "custom" | "percentage";
  customAmounts?: Record<string, number>;
  createdByUid: string;
  createdAt: Timestamp;
}

export interface FirestoreCarpool {
  tripId: string;
  name: string;
  route: string;
  distance: number;
  fuelCost: number;
  passengers: CarpoolPassenger[];
  createdAt: Timestamp;
}

export interface FirestoreSettlement {
  tripId: string;
  fromParticipantId: string;
  toParticipantId: string;
  amount: number;
  status: "pending" | "settled";
  createdAt: Timestamp;
  settledAt?: Timestamp;
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
  createdAt: Timestamp;
}
```

---

## 3. Security Rules

File: `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthed() {
      return request.auth != null;
    }

    function isTripMember(tripId) {
      return isAuthed() &&
        request.auth.uid in get(/databases/$(database)/documents/trips/$(tripId)).data.memberUids;
    }

    function isTripCreator(tripId) {
      return isAuthed() &&
        request.auth.uid == get(/databases/$(database)/documents/trips/$(tripId)).data.createdByUid;
    }

    match /users/{uid} {
      allow read, update, delete: if isAuthed() && request.auth.uid == uid;
      allow create: if isAuthed() && request.auth.uid == uid;
    }

    match /receipts/{receiptId} {
      allow read, update, delete: if isAuthed() && request.auth.uid == resource.data.userId;
      allow create: if isAuthed() && request.auth.uid == request.resource.data.userId;
    }

    match /warranties/{warrantyId} {
      allow read, update, delete: if isAuthed() && request.auth.uid == resource.data.userId;
      allow create: if isAuthed() && request.auth.uid == request.resource.data.userId;
    }

    match /trips/{tripId} {
      allow read: if isTripMember(tripId);
      allow create: if isAuthed() && request.auth.uid == request.resource.data.createdByUid;
      allow update: if isTripMember(tripId);
      allow delete: if isTripCreator(tripId);

      match /expenses/{expenseId} {
        allow read, create, update: if isTripMember(tripId);
        allow delete: if isTripMember(tripId) &&
          request.auth.uid == resource.data.createdByUid;
      }

      match /carpools/{carpoolId} {
        allow read, create, update: if isTripMember(tripId);
        allow delete: if isTripMember(tripId) &&
          request.auth.uid == resource.data.createdByUid;
      }

      match /settlements/{settlementId} {
        allow read, create: if isTripMember(tripId);
        allow update: if isTripMember(tripId) && (
          request.auth.uid == resource.data.fromParticipantId ||
          request.auth.uid == resource.data.toParticipantId ||
          isTripCreator(tripId)
        );
        allow delete: if isTripCreator(tripId);
      }

      match /plannerItems/{itemId} {
        allow read, create, update: if isTripMember(tripId);
        allow delete: if isTripMember(tripId) &&
          request.auth.uid == resource.data.createdByUid;
      }
    }

    match /tripInvitations/{inviteId} {
      allow create: if isAuthed();
      allow read: if isAuthed() &&
        (request.auth.uid == resource.data.invitedByUid ||
         request.auth.token.email == resource.data.inviteeEmail);
      allow update: if isAuthed() &&
        request.auth.token.email == resource.data.inviteeEmail &&
        request.resource.data.status in ["accepted", "declined"];
    }
  }
}
```

Deploy: `firebase deploy --only firestore:rules`

---

## 4. Composite Indexes

File: `firestore.indexes.json`

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
    },
    {
      "collectionGroup": "tripInvitations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "inviteeEmail", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

Deploy: `firebase deploy --only firestore:indexes`

---

## 5. Timestamp Conversion Helper

All `onSnapshot` listeners must convert `Timestamp` fields to ISO strings before passing data to store setters. Add this helper at the top of any service file that listens to Firestore:

```typescript
import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

type Timestamp = FirebaseFirestoreTypes.Timestamp;

function toISODate(ts: Timestamp | string | undefined): string {
  if (!ts) return new Date().toISOString().split("T")[0];
  if (typeof ts === "string") return ts;
  return ts.toDate().toISOString().split("T")[0];
}
```

---

## 5a. Testing Notes

The `@react-native-firebase/firestore` TypeScript types define `DocumentSnapshot.exists` as a method (`exists(): boolean`), not a boolean property. Always call it:

```typescript
// Correct
if (!snap.exists()) return;
const result = doc.exists() ? (doc.data() as MyType) : null;

// Wrong — snap.exists is a function reference (always truthy), the guard never fires
if (!snap.exists) return;
```

When writing Jest tests that mock Firestore snapshots, use `exists: jest.fn(() => false)` (not `exists: false`):

```typescript
// Correct
get: jest.fn(() => Promise.resolve({ exists: jest.fn(() => true), data: () => myData }))

// Wrong — calling .exists() on a boolean throws at runtime
get: jest.fn(() => Promise.resolve({ exists: true, data: () => myData }))
```

The global `__mocks__/@react-native-firebase/firestore/index.js` already uses `jest.fn(() => false)`. When overriding `get` in individual test files, follow the same pattern.

### Mock `requireAuth` via `jest.mock("../utils", ...)`

Do NOT attempt to mock `@react-native-firebase/auth` directly inside individual test files. The global `__mocks__/@react-native-firebase/auth/index.js` already provides an `auth()` mock, and re-mocking it from within a test file leads to `mockReturnValue is not a function` errors. Instead, mock the `requireAuth` utility directly:

```typescript
// Correct — mock the utils module
jest.mock("../utils", () => ({
  requireAuth: jest.fn(() => "uid-test"),
}));

// Wrong — leads to "mockReturnValue is not a function"
const mockAuth = require("@react-native-firebase/auth").default;
(mockAuth as any).mockReturnValue({ currentUser: { uid: "uid-test" } });
```

---

## 6. Service Layer Implementations

### `src/services/receiptService.ts`

> **expo-file-system v19 note (SDK 54):** The legacy file-system APIs (`documentDirectory`, `getInfoAsync`, `copyAsync`, `deleteAsync`, `makeDirectoryAsync`) have moved to the `/legacy` subpath. Import from `"expo-file-system/legacy"`, not `"expo-file-system"`. The main package now exposes a class-based API (`File`, `Directory`, `Paths`) and the legacy exports throw at runtime if accessed from the root import.

> **Collection reference pattern:** Do NOT call `firestore().collection(...)` at module load time (top-level constant). Wrap it in a factory function (`const receiptsCol = () => firestore().collection("receipts")`). Evaluating `firestore()` eagerly breaks Jest test isolation because the mock isn't yet configured when the module is imported.

```typescript
import firestore from "@react-native-firebase/firestore";
import * as FileSystem from "expo-file-system/legacy";
import { requireAuth } from "./utils";
import { generateUUID } from "../utils/uuid";
import type { FirestoreReceipt } from "../types/firestore";
import type { ReceiptCategory, Receipt } from "../types";
import type { OCRResult } from "./ocrService";

const receiptsCol = () => firestore().collection("receipts");
const RECEIPTS_DIR = `${FileSystem.documentDirectory}receipts/`;

function toISODate(ts: any): string {
  if (!ts) return new Date().toISOString().split("T")[0];
  if (typeof ts === "string") return ts;
  return ts.toDate().toISOString().split("T")[0];
}

export async function ensureReceiptsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(RECEIPTS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(RECEIPTS_DIR, { intermediates: true });
  }
}

export async function saveImageLocally(tempUri: string, receiptId: string): Promise<string> {
  await ensureReceiptsDir();
  const destination = `${RECEIPTS_DIR}${receiptId}.jpg`;
  await FileSystem.copyAsync({ from: tempUri, to: destination });
  return destination;
}

export async function createReceiptRecord(
  ocrResult: OCRResult,
  localImageUri: string,
  category: ReceiptCategory,
  isWarranty: boolean,
  tripId?: string
): Promise<string> {
  const uid = requireAuth();
  const receiptId = generateUUID();
  const localUri = await saveImageLocally(localImageUri, receiptId);

  await receiptsCol().doc(receiptId).set({
    userId: uid,
    merchant: ocrResult.merchant,
    date: ocrResult.date,
    amount: ocrResult.amount,
    category,
    isWarranty,
    items: ocrResult.items,
    syncStatus: "local",
    tripId: tripId ?? null,
    createdAt: new Date().toISOString(),
  });

  // Kick off background uploads (non-blocking)
  uploadToFirebaseStorage(receiptId, localUri).catch(console.error);

  return receiptId;
}

export async function updateReceipt(
  receiptId: string,
  updates: Partial<Pick<FirestoreReceipt, "merchant" | "date" | "amount" | "category" | "isWarranty">>
): Promise<void> {
  requireAuth();
  await receiptsCol().doc(receiptId).update(updates);
}

export async function deleteReceipt(receiptId: string): Promise<void> {
  requireAuth();
  // Delete Firestore doc
  await receiptsCol().doc(receiptId).delete();
  // Delete local file if it exists
  const localPath = `${RECEIPTS_DIR}${receiptId}.jpg`;
  const info = await FileSystem.getInfoAsync(localPath);
  if (info.exists) {
    await FileSystem.deleteAsync(localPath, { idempotent: true });
  }
  // Firebase Storage deletion handled in Plan 06 uploadToFirebaseStorage
}

// Stub — full implementation in Plan 06
export async function uploadToFirebaseStorage(
  _receiptId: string,
  _localUri: string
): Promise<string> {
  return "";
}

export function listenToReceipts(
  onUpdate: (receipts: Array<Receipt & { _pendingWrite: boolean }>) => void
): () => void {
  const uid = requireAuth();
  return receiptsCol()
    .where("userId", "==", uid)
    .orderBy("date", "desc")
    .limit(50)
    .onSnapshot(snap => {
      onUpdate(snap.docs.map(d => {
        const data = d.data() as FirestoreReceipt;
        return {
          id: d.id,
          _pendingWrite: d.metadata.hasPendingWrites,
          merchant: data.merchant,
          date: toISODate(data.date),
          amount: data.amount,
          category: data.category,
          isWarranty: data.isWarranty,
          items: data.items,
          imageUri: data.firebaseStorageUrl,
          syncStatus: data.syncStatus === "local" ? "pending" : data.syncStatus,
        };
      }));
    });
}
```

### `src/services/warrantyService.ts`

```typescript
import firestore from "@react-native-firebase/firestore";
import * as Notifications from "expo-notifications";
import { requireAuth } from "./utils";
import { generateUUID } from "../utils/uuid";
import type { FirestoreWarranty } from "../types/firestore";
import type { Warranty } from "../types";
import type { OCRResult } from "./ocrService";

const warrantiesCol = () => firestore().collection("warranties");

function toISODate(ts: any): string {
  if (!ts) return new Date().toISOString().split("T")[0];
  if (typeof ts === "string") return ts;
  return ts.toDate().toISOString().split("T")[0];
}

export async function createWarranty(
  data: Omit<FirestoreWarranty, "userId" | "notificationIds">
): Promise<string> {
  const uid = requireAuth();
  const warrantyId = generateUUID();
  const notificationIds = await scheduleExpirationNotifications(
    warrantyId,
    data.productName,
    typeof data.expirationDate === "string"
      ? data.expirationDate
      : (data.expirationDate as any).toDate().toISOString().split("T")[0]
  );

  await warrantiesCol().doc(warrantyId).set({
    ...data,
    userId: uid,
    notificationIds,
  });

  return warrantyId;
}

export async function createFromReceipt(
  receiptId: string,
  ocrResult: OCRResult
): Promise<string> {
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
  } as any);
}

export async function updateWarranty(
  warrantyId: string,
  updates: Partial<Omit<FirestoreWarranty, "userId">>
): Promise<void> {
  requireAuth();
  let finalUpdates: Record<string, unknown> = { ...updates };

  if (updates.expirationDate) {
    const doc = await warrantiesCol().doc(warrantyId).get();
    const existing = doc.data() as FirestoreWarranty;
    await cancelNotifications(existing.notificationIds ?? []);

    const newExpDate = toISODate(updates.expirationDate as any);
    const notificationIds = await scheduleExpirationNotifications(
      warrantyId,
      (updates.productName ?? existing.productName) as string,
      newExpDate
    );
    finalUpdates = { ...finalUpdates, notificationIds };
  }
  await warrantiesCol().doc(warrantyId).update(finalUpdates);
}

export async function deleteWarranty(warrantyId: string): Promise<void> {
  requireAuth();
  const doc = await warrantiesCol().doc(warrantyId).get();
  const data = doc.data() as FirestoreWarranty;
  await cancelNotifications(data.notificationIds ?? []);
  await warrantiesCol().doc(warrantyId).delete();
}

export function listenToWarranties(
  onUpdate: (warranties: Array<Warranty & { _pendingWrite: boolean }>) => void
): () => void {
  const uid = requireAuth();
  return warrantiesCol()
    .where("userId", "==", uid)
    .orderBy("expirationDate", "asc")
    .onSnapshot(snap => {
      onUpdate(snap.docs.map(d => {
        const data = d.data() as FirestoreWarranty;
        return {
          id: d.id,
          _pendingWrite: d.metadata.hasPendingWrites,
          receiptId: data.receiptId,
          productName: data.productName,
          manufacturer: data.manufacturer,
          purchaseDate: toISODate(data.purchaseDate),
          expirationDate: toISODate(data.expirationDate),
          coverageType: data.coverageType,
        };
      }));
    });
}

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

### `src/services/tripService.ts`

```typescript
import firestore from "@react-native-firebase/firestore";
import { requireAuth } from "./utils";
import { generateUUID } from "../utils/uuid";
import type {
  FirestoreTrip, FirestoreExpense, FirestoreCarpool,
  FirestoreSettlement, FirestorePlannerItem, FirestoreParticipant,
} from "../types/firestore";
import type { TripParticipant, Trip, Expense, Carpool, SettlementTransaction } from "../types";
import { getUserProfile } from "./userService";

const tripsCol = () => firestore().collection("trips");

function toISODate(ts: any): string {
  if (!ts) return new Date().toISOString().split("T")[0];
  if (typeof ts === "string") return ts;
  return ts.toDate().toISOString().split("T")[0];
}

// --- Trip CRUD ---

export async function createTrip(
  data: { name: string; startDate: string; endDate: string; participants: TripParticipant[] }
): Promise<string> {
  const uid = requireAuth();
  const tripId = generateUUID();
  const now = new Date().toISOString();
  await tripsCol().doc(tripId).set({
    name: data.name,
    createdByUid: uid,
    startDate: data.startDate,
    endDate: data.endDate,
    memberUids: [uid],
    participants: data.participants,
    totalPot: 0,
    categoryBreakdown: {},
    createdAt: now,
    updatedAt: now,
  });
  return tripId;
}

export async function updateTrip(
  tripId: string,
  updates: Partial<Pick<FirestoreTrip, "name" | "startDate" | "endDate" | "totalPot" | "categoryBreakdown">>
): Promise<void> {
  requireAuth();
  await tripsCol().doc(tripId).update({ ...updates, updatedAt: new Date().toISOString() });
}

export async function deleteTrip(tripId: string): Promise<void> {
  requireAuth();
  await tripsCol().doc(tripId).delete();
}

// --- Participant management ---

export async function addGhostParticipant(
  tripId: string,
  name: string,
  contact?: { email?: string; phone?: string }
): Promise<void> {
  const uid = requireAuth();
  const ghost: FirestoreParticipant = {
    id: generateUUID(),
    name,
    email: contact?.email,
    phone: contact?.phone,
    isGhost: true,
    managedBy: uid,
    amountPaid: 0,
    amountOwed: 0,
  };
  await tripsCol().doc(tripId).update({
    participants: firestore.FieldValue.arrayUnion(ghost),
  });
}

// --- Expense CRUD ---

export async function addExpense(
  tripId: string,
  data: Omit<FirestoreExpense, "tripId" | "createdByUid" | "createdAt">
): Promise<string> {
  const uid = requireAuth();
  const expenseId = generateUUID();
  await tripsCol().doc(tripId).collection("expenses").doc(expenseId).set({
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
  await tripsCol().doc(tripId).collection("expenses").doc(expenseId).update(updates);
}

export async function deleteExpense(tripId: string, expenseId: string): Promise<void> {
  requireAuth();
  await tripsCol().doc(tripId).collection("expenses").doc(expenseId).delete();
}

// --- Invitations ---

export async function createInvitation(
  tripId: string,
  invitedByUid: string,
  inviteeEmail?: string
): Promise<string> {
  const uid = requireAuth();
  const inviteId = generateUUID();
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 7);

  const tripDoc = await tripsCol().doc(tripId).get();
  const tripName = tripDoc.data()?.name ?? "";
  const profile = await getUserProfile(uid);

  await firestore().collection("tripInvitations").doc(inviteId).set({
    tripId,
    tripName,
    invitedByUid: uid,
    invitedByName: profile?.displayName ?? "Someone",
    inviteeEmail,
    status: "pending",
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  return inviteId;
}

export function buildInviteLink(inviteId: string, tripId: string): string {
  return `triptrack://invite/${inviteId}?tripId=${tripId}`;
}

// --- Listeners ---

export function listenToTrip(
  tripId: string,
  onUpdate: (trip: Trip & { _pendingWrite: boolean }) => void
): () => void {
  return tripsCol().doc(tripId).onSnapshot(snap => {
    if (!snap.exists()) return;
    const data = snap.data() as FirestoreTrip;
    onUpdate({
      id: snap.id,
      _pendingWrite: snap.metadata.hasPendingWrites,
      name: data.name,
      startDate: toISODate(data.startDate),
      endDate: toISODate(data.endDate),
      participants: (data.participants ?? []) as TripParticipant[],
      totalSpend: 0, // computed from expenses
      categories: [],
      carpools: [],
      settlements: [],
      totalPot: data.totalPot ?? 0,
      categoryBreakdown: data.categoryBreakdown ?? {},
    });
  });
}

export function listenToExpenses(
  tripId: string,
  onUpdate: (expenses: Array<Expense & { _pendingWrite: boolean }>) => void
): () => void {
  return tripsCol()
    .doc(tripId).collection("expenses")
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      onUpdate(snap.docs.map(d => {
        const data = d.data() as FirestoreExpense;
        return {
          id: d.id,
          _pendingWrite: d.metadata.hasPendingWrites,
          tripId: data.tripId,
          receiptId: data.receiptId,
          description: data.description,
          amount: data.amount,
          paidBy: data.paidBy,
          splitAmong: data.splitAmong,
          splitType: data.splitType,
          customAmounts: data.customAmounts,
        };
      }));
    });
}

export function listenToCarpools(
  tripId: string,
  onUpdate: (carpools: Array<Carpool & { _pendingWrite: boolean }>) => void
): () => void {
  return tripsCol().doc(tripId).collection("carpools")
    .orderBy("createdAt", "asc")
    .onSnapshot(snap => {
      onUpdate(snap.docs.map(d => {
        const data = d.data() as FirestoreCarpool;
        return {
          id: d.id,
          _pendingWrite: d.metadata.hasPendingWrites,
          tripId: data.tripId,
          name: data.name,
          route: data.route,
          distance: data.distance,
          fuelCost: data.fuelCost,
          passengers: data.passengers,
        };
      }));
    });
}

export function listenToSettlements(
  tripId: string,
  onUpdate: (settlements: Array<SettlementTransaction & { _pendingWrite: boolean }>) => void
): () => void {
  return tripsCol().doc(tripId).collection("settlements")
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      onUpdate(snap.docs.map(d => {
        const data = d.data() as FirestoreSettlement;
        return {
          id: d.id,
          _pendingWrite: d.metadata.hasPendingWrites,
          tripId: data.tripId,
          fromParticipantId: data.fromParticipantId,
          toParticipantId: data.toParticipantId,
          amount: data.amount,
          status: data.status,
        };
      }));
    });
}

export function listenToPlannerItems(
  tripId: string,
  onUpdate: (items: Array<FirestorePlannerItem & { id: string; _pendingWrite: boolean }>) => void
): () => void {
  return tripsCol().doc(tripId).collection("plannerItems")
    .orderBy("createdAt", "asc")
    .onSnapshot(snap => {
      onUpdate(snap.docs.map(d => ({
        id: d.id,
        _pendingWrite: d.metadata.hasPendingWrites,
        ...d.data() as FirestorePlannerItem,
      })));
    });
}
```

### `src/services/settlementService.ts`

```typescript
import { generateUUID } from "../utils/uuid";
import type { TripParticipant, SettlementTransaction } from "../types";

export function optimizeSettlements(
  participants: TripParticipant[],
  tripId: string
): SettlementTransaction[] {
  const balances = participants.map(p => ({
    id: p.id,
    balance: p.amountPaid - p.amountOwed, // positive = owed money, negative = owes money
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
      tripId,
      fromParticipantId: debt.id,
      toParticipantId: credit.id,
      amount: Math.round(amount * 100) / 100,
      status: "pending",
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

## 7. `syncService.ts` — Real-Time Listener Lifecycle

This service is a **lifecycle coordinator only**: it calls listener functions exported from the service layer (thin delegation pattern). This keeps `syncService` testable and query logic in the services.

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
  activeListeners.get(key)?.();
  activeListeners.set(key, unsubscribe);
}

export function startReceiptSync(): void {
  register("receipts", listenToReceipts(receipts => {
    useReceiptStore.getState().setReceipts(receipts);
  }));
}

export function startWarrantySync(): void {
  register("warranties", listenToWarranties(warranties => {
    useWarrantyStore.getState().setWarranties(warranties);
  }));
}

export function startTripSync(tripId: string): void {
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

export function stopTripSync(tripId: string): void {
  ["trip", "expenses", "carpools", "settlements", "plannerItems"].forEach(prefix => {
    const key = `${prefix}:${tripId}`;
    activeListeners.get(key)?.();
    activeListeners.delete(key);
  });
}

export function teardownAll(): void {
  activeListeners.forEach(fn => fn());
  activeListeners.clear();
}
```

### Where to start each listener

| Listener | Start | Stop |
|---|---|---|
| `startReceiptSync()` | `app/_layout.tsx` on auth confirmed (non-anonymous) | `teardownAll()` on sign-out |
| `startWarrantySync()` | `app/_layout.tsx` on auth confirmed (non-anonymous) | `teardownAll()` on sign-out |
| `startTripSync(tripId)` | `app/(tabs)/trips/[tripId].tsx` `useEffect` mount | `stopTripSync(tripId)` on `useEffect` cleanup |

---

## 8. Zustand Store Amendments

The existing stores (from Plan 01) hold mock data and have basic CRUD actions. Add the following setters so `syncService` can push live data into them. The mock data remains for development; live data replaces it once sync starts.

### `src/stores/receiptStore.ts` — add these actions

```typescript
// Add to ReceiptState interface:
setReceipts: (receipts: Receipt[]) => void;

// Add to create() implementation:
setReceipts: receipts => set({ receipts }),
```

### `src/stores/warrantyStore.ts` — add these actions

```typescript
// Add to WarrantyState interface:
setWarranties: (warranties: Warranty[]) => void;

// Add to create() implementation:
setWarranties: warranties => set({ warranties }),
```

### `src/stores/tripStore.ts` — replace with enhanced store

The existing trip store holds `trips: Trip[]`. Upgrade to `Record<string, Trip>` for O(1) lookups and add subcollection state:

```typescript
import { create } from "zustand";
import type { Trip, Expense, Carpool, SettlementTransaction } from "@/types";
import type { FirestorePlannerItem } from "@/types/firestore";

type PlannerItem = FirestorePlannerItem & { id: string; _pendingWrite?: boolean };

interface TripState {
  trips: Record<string, Trip>;
  expenses: Record<string, Expense[]>;          // keyed by tripId
  carpools: Record<string, Carpool[]>;          // keyed by tripId
  settlements: Record<string, SettlementTransaction[]>; // keyed by tripId
  plannerItems: Record<string, PlannerItem[]>;  // keyed by tripId
  loading: boolean;
  error: string | null;

  // Live data setters (called by syncService)
  upsertTrip: (trip: Trip) => void;
  setExpenses: (tripId: string, expenses: Expense[]) => void;
  setCarpools: (tripId: string, carpools: Carpool[]) => void;
  setSettlements: (tripId: string, settlements: SettlementTransaction[]) => void;
  setPlannerItems: (tripId: string, items: PlannerItem[]) => void;

  // UI actions
  addTrip: (trip: Trip) => void;
  updateTrip: (id: string, updates: Partial<Trip>) => void;
  deleteTrip: (id: string) => void;
  getTrip: (tripId: string) => Trip | undefined;
  getAllTrips: () => Trip[];
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: {},
  expenses: {},
  carpools: {},
  settlements: {},
  plannerItems: {},
  loading: false,
  error: null,

  upsertTrip: trip => set(s => ({ trips: { ...s.trips, [trip.id]: trip } })),
  setExpenses: (tripId, expenses) => set(s => ({ expenses: { ...s.expenses, [tripId]: expenses } })),
  setCarpools: (tripId, carpools) => set(s => ({ carpools: { ...s.carpools, [tripId]: carpools } })),
  setSettlements: (tripId, settlements) => set(s => ({ settlements: { ...s.settlements, [tripId]: settlements } })),
  setPlannerItems: (tripId, items) => set(s => ({ plannerItems: { ...s.plannerItems, [tripId]: items } })),

  addTrip: trip => set(s => ({ trips: { ...s.trips, [trip.id]: trip } })),
  updateTrip: (id, updates) => set(s => ({
    trips: { ...s.trips, [id]: { ...s.trips[id], ...updates } },
  })),
  deleteTrip: id => set(s => {
    const trips = { ...s.trips };
    delete trips[id];
    return { trips };
  }),
  getTrip: tripId => get().trips[tripId],
  getAllTrips: () => Object.values(get().trips),
}));
```

> **UI note:** Where old code iterated `trips` as an array (e.g., `trips.map(...)`), use `getAllTrips()` or `Object.values(trips)` instead.

---

## 9. Pending Write Indicator

Firestore documents include `metadata.hasPendingWrites`. Each listener maps this to a `_pendingWrite` flag (already done in the service implementations above). Show a `sync` icon on `ListItem` rows when `_pendingWrite` is true.

> **`MaterialIcon` has no `className` prop** — it wraps `@expo/vector-icons` which takes `color` and `size` props. Pass color via the `color` prop. NativeWind `animate-spin` does not apply to native icon components; omit it.

```typescript
// In ListItem (src/components/ListItem.tsx):
import { colors } from "@/theme/colors";

{item._pendingWrite && (
  <MaterialIcon name="sync" size={16} color={colors.onSurfaceVariant} />
)}
```

---

## 10. `arrayUnion` / `arrayRemove` for Participant Arrays

The `participants` array on the trip document stores full `TripParticipant` objects. When adding/removing participants, use Firestore field transforms — never overwrite the full array:

```typescript
// Adding a participant
await tripsCol().doc(tripId).update({
  participants: firestore.FieldValue.arrayUnion(newParticipant),
  memberUids: firestore.FieldValue.arrayUnion(newParticipant.uid ?? newParticipant.id),
});

// Removing a participant
await tripsCol().doc(tripId).update({
  participants: firestore.FieldValue.arrayRemove(existingParticipant),
  memberUids: firestore.FieldValue.arrayRemove(existingParticipant.uid ?? existingParticipant.id),
});
```

> **Known limitation:** Updating a single participant's `amountPaid`/`amountOwed` requires reading and rewriting the entire `participants` array. This is acceptable for MVP group sizes (≤20 participants). Recalculate all balances in a single batch after expense changes.

---

## Deliverables Checklist

- [ ] `src/types/firestore.ts` replaced — new schemas with `memberUids`, `createdByUid`, extended `syncStatus`, `FirestorePlannerItem`, `notificationIds[]` on warranties
- [ ] `firestore.rules` rewritten with explicit `create`/`update`/`delete` (no catch-all `write`)
- [ ] `firestore.indexes.json` with 6 composite indexes — deployed
- [ ] `src/services/receiptService.ts` — full implementation with `listenToReceipts` (Timestamp → string conversion)
- [ ] `src/services/warrantyService.ts` — full CRUD, `createFromReceipt`, notification scheduling/cancellation
- [ ] `src/services/tripService.ts` — trip CRUD, participant management, expense CRUD + all 5 listeners
- [ ] `src/services/syncService.ts` — delegation pattern, all listeners covered
- [ ] `src/services/settlementService.ts` — optimization algorithm with `tripId` parameter
- [ ] `src/stores/receiptStore.ts` — `setReceipts` added
- [ ] `src/stores/warrantyStore.ts` — `setWarranties` added
- [ ] `src/stores/tripStore.ts` — replaced with `Record<string, Trip>` shape + all subcollection setters
- [ ] `_pendingWrite` spinning icon in `ListItem` component
- [ ] `arrayUnion`/`arrayRemove` used for participant array updates
