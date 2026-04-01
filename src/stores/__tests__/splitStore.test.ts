import { useSplitStore } from "../splitStore";
import type { TripParticipant } from "@/types";

const DEFAULT_STATE = {
  totalAmount: 150,
  splitMode: "equal" as const,
  participants: [
    { id: "p1", name: "Alex", isIncluded: true, customAmount: undefined },
    { id: "p2", name: "Sam", isIncluded: true, customAmount: undefined },
    { id: "p3", name: "Jamie", isIncluded: true, customAmount: undefined },
    { id: "p4", name: "Chris", isIncluded: false, customAmount: undefined },
  ],
  paidBy: "p1",
  sharedItems: [],
};

beforeEach(() => {
  useSplitStore.setState(DEFAULT_STATE);
});

// ─── Initial state ───────────────────────────────────────────────────────────

describe("initial state", () => {
  it("has a default totalAmount of 150", () => {
    expect(useSplitStore.getState().totalAmount).toBe(150);
  });

  it("defaults to equal split mode", () => {
    expect(useSplitStore.getState().splitMode).toBe("equal");
  });

  it("has 4 default participants with p1 as payer", () => {
    const { participants, paidBy } = useSplitStore.getState();
    expect(participants).toHaveLength(4);
    expect(paidBy).toBe("p1");
  });

  it("has 3 included and 1 excluded participant by default", () => {
    const { participants } = useSplitStore.getState();
    const included = participants.filter((p) => p.isIncluded);
    const excluded = participants.filter((p) => !p.isIncluded);
    expect(included).toHaveLength(3);
    expect(excluded).toHaveLength(1);
  });

  it("defaults to an empty sharedItems array", () => {
    expect(useSplitStore.getState().sharedItems).toHaveLength(0);
  });
});

// ─── setTotalAmount ───────────────────────────────────────────────────────────

describe("setTotalAmount", () => {
  it("updates the totalAmount", () => {
    useSplitStore.getState().setTotalAmount(200);
    expect(useSplitStore.getState().totalAmount).toBe(200);
  });

  it("accepts zero", () => {
    useSplitStore.getState().setTotalAmount(0);
    expect(useSplitStore.getState().totalAmount).toBe(0);
  });
});

// ─── toggleParticipant ────────────────────────────────────────────────────────

describe("toggleParticipant", () => {
  it("toggles an excluded participant to included", () => {
    // Chris (p4) starts excluded
    useSplitStore.getState().toggleParticipant("p4");
    const p4 = useSplitStore
      .getState()
      .participants.find((p) => p.id === "p4");
    expect(p4?.isIncluded).toBe(true);
  });

  it("toggles an included participant to excluded", () => {
    useSplitStore.getState().toggleParticipant("p2");
    const p2 = useSplitStore
      .getState()
      .participants.find((p) => p.id === "p2");
    expect(p2?.isIncluded).toBe(false);
  });

  it("does not affect other participants", () => {
    useSplitStore.getState().toggleParticipant("p4");
    const p1 = useSplitStore
      .getState()
      .participants.find((p) => p.id === "p1");
    expect(p1?.isIncluded).toBe(true);
  });
});

// ─── setSplitMode ─────────────────────────────────────────────────────────────

describe("setSplitMode", () => {
  it("switches from equal to custom", () => {
    useSplitStore.getState().setSplitMode("custom");
    expect(useSplitStore.getState().splitMode).toBe("custom");
  });

  it("switches back from custom to equal", () => {
    useSplitStore.getState().setSplitMode("custom");
    useSplitStore.getState().setSplitMode("equal");
    expect(useSplitStore.getState().splitMode).toBe("equal");
  });
});

// ─── setPaidBy ────────────────────────────────────────────────────────────────

describe("setPaidBy", () => {
  it("updates the payer id", () => {
    useSplitStore.getState().setPaidBy("p2");
    expect(useSplitStore.getState().paidBy).toBe("p2");
  });
});

// ─── setCustomAmount ──────────────────────────────────────────────────────────

describe("setCustomAmount", () => {
  it("sets a custom amount for the specified participant", () => {
    useSplitStore.getState().setCustomAmount("p1", 75);
    const p1 = useSplitStore
      .getState()
      .participants.find((p) => p.id === "p1");
    expect(p1?.customAmount).toBe(75);
  });

  it("does not affect other participants' custom amounts", () => {
    useSplitStore.getState().setCustomAmount("p1", 75);
    const p2 = useSplitStore
      .getState()
      .participants.find((p) => p.id === "p2");
    expect(p2?.customAmount).toBeUndefined();
  });
});

// ─── getPerPersonAmount ───────────────────────────────────────────────────────

describe("getPerPersonAmount", () => {
  it("divides total equally among included participants", () => {
    // Default: 150 / 3 included = 50
    expect(useSplitStore.getState().getPerPersonAmount()).toBe(50);
  });

  it("recalculates when a participant is toggled in", () => {
    useSplitStore.getState().toggleParticipant("p4"); // 4 included now
    expect(useSplitStore.getState().getPerPersonAmount()).toBe(37.5);
  });

  it("recalculates when a participant is toggled out", () => {
    useSplitStore.getState().toggleParticipant("p2"); // 2 included now
    expect(useSplitStore.getState().getPerPersonAmount()).toBe(75);
  });

  it("returns 0 when no participants are included", () => {
    useSplitStore.getState().toggleParticipant("p1");
    useSplitStore.getState().toggleParticipant("p2");
    useSplitStore.getState().toggleParticipant("p3");
    expect(useSplitStore.getState().getPerPersonAmount()).toBe(0);
  });

  it("recalculates when total amount changes", () => {
    useSplitStore.getState().setTotalAmount(90);
    expect(useSplitStore.getState().getPerPersonAmount()).toBe(30);
  });
});

// ─── getCustomTotal ───────────────────────────────────────────────────────────

describe("getCustomTotal", () => {
  it("returns 0 when no custom amounts are set", () => {
    expect(useSplitStore.getState().getCustomTotal()).toBe(0);
  });

  it("sums custom amounts from all included participants", () => {
    useSplitStore.getState().setCustomAmount("p1", 60);
    useSplitStore.getState().setCustomAmount("p2", 50);
    useSplitStore.getState().setCustomAmount("p3", 40);
    expect(useSplitStore.getState().getCustomTotal()).toBe(150);
  });

  it("only sums included participants", () => {
    useSplitStore.getState().setCustomAmount("p1", 100);
    useSplitStore.getState().setCustomAmount("p4", 50); // p4 is excluded
    expect(useSplitStore.getState().getCustomTotal()).toBe(100);
  });
});

// ─── addSharedItem ────────────────────────────────────────────────────────────

describe("addSharedItem", () => {
  it("adds an item to sharedItems", () => {
    useSplitStore.getState().addSharedItem({ name: "Pizza", price: 20 });
    expect(useSplitStore.getState().sharedItems).toHaveLength(1);
  });

  it("assigns a generated id to the item", () => {
    useSplitStore.getState().addSharedItem({ name: "Pizza", price: 20 });
    const item = useSplitStore.getState().sharedItems[0];
    expect(item.id).toBeDefined();
    expect(typeof item.id).toBe("string");
  });

  it("initializes sharedBy as an empty array", () => {
    useSplitStore.getState().addSharedItem({ name: "Pizza", price: 20 });
    expect(useSplitStore.getState().sharedItems[0].sharedBy).toEqual([]);
  });

  it("adds multiple items", () => {
    useSplitStore.getState().addSharedItem({ name: "Pizza", price: 20 });
    useSplitStore.getState().addSharedItem({ name: "Drinks", price: 30 });
    expect(useSplitStore.getState().sharedItems).toHaveLength(2);
  });
});

// ─── removeSharedItem ─────────────────────────────────────────────────────────

describe("removeSharedItem", () => {
  it("removes an item by id", () => {
    useSplitStore.getState().addSharedItem({ name: "Pizza", price: 20 });
    const id = useSplitStore.getState().sharedItems[0].id;
    useSplitStore.getState().removeSharedItem(id);
    expect(useSplitStore.getState().sharedItems).toHaveLength(0);
  });

  it("does not remove other items", () => {
    useSplitStore.getState().addSharedItem({ name: "Pizza", price: 20 });
    useSplitStore.getState().addSharedItem({ name: "Drinks", price: 30 });
    const pizzaId = useSplitStore.getState().sharedItems[0].id;
    useSplitStore.getState().removeSharedItem(pizzaId);
    expect(useSplitStore.getState().sharedItems).toHaveLength(1);
    expect(useSplitStore.getState().sharedItems[0].name).toBe("Drinks");
  });
});

// ─── autoBalance ─────────────────────────────────────────────────────────────

describe("autoBalance", () => {
  it("distributes the full total equally when no custom amounts are set", () => {
    // Default: 150 total, 3 included participants → 50 each
    useSplitStore.getState().autoBalance();
    const included = useSplitStore
      .getState()
      .participants.filter((p) => p.isIncluded);
    included.forEach((p) => {
      expect(p.customAmount).toBeCloseTo(50);
    });
  });

  it("distributes only the remaining amount among participants without custom amounts", () => {
    useSplitStore.getState().setCustomAmount("p1", 100); // p1 takes 100
    useSplitStore.getState().autoBalance(); // p2 and p3 split remaining 50
    const p2 = useSplitStore
      .getState()
      .participants.find((p) => p.id === "p2");
    const p3 = useSplitStore
      .getState()
      .participants.find((p) => p.id === "p3");
    expect(p2?.customAmount).toBeCloseTo(25);
    expect(p3?.customAmount).toBeCloseTo(25);
  });

  it("does not change participants that already have custom amounts", () => {
    useSplitStore.getState().setCustomAmount("p1", 100);
    useSplitStore.getState().autoBalance();
    const p1 = useSplitStore
      .getState()
      .participants.find((p) => p.id === "p1");
    expect(p1?.customAmount).toBe(100);
  });
});

// ─── loadFromTrip ─────────────────────────────────────────────────────────────

describe("loadFromTrip", () => {
  const tripParticipants: TripParticipant[] = [
    { id: "tp1", name: "Alice", isGhost: false, amountPaid: 0, amountOwed: 0 },
    { id: "tp2", name: "Bob", isGhost: false, amountPaid: 0, amountOwed: 0 },
  ];

  it("maps TripParticipant array into SplitParticipants with isIncluded true", () => {
    useSplitStore.getState().loadFromTrip(tripParticipants);
    const { participants } = useSplitStore.getState();
    expect(participants).toHaveLength(2);
    expect(participants[0].id).toBe("tp1");
    expect(participants[0].name).toBe("Alice");
    expect(participants[0].isIncluded).toBe(true);
    expect(participants[1].id).toBe("tp2");
  });

  it("sets paidBy to the first participant id", () => {
    useSplitStore.getState().loadFromTrip(tripParticipants);
    expect(useSplitStore.getState().paidBy).toBe("tp1");
  });
});

// ─── resetSplit ───────────────────────────────────────────────────────────────

describe("resetSplit", () => {
  it("resets totalAmount to 0", () => {
    useSplitStore.getState().setTotalAmount(999);
    useSplitStore.getState().resetSplit();
    expect(useSplitStore.getState().totalAmount).toBe(0);
  });

  it("resets splitMode to equal", () => {
    useSplitStore.getState().setSplitMode("custom");
    useSplitStore.getState().resetSplit();
    expect(useSplitStore.getState().splitMode).toBe("equal");
  });

  it("clears custom amounts from participants", () => {
    useSplitStore.getState().setCustomAmount("p1", 50);
    useSplitStore.getState().resetSplit();
    const p1 = useSplitStore
      .getState()
      .participants.find((p) => p.id === "p1");
    expect(p1?.customAmount).toBeUndefined();
  });

  it("clears sharedItems", () => {
    useSplitStore.getState().addSharedItem({ name: "Pizza", price: 20 });
    useSplitStore.getState().resetSplit();
    expect(useSplitStore.getState().sharedItems).toHaveLength(0);
  });

  it("restores the default 4 participants", () => {
    useSplitStore.getState().loadFromTrip([
      { id: "tp1", name: "Alice", isGhost: false, amountPaid: 0, amountOwed: 0 },
    ]);
    useSplitStore.getState().resetSplit();
    expect(useSplitStore.getState().participants).toHaveLength(4);
  });
});
