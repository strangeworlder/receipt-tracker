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
  memberUids: string[];
  participants: FirestoreParticipant[];
  totalPot: number;
  categoryBreakdown: Record<string, number>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

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
  paidBy: string;
  splitAmong: string[];
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
