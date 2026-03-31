import React, { useState } from "react";
import { Alert } from "react-native";
import { View, Text, Pressable, ScrollView } from "@/tw";
import { useRouter, useLocalSearchParams } from "expo-router";
import { MaterialIcon } from "@/components/MaterialIcon";
import { colors } from "@/theme/colors";
import {
  signInWithGoogle,
  signInWithApple,
  signInAnonymously,
} from "@/services/authService";

export default function OnboardingScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const [loading, setLoading] = useState(false);

  async function handleSignIn(action: () => Promise<void>) {
    if (loading) return;
    setLoading(true);
    try {
      await action();
      // Auth state observer in root layout triggers redirect automatically
      if (redirect) {
        router.replace(redirect as Parameters<typeof router.replace>[0]);
      } else {
        router.replace("/(tabs)/");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Sign-in failed. Please try again.";
      // Don't show an error for cancellations
      if (!message.toLowerCase().includes("cancel")) {
        Alert.alert("Sign-in failed", message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-surface">
      {/* Hero section */}
      <View className="flex-1 items-center justify-center gap-5 px-8 pb-8">
        <View
          className="w-24 h-24 bg-primary rounded-3xl items-center justify-center"
          style={{ borderCurve: "continuous" }}
        >
          <MaterialIcon name="terrain" size={48} color={colors.onPrimary} />
        </View>
        <View className="items-center gap-2">
          <Text className="text-5xl font-extrabold text-primary tracking-tight">
            TripTrack
          </Text>
          <Text className="text-on-surface-variant text-lg text-center leading-relaxed">
            Track receipts, split expenses, plan trips.
          </Text>
        </View>
      </View>

      {/* Sign-in card */}
      <View
        className="bg-surface-container-lowest rounded-t-3xl px-6 pt-8 pb-10 gap-5"
        style={{ borderCurve: "continuous" }}
      >
        <View className="gap-1">
          <Text className="text-2xl font-bold text-on-surface">Get started</Text>
          <Text className="text-on-surface-variant text-sm">
            Sign in to sync your data and collaborate with friends.
          </Text>
        </View>

        <View className="gap-3">
          {/* Google Sign-In */}
          <Pressable
            onPress={() => handleSignIn(signInWithGoogle)}
            disabled={loading}
            className="flex-row items-center justify-center gap-3 bg-white border border-outline/20 rounded-2xl py-4 active:scale-95"
            style={{
              borderCurve: "continuous",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              opacity: loading ? 0.6 : 1,
            }}
          >
            <MaterialIcon name="google" size={20} color="#4285F4" />
            <Text className="text-on-surface font-semibold text-base">
              Continue with Google
            </Text>
          </Pressable>

          {/* Apple Sign-In — iOS only */}
          {process.env.EXPO_OS === "ios" && (
            <Pressable
              onPress={() => handleSignIn(signInWithApple)}
              disabled={loading}
              className="flex-row items-center justify-center gap-3 bg-black rounded-2xl py-4 active:scale-95"
              style={{
                borderCurve: "continuous",
                opacity: loading ? 0.6 : 1,
              }}
            >
              <MaterialIcon name="apple" size={20} color="#ffffff" />
              <Text className="text-white font-semibold text-base">
                Continue with Apple
              </Text>
            </Pressable>
          )}

          {/* Divider */}
          <View className="flex-row items-center gap-3">
            <View className="flex-1 h-px bg-outline-variant" />
            <Text className="text-on-surface-variant text-xs">or</Text>
            <View className="flex-1 h-px bg-outline-variant" />
          </View>

          {/* Offline option */}
          <Pressable
            onPress={() => handleSignIn(signInAnonymously)}
            disabled={loading}
            className="items-center py-2 active:opacity-70"
          >
            <Text className="text-primary text-sm font-semibold">
              Use offline (no sync)
            </Text>
          </Pressable>
        </View>

        {/* Privacy note */}
        <Text className="text-xs text-on-surface-variant text-center leading-relaxed">
          By continuing you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </View>
  );
}
