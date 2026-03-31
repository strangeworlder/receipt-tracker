const mockAuth = {
  currentUser: null,
  onAuthStateChanged: jest.fn((cb) => {
    cb(null);
    return jest.fn();
  }),
  signInAnonymously: jest.fn(),
  signOut: jest.fn(),
};

module.exports = () => mockAuth;
module.exports.default = () => mockAuth;
