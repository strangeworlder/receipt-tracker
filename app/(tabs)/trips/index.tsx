import React from "react";
import { ScrollView, View, Text, Pressable } from "@/tw";
import { router } from "expo-router";
import { TopAppBar } from "@/components/TopAppBar";
import { Card } from "@/components/Card";
import { StatusPill } from "@/components/StatusPill";
import { AvatarStack } from "@/components/AvatarStack";
import { useTripStore } from "@/stores/tripStore";

export default function TripsScreen() {
  const trips = useTripStore((s) => s.getAllTrips());

  return (
    <View className="flex-1 bg-surface">
      <TopAppBar />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 120, paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="px-4 gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-on-surface text-2xl font-bold">Trips</Text>
            <Pressable
              onPress={() => router.push("/trips/new")}
              className="bg-primary rounded-full px-4 py-2 active:opacity-70"
            >
              <Text className="text-on-primary font-semibold text-sm">
                + New
              </Text>
            </Pressable>
          </View>

          {trips.map((trip) => (
            <Pressable
              key={trip.id}
              onPress={() => router.push(`/(tabs)/trips/${trip.id}`)}
              className="active:opacity-80"
            >
              <Card variant="low" className="p-4 gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-on-surface font-semibold text-base flex-1 mr-2">
                    {trip.name}
                  </Text>
                  <StatusPill label="Active" variant="primary" />
                </View>
                <Text className="text-on-surface-variant text-sm">
                  {trip.startDate} – {trip.endDate}
                </Text>
                <View className="flex-row items-center justify-between">
                  <AvatarStack
                    avatars={trip.participants.map((p) => ({
                      name: p.name,
                      uri: p.avatarUri,
                    }))}
                    size={28}
                  />
                  <Text className="text-on-surface font-semibold text-base">
                    ${trip.totalSpend.toFixed(2)}
                  </Text>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
