import React from "react";
import { ScrollView, View, Text } from "@/tw";
import { Card } from "@/components/Card";

export default function PlannerScreen() {
  return (
    <View className="flex-1 bg-surface">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 60, paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="px-4 gap-4">
          <Text className="text-on-surface text-2xl font-bold">Planner</Text>
          <Card variant="low" className="p-4 gap-3">
            <Text className="text-on-surface font-medium">
              Who brings what
            </Text>
            <Text className="text-on-surface-variant text-sm">
              Assign items to trip participants here.
            </Text>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
