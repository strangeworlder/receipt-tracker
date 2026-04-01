import firestore from "@react-native-firebase/firestore";
import { requireAuth } from "./utils";
import { generateUUID } from "../utils/uuid";
import type {
  FirestoreTrip,
  FirestoreExpense,
  FirestoreCarpool,
  FirestoreSettlement,
  FirestorePlannerItem,
  FirestoreParticipant,
} from "../types/firestore";
import type {
  TripParticipant,
  Trip,
  Expense,
  Carpool,
  SettlementTransaction,
} from "../types";
import { getUserProfile } from "./userService";

const tripsCol = () => firestore().collection("trips");

function toISODate(ts: any): string {
  if (!ts) return new Date().toISOString().split("T")[0];
  if (typeof ts === "string") return ts;
  return ts.toDate().toISOString().split("T")[0];
}

// --- Trip CRUD ---

export async function createTrip(data: {
  name: string;
  startDate: string;
  endDate: string;
  participants: TripParticipant[];
}): Promise<string> {
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
  updates: Partial<
    Pick<
      FirestoreTrip,
      "name" | "startDate" | "endDate" | "totalPot" | "categoryBreakdown"
    >
  >
): Promise<void> {
  requireAuth();
  await tripsCol()
    .doc(tripId)
    .update({ ...updates, updatedAt: new Date().toISOString() });
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

// --- Carpool CRUD ---

export async function createCarpool(
  tripId: string,
  data: {
    name: string;
    route: string;
    distance: number;
    fuelCost: number;
    passengers: import("../types").CarpoolPassenger[];
  }
): Promise<string> {
  requireAuth();
  const carpoolId = generateUUID();
  await tripsCol()
    .doc(tripId)
    .collection("carpools")
    .doc(carpoolId)
    .set({
      ...data,
      tripId,
      createdAt: new Date().toISOString(),
    });
  return carpoolId;
}

// --- Expense CRUD ---

export async function addExpense(
  tripId: string,
  data: Omit<FirestoreExpense, "tripId" | "createdByUid" | "createdAt">
): Promise<string> {
  const uid = requireAuth();
  const expenseId = generateUUID();
  await tripsCol()
    .doc(tripId)
    .collection("expenses")
    .doc(expenseId)
    .set({
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
  updates: Partial<
    Omit<FirestoreExpense, "tripId" | "createdByUid" | "createdAt">
  >
): Promise<void> {
  requireAuth();
  await tripsCol()
    .doc(tripId)
    .collection("expenses")
    .doc(expenseId)
    .update(updates);
}

export async function deleteExpense(
  tripId: string,
  expenseId: string
): Promise<void> {
  requireAuth();
  await tripsCol()
    .doc(tripId)
    .collection("expenses")
    .doc(expenseId)
    .delete();
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
    invitedByUid,
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
  return tripsCol()
    .doc(tripId)
    .onSnapshot((snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as FirestoreTrip;
      onUpdate({
        id: snap.id,
        _pendingWrite: snap.metadata.hasPendingWrites,
        name: data.name,
        startDate: toISODate(data.startDate),
        endDate: toISODate(data.endDate),
        participants: (data.participants ?? []) as TripParticipant[],
        totalSpend: 0,
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
    .doc(tripId)
    .collection("expenses")
    .orderBy("createdAt", "desc")
    .onSnapshot((snap) => {
      onUpdate(
        snap.docs.map((d) => {
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
        })
      );
    });
}

export function listenToCarpools(
  tripId: string,
  onUpdate: (carpools: Array<Carpool & { _pendingWrite: boolean }>) => void
): () => void {
  return tripsCol()
    .doc(tripId)
    .collection("carpools")
    .orderBy("createdAt", "asc")
    .onSnapshot((snap) => {
      onUpdate(
        snap.docs.map((d) => {
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
        })
      );
    });
}

export function listenToSettlements(
  tripId: string,
  onUpdate: (
    settlements: Array<SettlementTransaction & { _pendingWrite: boolean }>
  ) => void
): () => void {
  return tripsCol()
    .doc(tripId)
    .collection("settlements")
    .orderBy("createdAt", "desc")
    .onSnapshot((snap) => {
      onUpdate(
        snap.docs.map((d) => {
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
        })
      );
    });
}

export function listenToPlannerItems(
  tripId: string,
  onUpdate: (
    items: Array<FirestorePlannerItem & { id: string; _pendingWrite: boolean }>
  ) => void
): () => void {
  return tripsCol()
    .doc(tripId)
    .collection("plannerItems")
    .orderBy("createdAt", "asc")
    .onSnapshot((snap) => {
      onUpdate(
        snap.docs.map((d) => ({
          id: d.id,
          _pendingWrite: d.metadata.hasPendingWrites,
          ...(d.data() as FirestorePlannerItem),
        }))
      );
    });
}

// --- Planner item claiming (Plan 09) ---

export async function claimPlannerItem(
  tripId: string,
  itemId: string
): Promise<void> {
  const uid = requireAuth();
  await tripsCol()
    .doc(tripId)
    .collection("plannerItems")
    .doc(itemId)
    .update({ assignedTo: uid, status: "assigned" });
}

export async function unclaimPlannerItem(
  tripId: string,
  itemId: string
): Promise<void> {
  requireAuth();
  await tripsCol()
    .doc(tripId)
    .collection("plannerItems")
    .doc(itemId)
    .update({ assignedTo: null, status: "unassigned" });
}

/**
 * Stub for FCM reminder. Wiring is in place for future Cloud Functions integration.
 * The UI calls Alert.alert() to confirm to the user — this function is a no-op.
 */
export async function sendReminder(
  _tripId: string,
  _toParticipantId: string
): Promise<void> {
  // Future: call a Cloud Function to deliver an FCM push to the participant
}

