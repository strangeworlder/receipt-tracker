import React from "react";
import { ScrollView, View, Text } from "@/tw";
import { useLocalSearchParams } from "expo-router";
import { Card } from "@/components/Card";

export default function CarpoolDetailScreen() {
  const { carpoolId } = useLocalSearchParams<{ carpoolId: string }>();

  return (
    <View className="flex-1 bg-surface">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 60, paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="px-4 gap-4">
          <Text className="text-on-surface text-2xl font-bold">Carpool</Text>
          <Card variant="low" className="p-4">
            <Text className="text-on-surface-variant text-sm">
              Carpool ID: {carpoolId}
            </Text>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
