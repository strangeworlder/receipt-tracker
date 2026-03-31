import React from "react";
import { ScrollView, View, Text, Pressable } from "@/tw";
import { router } from "expo-router";
import { MaterialIcon } from "@/components/MaterialIcon";
import { colors } from "@/theme/colors";

export default function NewTripScreen() {
  return (
    <View className="flex-1 bg-surface">
      <View className="px-4 pt-14 pb-3 flex-row items-center justify-between">
        <Text className="text-on-surface text-xl font-bold">New Trip</Text>
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center active:opacity-70"
        >
          <MaterialIcon name="close" size={24} color={colors.onSurface} />
        </Pressable>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="px-4 gap-4">
          <Text className="text-on-surface-variant text-sm">
            Trip creation form — Plan 11
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
