// Mock all service listeners
jest.mock("../receiptService", () => ({
  listenToReceipts: jest.fn(() => jest.fn()),
}));

jest.mock("../warrantyService", () => ({
  listenToWarranties: jest.fn(() => jest.fn()),
}));

jest.mock("../tripService", () => ({
  listenToTrip: jest.fn(() => jest.fn()),
  listenToExpenses: jest.fn(() => jest.fn()),
  listenToCarpools: jest.fn(() => jest.fn()),
  listenToSettlements: jest.fn(() => jest.fn()),
  listenToPlannerItems: jest.fn(() => jest.fn()),
}));

// Mock stores
jest.mock("../../stores/receiptStore", () => ({
  useReceiptStore: {
    getState: jest.fn(() => ({ setReceipts: jest.fn() })),
  },
}));

jest.mock("../../stores/warrantyStore", () => ({
  useWarrantyStore: {
    getState: jest.fn(() => ({ setWarranties: jest.fn() })),
  },
}));

jest.mock("../../stores/tripStore", () => ({
  useTripStore: {
    getState: jest.fn(() => ({
      upsertTrip: jest.fn(),
      setExpenses: jest.fn(),
      setCarpools: jest.fn(),
      setSettlements: jest.fn(),
      setPlannerItems: jest.fn(),
    })),
  },
}));

import { listenToReceipts } from "../receiptService";
import { listenToWarranties } from "../warrantyService";
import {
  listenToTrip,
  listenToExpenses,
  listenToCarpools,
  listenToSettlements,
  listenToPlannerItems,
} from "../tripService";

beforeEach(() => {
  jest.clearAllMocks();
  // Reset module so activeListeners map is cleared between tests
  jest.resetModules();

  // Re-apply mocks after resetModules
  jest.mock("../receiptService", () => ({
    listenToReceipts: jest.fn(() => jest.fn()),
  }));
  jest.mock("../warrantyService", () => ({
    listenToWarranties: jest.fn(() => jest.fn()),
  }));
  jest.mock("../tripService", () => ({
    listenToTrip: jest.fn(() => jest.fn()),
    listenToExpenses: jest.fn(() => jest.fn()),
    listenToCarpools: jest.fn(() => jest.fn()),
    listenToSettlements: jest.fn(() => jest.fn()),
    listenToPlannerItems: jest.fn(() => jest.fn()),
  }));
  jest.mock("../../stores/receiptStore", () => ({
    useReceiptStore: {
      getState: jest.fn(() => ({ setReceipts: jest.fn() })),
    },
  }));
  jest.mock("../../stores/warrantyStore", () => ({
    useWarrantyStore: {
      getState: jest.fn(() => ({ setWarranties: jest.fn() })),
    },
  }));
  jest.mock("../../stores/tripStore", () => ({
    useTripStore: {
      getState: jest.fn(() => ({
        upsertTrip: jest.fn(),
        setExpenses: jest.fn(),
        setCarpools: jest.fn(),
        setSettlements: jest.fn(),
        setPlannerItems: jest.fn(),
      })),
    },
  }));
});

describe("startReceiptSync", () => {
  it("calls listenToReceipts and passes data to receiptStore.setReceipts", () => {
    const { startReceiptSync } = require("../syncService");
    const { listenToReceipts } = require("../receiptService");
    const { useReceiptStore } = require("../../stores/receiptStore");

    const mockSetReceipts = jest.fn();
    useReceiptStore.getState.mockReturnValue({ setReceipts: mockSetReceipts });

    const fakeReceipts = [{ id: "r1" }];
    (listenToReceipts as jest.Mock).mockImplementation((cb: any) => {
      cb(fakeReceipts);
      return jest.fn();
    });

    startReceiptSync();

    expect(listenToReceipts).toHaveBeenCalled();
    expect(mockSetReceipts).toHaveBeenCalledWith(fakeReceipts);
  });
});

describe("startWarrantySync", () => {
  it("calls listenToWarranties and passes data to warrantyStore.setWarranties", () => {
    const { startWarrantySync } = require("../syncService");
    const { listenToWarranties } = require("../warrantyService");
    const { useWarrantyStore } = require("../../stores/warrantyStore");

    const mockSetWarranties = jest.fn();
    useWarrantyStore.getState.mockReturnValue({
      setWarranties: mockSetWarranties,
    });

    const fakeWarranties = [{ id: "w1" }];
    (listenToWarranties as jest.Mock).mockImplementation((cb: any) => {
      cb(fakeWarranties);
      return jest.fn();
    });

    startWarrantySync();

    expect(listenToWarranties).toHaveBeenCalled();
    expect(mockSetWarranties).toHaveBeenCalledWith(fakeWarranties);
  });
});

describe("startTripSync", () => {
  it("registers all 5 listeners for a trip", () => {
    const { startTripSync } = require("../syncService");
    const {
      listenToTrip,
      listenToExpenses,
      listenToCarpools,
      listenToSettlements,
      listenToPlannerItems,
    } = require("../tripService");

    startTripSync("t1");

    expect(listenToTrip).toHaveBeenCalledWith("t1", expect.any(Function));
    expect(listenToExpenses).toHaveBeenCalledWith("t1", expect.any(Function));
    expect(listenToCarpools).toHaveBeenCalledWith("t1", expect.any(Function));
    expect(listenToSettlements).toHaveBeenCalledWith(
      "t1",
      expect.any(Function)
    );
    expect(listenToPlannerItems).toHaveBeenCalledWith(
      "t1",
      expect.any(Function)
    );
  });
});

describe("stopTripSync", () => {
  it("unsubscribes all 5 listeners for the trip", () => {
    const { startTripSync, stopTripSync } = require("../syncService");
    const {
      listenToTrip,
      listenToExpenses,
      listenToCarpools,
      listenToSettlements,
      listenToPlannerItems,
    } = require("../tripService");

    const unsubs = [
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
    ];
    let callCount = 0;
    [
      listenToTrip,
      listenToExpenses,
      listenToCarpools,
      listenToSettlements,
      listenToPlannerItems,
    ].forEach((listener, i) => {
      (listener as jest.Mock).mockReturnValue(unsubs[i]);
    });

    startTripSync("t1");
    stopTripSync("t1");

    unsubs.forEach((unsub) => expect(unsub).toHaveBeenCalled());
  });
});

describe("teardownAll", () => {
  it("unsubscribes all active listeners", () => {
    const { startReceiptSync, startWarrantySync, teardownAll } =
      require("../syncService");
    const { listenToReceipts } = require("../receiptService");
    const { listenToWarranties } = require("../warrantyService");

    const receiptUnsub = jest.fn();
    const warrantyUnsub = jest.fn();
    (listenToReceipts as jest.Mock).mockReturnValue(receiptUnsub);
    (listenToWarranties as jest.Mock).mockReturnValue(warrantyUnsub);

    startReceiptSync();
    startWarrantySync();
    teardownAll();

    expect(receiptUnsub).toHaveBeenCalled();
    expect(warrantyUnsub).toHaveBeenCalled();
  });
});

describe("re-registering the same key", () => {
  it("unsubscribes the previous listener before starting a new one", () => {
    const { startReceiptSync } = require("../syncService");
    const { listenToReceipts } = require("../receiptService");

    const firstUnsub = jest.fn();
    const secondUnsub = jest.fn();
    (listenToReceipts as jest.Mock)
      .mockReturnValueOnce(firstUnsub)
      .mockReturnValueOnce(secondUnsub);

    startReceiptSync();
    startReceiptSync(); // Register again

    expect(firstUnsub).toHaveBeenCalled();
  });
});
