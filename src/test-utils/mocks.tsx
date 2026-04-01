/**
 * Shared Jest mock declarations for the TripTrack test suite.
 *
 * Import this file at the top of any test file that needs standard mocks:
 *   import "@/test-utils/mocks";
 *
 * All jest.mock() calls here are hoisted by Jest automatically.
 */

jest.mock("expo-router", () => {
  const RN = require("react-native");
  return {
    router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
    Link: RN.TouchableOpacity,
    usePathname: jest.fn(() => "/"),
    useSegments: jest.fn(() => []),
    useRouter: jest.fn(() => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() })),
    useLocalSearchParams: jest.fn(() => ({})),
  };
});

jest.mock("expo-blur", () => ({
  BlurView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => "MaterialCommunityIcons");
jest.mock("@expo/vector-icons/MaterialIcons", () => "MaterialIcons");

jest.mock("react-native-reanimated", () => {
  const RN = require("react-native");
  return {
    __esModule: true,
    default: {
      View: RN.View,
      Text: RN.Text,
      ScrollView: RN.ScrollView,
      createAnimatedComponent: (C: React.ComponentType) => C,
    },
    FadeInDown: {
      delay: () => ({
        duration: () => ({
          springify: () => undefined,
        }),
      }),
    },
    FadeOutUp: {
      duration: () => ({
        springify: () => undefined,
      }),
    },
    useSharedValue: jest.fn(() => ({ value: 0 })),
    useAnimatedStyle: jest.fn(() => ({})),
    withTiming: jest.fn((v: unknown) => v),
    withSpring: jest.fn((v: unknown) => v),
    runOnJS: jest.fn((fn: Function) => fn),
  };
});
