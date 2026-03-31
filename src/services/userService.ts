import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import type { AppUser } from "../types";

const usersCollection = () => firestore().collection("users");

export async function upsertUserProfile(): Promise<void> {
  const firebaseUser = auth().currentUser;
  if (!firebaseUser || firebaseUser.isAnonymous) return;

  const profile: Partial<AppUser> = {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName ?? "Anonymous",
    email: firebaseUser.email ?? "",
    avatarUrl: firebaseUser.photoURL ?? undefined,
    googleDriveLinked: firebaseUser.providerData.some(
      p => p.providerId === "google.com"
    ),
  };

  await usersCollection().doc(firebaseUser.uid).set(profile, { merge: true });
}

export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const doc = await usersCollection().doc(uid).get();
  return doc.exists() ? (doc.data() as AppUser) : null;
}

export async function updateFcmToken(token: string): Promise<void> {
  const uid = auth().currentUser?.uid;
  if (!uid) return;
  await usersCollection().doc(uid).update({ fcmToken: token });
}
