import type { Config } from "jest";

const config: Config = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  testPathIgnorePatterns: ["/node_modules/", "/functions/"],
  moduleNameMapper: {
    "^@/tw$": "<rootDir>/src/tw/index",
    "^@/tw/image$": "<rootDir>/src/tw/image",
    "^@/tw/animated$": "<rootDir>/src/tw/animated",
    "^@/test-utils/(.*)$": "<rootDir>/src/test-utils/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css))",
  ],
};

export default config;
