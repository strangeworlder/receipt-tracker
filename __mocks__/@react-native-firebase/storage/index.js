const mockStorageRef = {
  putFile: jest.fn(() => Promise.resolve({ state: "success" })),
  getDownloadURL: jest.fn(() => Promise.resolve("https://mock-storage.example.com/file")),
  delete: jest.fn(() => Promise.resolve()),
};

const mockStorage = {
  ref: jest.fn(() => mockStorageRef),
};

module.exports = () => mockStorage;
module.exports.default = () => mockStorage;
