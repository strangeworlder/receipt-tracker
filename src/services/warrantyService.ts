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
  const expirationDateStr =
    typeof data.expirationDate === "string"
      ? data.expirationDate
      : toISODate(data.expirationDate);

  const notificationIds = await scheduleExpirationNotifications(
    warrantyId,
    data.productName as string,
    expirationDateStr
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
    purchaseDate: purchaseDate as any,
    expirationDate: expirationDate.toISOString().split("T")[0] as any,
    coverageType: "Standard 1-year",
  });
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
    .onSnapshot((snap) => {
      onUpdate(
        snap.docs.map((d) => {
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
        })
      );
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
    notificationIds.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id)
    )
  );
}
