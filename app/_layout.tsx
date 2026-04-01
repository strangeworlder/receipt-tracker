import "../global.css";
import "expo-sqlite/localStorage/install";

import React, { useEffect, useState } from "react";
import { AppState } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Lexend_300Light,
  Lexend_400Regular,
  Lexend_500Medium,
  Lexend_600SemiBold,
  Lexend_700Bold,
  Lexend_800ExtraBold,
} from "@expo-google-fonts/lexend";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import auth from "@react-native-firebase/auth";
import type { FirebaseAuthTypes } from "@react-native-firebase/auth";

import { useAuthStore } from "@/stores/authStore";
import { upsertUserProfile, getUserProfile } from "@/services/userService";
import {
  configureGoogleSignIn,
  registerForPushNotifications,
} from "@/services/authService";
import {
  startReceiptSync,
  startWarrantySync,
  teardownAll,
} from "@/services/syncService";
import { startQueueProcessor } from "@/services/driveService";
import { cleanupOldLocalFiles } from "@/services/receiptService";
import { Toast } from "@/components/Toast";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Lexend_300Light,
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
    Lexend_800ExtraBold,
  });

  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(
    auth().currentUser
  );
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // Hide splash once fonts resolve
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Subscribe to Firebase auth state — set up sync services on sign-in
  useEffect(() => {
    configureGoogleSignIn();

    const unsubscribe = auth().onAuthStateChanged(async newUser => {
      if (newUser && !newUser.isAnonymous) {
        await upsertUserProfile();
        await registerForPushNotifications();
        startReceiptSync();
        startWarrantySync();
        startQueueProcessor();
        const profile = await getUserProfile(newUser.uid);
        useAuthStore.getState().setUser(profile, false);
      } else {
        useAuthStore.getState().setUser(null, newUser?.isAnonymous ?? false);
      }
      setUser(newUser);
      setAuthLoading(false);
    });

    return () => {
      unsubscribe();
      teardownAll();
    };
  }, []);

  // Cleanup old local files when app becomes active
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && user && !user.isAnonymous) {
        cleanupOldLocalFiles().catch(console.error);
      }
    });
    return () => sub.remove();
  }, [user]);

  // Navigate to warranty tab when user taps a warranty notification
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const warrantyId =
          response.notification.request.content.data?.warrantyId;
        if (warrantyId) {
          router.push("/(tabs)/warranty");
        }
      }
    );
    return () => sub.remove();
  }, []);

  // Redirect based on auth state once both fonts and auth have resolved
  useEffect(() => {
    if (authLoading || (!fontsLoaded && !fontError)) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/onboarding");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)/");
    }
  }, [user, authLoading, segments, fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Toast />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{
            presentation: "modal",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="trips/new"
          options={{
            presentation: "modal",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="trips/carpool-new"
          options={{
            presentation: "modal",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="receipts/[receiptId]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="invite/[inviteId]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="scanner"
          options={{
            presentation: "fullScreenModal",
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}
