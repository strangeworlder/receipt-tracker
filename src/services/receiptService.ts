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
  updates: Partial<
    Pick<
      FirestoreReceipt,
      "merchant" | "date" | "amount" | "category" | "isWarranty"
    >
  >
): Promise<void> {
  requireAuth();
  await receiptsCol().doc(receiptId).update(updates);
}

export async function deleteReceipt(receiptId: string): Promise<void> {
  requireAuth();
  await receiptsCol().doc(receiptId).delete();
  const localPath = `${RECEIPTS_DIR}${receiptId}.jpg`;
  const info = await FileSystem.getInfoAsync(localPath);
  if (info.exists) {
    await FileSystem.deleteAsync(localPath, { idempotent: true });
  }
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
            items: data.items,
            imageUri: data.firebaseStorageUrl,
            syncStatus:
              data.syncStatus === "local" ? "pending" : data.syncStatus,
          };
        })
      );
    });
}
