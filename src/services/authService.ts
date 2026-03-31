import auth from "@react-native-firebase/auth";
import messaging from "@react-native-firebase/messaging";
import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as SecureStore from "expo-secure-store";
import { updateFcmToken } from "./userService";

export function configureGoogleSignIn(): void {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
    offlineAccess: true,
  });
}

export async function signInWithGoogle(): Promise<void> {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();

  if (!isSuccessResponse(response)) {
    throw new Error("Google Sign-In was cancelled");
  }

  const { idToken } = response.data;
  const credential = auth.GoogleAuthProvider.credential(idToken);
  await auth().signInWithCredential(credential);

  const { accessToken } = await GoogleSignin.getTokens();
  await saveGoogleTokens({ accessToken });
}

export async function signInWithApple(): Promise<void> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  const { identityToken, fullName } = credential;
  if (!identityToken) throw new Error("Apple Sign-In failed: no identity token");

  const appleCredential = auth.AppleAuthProvider.credential(identityToken);
  const result = await auth().signInWithCredential(appleCredential);

  // Apple only sends the name on first sign-in; persist it immediately
  if (fullName?.givenName) {
    await result.user.updateProfile({
      displayName: `${fullName.givenName} ${fullName.familyName ?? ""}`.trim(),
    });
  }
}

export async function signInAnonymously(): Promise<void> {
  await auth().signInAnonymously();
}

export async function linkWithGoogle(): Promise<void> {
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) throw new Error("Cancelled");
  const { idToken } = response.data;
  const credential = auth.GoogleAuthProvider.credential(idToken);
  await auth().currentUser?.linkWithCredential(credential);
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync("google_access_token");
  try {
    await GoogleSignin.signOut();
  } catch {
    // May fail if user signed in with Apple — ignore
  }
  await auth().signOut();
}

export async function saveGoogleTokens(tokens: {
  accessToken: string;
}): Promise<void> {
  await SecureStore.setItemAsync("google_access_token", tokens.accessToken);
}

export async function getGoogleAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync("google_access_token");
}

export async function refreshGoogleAccessToken(): Promise<string> {
  const { accessToken } = await GoogleSignin.getTokens();
  await saveGoogleTokens({ accessToken });
  return accessToken;
}

export async function registerForPushNotifications(): Promise<void> {
  const permission = await messaging().requestPermission();
  const granted =
    permission === messaging.AuthorizationStatus.AUTHORIZED ||
    permission === messaging.AuthorizationStatus.PROVISIONAL;

  if (!granted) return;

  const token = await messaging().getToken();
  await updateFcmToken(token);

  messaging().onTokenRefresh(newToken => updateFcmToken(newToken));
}
