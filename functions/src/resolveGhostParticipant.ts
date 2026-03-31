import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const resolveGhostParticipant = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in");
  }

  const { tripId, inviteId } = request.data as {
    tripId: string;
    inviteId: string;
  };
  const uid = request.auth.uid;
  const email = request.auth.token.email as string | undefined;

  // Validate the invitation
  const inviteRef = admin.firestore().collection("tripInvitations").doc(inviteId);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) {
    throw new HttpsError("not-found", "Invitation not found");
  }
  const invite = inviteSnap.data()!;
  if (invite.status !== "pending") {
    throw new HttpsError("failed-precondition", "Invitation already used");
  }
  if (invite.tripId !== tripId) {
    throw new HttpsError("invalid-argument", "Trip/invite mismatch");
  }
  if (new Date(invite.expiresAt) < new Date()) {
    throw new HttpsError("deadline-exceeded", "Invitation expired");
  }

  // Load the trip document
  const tripRef = admin.firestore().collection("trips").doc(tripId);
  const tripSnap = await tripRef.get();
  if (!tripSnap.exists) {
    throw new HttpsError("not-found", "Trip not found");
  }
  const trip = tripSnap.data()!;

  // Find a ghost participant matching the caller's email
  const participants: Array<Record<string, unknown>> = trip.participants ?? [];
  const ghostIndex = participants.findIndex(
    p => p.isGhost === true && p.email === email
  );

  if (ghostIndex === -1) {
    // No ghost match — add the user as a new participant
    await tripRef.update({
      memberUids: admin.firestore.FieldValue.arrayUnion(uid),
    });
    await inviteRef.update({ status: "accepted" });
    return { merged: false };
  }

  const oldGhostId = participants[ghostIndex].id as string;
  const updatedParticipants = [...participants];
  const { managedBy: _managedBy, ...ghostWithoutManaged } =
    updatedParticipants[ghostIndex];
  updatedParticipants[ghostIndex] = {
    ...ghostWithoutManaged,
    id: uid,
    uid,
    isGhost: false,
  };

  const batch = admin.firestore().batch();

  batch.update(tripRef, {
    participants: updatedParticipants,
    memberUids: admin.firestore.FieldValue.arrayUnion(uid),
  });

  // Migrate expenses
  const expensesSnap = await tripRef.collection("expenses").get();
  expensesSnap.docs.forEach(expenseDoc => {
    const data = expenseDoc.data();
    const splitAmong = (data.splitAmong ?? []) as string[];
    const needsUpdate =
      data.paidBy === oldGhostId || splitAmong.includes(oldGhostId);

    if (needsUpdate) {
      const update: Record<string, unknown> = {
        paidBy: data.paidBy === oldGhostId ? uid : data.paidBy,
        splitAmong: splitAmong.map((id: string) =>
          id === oldGhostId ? uid : id
        ),
      };
      if (data.customAmounts?.[oldGhostId] !== undefined) {
        update[`customAmounts.${uid}`] = data.customAmounts[oldGhostId];
        update[`customAmounts.${oldGhostId}`] =
          admin.firestore.FieldValue.delete();
      }
      batch.update(expenseDoc.ref, update);
    }
  });

  // Migrate settlements
  const settlementsSnap = await tripRef.collection("settlements").get();
  settlementsSnap.docs.forEach(settlementDoc => {
    const data = settlementDoc.data();
    if (
      data.fromParticipantId === oldGhostId ||
      data.toParticipantId === oldGhostId
    ) {
      batch.update(settlementDoc.ref, {
        fromParticipantId:
          data.fromParticipantId === oldGhostId
            ? uid
            : data.fromParticipantId,
        toParticipantId:
          data.toParticipantId === oldGhostId ? uid : data.toParticipantId,
      });
    }
  });

  batch.update(inviteRef, { status: "accepted" });
  await batch.commit();

  return { merged: true, oldGhostId };
});
