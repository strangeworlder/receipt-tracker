import React from "react";
import { View, Text } from "@/tw";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";

export default function OnboardingScreen() {
  return (
    <View className="flex-1 bg-surface items-center justify-center px-6 gap-6">
      <Text className="text-primary font-bold text-4xl">TripTrack</Text>
      <Text className="text-on-surface-variant text-base text-center">
        Scan receipts, split expenses, and plan trips together.
      </Text>
      <View className="w-full gap-3 mt-4">
        <PrimaryButton label="Sign in with Google" onPress={() => {}} />
        <PrimaryButton label="Sign in with Apple" onPress={() => {}} />
        <SecondaryButton label="Continue Offline" onPress={() => {}} />
      </View>
    </View>
  );
}
