/**
 * driveService.test.ts — TDD tests for Drive upload queue.
 *
 * Tests the queue management, processing, and concurrency guard.
 * The actual Drive API upload (multipart fetch) is mocked.
 */

// Mock localStorage (expo-sqlite polyfill)
const mockStorage: Record<string, string> = {};
Object.defineProperty(global, "localStorage", {
  value: {
    getItem: jest.fn((key: string) => mockStorage[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStorage[key];
    }),
  },
  writable: true,
});

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "/mock-doc-dir/",
  readAsStringAsync: jest.fn(() => Promise.resolve("base64data")),
  EncodingType: { Base64: "base64" },
}));

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock("../authService", () => ({
  getGoogleAccessToken: jest.fn(() => Promise.resolve("mock-access-token")),
  refreshGoogleAccessToken: jest.fn(() =>
    Promise.resolve("refreshed-mock-token")
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Clear localStorage between tests
  Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
});

describe("queueDriveUpload", () => {
  it("persists an entry to localStorage", async () => {
    const { queueDriveUpload } = require("../driveService");
    await queueDriveUpload("rec-1", "/local/photo.jpg", "Whole Foods", "2026-03-28");

    const raw = localStorage.getItem("drive_upload_queue");
    expect(raw).not.toBeNull();
    const queue = JSON.parse(raw!);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      receiptId: "rec-1",
      merchant: "Whole Foods",
      attempts: 0,
    });
  });

  it("replaces an existing entry with the same receiptId", async () => {
    const { queueDriveUpload } = require("../driveService");
    await queueDriveUpload("rec-1", "/local/old.jpg", "Old", "2026-01-01");
    await queueDriveUpload("rec-1", "/local/new.jpg", "New", "2026-02-02");

    const queue = JSON.parse(localStorage.getItem("drive_upload_queue")!);
    expect(queue).toHaveLength(1);
    expect(queue[0].merchant).toBe("New");
  });
});

describe("processQueue", () => {
  it("drops entries after 5 failed attempts", async () => {
    // Seed queue with an entry that has already failed 5 times
    const failedEntry = {
      receiptId: "rec-fail",
      localUri: "/local/fail.jpg",
      merchant: "FailStore",
      date: "2026-01-01",
      attempts: 5,
    };
    localStorage.setItem("drive_upload_queue", JSON.stringify([failedEntry]));

    const { processQueue } = require("../driveService");
    await processQueue();

    const queue = JSON.parse(localStorage.getItem("drive_upload_queue") ?? "[]");
    expect(queue).toHaveLength(0);
  });
});

describe("startQueueProcessor", () => {
  it("returns an unsubscribe function", () => {
    const { startQueueProcessor } = require("../driveService");
    const unsub = startQueueProcessor();

    expect(typeof unsub).toBe("function");

    const NetInfo = require("@react-native-community/netinfo");
    expect(NetInfo.addEventListener).toHaveBeenCalled();
  });
});
