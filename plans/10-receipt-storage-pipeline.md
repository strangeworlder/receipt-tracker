# Plan 10: Receipt Storage Pipeline

> **Prerequisite:** Plan 7 (Architecture Overview), Plan 8 (Auth), Plan 9 (Data Layer).
> **Amends:** Plan 03 (Receipt Scanner) Steps 6 and 7 are replaced by this plan.

This plan covers the full lifecycle of a receipt from the moment the camera shutter fires to the point where the image and its extracted data are safely stored in three locations: the device filesystem (immediate), Firebase Storage (shared), and Google Drive (personal backup). It also covers image optimization, the offline retry queue, and access control for shared receipts within a trip.

---

## 1. Pipeline Overview

```
Camera capture
      │
      ▼
[1] Save to local filesystem (expo-file-system)
      │  instant, always works offline
      ▼
[2] On-device OCR (ML Kit)
      │  reads local file, no network needed
      ▼
[3] Save metadata to Firestore (receipts/{id})
      │  queued offline if no connectivity
      ▼
[4] Compress image (expo-image-manipulator)
      │
      ├──▶ [5a] Upload to Firebase Storage
      │          receipts/{userId}/{receiptId}.jpg
      │          Update Firestore doc: firebaseStorageUrl, syncStatus: "synced"
      │
      └──▶ [5b] Queue Google Drive upload (expo-sqlite localStorage queue)
                 Processed in background when online
                 Update Firestore doc: driveFileId
```

Steps 3–5 are non-blocking from the user's perspective. The receipt is immediately usable after step 3.

---

## 2. New Dependencies

```bash
# Image compression (used before uploading to reduce bandwidth/storage)
npx expo install expo-image-manipulator

# Already installed in Plan 01:
# expo-camera, expo-file-system, expo-secure-store, @react-native-firebase/storage
# @react-native-ml-kit/text-recognition, @react-native-google-signin/google-signin
```

---

## 3. Step 1 — Local File Save

After `takePictureAsync()` returns (Plan 03 Step 4), the image is at a temporary URI that may be cleared by the OS. Move it to a permanent app directory immediately.

```typescript
// src/services/receiptService.ts
import * as FileSystem from "expo-file-system";

const RECEIPTS_DIR = `${FileSystem.documentDirectory}receipts/`;

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
```

---

## 4. Step 2 — On-Device OCR

Replaces the mock `ocrService.ts` from Plan 03 Step 6. The interface is identical so Plan 03's UI code does not change.

> **Package choice for Expo SDK 53+:** Use `@infinitered/react-native-mlkit-text-recognition` (v4.0.0+ for SDK 53) instead of `@react-native-ml-kit/text-recognition`. The `@infinitered` package is the official Expo-compatible wrapper, actively maintained for CNG projects. Install with: `npx expo install @infinitered/react-native-mlkit-text-recognition`

```typescript
// src/services/ocrService.ts
import { useTextRecognition } from "@infinitered/react-native-mlkit-text-recognition";
// For non-hook usage (service layer), use the module's recognize function directly:
import TextRecognition from "@infinitered/react-native-mlkit-text-recognition";

export interface OCRResult {
  merchant: string;
  date: string;
  amount: number;
  items: Array<{ name: string; quantity: number; price: number }>;
  confidence: number;
}

export async function processReceiptImage(imageUri: string): Promise<OCRResult> {
  const result = await TextRecognition.recognize(imageUri);
  return parseReceiptText(result.text);
}

function parseReceiptText(rawText: string): OCRResult {
  // Parse the raw OCR text into structured receipt data.
  // Strategy: scan for common receipt patterns.

  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);

  // Merchant: usually the first non-empty line in large text
  const merchant = lines[0] ?? "Unknown Merchant";

  // Date: look for common date formats (MM/DD/YYYY, DD-MM-YYYY, Month DD YYYY)
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|([A-Z][a-z]+ \d{1,2},? \d{4})/;
  const dateMatch = rawText.match(datePattern);
  const date = dateMatch ? normalizeDateString(dateMatch[0]) : new Date().toISOString().split("T")[0];

  // Total: look for the largest dollar amount near words like "total", "amount due"
  const totalPattern = /(?:total|amount due|balance)[^\d]*\$?([\d,]+\.\d{2})/i;
  const totalMatch = rawText.match(totalPattern);
  // Fallback: largest dollar amount on any line
  const allAmounts = [...rawText.matchAll(/\$?([\d,]+\.\d{2})/g)].map(m => parseFloat(m[1].replace(",", "")));
  const amount = totalMatch
    ? parseFloat(totalMatch[1].replace(",", ""))
    : allAmounts.length > 0 ? Math.max(...allAmounts) : 0;

  return {
    merchant,
    date,
    amount,
    items: [],  // Line-item extraction is complex; return empty for MVP, parse opportunistically
    confidence: totalMatch ? 0.85 : 0.5,
  };
}

function normalizeDateString(raw: string): string {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date().toISOString().split("T")[0] : d.toISOString().split("T")[0];
}
```

> **Note:** Receipt OCR parsing is inherently imperfect. The confidence score is surfaced in the Plan 03 preview UI — when confidence is below 0.7, the preview card highlights fields for manual correction.

---

## 5. Step 3 — Save Metadata to Firestore

After OCR, create the Firestore document immediately. At this point `syncStatus` is `"local"` — the image has not yet been uploaded to Firebase Storage.

```typescript
// src/services/receiptService.ts (continued)
import firestore from "@react-native-firebase/firestore";
import { requireAuth } from "./utils";
import { generateUUID } from "../utils/uuid";

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

  const doc: FirestoreReceipt = {
    userId: uid,
    merchant: ocrResult.merchant,
    date: ocrResult.date,
    amount: ocrResult.amount,
    category,
    isWarranty,
    items: ocrResult.items,
    syncStatus: "local",
    tripId,
    createdAt: new Date().toISOString(),
    // firebaseStorageUrl and driveFileId added later by upload steps
  };

  await firestore().collection("receipts").doc(receiptId).set(doc);

  // Kick off background uploads (non-blocking)
  uploadToFirebaseStorage(receiptId, localUri).catch(console.error);
  queueDriveUpload(receiptId, localUri, ocrResult.merchant, ocrResult.date).catch(console.error);

  return receiptId;
}
```

---

## 6. Step 4 — Image Compression

Before uploading, compress the image to reduce storage costs and upload time. Receipt images do not need to be high resolution — text is readable at 1200px wide.

> **API change (SDK 53+):** `manipulateAsync` has been removed from `expo-image-manipulator`. The new API uses a chainable context-based approach: `ImageManipulator.manipulate(uri).resize(...).renderAsync()` followed by `image.saveAsync(options)`.

```typescript
// src/services/receiptService.ts (continued)
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

## 7. Step 5a — Firebase Storage Upload

```typescript
// src/services/receiptService.ts (continued)
import storage from "@react-native-firebase/storage";
import { requireAuth } from "./utils";

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
```

### Firebase Storage security rules

File: `storage.rules`

> **Security fix:** The original `allow write: if request.auth != null` on the trip receipts path allowed ANY authenticated user to write to any trip's storage path. The corrected rules below restrict writes to trip members only.

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // User's own receipts: only they can read/write
    match /receipts/{userId}/{receiptId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Trip shared receipts: any trip member can read; only trip members can write
    match /trips/{tripId}/receipts/{receiptId} {
      allow read: if request.auth != null &&
        firestore.get(/databases/(default)/documents/trips/$(tripId)).data.memberUids.hasAny([request.auth.uid]);
      allow write: if request.auth != null &&
        firestore.get(/databases/(default)/documents/trips/$(tripId)).data.memberUids.hasAny([request.auth.uid]);
    }
  }
}
```

---

## 8. Step 5b — Google Drive Upload Queue

Google Drive backup runs in the background and is resilient to network failures. The queue is stored in `expo-sqlite` localStorage and processed whenever the app comes online.

### Queue entry schema:

```typescript
interface DriveUploadQueueEntry {
  receiptId: string;
  localUri: string;
  merchant: string;
  date: string;
  attempts: number;
  lastAttemptAt?: string;
}
```

### Queue management:

> **expo-sqlite localStorage API:** `SQLiteLocalStorage` does not exist. Instead, use one of:
> 1. **Global polyfill:** `import 'expo-sqlite/localStorage/install'` (once, in `_layout.tsx`), then use `localStorage.getItem()` / `localStorage.setItem()` globally.
> 2. **Async-storage compatible:** `import AsyncStorage from 'expo-sqlite/async-storage'` for an async API.
>
> The code below uses the global polyfill approach. Make sure `import 'expo-sqlite/localStorage/install'` is called once at app startup (e.g., in `app/_layout.tsx`).

```typescript
// src/services/driveService.ts
// expo-sqlite localStorage polyfill must be installed once at app startup:
//   import 'expo-sqlite/localStorage/install';
// After that, the global `localStorage` object is available (getItem, setItem, removeItem).
import firestore from "@react-native-firebase/firestore";
import { getGoogleAccessToken, refreshGoogleAccessToken } from "./authService";

const QUEUE_KEY = "drive_upload_queue";

// Concurrency guard — prevents multiple simultaneous processQueue() calls
// (triggered from both NetInfo events and AppState foreground events).
let isProcessing = false;

export async function queueDriveUpload(
  receiptId: string,
  localUri: string,
  merchant: string,
  date: string
): Promise<void> {
  const existing = await getQueue();
  const entry: DriveUploadQueueEntry = {
    receiptId,
    localUri,
    merchant,
    date,
    attempts: 0,
  };
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
      if (entry.attempts >= 5) continue;  // drop after 5 failed attempts

      try {
        const driveFileId = await uploadToDrive(entry);
        await firestore().collection("receipts").doc(entry.receiptId).update({ driveFileId });
        // Success: don't add back to remaining
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

async function getQueue(): Promise<DriveUploadQueueEntry[]> {
  const raw = await localStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveQueue(queue: DriveUploadQueueEntry[]): Promise<void> {
  await localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}
```

### Google Drive REST upload:

```typescript
async function uploadToDrive(
  entry: DriveUploadQueueEntry,
  isRetry = false     // guard flag — prevents infinite recursion on persistent 401s
): Promise<string> {
  let accessToken = await getGoogleAccessToken();
  if (!accessToken) throw new Error("No Google access token");

  // Ensure the TripTrack folder exists (create once, cache the ID)
  const folderId = await ensureTripTrackFolder(accessToken);

  const fileName = `${entry.date}_${entry.merchant.replace(/[^a-zA-Z0-9]/g, "_")}_${entry.receiptId}.jpg`;

  // Read the local file as base64
  const base64 = await FileSystem.readAsStringAsync(entry.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Multipart upload to Drive
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
    // Token expired — refresh once and retry. The `isRetry` flag prevents
    // infinite recursion if the refreshed token is also rejected.
    await refreshGoogleAccessToken();
    return uploadToDrive(entry, true);
  }

  if (!response.ok) throw new Error(`Drive upload failed: ${response.status}`);

  const json = await response.json();
  return json.id;
}

async function ensureTripTrackFolder(accessToken: string): Promise<string> {
  const cached = await localStorage.getItem("drive_folder_id");
  if (cached) return cached;

  // Search for existing folder
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='TripTrack' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchJson = await searchResponse.json();

  if (searchJson.files?.length > 0) {
    const id = searchJson.files[0].id;
    await localStorage.setItem("drive_folder_id", id);
    return id;
  }

  // Create the folder
  const createResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "TripTrack", mimeType: "application/vnd.google-apps.folder" }),
  });
  const createJson = await createResponse.json();
  await localStorage.setItem("drive_folder_id", createJson.id);
  return createJson.id;
}
```

### When to call `processQueue`:

1. On app foreground (AppState `"active"` event)
2. After successful sign-in
3. After any network connectivity event (use `@react-native-community/netinfo`)

```bash
npx expo install @react-native-community/netinfo
```

```typescript
// src/services/driveService.ts (addition)
import NetInfo from "@react-native-community/netinfo";

export function startQueueProcessor(): () => void {
  return NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      processQueue();
    }
  });
}
```

Call `startQueueProcessor()` in `app/_layout.tsx` after auth is confirmed. The returned function is called on unmount to remove the listener.

---

## 9. Google Drive Folder Structure

```
Google Drive (user's personal Drive)
  └── TripTrack/
        ├── 2026-03-24_Whole_Foods_Market_{uuid}.jpg
        ├── 2026-03-23_Blue_Bottle_Coffee_{uuid}.jpg
        └── 2026-03-22_Shell_Gas_Station_{uuid}.jpg
```

File naming: `{date}_{merchant_sanitized}_{receiptId}.jpg`

- Date first so the folder sorts chronologically in Drive
- Merchant name makes files recognizable without opening them
- Receipt ID ensures uniqueness

---

## 10. Receipt Sharing Within Trips

When a receipt is linked to a trip expense (via `tripId` field), other trip members need to view the image. The image is re-uploaded to the trip's Firebase Storage path alongside the personal copy:

```typescript
import { requireAuth } from "./utils";

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
    firebaseStorageUrl: sharedUrl,  // replace personal URL with shared URL
  });
}
```

This function is called when the user links a receipt to a trip expense in the Expense Splitting flow (Plan 04).

---

## 11. Full Save Flow (Replaces Plan 03 Step 7)

When the user taps "Confirm & Save" in the receipt preview screen:

```typescript
// Triggered from the Plan 03 preview screen "Confirm & Save" button
async function handleConfirmSave(
  ocrResult: OCRResult,
  capturedImageUri: string,
  category: ReceiptCategory,
  isWarranty: boolean
): Promise<void> {
  // 1. Create Firestore record + save image locally (non-blocking uploads)
  const receiptId = await createReceiptRecord(
    ocrResult,
    capturedImageUri,
    category,
    isWarranty
  );

  // 2. If warranty, create warranty entry
  if (isWarranty) {
    await warrantyService.createFromReceipt(receiptId, ocrResult);
  }

  // 3. Optimistically update the Zustand store for immediate UI update
  // (Firestore listener will also fire, but this makes the Dashboard update instantly)
  useReceiptStore.getState().addReceipt({
    id: receiptId,
    userId: auth().currentUser!.uid,
    merchant: ocrResult.merchant,
    date: ocrResult.date,
    amount: ocrResult.amount,
    category,
    isWarranty,
    syncStatus: "local",
    createdAt: new Date().toISOString(),
  });

  // 4. Show success toast and navigate back to Dashboard
  showToast("Receipt saved!");
  router.replace("/(tabs)/");
}
```

---

## 12. Storage Lifecycle & Cleanup

### Firebase Storage:
- Receipt images are retained indefinitely (no auto-delete rules for MVP)
- If a user deletes a receipt, delete the Storage file in `receiptService.deleteReceipt()`
- Quota: Firebase Spark free tier includes 5GB Storage; sufficient for ~25,000 compressed receipt images at ~200KB each

### Google Drive:
- Files in the TripTrack folder are the user's property; the app never deletes Drive files
- If a receipt is deleted in-app, the Drive file remains (user retains ownership)

### Local filesystem:
- Local copies in `documentDirectory/receipts/` are kept as offline fallback
- Implement a cleanup job to delete local files older than 90 days when Storage sync is confirmed
- Run cleanup on app foreground: compare `driveFileId` + `syncStatus: "synced"` to determine safe-to-delete files

```typescript
export async function cleanupOldLocalFiles(): Promise<void> {
  const receipts = useReceiptStore.getState().receipts;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  for (const receipt of receipts) {
    if (
      receipt.syncStatus === "synced" &&
      receipt.driveFileId &&
      new Date(receipt.createdAt) < cutoff
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

---

## Deliverables Checklist

- [ ] `expo-image-manipulator` and `@react-native-community/netinfo` installed (also listed in Plan 01 Step 2)
- [ ] `src/services/ocrService.ts` — ML Kit implementation replacing Plan 03 mock
- [ ] `src/services/receiptService.ts` — local save, Firestore creation, Firebase Storage upload; uses `requireAuth()` (no `!` assertions)
- [ ] `src/services/driveService.ts` — Drive REST upload, folder management, offline queue with concurrency guard (`isProcessing` flag)
- [ ] `storage.rules` — Firebase Storage security rules deployed; trip receipts path restricted to trip members (not any auth'd user)
- [ ] Queue processor started in `app/_layout.tsx` via `startQueueProcessor()`
- [ ] `uploadToDrive` uses `isRetry` flag to prevent infinite recursion on persistent 401
- [ ] `shareReceiptWithTrip()` called when linking receipt to a trip expense
- [ ] Plan 03 `handleConfirmSave` updated to use `createReceiptRecord()`
- [ ] Receipt confidence score surfaced in Plan 03 preview UI (low confidence highlights fields)
- [ ] `cleanupOldLocalFiles()` called on app foreground for devices low on storage
- [ ] Google Drive folder created once and ID cached in `expo-sqlite` localStorage
- [ ] Token refresh handled with one retry on 401 response (guarded by `isRetry` parameter)
