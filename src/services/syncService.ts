import { listenToReceipts } from "./receiptService";
import { listenToWarranties } from "./warrantyService";
import {
  listenToTrip,
  listenToExpenses,
  listenToCarpools,
  listenToSettlements,
  listenToPlannerItems,
} from "./tripService";
import { useReceiptStore } from "../stores/receiptStore";
import { useWarrantyStore } from "../stores/warrantyStore";
import { useTripStore } from "../stores/tripStore";

type UnsubscribeFn = () => void;
const activeListeners: Map<string, UnsubscribeFn> = new Map();

function register(key: string, unsubscribe: UnsubscribeFn) {
  activeListeners.get(key)?.();
  activeListeners.set(key, unsubscribe);
}

export function startReceiptSync(): void {
  register(
    "receipts",
    listenToReceipts((receipts) => {
      useReceiptStore.getState().setReceipts(receipts);
    })
  );
}

export function startWarrantySync(): void {
  register(
    "warranties",
    listenToWarranties((warranties) => {
      useWarrantyStore.getState().setWarranties(warranties);
    })
  );
}

export function startTripSync(tripId: string): void {
  register(
    `trip:${tripId}`,
    listenToTrip(tripId, (trip) => {
      useTripStore.getState().upsertTrip(trip);
    })
  );
  register(
    `expenses:${tripId}`,
    listenToExpenses(tripId, (expenses) => {
      useTripStore.getState().setExpenses(tripId, expenses);
    })
  );
  register(
    `carpools:${tripId}`,
    listenToCarpools(tripId, (carpools) => {
      useTripStore.getState().setCarpools(tripId, carpools);
    })
  );
  register(
    `settlements:${tripId}`,
    listenToSettlements(tripId, (settlements) => {
      useTripStore.getState().setSettlements(tripId, settlements);
    })
  );
  register(
    `plannerItems:${tripId}`,
    listenToPlannerItems(tripId, (items) => {
      useTripStore.getState().setPlannerItems(tripId, items);
    })
  );
}

export function stopTripSync(tripId: string): void {
  ["trip", "expenses", "carpools", "settlements", "plannerItems"].forEach(
    (prefix) => {
      const key = `${prefix}:${tripId}`;
      activeListeners.get(key)?.();
      activeListeners.delete(key);
    }
  );
}

export function teardownAll(): void {
  activeListeners.forEach((fn) => fn());
  activeListeners.clear();
}
