const mockMessaging = {
  getToken: jest.fn(() => Promise.resolve("mock-fcm-token")),
  onMessage: jest.fn(() => jest.fn()),
  requestPermission: jest.fn(() => Promise.resolve(1)),
  setBackgroundMessageHandler: jest.fn(),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn(() => Promise.resolve(null)),
};

module.exports = () => mockMessaging;
module.exports.default = () => mockMessaging;
module.exports.AuthorizationStatus = {
  AUTHORIZED: 1,
  PROVISIONAL: 2,
  NOT_DETERMINED: -1,
  DENIED: 0,
};
