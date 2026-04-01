import React from "react";
import { StyleSheet, ActivityIndicator } from "react-native";
import { ScrollView, View, Text, Pressable } from "@/tw";
import { router } from "expo-router";
import { TopAppBar } from "@/components/TopAppBar";
import { Card } from "@/components/Card";
import { AvatarStack } from "@/components/AvatarStack";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useTripStore } from "@/stores/tripStore";
import { formatCurrency, formatDate } from "@/utils/format";
import { colors } from "@/theme/colors";

// ─── Trip Card ────────────────────────────────────────────────────────────────

function TripCard({ trip }: { trip: ReturnType<typeof useTripStore.getState>["trips"][string] }) {
  const startDate = formatDate(trip.startDate);
  const endDate = formatDate(trip.endDate);
  const nights = Math.max(
    0,
    Math.ceil(
      (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  return (
    <Pressable
      onPress={() => router.push(`/(tabs)/trips/${trip.id}` as any)}
      className="active:opacity-80"
    >
      <Card variant="low" rounded="2xl" bordered className="p-5 gap-3">
        {/* Header row */}
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 gap-0.5">
            <Text
              className="text-lg font-bold text-on-surface"
              numberOfLines={1}
            >
              {trip.name}
            </Text>
            <Text className="text-sm text-on-surface-variant">
              {startDate} – {endDate}
            </Text>
          </View>
          {trip._pendingWrite && (
            <ActivityIndicator size="small" color={colors.primary} />
          )}
        </View>

        {/* Duration pills */}
        <View className="flex-row gap-2">
          <View
            className="bg-secondary-container rounded-full px-3 py-1 flex-row items-center gap-1"
            style={{ borderCurve: "continuous" }}
          >
            <MaterialIcon name="group" size={12} color={colors.onSecondaryContainer} />
            <Text className="text-xs font-semibold text-on-secondary-container">
              {trip.participants.length} traveler{trip.participants.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <View
            className="bg-primary-container rounded-full px-3 py-1 flex-row items-center gap-1"
            style={{ borderCurve: "continuous" }}
          >
            <MaterialIcon name="calendar_today" size={12} color={colors.onPrimaryContainer} />
            <Text className="text-xs font-semibold text-on-primary-container">
              {nights} night{nights !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        {/* Bottom row: avatars + spend */}
        <View className="flex-row items-center justify-between">
          <AvatarStack
            avatars={trip.participants.map((p) => ({ name: p.name, uri: p.avatarUri }))}
            maxVisible={4}
            size={28}
          />
          <Text className="text-base font-bold text-primary">
            {formatCurrency(trip.totalPot)}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View className="items-center gap-4 pt-16 px-8">
      <View
        className="w-20 h-20 bg-surface-container rounded-full items-center justify-center"
        style={{ borderCurve: "continuous" }}
      >
        <MaterialIcon name="folder_shared" size={40} color={colors.onSurfaceVariant} />
      </View>
      <View className="items-center gap-2">
        <Text className="text-on-surface font-semibold text-xl">No Trips Yet</Text>
        <Text className="text-on-surface-variant text-sm text-center">
          Create a trip to start splitting expenses with friends
        </Text>
      </View>
      <Pressable
        onPress={() => router.push("/trips/new" as any)}
        className="bg-primary rounded-full px-8 py-3 active:opacity-80"
        style={{ borderCurve: "continuous" }}
      >
        <Text className="text-on-primary font-bold text-sm">Create First Trip</Text>
      </Pressable>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TripsScreen() {
  const getAllTrips = useTripStore((s) => s.getAllTrips);
  const trips = getAllTrips().sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  return (
    <View className="flex-1 bg-surface">
      <TopAppBar />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 120, paddingBottom: 120 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Page header */}
        <View className="px-4 mb-4 gap-1">
          <Text className="text-4xl font-extrabold text-on-surface">My Trips</Text>
          <Text className="text-sm text-on-surface-variant">
            Shared adventures, settled together.
          </Text>
        </View>

        {/* Content */}
        <View className="px-4 gap-3">
          {trips.length === 0 ? (
            <EmptyState />
          ) : (
            trips.map((trip) => <TripCard key={trip.id} trip={trip} />)
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={() => router.push("/trips/new" as any)}
        style={[styles.fab, { boxShadow: "0 4px 12px rgba(2, 186, 65, 0.4)" } as any]}
        className="bg-primary rounded-full w-14 h-14 items-center justify-center active:opacity-80"
      >
        <MaterialIcon name="add" size={28} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
  },
});
