// All jest.mock factories must be self-contained — no outer variable references,
// because jest.mock is hoisted before const declarations are initialized.

jest.mock("@react-native-firebase/auth", () => {
  const mockUpdateProfile = jest.fn(() => Promise.resolve());
  const mockCredential = { providerId: "mock" };
  const mockUser = {
    uid: "test-uid",
    isAnonymous: false,
    updateProfile: mockUpdateProfile,
    providerData: [{ providerId: "google.com" }],
    linkWithCredential: jest.fn(() => Promise.resolve()),
  };
  const instance = {
    currentUser: mockUser,
    signInWithCredential: jest.fn(() => Promise.resolve({ user: mockUser })),
    signInAnonymously: jest.fn(() => Promise.resolve()),
    signOut: jest.fn(() => Promise.resolve()),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn: any = jest.fn(() => instance);
  fn.GoogleAuthProvider = { credential: jest.fn(() => mockCredential) };
  fn.AppleAuthProvider = { credential: jest.fn(() => mockCredential) };
  return fn;
});

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() =>
      Promise.resolve({ type: "success", data: { idToken: "mock-id-token" } })
    ),
    getTokens: jest.fn(() =>
      Promise.resolve({
        accessToken: "mock-access-token",
        idToken: "mock-id-token",
      })
    ),
    signOut: jest.fn(() => Promise.resolve()),
  },
  isSuccessResponse: jest.fn(
    (response: { type: string }) => response.type === "success"
  ),
}));

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-apple-authentication", () => ({
  signInAsync: jest.fn(() =>
    Promise.resolve({
      identityToken: "mock-identity-token",
      fullName: { givenName: "John", familyName: "Doe" },
    })
  ),
  AppleAuthenticationScope: { FULL_NAME: "FULL_NAME", EMAIL: "EMAIL" },
}));

jest.mock("@react-native-firebase/messaging", () => {
  const instance = {
    requestPermission: jest.fn(() => Promise.resolve(1)),
    getToken: jest.fn(() => Promise.resolve("mock-fcm-token")),
    onTokenRefresh: jest.fn(() => jest.fn()),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn: any = jest.fn(() => instance);
  fn.AuthorizationStatus = { AUTHORIZED: 1, PROVISIONAL: 2 };
  return fn;
});

jest.mock("../userService", () => ({
  updateFcmToken: jest.fn(() => Promise.resolve()),
}));

// ─────────────────────────────────────────────────────────────────────────────

import auth from "@react-native-firebase/auth";
import messaging from "@react-native-firebase/messaging";
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as SecureStore from "expo-secure-store";
import { updateFcmToken } from "../userService";

import {
  configureGoogleSignIn,
  signInWithGoogle,
  signInWithApple,
  signInAnonymously,
  signOut,
  saveGoogleTokens,
  getGoogleAccessToken,
  refreshGoogleAccessToken,
  registerForPushNotifications,
  linkWithGoogle,
} from "../authService";

// Helpers to access the mock instances
const getAuthInstance = () => (auth as jest.MockedFunction<typeof auth>)();
const getMessagingInstance = () =>
  (messaging as jest.MockedFunction<typeof messaging>)();

beforeEach(() => {
  jest.clearAllMocks();
  // Restore default mock implementations after clearAllMocks
  (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
    type: "success",
    data: { idToken: "mock-id-token" },
  });
  (isSuccessResponse as unknown as jest.Mock).mockImplementation(
    (r: { type: string }) => r.type === "success"
  );
  (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
    accessToken: "mock-access-token",
    idToken: "mock-id-token",
  });
  (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
  (GoogleSignin.signOut as jest.Mock).mockResolvedValue(undefined);
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authInst = getAuthInstance() as any;
  authInst.signInWithCredential = jest.fn(() =>
    Promise.resolve({ user: authInst.currentUser })
  );
  authInst.signOut = jest.fn(() => Promise.resolve());
  authInst.signInAnonymously = jest.fn(() => Promise.resolve());
  authInst.currentUser.linkWithCredential = jest.fn(() => Promise.resolve());
  (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
    identityToken: "mock-identity-token",
    fullName: { givenName: "John", familyName: "Doe" },
  });
  getMessagingInstance().requestPermission = jest.fn(() => Promise.resolve(1));
  getMessagingInstance().getToken = jest.fn(() =>
    Promise.resolve("mock-fcm-token")
  );
  getMessagingInstance().onTokenRefresh = jest.fn(() => jest.fn());
});

// ─── configureGoogleSignIn ────────────────────────────────────────────────────
describe("configureGoogleSignIn", () => {
  it("calls GoogleSignin.configure with web client id and drive scope", () => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = "test-web-client-id";
    configureGoogleSignIn();
    expect(GoogleSignin.configure).toHaveBeenCalledWith({
      webClientId: "test-web-client-id",
      scopes: ["https://www.googleapis.com/auth/drive.file"],
      offlineAccess: true,
    });
  });
});

// ─── signInWithGoogle ─────────────────────────────────────────────────────────
describe("signInWithGoogle", () => {
  it("calls signInWithCredential and stores access token", async () => {
    await signInWithGoogle();
    expect(getAuthInstance().signInWithCredential).toHaveBeenCalled();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "google_access_token",
      "mock-access-token"
    );
  });

  it("passes idToken to GoogleAuthProvider.credential", async () => {
    await signInWithGoogle();
    expect((auth as any).GoogleAuthProvider.credential).toHaveBeenCalledWith(
      "mock-id-token"
    );
  });

  it("throws when sign-in is cancelled", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ type: "cancel" });
    (isSuccessResponse as unknown as jest.Mock).mockReturnValueOnce(false);
    await expect(signInWithGoogle()).rejects.toThrow(
      "Google Sign-In was cancelled"
    );
  });
});

// ─── signInWithApple ──────────────────────────────────────────────────────────
describe("signInWithApple", () => {
  it("creates AppleAuthProvider credential from identityToken", async () => {
    await signInWithApple();
    expect((auth as any).AppleAuthProvider.credential).toHaveBeenCalledWith(
      "mock-identity-token"
    );
    expect(getAuthInstance().signInWithCredential).toHaveBeenCalled();
  });

  it("updates display name from fullName on first sign-in", async () => {
    await signInWithApple();
    expect(
      (getAuthInstance() as any).currentUser.updateProfile
    ).toHaveBeenCalledWith({ displayName: "John Doe" });
  });

  it("throws when identity token is missing", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: null,
      fullName: null,
    });
    await expect(signInWithApple()).rejects.toThrow(
      "Apple Sign-In failed: no identity token"
    );
  });
});

// ─── signInAnonymously ────────────────────────────────────────────────────────
describe("signInAnonymously", () => {
  it("calls Firebase signInAnonymously", async () => {
    await signInAnonymously();
    expect(getAuthInstance().signInAnonymously).toHaveBeenCalled();
  });
});

// ─── linkWithGoogle ───────────────────────────────────────────────────────────
describe("linkWithGoogle", () => {
  it("links current user account with Google credential", async () => {
    await linkWithGoogle();
    expect(
      (getAuthInstance() as any).currentUser.linkWithCredential
    ).toHaveBeenCalled();
  });

  it("throws when sign-in is cancelled", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ type: "cancel" });
    (isSuccessResponse as unknown as jest.Mock).mockReturnValueOnce(false);
    await expect(linkWithGoogle()).rejects.toThrow("Cancelled");
  });
});

// ─── signOut ─────────────────────────────────────────────────────────────────
describe("signOut", () => {
  it("deletes google token, calls GoogleSignin.signOut, then Firebase signOut", async () => {
    await signOut();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "google_access_token"
    );
    expect(GoogleSignin.signOut).toHaveBeenCalled();
    expect(getAuthInstance().signOut).toHaveBeenCalled();
  });

  it("still signs out of Firebase even if GoogleSignin.signOut throws", async () => {
    (GoogleSignin.signOut as jest.Mock).mockRejectedValueOnce(
      new Error("not linked")
    );
    await signOut();
    expect(getAuthInstance().signOut).toHaveBeenCalled();
  });
});

// ─── token helpers ───────────────────────────────────────────────────────────
describe("saveGoogleTokens", () => {
  it("stores access token in SecureStore", async () => {
    await saveGoogleTokens({ accessToken: "my-token" });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "google_access_token",
      "my-token"
    );
  });
});

describe("getGoogleAccessToken", () => {
  it("reads access token from SecureStore", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(
      "stored-token"
    );
    const token = await getGoogleAccessToken();
    expect(token).toBe("stored-token");
  });

  it("returns null when no token stored", async () => {
    const token = await getGoogleAccessToken();
    expect(token).toBeNull();
  });
});

describe("refreshGoogleAccessToken", () => {
  it("fetches new tokens via GoogleSignin and stores the access token", async () => {
    const token = await refreshGoogleAccessToken();
    expect(token).toBe("mock-access-token");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "google_access_token",
      "mock-access-token"
    );
  });
});

// ─── registerForPushNotifications ────────────────────────────────────────────
describe("registerForPushNotifications", () => {
  it("registers FCM token and calls updateFcmToken when permission granted", async () => {
    await registerForPushNotifications();
    expect(updateFcmToken).toHaveBeenCalledWith("mock-fcm-token");
  });

  it("does not register token when permission is denied", async () => {
    getMessagingInstance().requestPermission = jest.fn(() =>
      Promise.resolve(0)
    );
    await registerForPushNotifications();
    expect(updateFcmToken).not.toHaveBeenCalled();
  });
});
