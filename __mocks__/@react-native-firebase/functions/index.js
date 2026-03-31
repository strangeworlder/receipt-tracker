const mockFunctions = {
  httpsCallable: jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
};

module.exports = () => mockFunctions;
module.exports.default = () => mockFunctions;
