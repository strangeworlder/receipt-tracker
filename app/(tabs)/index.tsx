import React from "react";
import { ScrollView, View, Text } from "@/tw";
import { TopAppBar } from "@/components/TopAppBar";
import { Card } from "@/components/Card";
import { StatusPill } from "@/components/StatusPill";

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-surface">
      <TopAppBar userName="Petri" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 120, paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="px-4 gap-4">
          <View className="gap-1">
            <Text className="text-on-surface-variant text-sm font-medium">
              Good morning
            </Text>
            <Text className="text-on-surface text-2xl font-bold">
              Overview
            </Text>
          </View>

          <Card variant="low" className="p-4 gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-on-surface font-semibold text-base">
                Recent Scans
              </Text>
              <StatusPill label="4 Items" variant="primary" />
            </View>
            <Text className="text-on-surface-variant text-sm">
              Your receipts will appear here once scanned.
            </Text>
          </Card>

          <Card variant="low" className="p-4 gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-on-surface font-semibold text-base">
                Active Trips
              </Text>
              <StatusPill label="1 Trip" variant="secondary" />
            </View>
            <Text className="text-on-surface-variant text-sm">
              Barcelona Summer 2026 · Jul 10–20
            </Text>
          </Card>

          <Card variant="primary" className="p-4 gap-3">
            <Text className="text-on-primary-container font-semibold text-base">
              Warranties Expiring
            </Text>
            <Text className="text-on-primary-container/70 text-sm">
              No warranties expiring soon.
            </Text>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
