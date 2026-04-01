import React from "react";
import { StyleSheet, Animated } from "react-native";
import { ScrollView, View, Text, Pressable } from "@/tw";
import { useLocalSearchParams, router } from "expo-router";
import { useTripStore } from "@/stores/tripStore";
import { Card } from "@/components/Card";
import { MaterialIcon } from "@/components/MaterialIcon";
import { StatusPill } from "@/components/StatusPill";
import { AvatarStack } from "@/components/AvatarStack";
import { formatCurrency } from "@/utils/format";
import { colors } from "@/theme/colors";

// ─── Stats Bento Grid (B3) ────────────────────────────────────────────────────

function StatsBentoGrid({ carpool }: { carpool: any }) {
  const perPerson =
    carpool.passengers.length > 0 ? carpool.fuelCost / carpool.passengers.length : 0;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16 }}>
      {/* Distance card — 2-col wide */}
      <View
        className="bg-surface-container-low border border-outline/10 rounded-2xl p-5"
        style={[{ flex: 2, minHeight: 160, borderCurve: "continuous" }, styles.cardShadow]}
      >
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Total Distance
          </Text>
          <MaterialIcon name="route" size={18} color={colors.primary} />
        </View>
        <Text className="text-4xl font-extrabold text-on-surface mb-1">
          {carpool.distance}
        </Text>
        <Text className="text-sm text-on-surface-variant">miles</Text>
        <Text className="text-sm text-on-surface-variant mt-2" numberOfLines={1}>
          {carpool.route}
        </Text>
      </View>

      {/* Fuel cost card — 1-col */}
      <View
        className="rounded-2xl p-5"
        style={[
          {
            flex: 1,
            minHeight: 160,
            borderCurve: "continuous",
            experimental_backgroundImage: "linear-gradient(135deg, #02ba41, #026b25)",
          } as any,
          styles.cardShadow,
        ]}
      >
        <Text className="text-xs font-bold uppercase tracking-widest text-on-primary/70 mb-3">
          Fuel Expense
        </Text>
        <Text className="text-2xl font-extrabold text-on-primary mb-3">
          {formatCurrency(carpool.fuelCost)}
        </Text>
        {/* Budget progress bar */}
        <View
          className="rounded-full overflow-hidden"
          style={{ height: 5, backgroundColor: "rgba(255,255,255,0.25)" }}
        >
          <View
            className="rounded-full"
            style={{ width: "60%", height: 5, backgroundColor: colors.onPrimary }}
          />
        </View>
        <Text className="text-xs text-on-primary/70 mt-2">60% of budget</Text>
      </View>

      {/* Per person card — full width */}
      <View
        className="bg-surface-container-low border border-outline/10 rounded-2xl p-5"
        style={[{ width: "100%", borderCurve: "continuous" }, styles.cardShadow]}
      >
        <Text className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">
          Per Person
        </Text>
        <Text className="text-2xl font-bold text-primary">{formatCurrency(perPerson)}</Text>
      </View>
    </View>
  );
}

// ─── Quick Actions (B4) ───────────────────────────────────────────────────────

function QuickActionsRow() {
  const action = (label: string) =>
    () => {};

  return (
    <View className="px-4 flex-row gap-3">
      <Pressable
        onPress={action("toll")}
        className="flex-1 bg-secondary-container rounded-xl py-3 items-center gap-1 active:opacity-80"
        style={{ borderCurve: "continuous" }}
      >
        <MaterialIcon name="toll" size={20} color={colors.secondary} />
        <Text className="text-xs font-bold text-on-secondary-container">Add Toll</Text>
      </Pressable>
      <Pressable
        onPress={action("parking")}
        className="flex-1 bg-secondary-container rounded-xl py-3 items-center gap-1 active:opacity-80"
        style={{ borderCurve: "continuous" }}
      >
        <MaterialIcon name="local_parking" size={20} color={colors.secondary} />
        <Text className="text-xs font-bold text-on-secondary-container">Add Parking</Text>
      </Pressable>
      <Pressable
        onPress={action("sync")}
        className="flex-1 bg-primary rounded-xl py-3 items-center gap-1 active:opacity-80"
        style={{ borderCurve: "continuous" }}
      >
        <MaterialIcon name="sync" size={20} color={colors.onPrimary} />
        <Text className="text-xs font-bold text-on-primary">Sync</Text>
      </Pressable>
    </View>
  );
}

// ─── Passenger Split (B5) ─────────────────────────────────────────────────────

function PassengerSplitSection({ carpool }: { carpool: any }) {
  const perPerson =
    carpool.passengers.length > 0 ? carpool.fuelCost / carpool.passengers.length : 0;

  const roleLabel: Record<string, string> = {
    driver: "Primary Driver",
    navigator: "Navigator",
    passenger: "Passenger",
  };

  return (
    <View className="px-4 gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-bold text-on-surface">Passenger Split</Text>
        <Text className="text-sm font-semibold text-primary">
          Per Person: {formatCurrency(perPerson)}
        </Text>
      </View>
      <View
        className="bg-surface-container-low rounded-2xl border border-outline/10 overflow-hidden"
        style={{ borderCurve: "continuous" }}
      >
        {carpool.passengers.map((passenger: any, i: number) => (
          <View key={passenger.participantId}>
            <View className="px-4 py-4 flex-row items-center gap-3">
              {/* Avatar placeholder */}
              <View
                className="w-12 h-12 bg-primary-container rounded-full items-center justify-center"
                style={{ borderCurve: "continuous" }}
              >
                <MaterialIcon
                  name={passenger.role === "driver" ? "directions_car" : "person"}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-bold text-on-surface">
                  {passenger.participantId}
                </Text>
                <Text className="text-xs text-on-surface-variant">
                  {roleLabel[passenger.role] ?? "Passenger"}
                </Text>
              </View>
              <View className="items-end gap-1">
                <Text className="text-sm font-bold text-on-surface">
                  {formatCurrency(passenger.amountOwed)}
                </Text>
                <StatusPill
                  label={passenger.settled ? "Settled" : "Pending"}
                  variant={passenger.settled ? "primary" : "neutral"}
                />
              </View>
            </View>
            {i < carpool.passengers.length - 1 && (
              <View className="mx-4 border-t border-outline/10" />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Map Preview Placeholder (B6) ─────────────────────────────────────────────

function MapPreviewSection() {
  return (
    <View className="px-4">
      <View
        className="rounded-2xl overflow-hidden border border-outline/10"
        style={{ height: 192, borderCurve: "continuous" }}
      >
        {/* Placeholder background */}
        <View
          className="flex-1"
          style={{
            experimental_backgroundImage:
              "linear-gradient(160deg, #d5e8cf 0%, #bcebf1 100%)",
          } as any}
        />
        {/* Dark gradient overlay */}
        <View
          style={[StyleSheet.absoluteFill, { experimental_backgroundImage: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)" } as any]}
        />
        {/* Bottom text */}
        <View className="absolute bottom-4 left-4 right-4 flex-row items-center justify-between">
          <Text className="text-white font-bold text-sm">Next Stop: Base Camp</Text>
          {/* Live tracking badge */}
          <View className="flex-row items-center gap-1.5 bg-black/40 rounded-full px-3 py-1">
            <View className="w-2 h-2 bg-primary rounded-full" />
            <Text className="text-white text-xs font-bold">Live Tracking</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CarpoolDetailScreen() {
  const { carpoolId } = useLocalSearchParams<{ carpoolId: string }>();

  // Find the carpool across all trips in the store
  const storeState = useTripStore.getState();
  const allCarpools = Object.values(storeState.carpools).flat();
  const carpool = allCarpools.find((c) => c.id === carpoolId);

  // Also find the parent trip for the context label
  const tripId = carpool?.tripId;
  const trip = tripId ? storeState.getTrip(tripId) : undefined;

  return (
    <View className="flex-1 bg-surface">
      {/* B1: Navigation Header */}
      <View className="px-4 pt-14 pb-2 flex-row items-center gap-2">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center active:opacity-70"
        >
          <MaterialIcon name="arrow_back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text className="text-primary font-bold text-base flex-1 text-center">
          Trip Intelligence
        </Text>
        <Pressable className="w-10 h-10 items-center justify-center active:opacity-70">
          <MaterialIcon name="settings" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100, gap: 24 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* B2: Editorial Header */}
        <View className="px-4 pt-4 gap-2">
          {trip && (
            <Text className="text-xs font-extrabold uppercase tracking-widest text-primary">
              {trip.name}
            </Text>
          )}
          <Text className="text-4xl font-extrabold text-on-surface">
            {carpool?.name ?? `Carpool ${carpoolId}`}
          </Text>
          <View
            className="self-start bg-primary-container rounded-lg px-3 py-1.5 flex-row items-center gap-2"
            style={{ borderCurve: "continuous" }}
          >
            <MaterialIcon name="check_circle" size={14} color={colors.primary} />
            <Text className="text-xs font-extrabold uppercase tracking-widest text-on-primary-container">
              Active Voyage
            </Text>
          </View>
        </View>

        {/* B3: Stats Bento */}
        {carpool ? (
          <StatsBentoGrid carpool={carpool} />
        ) : (
          <View className="px-4">
            <Card variant="low" className="p-4">
              <Text className="text-on-surface-variant text-sm">
                Carpool data loading…
              </Text>
            </Card>
          </View>
        )}

        {/* B4: Quick Actions */}
        <QuickActionsRow />

        {/* B5: Passenger Split */}
        {carpool && carpool.passengers.length > 0 && (
          <PassengerSplitSection carpool={carpool} />
        )}

        {/* B6: Map Preview */}
        <MapPreviewSection />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  } as any,
});
