import { useWarrantyStore } from "../warrantyStore";
import type { Warranty } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateInDays(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

const mockWarranty = (id: string, expirationDate = "2027-01-01"): Warranty => ({
  id,
  receiptId: "r1",
  productName: `Product ${id}`,
  manufacturer: "Acme",
  purchaseDate: "2026-01-01",
  expirationDate,
  coverageType: "Standard",
});

beforeEach(() => {
  useWarrantyStore.setState({ warranties: [], loading: false, error: null });
});

// ─── Pre-existing tests ────────────────────────────────────────────────────────

describe("setWarranties", () => {
  it("replaces the entire warranties array", () => {
    useWarrantyStore.setState({ warranties: [mockWarranty("old-1")] });
    const newWarranties = [mockWarranty("new-1"), mockWarranty("new-2")];
    useWarrantyStore.getState().setWarranties(newWarranties);
    expect(useWarrantyStore.getState().warranties).toEqual(newWarranties);
  });

  it("can clear warranties with an empty array", () => {
    useWarrantyStore.setState({ warranties: [mockWarranty("w1")] });
    useWarrantyStore.getState().setWarranties([]);
    expect(useWarrantyStore.getState().warranties).toHaveLength(0);
  });
});

describe("existing getExpiringWarranties still works", () => {
  it("returns warranties expiring within the given window", () => {
    const expiring = mockWarranty("exp", dateInDays(5));
    const notExpiring = mockWarranty("far", "2030-01-01");
    useWarrantyStore.setState({ warranties: [expiring, notExpiring] });

    const result = useWarrantyStore.getState().getExpiringWarranties(10);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("exp");
  });
});

// ─── getWarranties ────────────────────────────────────────────────────────────

describe("getWarranties", () => {
  it("returns all warranties sorted soonest-expiring first, expired at bottom", () => {
    const far = mockWarranty("far", dateInDays(200));
    const soon = mockWarranty("soon", dateInDays(10));
    const expired = mockWarranty("expired", dateInDays(-5));
    useWarrantyStore.setState({ warranties: [far, expired, soon] });

    const result = useWarrantyStore.getState().getWarranties("all");
    expect(result.map((w) => w.id)).toEqual(["soon", "far", "expired"]);
  });

  it("'active' excludes expired warranties", () => {
    const active = mockWarranty("active", dateInDays(60));
    const expired = mockWarranty("expired", dateInDays(-1));
    useWarrantyStore.setState({ warranties: [active, expired] });

    const result = useWarrantyStore.getState().getWarranties("active");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("active");
  });

  it("'expired' returns only past-due warranties", () => {
    const active = mockWarranty("active", dateInDays(60));
    const expired = mockWarranty("expired", dateInDays(-3));
    useWarrantyStore.setState({ warranties: [active, expired] });

    const result = useWarrantyStore.getState().getWarranties("expired");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("expired");
  });

  it("returns empty array when no warranties match the filter", () => {
    useWarrantyStore.setState({ warranties: [mockWarranty("active", dateInDays(60))] });
    const result = useWarrantyStore.getState().getWarranties("expired");
    expect(result).toHaveLength(0);
  });
});

// ─── getDaysRemaining ─────────────────────────────────────────────────────────

describe("getDaysRemaining", () => {
  it("returns a positive number for a future warranty", () => {
    useWarrantyStore.setState({ warranties: [mockWarranty("w", dateInDays(30))] });
    const days = useWarrantyStore.getState().getDaysRemaining("w");
    expect(days).toBeGreaterThan(0);
  });

  it("returns a negative number for an expired warranty", () => {
    useWarrantyStore.setState({ warranties: [mockWarranty("w", dateInDays(-1))] });
    const days = useWarrantyStore.getState().getDaysRemaining("w");
    expect(days).toBeLessThan(0);
  });

  it("returns 0 for an unknown warranty id", () => {
    useWarrantyStore.setState({ warranties: [] });
    expect(useWarrantyStore.getState().getDaysRemaining("nonexistent")).toBe(0);
  });
});

// ─── getWarrantyStatus ────────────────────────────────────────────────────────

describe("getWarrantyStatus", () => {
  it("returns 'healthy' for a warranty with more than 30 days remaining", () => {
    useWarrantyStore.setState({ warranties: [mockWarranty("w", dateInDays(60))] });
    expect(useWarrantyStore.getState().getWarrantyStatus("w")).toBe("healthy");
  });

  it("returns 'action_required' for a warranty expiring within 30 days", () => {
    useWarrantyStore.setState({ warranties: [mockWarranty("w", dateInDays(15))] });
    expect(useWarrantyStore.getState().getWarrantyStatus("w")).toBe("action_required");
  });

  it("returns 'expired' for an already-expired warranty", () => {
    useWarrantyStore.setState({ warranties: [mockWarranty("w", dateInDays(-5))] });
    expect(useWarrantyStore.getState().getWarrantyStatus("w")).toBe("expired");
  });
});
