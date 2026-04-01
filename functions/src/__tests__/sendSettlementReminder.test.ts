// ── firebase-admin mock ───────────────────────────────────────────────────────

const mockSendFcm = jest.fn(() => Promise.resolve("message-id-1"));
const mockMessaging = { send: mockSendFcm };

const mockUserUpdate = jest.fn(() => Promise.resolve());

let senderData: object = {};
let targetData: object = {};
let tripData: object = {};

const mockDocFn = jest.fn((path: string) => {
  if (path.startsWith("trips/")) {
    return {
      get: jest.fn(() => Promise.resolve({ exists: true, data: () => tripData })),
    };
  }
  if (path === "users/sender-uid") {
    return { get: jest.fn(() => Promise.resolve({ exists: true, data: () => senderData })) };
  }
  if (path === "users/target-uid") {
    return { get: jest.fn(() => Promise.resolve({ exists: true, data: () => targetData })) };
  }
  return {
    get: jest.fn(() => Promise.resolve({ exists: false, data: () => undefined })),
  };
});

const mockFirestore = {
  collection: jest.fn((col: string) => ({
    doc: (id: string) => mockDocFn(`${col}/${id}`),
  })),
};

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(jest.fn(() => mockFirestore), {
    FieldValue: { arrayUnion: jest.fn() },
  }),
  messaging: jest.fn(() => mockMessaging),
}));

const mockOnCall = jest.fn((handler: Function) => ({ handler }));
jest.mock("firebase-functions/v2/https", () => ({
  onCall: mockOnCall,
  HttpsError: class HttpsError extends Error {
    constructor(
      public code: string,
      message: string
    ) {
      super(message);
      this.name = "HttpsError";
    }
  },
}));

import "../sendSettlementReminder";

let handler: (...args: any[]) => Promise<unknown>;

beforeAll(() => {
  expect(mockOnCall).toHaveBeenCalledTimes(1);
  handler = mockOnCall.mock.calls[0][0] as typeof handler;
});

beforeEach(() => {
  jest.clearAllMocks();
  senderData = { displayName: "Alice" };
  targetData = { fcmToken: "fcm-token-target" };
  tripData = { name: "Road Trip", memberUids: ["sender-uid", "target-uid"] };

  mockDocFn.mockImplementation((path: string) => {
    if (path.startsWith("trips/")) {
      return {
        get: jest.fn(() => Promise.resolve({ exists: true, data: () => tripData })),
      };
    }
    if (path === "users/sender-uid") {
      return { get: jest.fn(() => Promise.resolve({ exists: true, data: () => senderData })) };
    }
    if (path === "users/target-uid") {
      return { get: jest.fn(() => Promise.resolve({ exists: true, data: () => targetData })) };
    }
    return {
      get: jest.fn(() => Promise.resolve({ exists: false, data: () => undefined })),
    };
  });
});

const validRequest = {
  auth: { uid: "sender-uid" },
  data: { tripId: "trip-1", toParticipantId: "target-uid" },
};

describe("unauthenticated request", () => {
  it("throws unauthenticated error", async () => {
    await expect(
      handler({ data: validRequest.data })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });
});

describe("trip not found", () => {
  it("throws not-found error", async () => {
    mockDocFn.mockImplementation((path: string) => {
      if (path.startsWith("trips/")) {
        return { get: jest.fn(() => Promise.resolve({ exists: false, data: () => undefined })) };
      }
      return { get: jest.fn(() => Promise.resolve({ exists: true, data: () => ({}) })) };
    });
    await expect(handler(validRequest)).rejects.toMatchObject({ code: "not-found" });
  });
});

describe("caller not a trip member", () => {
  it("throws permission-denied error", async () => {
    tripData = { name: "Trip", memberUids: ["other-user"] };
    await expect(handler(validRequest)).rejects.toMatchObject({
      code: "permission-denied",
    });
  });
});

describe("target user not found", () => {
  it("throws not-found error", async () => {
    mockDocFn.mockImplementation((path: string) => {
      if (path.startsWith("trips/")) {
        return { get: jest.fn(() => Promise.resolve({ exists: true, data: () => tripData })) };
      }
      if (path === "users/sender-uid") {
        return { get: jest.fn(() => Promise.resolve({ exists: true, data: () => senderData })) };
      }
      // target user does not exist
      return {
        get: jest.fn(() => Promise.resolve({ exists: false, data: () => undefined })),
      };
    });
    await expect(handler(validRequest)).rejects.toMatchObject({ code: "not-found" });
  });
});

describe("target has no FCM token", () => {
  it("returns { sent: false, reason: 'no_fcm_token' }", async () => {
    targetData = {}; // no fcmToken
    const result = await handler(validRequest);
    expect(result).toEqual({ sent: false, reason: "no_fcm_token" });
    expect(mockSendFcm).not.toHaveBeenCalled();
  });
});

describe("successful reminder", () => {
  it("sends FCM push and returns { sent: true }", async () => {
    const result = await handler(validRequest);
    expect(result).toEqual({ sent: true });
    expect(mockSendFcm).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "fcm-token-target",
        notification: expect.objectContaining({
          title: "Settlement Reminder",
          body: expect.stringContaining("Alice"),
        }),
        data: expect.objectContaining({ tripId: "trip-1", type: "settlement_reminder" }),
      })
    );
  });

  it("includes the trip name in the notification body", async () => {
    await handler(validRequest);
    expect(mockSendFcm).toHaveBeenCalledWith(
      expect.objectContaining({
        notification: expect.objectContaining({
          body: expect.stringContaining("Road Trip"),
        }),
      })
    );
  });
});
