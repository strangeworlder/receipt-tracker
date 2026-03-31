import React from "react";
import { ScrollView, View, Text, Pressable } from "@/tw";
import { useLocalSearchParams, router } from "expo-router";
import { useReceiptStore } from "@/stores/receiptStore";
import { Card } from "@/components/Card";
import { MaterialIcon } from "@/components/MaterialIcon";
import { colors } from "@/theme/colors";

export default function ReceiptDetailScreen() {
  const { receiptId } = useLocalSearchParams<{ receiptId: string }>();
  const receipt = useReceiptStore((s) => s.getReceiptById(receiptId));

  if (!receipt) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <Text className="text-on-surface-variant">Receipt not found.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <View className="px-4 pt-14 pb-3 flex-row items-center gap-3">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center active:opacity-70"
        >
          <MaterialIcon name="arrow_back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text className="text-on-surface text-xl font-bold flex-1">
          {receipt.merchant}
        </Text>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="px-4 gap-4">
          <Card variant="low" className="p-4 gap-2">
            <View className="flex-row justify-between">
              <Text className="text-on-surface-variant text-sm">Date</Text>
              <Text className="text-on-surface font-medium">{receipt.date}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-on-surface-variant text-sm">Amount</Text>
              <Text className="text-on-surface font-semibold text-base">
                ${receipt.amount.toFixed(2)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-on-surface-variant text-sm">Category</Text>
              <Text className="text-on-surface font-medium capitalize">
                {receipt.category}
              </Text>
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
