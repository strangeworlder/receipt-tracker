import React, { useCallback, useState } from "react";
import { RefreshControl, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { View, Text, ScrollView, Pressable } from "@/tw";
import { TopAppBar } from "@/components/TopAppBar";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useDashboardData } from "@/hooks/useDashboardData";
import { colors } from "@/theme/colors";
import { formatCurrency, formatDate, daysUntil } from "@/utils/format";

const RECEIPT_ICONS: Record<string, string> = {
  food: "local_cafe",
  travel: "flight",
  warranty: "verified_user",
  utility: "bolt",
  shopping: "shopping_bag",
  other: "receipt_long",
};

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [refreshing, setRefreshing] = useState(false);

  const {
    totalMonthlySpend,
    spendChangePercent,
    budgetUtilization,
    categoryBreakdown,
    expiringWarranty,
    recentScans,
  } = useDashboardData();

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Stores update reactively; a brief delay satisfies the pull-to-refresh UX
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const cardWidth = isTablet
    ? (width - 48 - 16) / 2
    : (width - 48 - 16) / 2;

  return (
    <View className="flex-1 bg-surface">
      <TopAppBar userName="Petri" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 108, paddingBottom: 120, paddingHorizontal: 24, gap: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero: Total Spending ── */}
        <Animated.View entering={FadeInDown.delay(0).duration(400).springify()}>
          <HeroSection
            totalMonthlySpend={totalMonthlySpend}
            spendChangePercent={spendChangePercent}
            budgetUtilization={budgetUtilization}
          />
        </Animated.View>

        {/* ── Category Bento Grid ── */}
        {categoryBreakdown.length > 0 && (
          <Animated.View entering={FadeInDown.delay(80).duration(400).springify()}>
            <BentoGrid items={categoryBreakdown} cardWidth={cardWidth} />
          </Animated.View>
        )}

        {/* ── Expiring Warranty Alert ── */}
        {expiringWarranty && (
          <Animated.View entering={FadeInDown.delay(160).duration(400).springify()}>
            <WarrantyAlert
              productName={expiringWarranty.productName}
              expirationDate={expiringWarranty.expirationDate}
            />
          </Animated.View>
        )}

        {/* ── Recent Scans ── */}
        {recentScans.length > 0 && (
          <Animated.View entering={FadeInDown.delay(240).duration(400).springify()}>
            <RecentScansSection scans={recentScans} />
          </Animated.View>
        )}
      </ScrollView>

      {/* ── FAB ── */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scan receipt"
        onPress={() => router.push("/scanner")}
        className="active:scale-95"
        style={{
          position: "absolute",
          right: 24,
          bottom: 112,
          width: 64,
          height: 64,
          borderRadius: 20,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 6px 12px ${colors.primary}4d`,
          borderCurve: "continuous",
        }}
      >
        <MaterialIcon name="photo_camera" size={30} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

// ─── Hero Section ────────────────────────────────────────────────────────────

interface HeroSectionProps {
  totalMonthlySpend: number;
  spendChangePercent: number;
  budgetUtilization: number;
}

function HeroSection({ totalMonthlySpend, spendChangePercent, budgetUtilization }: HeroSectionProps) {
  const isPositive = spendChangePercent >= 0;

  return (
    <View className="gap-3">
      <Text className="text-on-surface-variant font-medium text-sm">
        Total spending this month
      </Text>

      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
        <Text className="text-primary font-extrabold tracking-tight" style={{ fontSize: 44, lineHeight: 50 }}>
          {formatCurrency(totalMonthlySpend)}
        </Text>
        {spendChangePercent !== 0 && (
          <View
            className="rounded-full px-3 py-1"
            style={{ backgroundColor: colors.primary }}
          >
            <Text style={{ color: colors.onPrimary, fontSize: 12, fontWeight: "700" }}>
              {isPositive ? "+" : ""}
              {spendChangePercent}%
            </Text>
          </View>
        )}
      </View>

      <View
        className="rounded-full overflow-hidden"
        style={{ height: 6, backgroundColor: colors.surfaceContainerHigh, marginTop: 4 }}
      >
        <View
          style={{
            height: "100%",
            width: `${Math.round(budgetUtilization * 100)}%`,
            backgroundColor: colors.primary,
            borderRadius: 9999,
          }}
        />
      </View>
      <Text className="text-on-surface-variant text-xs">
        {Math.round(budgetUtilization * 100)}% of monthly budget
      </Text>
    </View>
  );
}

// ─── Bento Grid ──────────────────────────────────────────────────────────────

interface CategoryCard {
  category: string;
  icon: string;
  amount: number;
  highlighted: boolean;
}

interface BentoGridProps {
  items: CategoryCard[];
  cardWidth: number;
}

function BentoGrid({ items, cardWidth }: BentoGridProps) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
      {items.map((item) => (
        <View
          key={item.category}
          style={{
            width: cardWidth,
            height: 132,
            padding: 20,
            borderRadius: 20,
            borderCurve: "continuous",
            justifyContent: "space-between",
            backgroundColor: item.highlighted ? colors.primary : colors.surfaceContainerLow,
            borderWidth: item.highlighted ? 0 : 1,
            borderColor: "rgba(114, 121, 111, 0.1)",
            boxShadow: item.highlighted ? `0 4px 12px ${colors.primary}33` : "none",
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <MaterialIcon
              name={item.icon}
              size={22}
              color={item.highlighted ? colors.onPrimary : colors.onSurface}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "500",
                color: item.highlighted ? colors.onPrimary : colors.onSurfaceVariant,
              }}
            >
              {item.category}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "800",
              color: item.highlighted ? colors.onPrimary : colors.onSurface,
            }}
          >
            {formatCurrency(item.amount)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Warranty Alert ──────────────────────────────────────────────────────────

interface WarrantyAlertProps {
  productName: string;
  expirationDate: string;
}

function WarrantyAlert({ productName, expirationDate }: WarrantyAlertProps) {
  const days = daysUntil(expirationDate);

  return (
    <View
      style={{
        backgroundColor: colors.errorContainer,
        padding: 20,
        borderRadius: 20,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: "rgba(186, 26, 26, 0.1)",
        overflow: "hidden",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Left content */}
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MaterialIcon name="notification_important" size={20} color={colors.error} />
          <Text
            style={{ fontSize: 16, fontWeight: "700", color: colors.onErrorContainer }}
          >
            Expiring Soon
          </Text>
        </View>
        <Text
          style={{ fontSize: 13, fontWeight: "500", color: colors.onErrorContainer, opacity: 0.85 }}
          numberOfLines={2}
        >
          {productName} ends in {days} day{days !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Renew button */}
      <Pressable
        onPress={() => router.push("/(tabs)/warranty")}
        className="active:opacity-80"
        style={{
          backgroundColor: colors.error,
          paddingHorizontal: 20,
          paddingVertical: 10,
          borderRadius: 9999,
          marginLeft: 12,
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.15)",
        }}
      >
        <Text style={{ color: colors.onError, fontSize: 12, fontWeight: "700" }}>
          Renew
        </Text>
      </Pressable>

      {/* Decorative circle */}
      <View
        style={{
          position: "absolute",
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: "rgba(186, 26, 26, 0.05)",
          right: -32,
          bottom: -32,
        }}
      />
    </View>
  );
}

// ─── Recent Scans ────────────────────────────────────────────────────────────

interface Scan {
  id: string;
  merchant: string;
  date: string;
  amount: number;
  category: string;
}

interface RecentScansSectionProps {
  scans: Scan[];
}

function RecentScansSection({ scans }: RecentScansSectionProps) {
  return (
    <View style={{ gap: 12 }}>
      {/* Section header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text className="text-on-surface font-extrabold text-xl">
          Recent Scans
        </Text>
        <Pressable
          onPress={() => router.push("/(tabs)/scans")}
          className="active:opacity-70"
        >
          <Text className="text-primary font-bold text-sm">View All</Text>
        </Pressable>
      </View>

      {/* Scan rows */}
      {scans.map((scan) => (
        <ScanRow key={scan.id} scan={scan} />
      ))}
    </View>
  );
}

function ScanRow({ scan }: { scan: Scan }) {
  return (
    <Pressable
      onPress={() => router.push(`/receipts/${scan.id}` as `${string}`)}
      className="active:opacity-70"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 16,
        backgroundColor: colors.surfaceContainerLowest,
        borderRadius: 20,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: "rgba(114, 121, 111, 0.05)",
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.05)",
      }}
    >
      {/* Icon container */}
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          borderCurve: "continuous",
          backgroundColor: colors.primaryContainer,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcon
          name={RECEIPT_ICONS[scan.category] ?? "receipt_long"}
          size={22}
          color={colors.primary}
        />
      </View>

      {/* Text info */}
      <View style={{ flex: 1, gap: 2 }}>
        <Text className="text-on-surface font-extrabold text-sm" numberOfLines={1}>
          {scan.merchant}
        </Text>
        <Text className="text-on-surface-variant text-xs">
          {formatDate(scan.date)}
        </Text>
      </View>

      {/* Amount */}
      <Text className="text-on-surface font-extrabold text-sm">
        {formatCurrency(scan.amount)}
      </Text>
    </Pressable>
  );
}
