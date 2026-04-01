export type ReceiptCategory =
  | "food"
  | "travel"
  | "warranty"
  | "utility"
  | "shopping"
  | "other";

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

/** UI view model — see FirestoreReceipt in src/types/firestore.ts for the Firestore shape */
export interface Receipt {
  id: string;
  merchant: string;
  date: string;
  amount: number;
  category: ReceiptCategory;
  items?: ReceiptItem[];
  imageUri?: string;
  isWarranty: boolean;
  confidence?: number;
  tripId?: string;
  syncStatus?: "synced" | "pending" | "error";
  _pendingWrite?: boolean;
}

/** UI view model — see FirestoreWarranty in src/types/firestore.ts */
export interface Warranty {
  id: string;
  receiptId: string;
  productName: string;
  manufacturer: string;
  purchaseDate: string;
  expirationDate: string;
  coverageType: string;
  _pendingWrite?: boolean;
}

export interface TripItem {
  id: string;
  name: string;
  description: string;
  category: string;
  assignedTo: string | null;
  status: "unassigned" | "assigned" | "brought";
}

export interface TripCategory {
  id: string;
  name: string;
  icon: string;
  variant: "default" | "tertiary" | "full-width";
  items: TripItem[];
}

/**
 * Participant model — supports both AppUser (has uid) and GhostParticipant
 * (uid undefined, managed by another user).
 */
export interface TripParticipant {
  id: string;
  uid?: string;
  name: string;
  email?: string;
  avatarUri?: string;
  isGhost: boolean;
  managedBy?: string;
  amountPaid: number;
  amountOwed: number;
}

/** Keep Participant as alias for backward compat; prefer TripParticipant in new code */
export type Participant = TripParticipant;

/** UI view model — see FirestoreTrip in src/types/firestore.ts */
export interface Trip {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  participants: TripParticipant[];
  totalSpend: number;
  categories: TripCategory[];
  carpools: Carpool[];
  settlements: SettlementTransaction[];
  totalPot: number;
  categoryBreakdown: Record<string, number>;
  _pendingWrite?: boolean;
}

/** UI view model — see FirestoreExpense in src/types/firestore.ts */
export interface Expense {
  id: string;
  tripId?: string;
  receiptId?: string;
  description: string;
  amount: number;
  paidBy: string;
  splitAmong: string[];
  splitType: "equal" | "custom" | "percentage";
  customAmounts?: Record<string, number>;
  _pendingWrite?: boolean;
}

export interface Carpool {
  id: string;
  tripId: string;
  name: string;
  route: string;
  distance: number;
  fuelCost: number;
  passengers: CarpoolPassenger[];
  _pendingWrite?: boolean;
}

export interface CarpoolPassenger {
  participantId: string;
  role: "driver" | "navigator" | "passenger";
  amountOwed: number;
  settled: boolean;
}

export interface SettlementTransaction {
  id: string;
  tripId: string;
  fromParticipantId: string;
  toParticipantId: string;
  amount: number;
  status: "pending" | "settled";
  _pendingWrite?: boolean;
}

export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  fcmToken?: string;
  googleDriveLinked: boolean;
  createdAt: string;
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
