import React, { useEffect } from "react";
import { StyleSheet, Share, useWindowDimensions } from "react-native";
import { ScrollView, View, Text, Pressable } from "@/tw";
import { useLocalSearchParams, router } from "expo-router";
import { useTripStore } from "@/stores/tripStore";
import { useSplitStore } from "@/stores/splitStore";
import { startTripSync, stopTripSync } from "@/services/syncService";
import { Card } from "@/components/Card";
import { MaterialIcon } from "@/components/MaterialIcon";
import { AvatarStack } from "@/components/AvatarStack";
import { StatusPill } from "@/components/StatusPill";
import { formatCurrency, formatDate } from "@/utils/format";
import { colors } from "@/theme/colors";

// ─── Hero Section (A1) ────────────────────────────────────────────────────────

function HeroSection({ trip }: { trip: NonNullable<ReturnType<typeof useTripStore.getState>["trips"][string]> }) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const nights = Math.max(
    0,
    Math.ceil(
      (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  return (
    <View className="px-4 pt-6 pb-4 gap-3">
      <Text className="text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">
        {trip.name}
      </Text>
      <Text
        className="font-extrabold tracking-tighter text-on-surface"
        style={{ fontSize: isTablet ? 64 : 48 }}
      >
        {formatCurrency(trip.totalPot)}
      </Text>
      {/* Info pills */}
      <View className="flex-row gap-2 flex-wrap">
        <View
          className="bg-secondary-container rounded-full px-4 py-2 flex-row items-center gap-1.5"
          style={{ borderCurve: "continuous" }}
        >
          <MaterialIcon name="group" size={14} color={colors.onSecondaryContainer} />
          <Text className="text-xs font-bold text-on-secondary-container">
            {trip.participants.length} Traveler{trip.participants.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View
          className="bg-primary-container rounded-full px-4 py-2 flex-row items-center gap-1.5"
          style={{ borderCurve: "continuous" }}
        >
          <MaterialIcon name="calendar_today" size={14} color={colors.onPrimaryContainer} />
          <Text className="text-xs font-bold text-on-primary-container">
            {nights} Day{nights !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Active Carpools (A2) ─────────────────────────────────────────────────────

function CarpoolsSection({ tripId }: { tripId: string }) {
  const carpools = useTripStore((s) => s.getCarpools(tripId));

  if (carpools.length === 0) return null;

  return (
    <View className="gap-3">
      <View className="px-4 flex-row items-center justify-between">
        <Text className="text-base font-bold text-on-surface">Active Carpools</Text>
        <Text className="text-sm font-semibold text-primary">View All</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {carpools.map((carpool) => (
          <Pressable
            key={carpool.id}
            onPress={() => router.push(`/(tabs)/trips/carpool/${carpool.id}` as any)}
            className="active:opacity-80"
          >
            <View
              className="bg-surface-container-lowest border border-outline/10 rounded-2xl p-5"
              style={[
                styles.carpoolCard,
                { borderCurve: "continuous", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" } as any,
              ]}
            >
              <View className="flex-row items-center gap-2 mb-3">
                <MaterialIcon name="directions_car" size={16} color={colors.primary} />
                <Text className="text-xs font-bold uppercase tracking-widest text-primary">
                  Carpool
                </Text>
              </View>
              <Text className="text-base font-bold text-on-surface mb-1" numberOfLines={1}>
                {carpool.name}
              </Text>
              <Text className="text-sm text-on-surface-variant mb-3" numberOfLines={1}>
                {carpool.route}
              </Text>
              {/* Stats row */}
              <View className="flex-row gap-4">
                <View className="gap-0.5">
                  <Text className="text-xs text-on-surface-variant">Miles</Text>
                  <Text className="text-sm font-bold text-on-surface">{carpool.distance}</Text>
                </View>
                <View className="gap-0.5">
                  <Text className="text-xs text-on-surface-variant">Cost</Text>
                  <Text className="text-sm font-bold text-on-surface">
                    {formatCurrency(carpool.fuelCost)}
                  </Text>
                </View>
                <View className="gap-0.5">
                  <Text className="text-xs text-on-surface-variant">Passengers</Text>
                  <AvatarStack
                    avatars={carpool.passengers.map((p) => ({ name: p.participantId }))}
                    maxVisible={3}
                    size={20}
                  />
                </View>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Eco Impact Card (A3) ─────────────────────────────────────────────────────

function EcoImpactCard() {
  return (
    <View className="mx-4">
      <View
        className="bg-primary rounded-2xl p-6 overflow-hidden"
        style={{ borderCurve: "continuous", boxShadow: "0 4px 16px rgba(2,186,65,0.2)" } as any}
      >
        {/* Decorative icon */}
        <View style={styles.ecoDecorIcon}>
          <MaterialIcon name="eco" size={80} color={colors.onPrimary} />
        </View>
        <Text className="text-xs font-extrabold uppercase tracking-widest text-on-primary/70 mb-2">
          Eco Impact
        </Text>
        <Text className="text-2xl font-extrabold text-on-primary mb-4">
          Saved 1.2 Tons CO₂
        </Text>
        {/* Progress bar */}
        <View className="rounded-full overflow-hidden mb-2" style={{ height: 6, backgroundColor: "rgba(255,255,255,0.2)", borderCurve: "continuous" } as any}>
          <View
            className="rounded-full"
            style={{ width: "42%", height: 6, backgroundColor: colors.onPrimary }}
          />
        </View>
        <Text className="text-xs text-on-primary/80">
          Carpooling reduced fuel costs by 42%.
        </Text>
      </View>
    </View>
  );
}

// ─── Recent Receipts / Expenses (A4) ─────────────────────────────────────────

function RecentExpensesSection({ tripId }: { tripId: string }) {
  const expenses = useTripStore((s) => s.getExpenses(tripId)).slice(0, 5);

  if (expenses.length === 0) return null;

  return (
    <View className="gap-3">
      <View className="px-4 flex-row items-center justify-between">
        <Text className="text-base font-bold text-on-surface">Recent Receipts</Text>
      </View>
      <View className="mx-4 bg-surface-container-low rounded-2xl border border-outline/10 overflow-hidden" style={{ borderCurve: "continuous" }}>
        {expenses.map((expense, i) => (
          <View key={expense.id}>
            <View className="px-4 py-3 flex-row items-center gap-3">
              <View
                className="w-9 h-9 bg-primary-container rounded-lg items-center justify-center"
                style={{ borderCurve: "continuous" }}
              >
                <MaterialIcon name="receipt_long" size={18} color={colors.primary} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-semibold text-on-surface" numberOfLines={1}>
                  {expense.description}
                </Text>
                <Text className="text-xs text-on-surface-variant">
                  Paid by {expense.paidBy} · Shared by {expense.splitAmong.length}
                </Text>
              </View>
              <Text className="text-sm font-bold text-on-surface">
                {formatCurrency(expense.amount)}
              </Text>
            </View>
            {i < expenses.length - 1 && (
              <View className="mx-4 border-t border-outline/10" />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Settlement Summary (A5) ──────────────────────────────────────────────────

function SettlementSummarySection({ tripId }: { tripId: string }) {
  const trip = useTripStore((s) => s.getTrip(tripId));
  if (!trip || trip.participants.length < 2) return null;

  const navigateToSettlement = () =>
    router.push({ pathname: "/(tabs)/trips/settlement", params: { tripId } } as any);

  return (
    <View className="px-4 gap-3">
      <Text className="text-base font-bold text-on-surface">Settlements</Text>
      <View className="flex-row gap-3">
        {/* You owe */}
        <Pressable onPress={navigateToSettlement} className="flex-1 active:opacity-80">
          <View
            className="bg-surface-container-low rounded-2xl p-4 gap-2"
            style={{ borderLeftWidth: 4, borderLeftColor: colors.error, borderCurve: "continuous" } as any}
          >
            <Text className="text-xs font-bold uppercase tracking-wide text-error">You Owe</Text>
            <Text className="text-base font-bold text-on-surface">{formatCurrency(0)}</Text>
            <Text className="text-xs text-on-surface-variant">Tap to settle up</Text>
          </View>
        </Pressable>
        {/* Owed to you */}
        <Pressable onPress={navigateToSettlement} className="flex-1 active:opacity-80">
          <View
            className="bg-surface-container-low rounded-2xl p-4 gap-2"
            style={{ borderLeftWidth: 4, borderLeftColor: colors.primary, borderCurve: "continuous" } as any}
          >
            <Text className="text-xs font-bold uppercase tracking-wide text-primary">Owed to You</Text>
            <Text className="text-base font-bold text-on-surface">{formatCurrency(0)}</Text>
            <Text className="text-xs text-on-surface-variant">Tap to remind</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const trip = useTripStore((s) => s.getTrip(tripId));

  useEffect(() => {
    if (!tripId) return;
    startTripSync(tripId);
    // Seed the Split tab with this trip's participants
    const t = useTripStore.getState().getTrip(tripId);
    if (t) useSplitStore.getState().loadFromTrip(t.participants);
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
      {/* Navigation header */}
      <View className="px-4 pt-14 pb-2 flex-row items-center gap-2">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center active:opacity-70"
        >
          <MaterialIcon name="arrow_back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text className="text-on-surface font-bold text-base flex-1" numberOfLines={1}>
          {trip.name}
        </Text>
        {trip._pendingWrite && (
          <MaterialIcon name="sync" size={20} color={colors.onSurfaceVariant} />
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <HeroSection trip={trip} />
        <View className="gap-6">
          <CarpoolsSection tripId={tripId} />
          <EcoImpactCard />
          <RecentExpensesSection tripId={tripId} />
          <SettlementSummarySection tripId={tripId} />
        </View>
      </ScrollView>

      {/* FAB — Add Carpool */}
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/trips/carpool-new",
            params: { tripId },
          } as any)
        }
        style={[styles.fab, { boxShadow: "0 4px 12px rgba(2, 186, 65, 0.4)" } as any]}
        className="bg-primary rounded-2xl w-14 h-14 items-center justify-center active:opacity-80"
      >
        <MaterialIcon name="add_road" size={24} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  carpoolCard: {
    width: 280,
    minHeight: 176,
  },
  ecoDecorIcon: {
    position: "absolute",
    bottom: -16,
    right: -16,
    opacity: 0.12,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
  },
});
