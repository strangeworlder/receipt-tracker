import React from "react";
import { StyleSheet, Alert, Share } from "react-native";
import { ScrollView, View, Text, Pressable } from "@/tw";
import { useLocalSearchParams, router } from "expo-router";
import { BlurView } from "expo-blur";
import { useTripStore } from "@/stores/tripStore";
import { useAuthStore } from "@/stores/authStore";
import { optimizeSettlements } from "@/services/settlementService";
import { sendReminder } from "@/services/tripService";
import { MaterialIcon } from "@/components/MaterialIcon";
import { StatusPill } from "@/components/StatusPill";
import { formatCurrency } from "@/utils/format";
import { colors } from "@/theme/colors";

// ─── BlurView with web fallback ───────────────────────────────────────────────

function FrostedView({
  children,
  style,
  className,
}: {
  children: React.ReactNode;
  style?: any;
  className?: string;
}) {
  if (process.env.EXPO_OS === "web") {
    return (
      <View
        className={className}
        style={[{ backgroundColor: "rgba(255,255,255,0.2)" }, style]}
      >
        {children}
      </View>
    );
  }
  return (
    <BlurView intensity={20} tint="light" style={style}>
      <View className={className}>{children}</View>
    </BlurView>
  );
}

// ─── Hero Section (C1) ────────────────────────────────────────────────────────

function HeroSection({ tripName, nights }: { tripName: string; nights: number }) {
  return (
    <View className="px-4 pt-6 pb-4 gap-2">
      <Text className="text-xs text-on-surface-variant">
        Trips &gt; {tripName}
      </Text>
      <Text className="text-4xl font-extrabold text-on-surface">Settlement</Text>
      <Text className="text-sm text-on-surface-variant">
        Finalizing the books for your {nights}-day journey.
      </Text>
      {/* Status pill with pulsing dot */}
      <View className="flex-row items-center gap-2 self-start">
        <View className="w-2 h-2 bg-primary rounded-full" />
        <Text className="text-xs font-bold text-primary">Settlement Active</Text>
      </View>
    </View>
  );
}

// ─── Trip Pot Summary (C2) ────────────────────────────────────────────────────

function TripPotCard({ trip }: { trip: any }) {
  const categories = Object.entries(trip.categoryBreakdown ?? {});

  return (
    <View className="mx-4">
      <View
        className="bg-surface-container-low border border-outline/10 rounded-2xl p-6 gap-4"
        style={{ borderCurve: "continuous" }}
      >
        <View className="flex-row items-center justify-between">
          <View className="gap-1">
            <Text className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Total Trip Pot
            </Text>
            <Text className="text-3xl font-extrabold text-primary">
              {formatCurrency(trip.totalPot)}
            </Text>
          </View>
          <MaterialIcon name="receipt_long" size={28} color={colors.primary} />
        </View>

        {categories.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {categories.map(([cat, amt]) => (
              <View
                key={cat}
                className="bg-surface-container-lowest rounded-lg border border-outline/10 p-3 flex-1"
                style={{ minWidth: 72, borderCurve: "continuous" }}
              >
                <Text className="text-xs text-on-surface-variant capitalize">{cat}</Text>
                <Text className="text-sm font-bold text-on-surface">
                  {formatCurrency(amt as number)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Your Share Card (C3) ─────────────────────────────────────────────────────

function YourShareCard({ trip, currentUid }: { trip: any; currentUid: string | undefined }) {
  const me = trip.participants.find((p: any) => p.uid === currentUid);
  if (!me) return null;

  const netAmount = me.amountPaid - me.amountOwed;
  const isRefund = netAmount >= 0;

  return (
    <View className="mx-4">
      <View
        className="bg-primary rounded-2xl p-6 gap-4 overflow-hidden"
        style={{ borderCurve: "continuous", boxShadow: "0 8px 24px rgba(2,186,65,0.25)" } as any}
      >
        <View className="gap-1">
          <Text className="text-xs font-bold uppercase tracking-widest text-on-primary/70">
            Your Personal Share
          </Text>
          <Text className="text-4xl font-extrabold text-on-primary">
            {formatCurrency(me.amountOwed)}
          </Text>
        </View>

        {/* Frosted glass detail section */}
        <FrostedView
          className="rounded-xl p-4 gap-2"
          style={{ borderRadius: 12, overflow: "hidden" }}
        >
          <View className="flex-row justify-between">
            <Text style={{ color: colors.onPrimary, fontSize: 13 }}>Paid by You</Text>
            <Text style={{ color: colors.onPrimary, fontSize: 13, fontFamily: "Lexend_700Bold" }}>
              {formatCurrency(me.amountPaid)}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text style={{ color: colors.onPrimary, fontSize: 13 }}>
              {isRefund ? "Net Refund" : "Net Owed"}
            </Text>
            <Text style={{ color: colors.onPrimary, fontSize: 13, fontFamily: "Lexend_700Bold" }}>
              {isRefund ? "+" : "-"}{formatCurrency(Math.abs(netAmount))}
            </Text>
          </View>
        </FrostedView>
      </View>
    </View>
  );
}

// ─── Optimized Transactions (C4) ──────────────────────────────────────────────

function TransactionsSection({ trip, currentUid }: { trip: any; currentUid: string | undefined }) {
  const transactions = optimizeSettlements(trip.participants, trip.id);

  const handleRemindAppUser = async (toParticipantId: string) => {
    await sendReminder(trip.id, toParticipantId);
    Alert.alert("Reminder Sent", "The participant will receive a notification.");
  };

  const handleRemindGhost = async (ghost: any) => {
    const msg = `Hey ${ghost.name}, you owe ${trip.name} some money. Please settle up! (Sent via TripTrack)`;
    await Share.share({ message: msg });
  };

  return (
    <View className="px-4 gap-3">
      <View className="border-l-4 border-primary pl-4 gap-1">
        <Text className="text-base font-bold text-on-surface">Optimization Logic</Text>
        <Text className="text-xs text-on-surface-variant">
          Our algorithm reduced potential debts into {transactions.length} direct transfer
          {transactions.length !== 1 ? "s" : ""}.
        </Text>
      </View>
      <View
        className="bg-primary-container rounded-full px-4 py-2 self-start"
        style={{ borderCurve: "continuous" }}
      >
        <Text className="text-xs font-bold text-on-primary-container">
          {transactions.length} Transaction{transactions.length !== 1 ? "s" : ""} Needed
        </Text>
      </View>

      <View className="gap-3">
        {transactions.map((tx) => {
          const from = trip.participants.find((p: any) => p.id === tx.fromParticipantId);
          const to = trip.participants.find((p: any) => p.id === tx.toParticipantId);
          const isIncoming = to?.uid === currentUid;
          const isSettled = tx.status === "settled";
          const isGhost = from?.isGhost;

          return (
            <View
              key={tx.id}
              className="bg-surface-container-low rounded-2xl p-4 gap-3"
              style={{
                borderCurve: "continuous",
                opacity: isSettled ? 0.6 : 1,
                ...(isIncoming && !isSettled
                  ? { borderLeftWidth: 4, borderLeftColor: colors.primary, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }
                  : { borderWidth: 1, borderColor: `${colors.outline}1a` }),
              } as any}
            >
              {/* From → To */}
              <View className="flex-row items-center gap-2 flex-1">
                <Text className="text-sm font-bold text-on-surface" numberOfLines={1}>
                  {from?.name ?? tx.fromParticipantId}
                </Text>
                <MaterialIcon name="arrow_forward" size={16} color={colors.onSurfaceVariant} />
                <Text className="text-sm font-bold text-on-surface flex-1" numberOfLines={1}>
                  {to?.name ?? tx.toParticipantId}
                </Text>
                <Text className="text-sm font-bold text-primary">
                  {formatCurrency(tx.amount)}
                </Text>
              </View>

              {/* Status + action */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <View
                    className={`w-2 h-2 rounded-full ${isSettled ? "bg-primary" : "bg-outline"}`}
                  />
                  <Text className="text-xs text-on-surface-variant capitalize">{tx.status}</Text>
                </View>
                {!isSettled && (
                  <Pressable
                    onPress={() =>
                      isGhost
                        ? handleRemindGhost(from)
                        : handleRemindAppUser(tx.toParticipantId)
                    }
                    className="bg-surface-container-high rounded-lg px-3 py-1.5 active:opacity-70"
                    style={{ borderCurve: "continuous" }}
                  >
                    <Text className="text-xs font-bold text-on-surface">
                      {isIncoming ? "Notify" : "Remind"}
                    </Text>
                  </Pressable>
                )}
                {isSettled && (
                  <MaterialIcon name="check_circle" size={18} color={colors.primary} />
                )}
              </View>
            </View>
          );
        })}

        {transactions.length === 0 && (
          <View className="items-center py-8 gap-2">
            <MaterialIcon name="check_circle" size={40} color={colors.primary} />
            <Text className="text-base font-bold text-on-surface">All Settled!</Text>
            <Text className="text-sm text-on-surface-variant">No outstanding balances.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Individual Balance Sheets (C5) ──────────────────────────────────────────

function BalanceSheetsSection({ trip }: { trip: any }) {
  return (
    <View className="px-4 gap-3">
      <View className="border-l-4 border-primary pl-4">
        <Text className="text-base font-bold text-on-surface">Individual Balance Sheets</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {trip.participants.map((p: any) => {
          const balance = p.amountPaid - p.amountOwed;
          const isPositive = balance >= 0;
          return (
            <View
              key={p.id}
              className="bg-surface-container-low border border-outline/10 rounded-2xl p-4 gap-2"
              style={{ flex: 1, minWidth: 100, borderCurve: "continuous" }}
            >
              {/* Avatar initials */}
              <View
                className="w-10 h-10 bg-primary-container rounded-full items-center justify-center"
                style={{ borderCurve: "continuous" }}
              >
                <Text className="text-sm font-bold text-on-primary-container">
                  {p.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                </Text>
              </View>
              <Text className="text-xs font-bold text-on-surface" numberOfLines={1}>
                {p.name}
              </Text>
              <View className="gap-1">
                <Text className="text-xs text-on-surface-variant">
                  Spent {formatCurrency(p.amountPaid)}
                </Text>
                <Text className="text-xs text-on-surface-variant">
                  Owes {formatCurrency(p.amountOwed)}
                </Text>
                <Text
                  className="text-sm font-bold"
                  style={{ color: isPositive ? colors.primary : colors.error }}
                >
                  {isPositive ? "+" : ""}{formatCurrency(balance)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettlementScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const trip = useTripStore((s) => s.getTrip(tripId));
  const currentUid = useAuthStore((s) => s.user?.uid);

  if (!trip) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <Text className="text-on-surface-variant">Trip not found.</Text>
      </View>
    );
  }

  const nights = Math.max(
    0,
    Math.ceil(
      (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  return (
    <View className="flex-1 bg-surface">
      {/* Navigation */}
      <View className="px-4 pt-14 pb-2 flex-row items-center gap-2">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center active:opacity-70"
        >
          <MaterialIcon name="arrow_back" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 60, gap: 24 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <HeroSection tripName={trip.name} nights={nights} />
        <TripPotCard trip={trip} />
        <YourShareCard trip={trip} currentUid={currentUid} />
        <TransactionsSection trip={trip} currentUid={currentUid} />
        <BalanceSheetsSection trip={trip} />
      </ScrollView>
    </View>
  );
}
