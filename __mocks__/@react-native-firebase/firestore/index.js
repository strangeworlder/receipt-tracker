const mockFirestore = {
  collection: jest.fn(() => mockFirestore),
  doc: jest.fn(() => mockFirestore),
  where: jest.fn(() => mockFirestore),
  orderBy: jest.fn(() => mockFirestore),
  onSnapshot: jest.fn(() => jest.fn()),
  get: jest.fn(() =>
    Promise.resolve({ docs: [], exists: false, data: () => ({}) })
  ),
  set: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
  delete: jest.fn(() => Promise.resolve()),
  add: jest.fn(() => Promise.resolve({ id: "mock-id" })),
};

module.exports = () => mockFirestore;
module.exports.FieldValue = {
  serverTimestamp: jest.fn(() => "mock-timestamp"),
  arrayUnion: jest.fn((...args) => args),
  arrayRemove: jest.fn((...args) => args),
};
