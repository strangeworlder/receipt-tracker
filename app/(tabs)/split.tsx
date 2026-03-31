import React from "react";
import { ScrollView, View, Text } from "@/tw";
import { TopAppBar } from "@/components/TopAppBar";
import { Card } from "@/components/Card";
import { PrimaryButton } from "@/components/PrimaryButton";

export default function SplitScreen() {
  return (
    <View className="flex-1 bg-surface">
      <TopAppBar />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 120, paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="px-4 gap-4">
          <Text className="text-on-surface text-2xl font-bold">Split</Text>
          <Card variant="low" className="p-4 gap-3 items-center">
            <Text className="text-on-surface font-medium text-base text-center">
              Split expenses with your group
            </Text>
            <Text className="text-on-surface-variant text-sm text-center">
              Select a trip or create a custom split to get started.
            </Text>
            <PrimaryButton
              label="New Split"
              onPress={() => {}}
              className="w-full mt-2"
            />
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
