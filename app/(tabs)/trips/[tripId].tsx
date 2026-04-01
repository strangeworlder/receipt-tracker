import React, { useEffect } from "react";
import { ScrollView, View, Text, Pressable } from "@/tw";
import { useLocalSearchParams, router } from "expo-router";
import { useTripStore } from "@/stores/tripStore";
import { startTripSync, stopTripSync } from "@/services/syncService";
import { Card } from "@/components/Card";
import { MaterialIcon } from "@/components/MaterialIcon";
import { colors } from "@/theme/colors";

export default function TripDetailScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const trip = useTripStore((s) => s.getTrip(tripId));

  useEffect(() => {
    if (!tripId) return;
    startTripSync(tripId);
    return () => stopTripSync(tripId);
  }, [tripId]);

  if (!trip) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <Text className="text-on-surface-variant">Trip not found.</Text>
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
          {trip.name}
        </Text>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="px-4 gap-4">
          <Card variant="low" className="p-4 gap-2">
            <Text className="text-on-surface-variant text-xs font-medium uppercase tracking-wide">
              Dates
            </Text>
            <Text className="text-on-surface font-medium">
              {trip.startDate} – {trip.endDate}
            </Text>
          </Card>

          <Card variant="low" className="p-4 gap-3">
            <Text className="text-on-surface font-semibold text-base">
              Participants ({trip.participants.length})
            </Text>
            {trip.participants.map((p) => (
              <View key={p.id} className="flex-row items-center justify-between">
                <Text className="text-on-surface font-medium">{p.name}</Text>
                <Text className="text-on-surface-variant text-sm">
                  Paid ${p.amountPaid.toFixed(2)}
                </Text>
              </View>
            ))}
          </Card>

          <Card variant="primary" className="p-4 gap-2">
            <Text className="text-on-primary-container font-semibold text-base">
              Total Spend
            </Text>
            <Text className="text-on-primary-container text-3xl font-bold">
              ${trip.totalSpend.toFixed(2)}
            </Text>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
