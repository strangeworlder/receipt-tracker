import { useWarrantyStore } from "../warrantyStore";
import type { Warranty } from "@/types";

const mockWarranty = (id: string): Warranty => ({
  id,
  receiptId: "r1",
  productName: `Product ${id}`,
  manufacturer: "Acme",
  purchaseDate: "2026-01-01",
  expirationDate: "2027-01-01",
  coverageType: "Standard",
});

beforeEach(() => {
  useWarrantyStore.setState({ warranties: [], loading: false, error: null });
});

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
    const soon = new Date();
    soon.setDate(soon.getDate() + 5);
    const expiring = { ...mockWarranty("exp"), expirationDate: soon.toISOString().split("T")[0] };
    const notExpiring = { ...mockWarranty("far"), expirationDate: "2030-01-01" };
    useWarrantyStore.setState({ warranties: [expiring, notExpiring] });

    const result = useWarrantyStore.getState().getExpiringWarranties(10);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("exp");
  });
});
