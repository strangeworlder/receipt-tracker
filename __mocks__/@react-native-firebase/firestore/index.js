const mockFirestore = {
  collection: jest.fn(() => mockFirestore),
  doc: jest.fn(() => mockFirestore),
  where: jest.fn(() => mockFirestore),
  orderBy: jest.fn(() => mockFirestore),
  limit: jest.fn(() => mockFirestore),
  onSnapshot: jest.fn(() => jest.fn()),
  get: jest.fn(() =>
    Promise.resolve({ docs: [], exists: jest.fn(() => false), data: () => ({}) })
  ),
  set: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
  delete: jest.fn(() => Promise.resolve()),
  add: jest.fn(() => Promise.resolve({ id: "mock-id" })),
  settings: jest.fn(),
};

const firestoreFn = () => mockFirestore;
firestoreFn.CACHE_SIZE_UNLIMITED = -1;
firestoreFn.FieldValue = {
  serverTimestamp: jest.fn(() => "mock-timestamp"),
  arrayUnion: jest.fn((...args) => args),
  arrayRemove: jest.fn((...args) => args),
};

module.exports = firestoreFn;
module.exports.CACHE_SIZE_UNLIMITED = -1;
module.exports.FieldValue = firestoreFn.FieldValue;
