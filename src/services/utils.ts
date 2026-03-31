import auth from "@react-native-firebase/auth";

/**
 * Returns the current user's UID or throws if unauthenticated.
 * Use this instead of auth().currentUser!.uid to get a clear error.
 */
export function requireAuth(): string {
  const uid = auth().currentUser?.uid;
  if (!uid) throw new Error("requireAuth: no authenticated user");
  return uid;
}
