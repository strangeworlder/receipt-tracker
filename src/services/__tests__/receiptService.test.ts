import firestore from "@react-native-firebase/firestore";

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "/mock-doc-dir/",
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: false })),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  copyAsync: jest.fn(() => Promise.resolve()),
  deleteAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("../utils", () => ({
  requireAuth: jest.fn(() => "uid-test"),
}));

jest.mock("../ocrService");

// Reset modules between tests so jest.mock overrides take effect cleanly
beforeEach(() => {
  jest.clearAllMocks();
});

describe("ensureReceiptsDir", () => {
  it("creates directory when it does not exist", async () => {
    const FileSystem = require("expo-file-system/legacy");
    FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: false });

    const { ensureReceiptsDir } = require("../receiptService");
    await ensureReceiptsDir();

    expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
      expect.stringContaining("receipts"),
      { intermediates: true }
    );
  });

  it("skips creation when directory already exists", async () => {
    const FileSystem = require("expo-file-system/legacy");
    FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });

    const { ensureReceiptsDir } = require("../receiptService");
    await ensureReceiptsDir();

    expect(FileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
  });
});

describe("saveImageLocally", () => {
  it("copies the file to the receipts directory and returns the path", async () => {
    const FileSystem = require("expo-file-system/legacy");
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true });

    const { saveImageLocally } = require("../receiptService");
    const dest = await saveImageLocally("/tmp/photo.jpg", "rec-123");

    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: "/tmp/photo.jpg",
      to: expect.stringContaining("rec-123.jpg"),
    });
    expect(dest).toContain("rec-123.jpg");
  });
});

describe("createReceiptRecord", () => {
  it("writes a Firestore document with the correct shape", async () => {
    const FileSystem = require("expo-file-system/legacy");
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
    FileSystem.copyAsync.mockResolvedValue(undefined);

    const mockSet = jest.fn(() => Promise.resolve());
    const mockDoc = jest.fn(() => ({ set: mockSet }));
    (firestore().collection as jest.Mock).mockReturnValue({ doc: mockDoc });

    const { createReceiptRecord } = require("../receiptService");
    const ocr = {
      merchant: "Test Store",
      date: "2026-01-15",
      amount: 42.5,
      items: [],
      confidence: 0.9,
    };

    await createReceiptRecord(ocr, "/tmp/img.jpg", "food", false);

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "uid-test",
        merchant: "Test Store",
        amount: 42.5,
        category: "food",
        isWarranty: false,
        syncStatus: "local",
      })
    );
  });

  it("throws when not authenticated", async () => {
    const utils = require("../utils");
    utils.requireAuth.mockImplementationOnce(() => {
      throw new Error("requireAuth: no authenticated user");
    });

    const FileSystem = require("expo-file-system/legacy");
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true });

    const { createReceiptRecord } = require("../receiptService");
    await expect(
      createReceiptRecord(
        {
          merchant: "X",
          date: "2026-01-01",
          amount: 1,
          items: [],
          confidence: 0,
        },
        "/tmp/img.jpg",
        "food",
        false
      )
    ).rejects.toThrow("requireAuth");
  });
});

describe("updateReceipt", () => {
  it("calls Firestore update on the receipt document", async () => {
    const mockUpdate = jest.fn(() => Promise.resolve());
    const mockDoc = jest.fn(() => ({ update: mockUpdate }));
    (firestore().collection as jest.Mock).mockReturnValue({ doc: mockDoc });

    const { updateReceipt } = require("../receiptService");
    await updateReceipt("rec-1", { merchant: "New Name" });

    expect(mockUpdate).toHaveBeenCalledWith({ merchant: "New Name" });
  });
});

describe("deleteReceipt", () => {
  it("deletes the Firestore document", async () => {
    const mockDelete = jest.fn(() => Promise.resolve());
    const mockDoc = jest.fn(() => ({ delete: mockDelete }));
    (firestore().collection as jest.Mock).mockReturnValue({ doc: mockDoc });

    const FileSystem = require("expo-file-system/legacy");
    FileSystem.getInfoAsync.mockResolvedValue({ exists: false });

    const { deleteReceipt } = require("../receiptService");
    await deleteReceipt("rec-1");

    expect(mockDelete).toHaveBeenCalled();
  });

  it("also deletes the local image file when it exists", async () => {
    const mockDelete = jest.fn(() => Promise.resolve());
    const mockDoc = jest.fn(() => ({ delete: mockDelete }));
    (firestore().collection as jest.Mock).mockReturnValue({ doc: mockDoc });

    const FileSystem = require("expo-file-system/legacy");
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true });

    const { deleteReceipt } = require("../receiptService");
    await deleteReceipt("rec-1");

    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      expect.stringContaining("rec-1.jpg"),
      { idempotent: true }
    );
  });
});

describe("listenToReceipts", () => {
  it("returns an unsubscribe function", () => {
    const mockUnsub = jest.fn();
    const chain = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      onSnapshot: jest.fn(() => mockUnsub),
    };
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { listenToReceipts } = require("../receiptService");
    const unsub = listenToReceipts(jest.fn());

    expect(chain.onSnapshot).toHaveBeenCalled();
    expect(unsub).toBe(mockUnsub);
  });

  it("converts Timestamps to ISO date strings and maps _pendingWrite", () => {
    const fakeTimestamp = {
      toDate: () => new Date("2026-03-15T00:00:00Z"),
    };
    const fakeDocs = [
      {
        id: "r1",
        metadata: { hasPendingWrites: true },
        data: () => ({
          merchant: "Shop",
          date: fakeTimestamp,
          amount: 55,
          category: "food",
          isWarranty: false,
          syncStatus: "local",
          items: [],
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
      limit: jest.fn().mockReturnThis(),
      onSnapshot: mockOnSnapshot,
    };
    (firestore().collection as jest.Mock).mockReturnValue(chain);

    const { listenToReceipts } = require("../receiptService");
    const onUpdate = jest.fn();
    listenToReceipts(onUpdate);

    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "r1",
          date: "2026-03-15",
          _pendingWrite: true,
        }),
      ])
    );
  });
});

describe("compressReceiptImage", () => {
  it("calls ImageManipulator chain and returns the compressed URI", async () => {
    const mockSaveAsync = jest.fn(() =>
      Promise.resolve({ uri: "/compressed/photo.jpg" })
    );
    const mockRenderAsync = jest.fn(() =>
      Promise.resolve({ saveAsync: mockSaveAsync })
    );
    const mockResize = jest.fn(() => ({ renderAsync: mockRenderAsync }));
    const mockManipulate = jest.fn(() => ({ resize: mockResize }));

    jest.doMock("expo-image-manipulator", () => ({
      ImageManipulator: { manipulate: mockManipulate },
      SaveFormat: { JPEG: "jpeg", PNG: "png", WEBP: "webp" },
    }));

    jest.resetModules();
    const { compressReceiptImage } = require("../receiptService");
    const result = await compressReceiptImage("/tmp/photo.jpg");

    expect(mockManipulate).toHaveBeenCalledWith("/tmp/photo.jpg");
    expect(mockResize).toHaveBeenCalledWith({ width: 1200 });
    expect(mockSaveAsync).toHaveBeenCalledWith(
      expect.objectContaining({ format: "jpeg" })
    );
    expect(result).toBe("/compressed/photo.jpg");
  });
});

describe("uploadToFirebaseStorage (full)", () => {
  it("uploads compressed image, gets download URL, and updates Firestore", async () => {
    const mockSaveAsync = jest.fn(() =>
      Promise.resolve({ uri: "/compressed/photo.jpg" })
    );
    const mockRenderAsync = jest.fn(() =>
      Promise.resolve({ saveAsync: mockSaveAsync })
    );
    const mockManipulate = jest.fn(() => ({
      resize: jest.fn(() => ({ renderAsync: mockRenderAsync })),
    }));

    jest.doMock("expo-image-manipulator", () => ({
      ImageManipulator: { manipulate: mockManipulate },
      SaveFormat: { JPEG: "jpeg", PNG: "png", WEBP: "webp" },
    }));

    jest.resetModules();

    // Re-acquire mocks from fresh modules
    const freshFirestore = require("@react-native-firebase/firestore");
    const storage = require("@react-native-firebase/storage");
    const storageInstance = storage();

    const mockUpdate = jest.fn(() => Promise.resolve());
    const mockDoc = jest.fn(() => ({ update: mockUpdate }));
    (freshFirestore().collection as jest.Mock).mockReturnValue({ doc: mockDoc });

    const { uploadToFirebaseStorage } = require("../receiptService");
    const downloadUrl = await uploadToFirebaseStorage("rec-1", "/local/photo.jpg");

    expect(storageInstance.ref).toHaveBeenCalled();
    expect(downloadUrl).toBe("https://mock-storage.example.com/file");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        firebaseStorageUrl: "https://mock-storage.example.com/file",
        syncStatus: "synced",
      })
    );
  });
});

describe("deleteReceipt (with Storage cleanup)", () => {
  it("also deletes the Firebase Storage file", async () => {
    jest.resetModules();

    const freshFirestore = require("@react-native-firebase/firestore");
    const storage = require("@react-native-firebase/storage");
    const storageInstance = storage();

    const mockDelete = jest.fn(() => Promise.resolve());
    const mockDoc = jest.fn(() => ({ delete: mockDelete }));
    (freshFirestore().collection as jest.Mock).mockReturnValue({ doc: mockDoc });

    const FileSystem = require("expo-file-system/legacy");
    FileSystem.getInfoAsync.mockResolvedValue({ exists: false });

    // Mock auth().currentUser
    const auth = require("@react-native-firebase/auth");
    auth().currentUser = { uid: "uid-test" };

    const { deleteReceipt } = require("../receiptService");
    await deleteReceipt("rec-1");

    expect(storageInstance.ref).toHaveBeenCalled();
  });
});

