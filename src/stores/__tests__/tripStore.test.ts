import { useTripStore } from "../tripStore";
import type { Trip, Expense, Carpool, SettlementTransaction } from "@/types";

const mockTrip = (id: string): Trip => ({
  id,
  name: `Trip ${id}`,
  startDate: "2026-07-01",
  endDate: "2026-07-10",
  participants: [],
  totalSpend: 0,
  categories: [],
  carpools: [],
  settlements: [],
  totalPot: 0,
  categoryBreakdown: {},
});

const mockExpense = (id: string, tripId: string): Expense => ({
  id,
  tripId,
  description: "Test",
  amount: 10,
  paidBy: "p1",
  splitAmong: ["p1"],
  splitType: "equal",
});

beforeEach(() => {
  useTripStore.setState({
    trips: {},
    expenses: {},
    carpools: {},
    settlements: {},
    plannerItems: {},
    loading: false,
    error: null,
  });
});

describe("upsertTrip", () => {
  it("adds a new trip to the record", () => {
    useTripStore.getState().upsertTrip(mockTrip("t1"));
    expect(useTripStore.getState().trips["t1"]).toBeDefined();
    expect(useTripStore.getState().trips["t1"].name).toBe("Trip t1");
  });

  it("replaces an existing trip", () => {
    useTripStore.getState().upsertTrip(mockTrip("t1"));
    useTripStore.getState().upsertTrip({ ...mockTrip("t1"), name: "Updated" });
    expect(useTripStore.getState().trips["t1"].name).toBe("Updated");
  });
});

describe("addTrip / updateTrip / deleteTrip", () => {
  it("addTrip inserts into the record", () => {
    useTripStore.getState().addTrip(mockTrip("t1"));
    expect(useTripStore.getState().trips["t1"]).toBeDefined();
  });

  it("updateTrip merges partial updates", () => {
    useTripStore.getState().addTrip(mockTrip("t1"));
    useTripStore.getState().updateTrip("t1", { name: "New Name" });
    expect(useTripStore.getState().trips["t1"].name).toBe("New Name");
  });

  it("deleteTrip removes the entry", () => {
    useTripStore.getState().addTrip(mockTrip("t1"));
    useTripStore.getState().deleteTrip("t1");
    expect(useTripStore.getState().trips["t1"]).toBeUndefined();
  });
});

describe("getTrip / getAllTrips", () => {
  it("getTrip returns the trip by id", () => {
    useTripStore.getState().addTrip(mockTrip("t1"));
    const t = useTripStore.getState().getTrip("t1");
    expect(t?.id).toBe("t1");
  });

  it("getTrip returns undefined for unknown id", () => {
    expect(useTripStore.getState().getTrip("unknown")).toBeUndefined();
  });

  it("getAllTrips returns all trips as an array", () => {
    useTripStore.getState().addTrip(mockTrip("t1"));
    useTripStore.getState().addTrip(mockTrip("t2"));
    const all = useTripStore.getState().getAllTrips();
    expect(all).toHaveLength(2);
  });
});

describe("setExpenses", () => {
  it("stores expenses keyed by tripId", () => {
    const expenses = [mockExpense("e1", "t1"), mockExpense("e2", "t1")];
    useTripStore.getState().setExpenses("t1", expenses);
    expect(useTripStore.getState().expenses["t1"]).toHaveLength(2);
  });

  it("replaces existing expenses for the same tripId", () => {
    useTripStore.getState().setExpenses("t1", [mockExpense("e1", "t1")]);
    useTripStore.getState().setExpenses("t1", [mockExpense("e2", "t1")]);
    const expenses = useTripStore.getState().expenses["t1"];
    expect(expenses).toHaveLength(1);
    expect(expenses[0].id).toBe("e2");
  });
});

describe("setCarpools", () => {
  it("stores carpools keyed by tripId", () => {
    const carpools: Carpool[] = [
      {
        id: "c1",
        tripId: "t1",
        name: "Van",
        route: "A-B",
        distance: 100,
        fuelCost: 20,
        passengers: [],
      },
    ];
    useTripStore.getState().setCarpools("t1", carpools);
    expect(useTripStore.getState().carpools["t1"]).toHaveLength(1);
  });
});

describe("setSettlements", () => {
  it("stores settlements keyed by tripId", () => {
    const settlements: SettlementTransaction[] = [
      {
        id: "s1",
        tripId: "t1",
        fromParticipantId: "p2",
        toParticipantId: "p1",
        amount: 50,
        status: "pending",
      },
    ];
    useTripStore.getState().setSettlements("t1", settlements);
    expect(useTripStore.getState().settlements["t1"]).toHaveLength(1);
  });
});

describe("setPlannerItems", () => {
  it("stores planner items keyed by tripId", () => {
    const items = [
      {
        id: "i1",
        tripId: "t1",
        name: "Tent",
        description: "Big tent",
        category: "gear",
        categoryId: "cat1",
        status: "unassigned" as const,
        createdByUid: "uid-test",
        createdAt: {} as any,
      },
    ];
    useTripStore.getState().setPlannerItems("t1", items);
    expect(useTripStore.getState().plannerItems["t1"]).toHaveLength(1);
  });
});

// ─── New Selector Tests (Plan 09) ──────────────────────────────────────────────

const mockCarpool = (id: string, tripId: string): Carpool => ({
  id,
  tripId,
  name: `Carpool ${id}`,
  route: "A → B",
  distance: 100,
  fuelCost: 20,
  passengers: [],
});

const mockSettlement = (id: string, tripId: string): SettlementTransaction => ({
  id,
  tripId,
  fromParticipantId: "p2",
  toParticipantId: "p1",
  amount: 50,
  status: "pending",
});

const mockPlannerItem = (
  id: string,
  tripId: string,
  status: "unassigned" | "assigned" | "brought" = "unassigned"
) => ({
  id,
  tripId,
  name: `Item ${id}`,
  description: "A thing to bring",
  category: "gear",
  categoryId: "cat1",
  status,
  createdByUid: "uid-test",
  createdAt: {} as any,
});

describe("getCarpools", () => {
  it("returns carpools for the given tripId", () => {
    useTripStore.getState().setCarpools("t1", [mockCarpool("c1", "t1"), mockCarpool("c2", "t1")]);
    const result = useTripStore.getState().getCarpools("t1");
    expect(result).toHaveLength(2);
  });

  it("returns an empty array when no carpools exist for the tripId", () => {
    const result = useTripStore.getState().getCarpools("unknown");
    expect(result).toEqual([]);
  });
});

describe("getExpenses", () => {
  it("returns expenses for the given tripId", () => {
    useTripStore.getState().setExpenses("t1", [mockExpense("e1", "t1"), mockExpense("e2", "t1")]);
    const result = useTripStore.getState().getExpenses("t1");
    expect(result).toHaveLength(2);
  });

  it("returns an empty array when no expenses exist for the tripId", () => {
    const result = useTripStore.getState().getExpenses("unknown");
    expect(result).toEqual([]);
  });
});

describe("getSettlements", () => {
  it("returns settlements for the given tripId", () => {
    useTripStore.getState().setSettlements("t1", [mockSettlement("s1", "t1")]);
    const result = useTripStore.getState().getSettlements("t1");
    expect(result).toHaveLength(1);
  });

  it("returns an empty array when no settlements exist for the tripId", () => {
    const result = useTripStore.getState().getSettlements("unknown");
    expect(result).toEqual([]);
  });
});

describe("getPlannerItems", () => {
  it("returns planner items for the given tripId", () => {
    useTripStore.getState().setPlannerItems("t1", [
      mockPlannerItem("i1", "t1"),
      mockPlannerItem("i2", "t1"),
    ]);
    const result = useTripStore.getState().getPlannerItems("t1");
    expect(result).toHaveLength(2);
  });

  it("returns an empty array when no planner items exist for the tripId", () => {
    const result = useTripStore.getState().getPlannerItems("unknown");
    expect(result).toEqual([]);
  });
});

describe("getPlannerProgress", () => {
  it("returns zero progress when there are no items", () => {
    const result = useTripStore.getState().getPlannerProgress("t1");
    expect(result).toEqual({ total: 0, assigned: 0, percentage: 0 });
  });

  it("counts assigned and brought items as assigned", () => {
    useTripStore.getState().setPlannerItems("t1", [
      mockPlannerItem("i1", "t1", "unassigned"),
      mockPlannerItem("i2", "t1", "assigned"),
      mockPlannerItem("i3", "t1", "brought"),
    ]);
    const result = useTripStore.getState().getPlannerProgress("t1");
    expect(result.total).toBe(3);
    expect(result.assigned).toBe(2);
    expect(result.percentage).toBeCloseTo(67, 0);
  });

  it("returns 100 percent when all items are brought", () => {
    useTripStore.getState().setPlannerItems("t1", [
      mockPlannerItem("i1", "t1", "brought"),
      mockPlannerItem("i2", "t1", "brought"),
    ]);
    const result = useTripStore.getState().getPlannerProgress("t1");
    expect(result.percentage).toBe(100);
  });
});

