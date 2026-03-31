
// ── firebase-admin mock ───────────────────────────────────────────────────────
// We mock the entire firebase-admin module so the function under test never
// touches real Firestore.

const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn(() => Promise.resolve());
const mockBatch = { update: mockBatchUpdate, commit: mockBatchCommit };

const mockInviteUpdate = jest.fn(() => Promise.resolve());
const mockTripUpdate = jest.fn(() => Promise.resolve());

const mockExpensesGet = jest.fn(() =>
  Promise.resolve({ docs: [] })
);
const mockSettlementsGet = jest.fn(() =>
  Promise.resolve({ docs: [] })
);
// Store refs so tests can update data per-case
let tripData: object = {};
let inviteData: object = {};

const mockTripRef = {
  get: jest.fn(() => Promise.resolve({ exists: true, data: () => tripData })),
  update: mockTripUpdate,
  collection: jest.fn((name: string) => {
    if (name === "expenses") return { get: mockExpensesGet };
    if (name === "settlements") return { get: mockSettlementsGet };
    return { get: jest.fn(() => Promise.resolve({ docs: [] })) };
  }),
};
const mockInviteRef = {
  get: jest.fn(() =>
    Promise.resolve({ exists: true, data: () => inviteData, ref: undefined as any })
  ),
  update: mockInviteUpdate,
};
const mockDocFn = jest.fn((path: string) => {
  if (path.startsWith("trips/")) return mockTripRef;
  if (path.startsWith("tripInvitations/")) return mockInviteRef;
  return mockTripRef;
});
const mockFirestore = {
  collection: jest.fn((col: string) => ({ doc: (id: string) => mockDocFn(`${col}/${id}`) })),
  batch: jest.fn(() => mockBatch),
};

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(jest.fn(() => mockFirestore), {
    FieldValue: {
      arrayUnion: jest.fn((...args: string[]) => ({ _arrayUnion: args })),
      delete: jest.fn(() => ({ _delete: true })),
    },
  }),
}));

// ── Import the function under test ────────────────────────────────────────────
// We test the handler logic extracted from the onCall wrapper.
// The handler is the async function passed to onCall(...). We import the module
// and call the exported function via firebase-functions/v2/https mock.

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

// Import after mocks are set up
import "../resolveGhostParticipant";
// Extract the handler that was passed to onCall
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let handler: (...args: any[]) => Promise<unknown>;

beforeAll(() => {
  expect(mockOnCall).toHaveBeenCalledTimes(1);
  handler = mockOnCall.mock.calls[0][0] as typeof handler;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Re-attach collection mock after clearAllMocks
  mockTripRef.collection.mockImplementation((name: string) => {
    if (name === "expenses") return { get: mockExpensesGet };
    if (name === "settlements") return { get: mockSettlementsGet };
    return { get: jest.fn(() => Promise.resolve({ docs: [] })) };
  });
  mockExpensesGet.mockResolvedValue({ docs: [] });
  mockSettlementsGet.mockResolvedValue({ docs: [] });
  mockBatchCommit.mockResolvedValue(undefined);
  mockTripRef.get.mockResolvedValue({ exists: true, data: () => tripData });
  mockInviteRef.get.mockResolvedValue({
    exists: true,
    data: () => inviteData,
    ref: mockInviteRef,
  } as any);
});

const validRequest = {
  auth: { uid: "real-uid", token: { email: "ghost@example.com" } },
  data: { tripId: "trip-1", inviteId: "invite-1" },
};

// ─── Authentication check ────────────────────────────────────────────────────
describe("unauthenticated request", () => {
  it("throws unauthenticated error", async () => {
    await expect(
      handler({ data: validRequest.data })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });
});

// ─── Invitation validation ────────────────────────────────────────────────────
describe("invitation not found", () => {
  it("throws not-found error", async () => {
    mockInviteRef.get.mockResolvedValueOnce({
      exists: false,
      data: () => undefined as any,
      ref: mockInviteRef,
    } as any);
    await expect(handler(validRequest)).rejects.toMatchObject({
      code: "not-found",
    });
  });
});

describe("invitation already used", () => {
  it("throws failed-precondition error", async () => {
    inviteData = {
      status: "accepted",
      tripId: "trip-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    await expect(handler(validRequest)).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });
});

describe("invitation tripId mismatch", () => {
  it("throws invalid-argument error", async () => {
    inviteData = {
      status: "pending",
      tripId: "different-trip",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    await expect(handler(validRequest)).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });
});

describe("invitation expired", () => {
  it("throws deadline-exceeded error", async () => {
    inviteData = {
      status: "pending",
      tripId: "trip-1",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    await expect(handler(validRequest)).rejects.toMatchObject({
      code: "deadline-exceeded",
    });
  });
});

// ─── No ghost match ────────────────────────────────────────────────────────────
describe("no ghost match — new participant", () => {
  beforeEach(() => {
    inviteData = {
      status: "pending",
      tripId: "trip-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    tripData = {
      participants: [
        {
          id: "other-user",
          isGhost: false,
          email: "other@example.com",
        },
      ],
    };
  });

  it("returns { merged: false }", async () => {
    const result = await handler(validRequest);
    expect(result).toEqual({ merged: false });
  });

  it("adds uid to memberUids via arrayUnion", async () => {
    await handler(validRequest);
    expect(mockTripUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        memberUids: expect.objectContaining({ _arrayUnion: ["real-uid"] }),
      })
    );
  });

  it("marks invite as accepted", async () => {
    await handler(validRequest);
    expect(mockInviteUpdate).toHaveBeenCalledWith({ status: "accepted" });
  });
});

// ─── Ghost match — merge ──────────────────────────────────────────────────────
describe("ghost found — merge participant", () => {
  beforeEach(() => {
    inviteData = {
      status: "pending",
      tripId: "trip-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    tripData = {
      participants: [
        {
          id: "ghost-uuid",
          isGhost: true,
          email: "ghost@example.com",
          managedBy: "manager-uid",
        },
      ],
    };
  });

  it("returns { merged: true, oldGhostId }", async () => {
    const result = await handler(validRequest);
    expect(result).toEqual({ merged: true, oldGhostId: "ghost-uuid" });
  });

  it("commits a batch write", async () => {
    await handler(validRequest);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it("updates participant to remove isGhost and set real uid", async () => {
    await handler(validRequest);
    const batchUpdateCall = mockBatchUpdate.mock.calls.find(
      ([, data]) => data.participants !== undefined
    );
    expect(batchUpdateCall).toBeDefined();
    const updatedParticipants = batchUpdateCall![1].participants;
    expect(updatedParticipants[0]).toMatchObject({
      id: "real-uid",
      uid: "real-uid",
      isGhost: false,
    });
    expect(updatedParticipants[0].managedBy).toBeUndefined();
  });

  it("migrates expense paidBy from ghost id to real uid", async () => {
    mockExpensesGet.mockResolvedValueOnce({
      docs: [
        {
          ref: { id: "expense-1" } as any,
          data: () => ({
            paidBy: "ghost-uuid",
            splitAmong: ["ghost-uuid", "other-uid"],
          }),
        },
      ] as any[],
    } as any);
    await handler(validRequest);
    const expenseBatchCall = mockBatchUpdate.mock.calls.find(
      ([, data]) => data.paidBy !== undefined
    );
    expect(expenseBatchCall).toBeDefined();
    expect(expenseBatchCall![1].paidBy).toBe("real-uid");
    expect(expenseBatchCall![1].splitAmong).toEqual(["real-uid", "other-uid"]);
  });

  it("marks invite as accepted via batch", async () => {
    await handler(validRequest);
    const inviteCall = mockBatchUpdate.mock.calls.find(
      ([, data]) => data.status === "accepted"
    );
    expect(inviteCall).toBeDefined();
  });
});
