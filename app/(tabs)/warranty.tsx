import React, { useState } from "react";
import { StyleSheet, Alert } from "react-native";
import { ScrollView, View, Text, Pressable } from "@/tw";
import { useRouter } from "expo-router";
import { TopAppBar } from "@/components/TopAppBar";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useWarrantyStore } from "@/stores/warrantyStore";
import { formatDate, daysUntil } from "@/utils/format";
import { colors } from "@/theme/colors";
import type { Warranty } from "@/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

type FilterOption = "all" | "active" | "expired";

// ─── Filter Bar ────────────────────────────────────────────────────────────────

const FILTERS: { label: string; value: FilterOption }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Expired", value: "expired" },
];

function FilterBar({
  selected,
  onSelect,
}: {
  selected: FilterOption;
  onSelect: (f: FilterOption) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      {FILTERS.map((f) => {
        const active = selected === f.value;
        return (
          <Pressable
            key={f.value}
            onPress={() => onSelect(f.value)}
            className={
              active
                ? "bg-primary px-6 py-2.5 rounded-full"
                : "bg-surface-container-high px-6 py-2.5 rounded-full"
            }
            style={{ borderCurve: "continuous" }}
          >
            <Text
              className={
                active
                  ? "text-on-primary text-sm font-bold"
                  : "text-on-surface-variant text-sm font-bold"
              }
            >
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Expiring / Expired Card ───────────────────────────────────────────────────

function ExpiringCard({ warranty }: { warranty: Warranty }) {
  const router = useRouter();
  const status = useWarrantyStore((s) => s.getWarrantyStatus(warranty.id));
  const days = useWarrantyStore((s) => s.getDaysRemaining(warranty.id));

  const isExpired = status === "expired";

  const badgeLabel = isExpired ? "Expired" : "Action Required";
  const badgeBg = isExpired ? styles.badgeMuted : styles.badgeError;
  const bannerBg = isExpired
    ? "bg-surface-container-high"
    : "bg-error-container";
  const bannerIconColor = isExpired ? colors.onSurfaceVariant : colors.error;

  function urgencyText(): string {
    if (isExpired) {
      return `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} ago`;
    }
    if (days <= 7) return `Expiring in ${days} day${days !== 1 ? "s" : ""}`;
    const weeks = Math.ceil(days / 7);
    return `Expiring in ${weeks} week${weeks !== 1 ? "s" : ""}`;
  }

  return (
    <View
      className="bg-surface-container-lowest rounded-xl p-6 border border-outline/10"
      style={[{ overflow: "hidden", borderCurve: "continuous" }, styles.cardShadow]}
    >
      {/* Status badge — absolute top-right */}
      <View style={[styles.badge, badgeBg]}>
        <Text style={styles.badgeText}>{badgeLabel}</Text>
      </View>

      {/* Header */}
      <View className="gap-0.5 mb-4 pr-28">
        <Text className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
          {warranty.manufacturer}
        </Text>
        <Text className="text-2xl font-bold text-on-surface" numberOfLines={2}>
          {warranty.productName}
        </Text>
        <Text className="text-sm text-on-surface-variant">
          Purchased {formatDate(warranty.purchaseDate)}
        </Text>
      </View>

      {/* Warning / expired banner */}
      <View
        className={`${bannerBg} p-4 rounded-lg mb-4`}
        style={[{ flexDirection: "row", gap: 12, alignItems: "flex-start" }, { borderCurve: "continuous" }]}
      >
        <MaterialIcon name="warning" size={20} color={bannerIconColor} />
        <View className="flex-1">
          <Text
            className="font-bold text-sm text-on-surface"
            style={{ color: isExpired ? colors.onSurfaceVariant : colors.onErrorContainer }}
          >
            {urgencyText()}
          </Text>
          <Text
            className="text-xs mt-0.5"
            style={{ color: isExpired ? colors.onSurfaceVariant : colors.onErrorContainer }}
          >
            Coverage {isExpired ? "ended" : "ends"} {formatDate(warranty.expirationDate)}
          </Text>
        </View>
      </View>

      {/* Action row */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => router.push(`/receipts/${warranty.receiptId}` as any)}
          className="flex-1 bg-primary rounded-lg py-3 flex-row items-center justify-center"
          style={[{ gap: 6, borderCurve: "continuous" }, isExpired && { opacity: 0.5 }]}
        >
          <MaterialIcon name="receipt_long" size={16} color={colors.onPrimary} />
          <Text className="text-on-primary text-sm font-bold">View Receipt</Text>
        </Pressable>
        <Pressable
          onPress={() => Alert.alert("Options", "Coming soon.")}
          className="w-12 h-12 bg-surface-container rounded-lg items-center justify-center"
          style={{ borderCurve: "continuous" }}
        >
          <MaterialIcon name="more_vert" size={20} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Healthy Card ─────────────────────────────────────────────────────────────

function HealthyCard({ warranty }: { warranty: Warranty }) {
  const router = useRouter();
  const days = useWarrantyStore((s) => s.getDaysRemaining(warranty.id));

  return (
    <View
      className="bg-surface-container-lowest rounded-xl p-6 border border-outline/10"
      style={[{ borderCurve: "continuous" }, styles.cardShadow]}
    >
      {/* Header row */}
      <View className="flex-row items-start gap-3 mb-4">
        <View
          className="w-12 h-12 bg-primary-container rounded-lg items-center justify-center"
          style={{ borderCurve: "continuous" }}
        >
          <MaterialIcon name="verified_user" size={22} color={colors.primary} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
            {warranty.manufacturer}
          </Text>
          <Text className="text-xl font-bold text-on-surface" numberOfLines={2}>
            {warranty.productName}
          </Text>
          <Text className="text-sm text-on-surface-variant">
            Purchased {formatDate(warranty.purchaseDate)}
          </Text>
        </View>
      </View>

      {/* Healthy status banner */}
      <View
        className="p-4 rounded-lg mb-4"
        style={[
          {
            backgroundColor: `${colors.primary}0d`,
            borderWidth: 1,
            borderColor: `${colors.primary}1a`,
            flexDirection: "row",
            gap: 12,
            alignItems: "flex-start",
            borderCurve: "continuous",
          },
        ]}
      >
        <MaterialIcon name="verified_user" size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="text-primary font-bold text-sm">
            {days} day{days !== 1 ? "s" : ""} left
          </Text>
          <Text className="text-on-surface-variant text-xs mt-0.5">
            Coverage ends {formatDate(warranty.expirationDate)}
          </Text>
        </View>
      </View>

      {/* Action row */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => router.push(`/receipts/${warranty.receiptId}` as any)}
          className="flex-1 bg-surface-container-high rounded-lg py-3 flex-row items-center justify-center"
          style={[{ gap: 6, borderCurve: "continuous" }]}
        >
          <MaterialIcon name="receipt_long" size={16} color={colors.onSurface} />
          <Text className="text-on-surface text-sm font-bold">View Receipt</Text>
        </Pressable>
        <Pressable
          onPress={() => Alert.alert("Options", "Coming soon.")}
          className="w-12 h-12 bg-surface-container rounded-lg items-center justify-center"
          style={{ borderCurve: "continuous" }}
        >
          <MaterialIcon name="more_vert" size={20} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Warranty Card (dispatcher) ────────────────────────────────────────────────

function WarrantyCard({ warranty }: { warranty: Warranty }) {
  const status = useWarrantyStore((s) => s.getWarrantyStatus(warranty.id));
  if (status === "healthy") return <HealthyCard warranty={warranty} />;
  return <ExpiringCard warranty={warranty} />;
}

// ─── Filter Empty State ────────────────────────────────────────────────────────

function FilterEmptyState({ filter }: { filter: FilterOption }) {
  const label = filter === "active" ? "active" : "expired";
  return (
    <View className="items-center gap-3 py-10">
      <View
        className="w-14 h-14 bg-surface-container rounded-full items-center justify-center"
        style={{ borderCurve: "continuous" }}
      >
        <MaterialIcon name="verified_user" size={26} color={colors.onSurfaceVariant} />
      </View>
      <View className="items-center gap-1">
        <Text className="text-on-surface font-bold text-base">
          No {label} warranties
        </Text>
        <Text className="text-on-surface-variant text-sm text-center px-8">
          {filter === "active"
            ? "All your warranties have expired."
            : "You have no expired warranties — great!"}
        </Text>
      </View>
    </View>
  );
}

// ─── Add New Card ──────────────────────────────────────────────────────────────

function AddNewCard() {
  const router = useRouter();
  return (
    <View
      className="p-8 bg-surface-container-low/50"
      style={[styles.addNewCard, { borderCurve: "continuous" }]}
    >
      <View className="items-center gap-3">
        <View
          className="w-14 h-14 bg-primary-container rounded-full items-center justify-center"
          style={{ borderCurve: "continuous" }}
        >
          <MaterialIcon name="add_shopping_cart" size={26} color={colors.primary} />
        </View>
        <View className="items-center gap-1">
          <Text className="text-on-surface font-bold text-base">
            Bought something new?
          </Text>
          <Text className="text-on-surface-variant text-sm text-center">
            Scan a receipt to automatically track its warranty period.
          </Text>
        </View>
        <Pressable onPress={() => router.push("/(tabs)/scans" as any)}>
          <Text className="text-primary font-bold text-sm">Scan Receipt</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function WarrantyScreen() {
  const [filter, setFilter] = useState<FilterOption>("all");
  const getWarranties = useWarrantyStore((s) => s.getWarranties);
  const allWarranties = useWarrantyStore((s) => s.warranties);

  const filtered = getWarranties(filter);
  const hasNoWarrantiesAtAll = allWarranties.length === 0;
  const filterIsEmpty = filtered.length === 0 && !hasNoWarrantiesAtAll;

  return (
    <View className="flex-1 bg-surface">
      <TopAppBar />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 120, paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Editorial header */}
        <View className="px-4 mb-4 gap-1">
          <Text className="text-4xl font-extrabold text-on-surface">
            Warranty
          </Text>
          <Text className="text-sm text-on-surface-variant">
            Protect your investments and track expiration dates.
          </Text>
        </View>

        {/* Filter bar */}
        <View className="mb-4">
          <FilterBar selected={filter} onSelect={setFilter} />
        </View>

        {/* Card list */}
        <View className="px-4 gap-4">
          {hasNoWarrantiesAtAll ? (
            /* No warranties at all — prominent prompt */
            <View className="items-center gap-4 pt-8">
              <View
                className="w-20 h-20 bg-primary-container rounded-full items-center justify-center"
                style={{ borderCurve: "continuous" }}
              >
                <MaterialIcon
                  name="add_shopping_cart"
                  size={36}
                  color={colors.primary}
                />
              </View>
              <View className="items-center gap-2">
                <Text className="text-on-surface text-xl font-bold">
                  No warranties yet
                </Text>
                <Text className="text-on-surface-variant text-sm text-center px-8">
                  Scan a receipt to automatically detect and track product
                  warranties.
                </Text>
              </View>
              <Pressable
                onPress={() => {}}
                className="bg-primary px-8 py-3 rounded-full"
                style={{ borderCurve: "continuous" }}
              >
                <Text className="text-on-primary font-bold text-sm">
                  Scan Receipt
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              {filterIsEmpty ? (
                <FilterEmptyState filter={filter} />
              ) : (
                filtered.map((w) => <WarrantyCard key={w.id} warranty={w} />)
              )}
              <AddNewCard />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cardShadow: {
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  } as any,
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  badgeError: {
    backgroundColor: colors.error,
  },
  badgeMuted: {
    backgroundColor: colors.outline,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Lexend_800ExtraBold",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  addNewCard: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: `${colors.outline}4d`,
    borderRadius: 12,
  },
});
