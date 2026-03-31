import React from "react";
import { View, Text, Pressable } from "@/tw";
import { router } from "expo-router";
import { MaterialIcon } from "@/components/MaterialIcon";
import { colors } from "@/theme/colors";

export default function ScannerScreen() {
  return (
    <View className="flex-1 bg-on-surface items-center justify-center">
      <View className="absolute top-14 right-4">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center active:opacity-70"
        >
          <MaterialIcon name="close" size={24} color={colors.surfaceContainerLowest} />
        </Pressable>
      </View>
      <Text className="text-surface font-medium text-base">
        Camera scanner — Plan 03
      </Text>
    </View>
  );
}
