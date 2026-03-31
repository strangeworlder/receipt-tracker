import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "TripTrack",
  slug: "triptrack",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "triptrack",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#f7fbf3",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.yourcompany.triptrack",
    googleServicesFile: "./ios/GoogleService-Info.plist",
    infoPlist: {
      NSCameraUsageDescription:
        "TripTrack uses the camera to scan receipts.",
      NSPhotoLibraryUsageDescription:
        "TripTrack reads your photo library to import receipts.",
    },
    entitlements: {
      "aps-environment": "development",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#f7fbf3",
    },
    package: "com.yourcompany.triptrack",
    googleServicesFile: "./android/app/google-services.json",
    permissions: [
      "android.permission.CAMERA",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.INTERNET",
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.VIBRATE",
    ],
  },
  web: {
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "@react-native-firebase/app",
    "@react-native-firebase/auth",
    "@react-native-firebase/messaging",
    [
      "expo-camera",
      { cameraPermission: "TripTrack uses the camera to scan receipts." },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "TripTrack reads your photo library to import receipts.",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#02ba41",
      },
    ],
    "expo-secure-store",
    "expo-font",
    "@react-native-google-signin/google-signin",
    "@react-native-community/datetimepicker",
  ],
  extra: {
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    eas: {
      projectId: "your-eas-project-id",
    },
  },
});
