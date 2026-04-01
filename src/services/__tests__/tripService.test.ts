import firestore from "@react-native-firebase/firestore";

jest.mock("../utils", () => ({
  requireAuth: jest.fn(() => "uid-test"),
}));

jest.mock("../userService", () => ({
  getUserProfile: jest.fn(() =>
    Promise.resolve({ displayName: "Test User", uid: "uid-test" })
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// Build a chainable Firestore mock with subcollection support
function makeChain(overrides: Record<string, jest.Mock> = {}) {
  const subChain: any = {};
  subChain.doc = jest.fn(() => subChain);
  subChain.collection = jest.fn(() => subChain);
  subChain.set = jest.fn(() => Promise.resolve());
  subChain.update = jest.fn(() => Promise.resolve());
  subChain.delete = jest.fn(() => Promise.resolve());
  subChain.get = jest.fn(() =>
    Promise.resolve({
      exists: jest.fn(() => true),
      data: () => ({ name: "Test Trip", memberUids: ["uid-test"] }),
    })
  );
  subChain.where = jest.fn(() => subChain);
  subChain.orderBy = jest.fn(() => subChain);
  subChain.onSnapshot = jest.fn(() => jest.fn());
  Object.assign(subChain, overrides);
  return subChain;
}

describe("createTrip", () => {
  it("writes a Firestore document with correct fields and returns an id", async () => {
    const chain = makeChain();
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { createTrip } = require("../tripService");
    const id = await createTrip({
      name: "Summer Trip",
      startDate: "2026-07-01",
      endDate: "2026-07-10",
      participants: [],
    });

    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Summer Trip",
        createdByUid: "uid-test",
        memberUids: ["uid-test"],
      })
    );
    expect(typeof id).toBe("string");
  });
});

describe("updateTrip", () => {
  it("calls Firestore update with the provided fields plus updatedAt", async () => {
    const chain = makeChain();
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { updateTrip } = require("../tripService");
    await updateTrip("t1", { name: "New Name" });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Name", updatedAt: expect.any(String) })
    );
  });
});

describe("deleteTrip", () => {
  it("calls Firestore delete", async () => {
    const chain = makeChain();
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { deleteTrip } = require("../tripService");
    await deleteTrip("t1");

    expect(chain.delete).toHaveBeenCalled();
  });
});

describe("addGhostParticipant", () => {
  it("uses arrayUnion to add the participant", async () => {
    const chain = makeChain();
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { addGhostParticipant } = require("../tripService");
    await addGhostParticipant("t1", "Carol", { email: "carol@test.com" });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        participants: expect.anything(),
      })
    );
  });
});

describe("addExpense", () => {
  it("writes the expense to the trip subcollection", async () => {
    const chain = makeChain();
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { addExpense } = require("../tripService");
    await addExpense("t1", {
      description: "Dinner",
      amount: 50,
      paidBy: "p1",
      splitAmong: ["p1", "p2"],
      splitType: "equal",
    });

    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Dinner",
        amount: 50,
        tripId: "t1",
        createdByUid: "uid-test",
      })
    );
  });

  it("returns the new expense id", async () => {
    const chain = makeChain();
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { addExpense } = require("../tripService");
    const id = await addExpense("t1", {
      description: "Hotel",
      amount: 200,
      paidBy: "p1",
      splitAmong: ["p1"],
      splitType: "equal",
    });

    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });
});

describe("updateExpense", () => {
  it("calls update on the expense subcollection document", async () => {
    const chain = makeChain();
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { updateExpense } = require("../tripService");
    await updateExpense("t1", "e1", { amount: 75 });

    expect(chain.update).toHaveBeenCalledWith({ amount: 75 });
  });
});

describe("deleteExpense", () => {
  it("calls delete on the expense subcollection document", async () => {
    const chain = makeChain();
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { deleteExpense } = require("../tripService");
    await deleteExpense("t1", "e1");

    expect(chain.delete).toHaveBeenCalled();
  });
});

describe("createInvitation", () => {
  it("creates a tripInvitations document with correct fields", async () => {
    const tripChain = makeChain();
    tripChain.get.mockResolvedValue({
      exists: jest.fn(() => true),
      data: () => ({ name: "Summer Trip" }),
    });
    const inviteChain = makeChain();
    (firestore().collection as jest.Mock)
      .mockReturnValueOnce(tripChain)
      .mockReturnValueOnce(inviteChain);

    const { createInvitation } = require("../tripService");
    const id = await createInvitation("t1", "uid-test", "friend@test.com");

    expect(inviteChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: "t1",
        tripName: "Summer Trip",
        invitedByUid: "uid-test",
        inviteeEmail: "friend@test.com",
        status: "pending",
      })
    );
    expect(typeof id).toBe("string");
  });
});

describe("buildInviteLink", () => {
  it("builds a triptrack:// deep link", () => {
    const { buildInviteLink } = require("../tripService");
    const link = buildInviteLink("inv-1", "t1");
    expect(link).toBe("triptrack://invite/inv-1?tripId=t1");
  });
});

describe("listenToTrip", () => {
  it("calls onSnapshot and returns unsubscribe", () => {
    const mockUnsub = jest.fn();
    const chain = makeChain();
    chain.onSnapshot = jest.fn(() => mockUnsub);
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { listenToTrip } = require("../tripService");
    const unsub = listenToTrip("t1", jest.fn());

    expect(chain.onSnapshot).toHaveBeenCalled();
    expect(unsub).toBe(mockUnsub);
  });

  it("maps snapshot data to UI Trip shape with Timestamp conversion", () => {
    const fakeTs = (d: string) => ({ toDate: () => new Date(d) });
    const mockOnSnapshot = jest.fn((cb) => {
      cb({
        exists: jest.fn(() => true),
        id: "t1",
        metadata: { hasPendingWrites: false },
        data: () => ({
          name: "Beach Trip",
          startDate: fakeTs("2026-07-01"),
          endDate: fakeTs("2026-07-10"),
          participants: [],
          totalPot: 500,
          categoryBreakdown: {},
        }),
      });
      return jest.fn();
    });
    const chain = makeChain();
    chain.onSnapshot = mockOnSnapshot;
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { listenToTrip } = require("../tripService");
    const onUpdate = jest.fn();
    listenToTrip("t1", onUpdate);

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "t1",
        name: "Beach Trip",
        startDate: "2026-07-01",
        endDate: "2026-07-10",
        _pendingWrite: false,
      })
    );
  });
});

describe("listenToExpenses", () => {
  it("maps expense docs to UI Expense shape with _pendingWrite", () => {
    const fakeDocs = [
      {
        id: "e1",
        metadata: { hasPendingWrites: true },
        data: () => ({
          tripId: "t1",
          description: "Dinner",
          amount: 100,
          paidBy: "p1",
          splitAmong: ["p1", "p2"],
          splitType: "equal",
        }),
      },
    ];
    const mockOnSnapshot = jest.fn((cb) => {
      cb({ docs: fakeDocs });
      return jest.fn();
    });
    const chain = makeChain();
    chain.onSnapshot = mockOnSnapshot;
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { listenToExpenses } = require("../tripService");
    const onUpdate = jest.fn();
    listenToExpenses("t1", onUpdate);

    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "e1",
          description: "Dinner",
          _pendingWrite: true,
        }),
      ])
    );
  });
});

describe("listenToCarpools", () => {
  it("returns unsubscribe function", () => {
    const mockUnsub = jest.fn();
    const chain = makeChain();
    chain.onSnapshot = jest.fn(() => mockUnsub);
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { listenToCarpools } = require("../tripService");
    const unsub = listenToCarpools("t1", jest.fn());

    expect(unsub).toBe(mockUnsub);
  });
});

describe("listenToSettlements", () => {
  it("returns unsubscribe function", () => {
    const mockUnsub = jest.fn();
    const chain = makeChain();
    chain.onSnapshot = jest.fn(() => mockUnsub);
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { listenToSettlements } = require("../tripService");
    const unsub = listenToSettlements("t1", jest.fn());

    expect(unsub).toBe(mockUnsub);
  });
});

describe("listenToPlannerItems", () => {
  it("returns unsubscribe function", () => {
    const mockUnsub = jest.fn();
    const chain = makeChain();
    chain.onSnapshot = jest.fn(() => mockUnsub);
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { listenToPlannerItems } = require("../tripService");
    const unsub = listenToPlannerItems("t1", jest.fn());

    expect(unsub).toBe(mockUnsub);
  });
});
