import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { requireAuth } from "./utils";
import { generateUUID } from "../utils/uuid";
import { useReceiptStore } from "../stores/receiptStore";
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

export async function saveImageLocally(
  tempUri: string,
  receiptId: string
): Promise<string> {
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
    confidence: ocrResult.confidence,
    items: ocrResult.items,
    syncStatus: "local",
    tripId: tripId ?? null,
    createdAt: new Date().toISOString(),
  });

  // Kick off background upload (non-blocking — Plan 06 scope)
  uploadToFirebaseStorage(receiptId, localUri).catch(console.error);

  return receiptId;
}

export async function updateReceipt(
  receiptId: string,
  updates: {
    merchant?: string;
    date?: string;
    amount?: number;
    category?: ReceiptCategory;
    isWarranty?: boolean;
  }
): Promise<void> {
  requireAuth();
  await receiptsCol().doc(receiptId).update(updates);
}

export async function deleteReceipt(receiptId: string): Promise<void> {
  requireAuth();
  await receiptsCol().doc(receiptId).delete();

  // Delete from Firebase Storage
  const uid = auth().currentUser?.uid;
  if (uid) {
    try {
      await storage().ref(`receipts/${uid}/${receiptId}.jpg`).delete();
    } catch {
      // File may not exist in Storage yet (syncStatus: "local") — ignore
    }
  }

  // Delete local file
  const localPath = `${RECEIPTS_DIR}${receiptId}.jpg`;
  const info = await FileSystem.getInfoAsync(localPath);
  if (info.exists) {
    await FileSystem.deleteAsync(localPath, { idempotent: true });
  }
}

export async function compressReceiptImage(localUri: string): Promise<string> {
  const image = await ImageManipulator.manipulate(localUri)
    .resize({ width: 1200 })
    .renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
  return result.uri;
}

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

export function listenToReceipts(
  onUpdate: (receipts: Array<Receipt & { _pendingWrite: boolean }>) => void
): () => void {
  const uid = requireAuth();
  return receiptsCol()
    .where("userId", "==", uid)
    .orderBy("date", "desc")
    .limit(50)
    .onSnapshot((snap) => {
      onUpdate(
        snap.docs.map((d) => {
          const data = d.data() as FirestoreReceipt;
          return {
            id: d.id,
            _pendingWrite: d.metadata.hasPendingWrites,
            merchant: data.merchant,
            date: toISODate(data.date),
            amount: data.amount,
            category: data.category,
            isWarranty: data.isWarranty,
            confidence: data.confidence,
            tripId: data.tripId ?? undefined,
            items: data.items,
            imageUri: data.firebaseStorageUrl,
            syncStatus:
              data.syncStatus === "local" ? "pending" : data.syncStatus,
          };
        })
      );
    });
}
