jest.mock("@react-native-firebase/firestore", () => {
  const docRef = {
    set: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
    get: jest.fn(() =>
      Promise.resolve({ exists: jest.fn(() => false), data: () => undefined })
    ),
  };
  const collectionRef = {
    doc: jest.fn(() => docRef),
  };
  const firestoreFn = jest.fn(() => ({ collection: jest.fn(() => collectionRef) }));
  (firestoreFn as any).FieldValue = {
    serverTimestamp: jest.fn(() => "mock-timestamp"),
    arrayUnion: jest.fn((...args: unknown[]) => args),
    arrayRemove: jest.fn((...args: unknown[]) => args),
  };
  return firestoreFn;
});

jest.mock("@react-native-firebase/auth", () => {
  const mockUser = {
    uid: "user-123",
    displayName: "Jane Doe",
    email: "jane@example.com",
    photoURL: "https://example.com/avatar.jpg",
    isAnonymous: false,
    providerData: [{ providerId: "google.com" }],
  };
  const fn = jest.fn(() => ({ currentUser: mockUser }));
  return fn;
});

jest.mock("@react-native-firebase/messaging", () => {
  const fn = jest.fn(() => ({
    getToken: jest.fn(() => Promise.resolve("fcm-token")),
  }));
  return fn;
});

// ─────────────────────────────────────────────────────────────────────────────

import firestore from "@react-native-firebase/firestore";
import { upsertUserProfile, getUserProfile, updateFcmToken } from "../userService";

const getDocRef = () =>
  (firestore as any)().collection().doc() as {
    set: jest.Mock;
    update: jest.Mock;
    get: jest.Mock;
  };

beforeEach(() => {
  jest.clearAllMocks();
  // Restore default mock implementations
  getDocRef().set = jest.fn(() => Promise.resolve());
  getDocRef().update = jest.fn(() => Promise.resolve());
  getDocRef().get = jest.fn(() =>
    Promise.resolve({ exists: jest.fn(() => false), data: () => undefined })
  );
});

describe("upsertUserProfile", () => {
  it("writes the user profile to Firestore with merge", async () => {
    await upsertUserProfile();
    expect(getDocRef().set).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-123",
        displayName: "Jane Doe",
        email: "jane@example.com",
        avatarUrl: "https://example.com/avatar.jpg",
        googleDriveLinked: true,
      }),
      { merge: true }
    );
  });

  it("sets googleDriveLinked=false when user has no google.com provider", async () => {
    const auth = require("@react-native-firebase/auth");
    auth().currentUser.providerData = [{ providerId: "apple.com" }];
    await upsertUserProfile();
    expect(getDocRef().set).toHaveBeenCalledWith(
      expect.objectContaining({ googleDriveLinked: false }),
      { merge: true }
    );
    auth().currentUser.providerData = [{ providerId: "google.com" }];
  });

  it("does nothing when user is anonymous", async () => {
    const auth = require("@react-native-firebase/auth");
    const original = auth().currentUser.isAnonymous;
    auth().currentUser.isAnonymous = true;
    await upsertUserProfile();
    expect(getDocRef().set).not.toHaveBeenCalled();
    auth().currentUser.isAnonymous = original;
  });

  it("does nothing when there is no current user", async () => {
    const auth = require("@react-native-firebase/auth");
    const original = auth().currentUser;
    (auth as jest.MockedFunction<typeof auth>).mockReturnValueOnce({
      currentUser: null,
    } as any);
    await upsertUserProfile();
    expect(getDocRef().set).not.toHaveBeenCalled();
  });
});

describe("getUserProfile", () => {
  it("returns null when the document does not exist", async () => {
    const result = await getUserProfile("user-123");
    expect(result).toBeNull();
  });

  it("returns the AppUser when the document exists", async () => {
    const mockProfile = {
      uid: "user-123",
      displayName: "Jane Doe",
      email: "jane@example.com",
      googleDriveLinked: true,
      createdAt: "2024-01-01T00:00:00Z",
    };
    getDocRef().get = jest.fn(() =>
      Promise.resolve({ exists: jest.fn(() => true), data: () => mockProfile })
    );
    const result = await getUserProfile("user-123");
    expect(result).toEqual(mockProfile);
  });
});

describe("updateFcmToken", () => {
  it("updates the fcmToken field in Firestore", async () => {
    await updateFcmToken("new-fcm-token");
    expect(getDocRef().update).toHaveBeenCalledWith({ fcmToken: "new-fcm-token" });
  });

  it("does nothing when there is no current user", async () => {
    const auth = require("@react-native-firebase/auth");
    (auth as jest.MockedFunction<typeof auth>).mockReturnValueOnce({
      currentUser: null,
    } as any);
    await updateFcmToken("new-fcm-token");
    expect(getDocRef().update).not.toHaveBeenCalled();
  });
});

describe("updateNotificationPreference", () => {
  it("updates notificationsEnabled=true in Firestore", async () => {
    const { updateNotificationPreference } = require("../userService");
    await updateNotificationPreference(true);
    expect(getDocRef().update).toHaveBeenCalledWith({ notificationsEnabled: true });
  });

  it("updates notificationsEnabled=false in Firestore", async () => {
    const { updateNotificationPreference } = require("../userService");
    await updateNotificationPreference(false);
    expect(getDocRef().update).toHaveBeenCalledWith({ notificationsEnabled: false });
  });

  it("does nothing when there is no current user", async () => {
    const auth = require("@react-native-firebase/auth");
    (auth as jest.MockedFunction<typeof auth>).mockReturnValueOnce({
      currentUser: null,
    } as any);
    const { updateNotificationPreference } = require("../userService");
    await updateNotificationPreference(true);
    expect(getDocRef().update).not.toHaveBeenCalled();
  });
});
