# Plan 6: Receipt Scanner & Storage Pipeline

> **Prerequisite:** Plan 5 (Data Layer — service implementations and store setters must exist).
> **Implements:** `app/(tabs)/scans.tsx`, `app/scanner.tsx`, `src/services/ocrService.ts`, `src/services/receiptService.ts` (upload steps), `src/services/driveService.ts`.

This plan implements the complete receipt lifecycle: the Scans tab list, the full-screen camera scanner, on-device OCR with ML Kit, the save flow, Firebase Storage upload, and the Google Drive background backup queue. No mock OCR step — real ML Kit is used from the start.

> **NativeWind v5 import rule:** Import `View`, `Text`, `ScrollView`, `Pressable`, `TextInput` from `@/tw` (not `react-native`). Import `Image` from `@/tw/image`. Raw React Native components silently ignore `className`.
>
> **No `expo-linear-gradient`:** Use CSS gradients via `experimental_backgroundImage` on `View`: `style={{ experimental_backgroundImage: 'linear-gradient(to bottom, ...)' }}`.
>
> **Rounded containers:** Add `borderCurve: 'continuous'` to `style` on any rounded View.
>
> **Safe area:** Use `contentInsetAdjustmentBehavior="automatic"` on `ScrollView`/`FlatList`.

---

## Context

`receiptStore` currently contains 7 mock receipts (r1-r7). The Scans tab will render all of them. When the real `syncService` starts (from Plan 05), live Firestore data will replace the mock data automatically via `setReceipts`.

The utility functions `formatCurrency(amount)`, `formatDate(dateString)`, and `daysUntil(dateString)` should be in `src/utils/format.ts`. If not yet extracted from `app/(tabs)/index.tsx`, extract them now as the first step.

---

## Pipeline Overview

```
Camera capture
      │
      ▼
[1] Save to local filesystem (expo-file-system)
      │  instant, always works offline
      ▼
[2] On-device OCR (ML Kit — @infinitered/react-native-mlkit-text-recognition)
      │  reads local file, no network needed
      ▼
[3] Save metadata to Firestore (receipts/{id}) — syncStatus: "local"
      │  queued offline if no connectivity
      ▼
[4] Compress image (expo-image-manipulator)
      │
      ├──▶ [5a] Upload to Firebase Storage
      │          receipts/{userId}/{receiptId}.jpg
      │          Update doc: firebaseStorageUrl, syncStatus: "synced"
      │
      └──▶ [5b] Queue Google Drive upload (expo-sqlite localStorage)
                 Processed in background when online
                 Update doc: driveFileId
```

Steps 3–5 are non-blocking from the user's perspective. The receipt is immediately usable after step 3.

---

## Part A: Scans Tab — Receipt List

File: `app/(tabs)/scans.tsx`

The Scans tab default view is a scrollable receipt list. The scanner is launched via a FAB.

### Step A1: Screen Layout

- `ScrollView` with `contentInsetAdjustmentBehavior="automatic"`
- `TopAppBar` (shared) at top
- Page title: "Receipts" — `font-headline text-2xl font-bold text-on-surface`
- `headerSearchBarOptions` on the Stack screen for native iOS search

### Step A2: Filter Pills

Horizontal `ScrollView` of filter pills:
- "All" | "Food" | "Travel" | "Warranty" | "Utility" | "Shopping" | "Other"
- Active: `bg-primary text-on-primary rounded-full px-4 py-1.5`
- Inactive: `bg-surface-container text-on-surface-variant rounded-full px-4 py-1.5`

### Step A3: Receipt List

Each receipt renders as a `ListItem` or custom row:
- **Left icon:** 48×48 `rounded-xl` category color + `MaterialIcon`
- **Title:** `receipt.merchant` — `font-semibold text-on-surface`
- **Subtitle:** `formatDate(receipt.date)` — `text-sm text-on-surface-variant`
- **Right:** `formatCurrency(receipt.amount)` — `font-bold text-on-surface`
- **Pending write:** If `_pendingWrite`, show spinning `sync` icon
- Tapping navigates to `router.push(`/receipts/${receipt.id}`)`

### Step A4: Empty State

When no receipts match the active filter:
- `MaterialIcon` "receipt_long" at 64px in `text-on-surface-variant`
- "No receipts yet" heading + "Tap the scan button to add your first receipt" subtext

### Step A5: FAB

- `absolute bottom-6 right-6`, `bg-primary rounded-full w-14 h-14`
- `document_scanner` icon in `text-on-primary`
- Navigates to scanner: `router.push('/scanner')`

### Step A6: Data source

```typescript
const receipts = useReceiptStore(state => state.receipts);
const [activeFilter, setActiveFilter] = useState<ReceiptCategory | "all">("all");

const filteredReceipts = activeFilter === "all"
  ? receipts
  : receipts.filter(r => r.category === activeFilter);
```

---

## Part B: Full-Screen Camera Scanner

File: `app/scanner.tsx` (full-screen modal — already registered in `app/_layout.tsx`)

```typescript
<Stack.Screen name="scanner" options={{ presentation: "fullScreenModal", headerShown: false }} />
```

### Step B1: Camera Permission Flow

1. On first open, request camera permission via `Camera.requestCameraPermissionsAsync()`
2. If denied, show a friendly message with a button to open settings
3. Store permission state so the prompt only shows once

### Step B2: Camera View

Layout:
1. Full-width container with `aspect-ratio: 3/4`, `rounded-3xl overflow-hidden`
2. Inside: `expo-camera` `CameraView` component filling the container
3. Shadow: `shadow-2xl` on the container

Scanning overlay (layered on top of camera):
1. **Frame guide:** Centered rectangle (`w-[85%] h-[75%]`) with:
   - `border-2 border-primary/60 rounded-xl`
   - `"Capture Receipt"` label in primary bold
2. **Scan line:** Animated horizontal line using Reanimated — slow sweep from top to bottom
   - `w-full h-1 style={{ experimental_backgroundImage: 'linear-gradient(to right, transparent, #02ba41, transparent)' }}`

Top overlay bar:
1. Absolute positioned at top — `style={{ experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}`
2. Close button (`close` icon) + Flash toggle (`flash_on` / `flash_off` icon)
3. Both in `w-10 h-10 rounded-full` with `BlurView` background from `expo-blur`

Capture button:
1. Centered at bottom: large circular button (68x68) with white border ring
2. Tap triggers `cameraRef.current.takePictureAsync({ quality: 0.8, base64: false })`

Gallery button:
- Opens `expo-image-picker` as alternative input

### Step B3: Preview Mode

After capture, the screen transitions to a preview below the captured image.

**Container:** `bg-surface-container-low rounded-3xl p-6 border border-outline-variant/30`

**Section A — Detected Merchant:**
- Label: "Detected Merchant" — `text-sm text-on-surface-variant`
- Value: merchant name — `text-2xl font-extrabold text-primary`
- OCR confidence badge: if `confidence < 0.7` — `bg-error-container text-on-error-container text-xs rounded-full px-3 py-1` "Low confidence — please verify"

**Section B — Data Grid (2 columns):**
- Left: "Date" label + `formatDate(ocrResult.date)`
- Right: "Amount" label + `formatCurrency(ocrResult.amount)` in `text-xl font-bold`

**Section C — Category Dropdown:**
- Use `@react-native-picker/picker` or a custom bottom sheet
- Options: Food, Travel, Warranty, Utility, Shopping, Other

**Section D — Warranty Toggle:**
- Row: `verified_user` icon + "Flag as Warranty" label + "Track for future claims" subtitle
- Right: `Switch` component (primary color when on)

**Section E — Action Buttons:**
- **Retake** (secondary): `flex-1 bg-surface-container-high text-on-surface font-semibold py-4 rounded-xl`
- **Confirm & Save** (primary): `flex-[2] bg-primary text-on-primary font-bold py-4 rounded-xl shadow-lg shadow-primary/20`

### Step B4: Loading States

- **Camera initializing:** Dark background with spinner
- **OCR processing:** Shimmer/skeleton over preview card fields
- **Saving:** Loading state on "Confirm & Save" button
- **Error:** Error toast with retry option

---

## Part C: OCR Service — ML Kit

File: `src/services/ocrService.ts`

> **Package:** `@infinitered/react-native-mlkit-text-recognition` (already installed in Plan 01). Uses the module's direct API (not the hook `useTextRecognition` — hooks cannot be used in service functions).

```typescript
import TextRecognition from "@infinitered/react-native-mlkit-text-recognition";

export interface OCRResult {
  merchant: string;
  date: string;       // ISO date string: "YYYY-MM-DD"
  amount: number;
  items: Array<{ name: string; quantity: number; price: number }>;
  confidence: number; // 0.0 - 1.0; < 0.7 means fields need manual review
}

export async function processReceiptImage(imageUri: string): Promise<OCRResult> {
  const result = await TextRecognition.recognize(imageUri);
  return parseReceiptText(result.text ?? "");
}

function parseReceiptText(rawText: string): OCRResult {
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);

  // Merchant: usually the first non-empty line
  const merchant = lines[0] ?? "Unknown Merchant";

  // Date: look for common date formats
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|([A-Z][a-z]+ \d{1,2},? \d{4})/;
  const dateMatch = rawText.match(datePattern);
  const date = dateMatch
    ? normalizeDateString(dateMatch[0])
    : new Date().toISOString().split("T")[0];

  // Total: look for the largest dollar amount near "total"
  const totalPattern = /(?:total|amount due|balance)[^\d]*\$?([\d,]+\.\d{2})/i;
  const totalMatch = rawText.match(totalPattern);
  const allAmounts = [...rawText.matchAll(/\$?([\d,]+\.\d{2})/g)]
    .map(m => parseFloat(m[1].replace(",", "")));
  const amount = totalMatch
    ? parseFloat(totalMatch[1].replace(",", ""))
    : allAmounts.length > 0 ? Math.max(...allAmounts) : 0;

  return {
    merchant,
    date,
    amount,
    items: [],
    confidence: totalMatch ? 0.85 : 0.5,
  };
}

function normalizeDateString(raw: string): string {
  const d = new Date(raw);
  return isNaN(d.getTime())
    ? new Date().toISOString().split("T")[0]
    : d.toISOString().split("T")[0];
}
```

> **Note:** Receipt OCR parsing is inherently imperfect. The confidence score surfaces in the preview UI — when below 0.7, highlight fields for manual correction.

---

## Part D: Image Compression

Add to `src/services/receiptService.ts`:

> **API change (SDK 53+):** `manipulateAsync` has been removed. The new API is chainable: `ImageManipulator.manipulate(uri).resize(...).renderAsync()` followed by `image.saveAsync(options)`.

```typescript
import { ImageManipulator } from "expo-image-manipulator";

export async function compressReceiptImage(localUri: string): Promise<string> {
  const image = await ImageManipulator.manipulate(localUri)
    .resize({ width: 1200 })
    .renderAsync();
  const result = await image.saveAsync({ format: "jpeg", compress: 0.82 });
  return result.uri;
}
```

---

## Part E: Firebase Storage Upload

Add to `src/services/receiptService.ts`:

```typescript
import storage from "@react-native-firebase/storage";

export async function uploadToFirebaseStorage(
  receiptId: string,
  localUri: string
): Promise<string> {
  const uid = requireAuth();
  const compressedUri = await compressReceiptImage(localUri);
  const remotePath = `receipts/${uid}/${receiptId}.jpg`;

  const ref = storage().ref(remotePath);
  await ref.putFile(compressedUri);
  const downloadUrl = await ref.getDownloadURL();

  await firestore().collection("receipts").doc(receiptId).update({
    firebaseStorageUrl: downloadUrl,
    syncStatus: "synced",
  });

  return downloadUrl;
}

export async function shareReceiptWithTrip(
  receiptId: string,
  tripId: string,
  localUri: string
): Promise<void> {
  requireAuth();
  const compressedUri = await compressReceiptImage(localUri);
  const tripPath = `trips/${tripId}/receipts/${receiptId}.jpg`;

  const ref = storage().ref(tripPath);
  await ref.putFile(compressedUri);
  const sharedUrl = await ref.getDownloadURL();

  await firestore().collection("receipts").doc(receiptId).update({
    tripId,
    firebaseStorageUrl: sharedUrl,
  });
}
```

### Firebase Storage security rules

File: `storage.rules`

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // User's own receipts: only they can read/write
    match /receipts/{userId}/{receiptId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Trip shared receipts: only trip members can read/write
    match /trips/{tripId}/receipts/{receiptId} {
      allow read: if request.auth != null &&
        firestore.get(/databases/(default)/documents/trips/$(tripId)).data.memberUids.hasAny([request.auth.uid]);
      allow write: if request.auth != null &&
        firestore.get(/databases/(default)/documents/trips/$(tripId)).data.memberUids.hasAny([request.auth.uid]);
    }
  }
}
```

Deploy: `firebase deploy --only storage:rules`

---

## Part F: Google Drive Upload Queue

File: `src/services/driveService.ts`

The Drive backup runs in the background and is resilient to network failures. The queue is stored in `expo-sqlite localStorage` (the global polyfill installed in `app/_layout.tsx`).

```typescript
// expo-sqlite localStorage polyfill is installed once in app/_layout.tsx:
//   import 'expo-sqlite/localStorage/install';
// The global `localStorage` object is then available everywhere.

import * as FileSystem from "expo-file-system";
import firestore from "@react-native-firebase/firestore";
import NetInfo from "@react-native-community/netinfo";
import { getGoogleAccessToken, refreshGoogleAccessToken } from "./authService";

interface DriveUploadQueueEntry {
  receiptId: string;
  localUri: string;
  merchant: string;
  date: string;
  attempts: number;
  lastAttemptAt?: string;
}

const QUEUE_KEY = "drive_upload_queue";

// Concurrency guard — prevents multiple simultaneous processQueue() calls
let isProcessing = false;

export async function queueDriveUpload(
  receiptId: string,
  localUri: string,
  merchant: string,
  date: string
): Promise<void> {
  const existing = await getQueue();
  const entry: DriveUploadQueueEntry = { receiptId, localUri, merchant, date, attempts: 0 };
  await saveQueue([...existing.filter(e => e.receiptId !== receiptId), entry]);
}

export async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const queue = await getQueue();
    if (queue.length === 0) return;

    const remaining: DriveUploadQueueEntry[] = [];

    for (const entry of queue) {
      if (entry.attempts >= 5) continue; // drop after 5 failures

      try {
        const driveFileId = await uploadToDrive(entry);
        await firestore().collection("receipts").doc(entry.receiptId).update({ driveFileId });
      } catch {
        remaining.push({
          ...entry,
          attempts: entry.attempts + 1,
          lastAttemptAt: new Date().toISOString(),
        });
      }
    }

    await saveQueue(remaining);
  } finally {
    isProcessing = false;
  }
}

export function startQueueProcessor(): () => void {
  return NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      processQueue();
    }
  });
}

async function getQueue(): Promise<DriveUploadQueueEntry[]> {
  const raw = localStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveQueue(queue: DriveUploadQueueEntry[]): Promise<void> {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function uploadToDrive(
  entry: DriveUploadQueueEntry,
  isRetry = false  // prevents infinite recursion on persistent 401s
): Promise<string> {
  let accessToken = await getGoogleAccessToken();
  if (!accessToken) throw new Error("No Google access token");

  const folderId = await ensureTripTrackFolder(accessToken);
  const fileName = `${entry.date}_${entry.merchant.replace(/[^a-zA-Z0-9]/g, "_")}_${entry.receiptId}.jpg`;

  const base64 = await FileSystem.readAsStringAsync(entry.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const boundary = "triptrack_boundary";
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    JSON.stringify({ name: fileName, parents: [folderId] }) + `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: image/jpeg\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    base64 + `\r\n` +
    `--${boundary}--`;

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (response.status === 401 && !isRetry) {
    await refreshGoogleAccessToken();
    return uploadToDrive(entry, true);
  }

  if (!response.ok) throw new Error(`Drive upload failed: ${response.status}`);

  const json = await response.json();
  return json.id;
}

async function ensureTripTrackFolder(accessToken: string): Promise<string> {
  const cached = localStorage.getItem("drive_folder_id");
  if (cached) return cached;

  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='TripTrack' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchJson = await searchResponse.json();

  if (searchJson.files?.length > 0) {
    const id = searchJson.files[0].id;
    localStorage.setItem("drive_folder_id", id);
    return id;
  }

  const createResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "TripTrack", mimeType: "application/vnd.google-apps.folder" }),
  });
  const createJson = await createResponse.json();
  localStorage.setItem("drive_folder_id", createJson.id);
  return createJson.id;
}
```

### Google Drive folder structure

```
Google Drive (user's personal Drive)
  └── TripTrack/
        ├── 2026-03-24_Whole_Foods_Market_{uuid}.jpg
        ├── 2026-03-23_Blue_Bottle_Coffee_{uuid}.jpg
        └── 2026-03-22_Shell_Gas_Station_{uuid}.jpg
```

File naming: `{date}_{merchant_sanitized}_{receiptId}.jpg`

---

## Part G: Full Save Flow

When the user taps "Confirm & Save" in the preview screen:

```typescript
// app/scanner.tsx — handleConfirmSave
import { createReceiptRecord } from "@/services/receiptService";
import { createFromReceipt } from "@/services/warrantyService";
import { queueDriveUpload } from "@/services/driveService";
import { useReceiptStore } from "@/stores/receiptStore";
import auth from "@react-native-firebase/auth";

async function handleConfirmSave(
  ocrResult: OCRResult,
  capturedImageUri: string,
  category: ReceiptCategory,
  isWarranty: boolean
): Promise<void> {
  // 1. Save locally + create Firestore record; kicks off Storage upload non-blocking
  const receiptId = await createReceiptRecord(
    ocrResult, capturedImageUri, category, isWarranty
  );

  // 2. Queue Google Drive backup
  await queueDriveUpload(receiptId, capturedImageUri, ocrResult.merchant, ocrResult.date);

  // 3. If warranty, create warranty entry
  if (isWarranty) {
    await createFromReceipt(receiptId, ocrResult);
  }

  // 4. Optimistically update the Zustand store for immediate UI update
  // (Firestore listener will also fire, but this makes Dashboard update instantly)
  useReceiptStore.getState().addReceipt({
    id: receiptId,
    merchant: ocrResult.merchant,
    date: ocrResult.date,
    amount: ocrResult.amount,
    category,
    isWarranty,
    syncStatus: "pending",
  });

  // 5. Show success toast and navigate back
  showToast("Receipt saved!");
  router.replace("/(tabs)/");
}
```

---

## Part H: Storage Lifecycle & Cleanup

### Firebase Storage
- Receipt images retained indefinitely for MVP
- When a receipt is deleted, also delete the Storage file in `receiptService.deleteReceipt()`:

```typescript
// Add to deleteReceipt() in receiptService.ts:
import storage from "@react-native-firebase/storage";

const uid = auth().currentUser?.uid;
if (uid) {
  try {
    await storage().ref(`receipts/${uid}/${receiptId}.jpg`).delete();
  } catch {
    // File may not exist in Storage yet (syncStatus: "local") — ignore
  }
}
```

### Local filesystem cleanup

Run when the app comes to the foreground, to free storage on devices low on space:

```typescript
// Add to receiptService.ts:
const RECEIPTS_DIR = `${FileSystem.documentDirectory}receipts/`;

export async function cleanupOldLocalFiles(): Promise<void> {
  const receipts = useReceiptStore.getState().receipts;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  for (const receipt of receipts) {
    if (
      receipt.syncStatus === "synced" &&
      new Date(receipt.date) < cutoff
    ) {
      const localPath = `${RECEIPTS_DIR}${receipt.id}.jpg`;
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists) {
        await FileSystem.deleteAsync(localPath, { idempotent: true });
      }
    }
  }
}
```

Call `cleanupOldLocalFiles()` in `app/_layout.tsx` on AppState `"active"` event.

---

## Deliverables Checklist

### Part A: Scans Tab
- [ ] `app/(tabs)/scans.tsx` — receipt list with filter pills, `ListItem` rows, `_pendingWrite` icon, empty state, FAB

### Part B: Camera Scanner
- [ ] `app/scanner.tsx` — full-screen modal camera with scanning overlay, flash toggle, gallery picker
- [ ] Camera permission flow with settings redirect
- [ ] Preview card with merchant, date, amount, category, warranty toggle
- [ ] Retake / Confirm & Save buttons
- [ ] Loading + error states

### Part C: OCR
- [ ] `src/services/ocrService.ts` — ML Kit text recognition + receipt parsing
- [ ] Low-confidence badge (< 0.7) shown in preview card

### Part D-E: Compression & Storage
- [ ] `compressReceiptImage()` using new `ImageManipulator` chainable API
- [ ] `uploadToFirebaseStorage()` — updates `firebaseStorageUrl` + `syncStatus: "synced"`
- [ ] `shareReceiptWithTrip()` — uploads to trip Storage path
- [ ] `storage.rules` deployed — trip receipts restricted to trip members

### Part F: Drive Queue
- [ ] `src/services/driveService.ts` — queue management, folder creation, multipart upload
- [ ] `startQueueProcessor()` called in `app/_layout.tsx` after auth confirmed
- [ ] `isRetry` flag prevents infinite recursion on persistent 401
- [ ] Drive folder ID cached in `expo-sqlite localStorage`

### Part G: Save Flow
- [ ] `handleConfirmSave` calls `createReceiptRecord` + `queueDriveUpload` + optimistic store update
- [ ] Warranty entry created when toggle is on

### Part H: Cleanup
- [ ] `deleteReceipt` removes Firestore doc, Storage file, and local file
- [ ] `cleanupOldLocalFiles` called on app foreground
