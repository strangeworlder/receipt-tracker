import React from "react";
import { ScrollView, View, Text } from "@/tw";
import { Card } from "@/components/Card";
import { StatusPill } from "@/components/StatusPill";

export default function SettlementScreen() {
  return (
    <View className="flex-1 bg-surface">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 60, paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="px-4 gap-4">
          <Text className="text-on-surface text-2xl font-bold">Settlement</Text>
          <Card variant="low" className="p-4 gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-on-surface font-medium">Bob → Alice</Text>
              <StatusPill label="$85.00" variant="neutral" />
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-on-surface font-medium">Carol → Alice</Text>
              <StatusPill label="$170.00" variant="neutral" />
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
