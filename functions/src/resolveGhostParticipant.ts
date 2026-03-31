import { onCall, HttpsError } from "firebase-functions/v2/https";

// Implemented in Plan 04: validates a trip invitation, matches the caller's
// email to a GhostParticipant record, and atomically upgrades the ghost to a
// real AppUser (migrating all expenses and settlements).
export const resolveGhostParticipant = onCall(async (_request) => {
  // TODO: implement in Plan 04
  throw new HttpsError("unimplemented", "Not yet implemented");
});
