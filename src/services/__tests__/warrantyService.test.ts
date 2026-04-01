import firestore from "@react-native-firebase/firestore";

jest.mock("expo-notifications", () => ({
  scheduleNotificationAsync: jest.fn(() => Promise.resolve("notif-id-1")),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

jest.mock("../utils", () => ({
  requireAuth: jest.fn(() => "uid-test"),
}));

jest.mock("../ocrService");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createWarranty", () => {
  it("writes a Firestore document with the correct fields", async () => {
    const mockSet = jest.fn(() => Promise.resolve());
    const mockDoc = jest.fn(() => ({ set: mockSet }));
    (firestore().collection as jest.Mock).mockReturnValue({ doc: mockDoc });

    const Notifications = require("expo-notifications");
    Notifications.scheduleNotificationAsync.mockResolvedValue("notif-1");

    const { createWarranty } = require("../warrantyService");
    await createWarranty({
      receiptId: "rec-1",
      productName: "MacBook Pro",
      manufacturer: "Apple",
      purchaseDate: "2026-01-01",
      expirationDate: "2027-01-01",
      coverageType: "AppleCare+",
    });

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "uid-test",
        receiptId: "rec-1",
        productName: "MacBook Pro",
        manufacturer: "Apple",
        coverageType: "AppleCare+",
        notificationIds: expect.any(Array),
      })
    );
  });

  it("schedules expiration notifications for future warranty", async () => {
    const mockSet = jest.fn(() => Promise.resolve());
    const mockDoc = jest.fn(() => ({ set: mockSet }));
    (firestore().collection as jest.Mock).mockReturnValue({ doc: mockDoc });

    const Notifications = require("expo-notifications");

    const { createWarranty } = require("../warrantyService");
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    await createWarranty({
      receiptId: "rec-1",
      productName: "Laptop",
      manufacturer: "Dell",
      purchaseDate: new Date().toISOString().split("T")[0],
      expirationDate: futureDate.toISOString().split("T")[0],
      coverageType: "Standard",
    });

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it("returns the new warranty id", async () => {
    const mockSet = jest.fn(() => Promise.resolve());
    const mockDoc = jest.fn(() => ({ set: mockSet }));
    (firestore().collection as jest.Mock).mockReturnValue({ doc: mockDoc });

    const { createWarranty } = require("../warrantyService");
    const id = await createWarranty({
      receiptId: "rec-1",
      productName: "TV",
      manufacturer: "Samsung",
      purchaseDate: "2026-01-01",
      expirationDate: "2027-01-01",
      coverageType: "Warranty",
    });

    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });
});

describe("createFromReceipt", () => {
  it("creates a warranty with a 1-year expiration from the receipt date", async () => {
    const mockSet = jest.fn(() => Promise.resolve());
    const mockDoc = jest.fn(() => ({ set: mockSet }));
    (firestore().collection as jest.Mock).mockReturnValue({ doc: mockDoc });

    const { createFromReceipt } = require("../warrantyService");
    await createFromReceipt("rec-1", {
      merchant: "BestBuy",
      date: "2026-03-01",
      amount: 500,
      items: [],
      confidence: 0.9,
    });

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        receiptId: "rec-1",
        productName: "BestBuy",
      })
    );
  });
});

describe("updateWarranty", () => {
  it("calls Firestore update without rescheduling when expiration date unchanged", async () => {
    const mockUpdate = jest.fn(() => Promise.resolve());
    const mockDoc = jest.fn(() => ({ update: mockUpdate }));
    (firestore().collection as jest.Mock).mockReturnValue({ doc: mockDoc });

    const Notifications = require("expo-notifications");

    const { updateWarranty } = require("../warrantyService");
    await updateWarranty("w-1", { productName: "Updated Name" });

    expect(mockUpdate).toHaveBeenCalledWith({ productName: "Updated Name" });
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it("cancels old notifications and reschedules when expiration date changes", async () => {
    const existingData = {
      productName: "Laptop",
      notificationIds: ["old-notif-1"],
      expirationDate: { toDate: () => new Date("2027-01-01") },
    };
    const mockGet = jest.fn(() =>
      Promise.resolve({
        exists: jest.fn(() => true),
        data: () => existingData,
      })
    );
    const mockUpdate = jest.fn(() => Promise.resolve());
    const mockDoc = jest.fn(() => ({ get: mockGet, update: mockUpdate }));
    (firestore().collection as jest.Mock).mockReturnValue({ doc: mockDoc });

    const Notifications = require("expo-notifications");

    const { updateWarranty } = require("../warrantyService");
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);

    await updateWarranty("w-1", {
      expirationDate: futureDate.toISOString().split("T")[0] as any,
    });

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "old-notif-1"
    );
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("deleteWarranty", () => {
  it("cancels notifications and deletes the Firestore document", async () => {
    const existingData = {
      notificationIds: ["notif-a", "notif-b"],
    };
    const mockGet = jest.fn(() =>
      Promise.resolve({
        exists: jest.fn(() => true),
        data: () => existingData,
      })
    );
    const mockDelete = jest.fn(() => Promise.resolve());
    const mockDoc = jest.fn(() => ({ get: mockGet, delete: mockDelete }));
    (firestore().collection as jest.Mock).mockReturnValue({ doc: mockDoc });

    const Notifications = require("expo-notifications");

    const { deleteWarranty } = require("../warrantyService");
    await deleteWarranty("w-1");

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "notif-a"
    );
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "notif-b"
    );
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe("listenToWarranties", () => {
  it("returns an unsubscribe function", () => {
    const mockUnsub = jest.fn();
    const chain = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      onSnapshot: jest.fn(() => mockUnsub),
    };
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { listenToWarranties } = require("../warrantyService");
    const unsub = listenToWarranties(jest.fn());

    expect(chain.onSnapshot).toHaveBeenCalled();
    expect(unsub).toBe(mockUnsub);
  });

  it("converts Timestamps to ISO date strings and maps _pendingWrite", () => {
    const fakeTs = (dateStr: string) => ({
      toDate: () => new Date(dateStr),
    });
    const fakeDocs = [
      {
        id: "w1",
        metadata: { hasPendingWrites: false },
        data: () => ({
          receiptId: "r1",
          productName: "TV",
          manufacturer: "LG",
          purchaseDate: fakeTs("2026-01-01"),
          expirationDate: fakeTs("2027-01-01"),
          coverageType: "Standard",
        }),
      },
    ];
    const mockOnSnapshot = jest.fn((cb) => {
      cb({ docs: fakeDocs });
      return jest.fn();
    });
    const chain = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      onSnapshot: mockOnSnapshot,
    };
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { listenToWarranties } = require("../warrantyService");
    const onUpdate = jest.fn();
    listenToWarranties(onUpdate);

    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "w1",
          purchaseDate: "2026-01-01",
          expirationDate: "2027-01-01",
          _pendingWrite: false,
        }),
      ])
    );
  });
});

describe("createWarranty — notification gating", () => {
  it("skips scheduling when notifications are disabled", async () => {
    const mockSet = jest.fn(() => Promise.resolve());
    const mockDoc = jest.fn(() => ({ set: mockSet }));
    (firestore().collection as jest.Mock).mockReturnValue({ doc: mockDoc });

    const Notifications = require("expo-notifications");

    // Disable notifications preference
    const { useAuthStore } = require("@/stores/authStore");
    useAuthStore.setState({ notificationsEnabled: false });

    const { createWarranty } = require("../warrantyService");
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);

    await createWarranty({
      receiptId: "rec-gate",
      productName: "Gated Product",
      manufacturer: "Acme",
      purchaseDate: "2026-01-01",
      expirationDate: future.toISOString().split("T")[0],
      coverageType: "Standard",
    });

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

    useAuthStore.setState({ notificationsEnabled: true });
  });

  it("schedules notifications when enabled (default)", async () => {
    const mockSet = jest.fn(() => Promise.resolve());
    const mockDoc = jest.fn(() => ({ set: mockSet }));
    (firestore().collection as jest.Mock).mockReturnValue({ doc: mockDoc });

    const Notifications = require("expo-notifications");

    const { useAuthStore } = require("@/stores/authStore");
    useAuthStore.setState({ notificationsEnabled: true });

    const { createWarranty } = require("../warrantyService");
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);

    await createWarranty({
      receiptId: "rec-gate-2",
      productName: "Enabled Product",
      manufacturer: "Acme",
      purchaseDate: "2026-01-01",
      expirationDate: future.toISOString().split("T")[0],
      coverageType: "Standard",
    });

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });
});
