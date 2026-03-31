import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

type Timestamp = FirebaseFirestoreTypes.Timestamp;

export interface FirestoreUser {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestoreReceipt {
  id: string;
  userId: string;
  merchant: string;
  date: Timestamp;
  amount: number;
  category: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
  imageUri?: string;
  storagePath?: string;
  isWarranty: boolean;
  syncStatus: "synced" | "pending" | "error";
  _pendingWrite?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestoreWarranty {
  id: string;
  userId: string;
  receiptId: string;
  productName: string;
  manufacturer: string;
  purchaseDate: Timestamp;
  expirationDate: Timestamp;
  coverageType: string;
  notificationScheduled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestoreTrip {
  id: string;
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
  createdBy: string;
  participantIds: string[];
  totalSpend: number;
  totalPot: number;
  categoryBreakdown: Record<string, number>;
  _pendingWrite?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestoreParticipant {
  id: string;
  tripId: string;
  uid?: string;
  name: string;
  email?: string;
  avatarUri?: string;
  isGhost: boolean;
  managedBy?: string;
  amountPaid: number;
  amountOwed: number;
}

export interface FirestoreExpense {
  id: string;
  tripId: string;
  receiptId?: string;
  description: string;
  amount: number;
  paidBy: string;
  splitAmong: string[];
  splitType: "equal" | "custom" | "percentage";
  customAmounts?: Record<string, number>;
  _pendingWrite?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestoreCarpool {
  id: string;
  tripId: string;
  name: string;
  route: string;
  distance: number;
  fuelCost: number;
  passengers: Array<{
    participantId: string;
    role: "driver" | "navigator" | "passenger";
    amountOwed: number;
    settled: boolean;
  }>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestoreSettlement {
  id: string;
  tripId: string;
  fromParticipantId: string;
  toParticipantId: string;
  amount: number;
  status: "pending" | "settled";
  settledAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
