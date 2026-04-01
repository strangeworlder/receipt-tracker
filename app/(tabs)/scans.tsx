import React, { useState, useRef } from "react";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { TextInput } from "react-native";
import { View, Text, ScrollView, Pressable } from "@/tw";
import { TopAppBar } from "@/components/TopAppBar";
import { MaterialIcon } from "@/components/MaterialIcon";
import { StatusPill } from "@/components/StatusPill";
import { useReceiptStore } from "@/stores/receiptStore";
import { formatCurrency, formatDate } from "@/utils/format";
import { colors } from "@/theme/colors";
import type { ReceiptCategory } from "@/types";

const CATEGORIES: Array<ReceiptCategory | "all"> = [
  "all",
  "food",
  "travel",
  "warranty",
  "utility",
  "shopping",
  "other",
];

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  food: "Food",
  travel: "Travel",
  warranty: "Warranty",
  utility: "Utility",
  shopping: "Shopping",
  other: "Other",
};

const CATEGORY_ICONS: Record<string, string> = {
  food: "local_cafe",
  travel: "flight",
  warranty: "verified_user",
  utility: "bolt",
  shopping: "shopping_bag",
  other: "receipt_long",
};

const CATEGORY_COLORS: Record<string, string> = {
  food: "#4caf50",
  travel: "#2196f3",
  warranty: "#9c27b0",
  utility: "#ff9800",
  shopping: "#e91e63",
  other: "#607d8b",
};

export default function ScansScreen() {
  const receipts = useReceiptStore((s) => s.receipts);
  const [activeFilter, setActiveFilter] = useState<ReceiptCategory | "all">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  function handleSearchChange(text: string) {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(text), 300);
  }

  const filteredReceipts = receipts.filter((r) => {
    const matchesCategory =
      activeFilter === "all" || r.category === activeFilter;
    const matchesSearch =
      debouncedQuery.trim() === "" ||
      r.merchant.toLowerCase().includes(debouncedQuery.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <View className="flex-1 bg-surface">
      <TopAppBar />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 108,
          paddingBottom: 120,
          gap: 20,
        }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Page title */}
        <View style={{ paddingHorizontal: 24 }}>
          <Text className="text-on-surface text-2xl font-bold font-headline">
            Receipts
          </Text>
        </View>

        {/* Search input */}
        <View
          style={{
            marginHorizontal: 24,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surfaceContainerLow,
            borderRadius: 16,
            borderCurve: "continuous",
            paddingHorizontal: 14,
            paddingVertical: 10,
            gap: 10,
          }}
        >
          <MaterialIcon name="search" size={20} color={colors.onSurfaceVariant} />
          <TextInput
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder="Search receipts…"
            placeholderTextColor={colors.onSurfaceVariant}
            style={{
              flex: 1,
              fontSize: 15,
              fontFamily: "Lexend_400Regular",
              color: colors.onSurface,
            }}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        {/* Filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}
        >
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setActiveFilter(cat)}
              className="active:scale-95"
              style={{
                backgroundColor:
                  activeFilter === cat ? colors.primary : colors.surfaceContainer,
                borderRadius: 9999,
                paddingHorizontal: 16,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color:
                    activeFilter === cat
                      ? colors.onPrimary
                      : colors.onSurfaceVariant,
                }}
              >
                {CATEGORY_LABELS[cat]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Receipt list */}
        <View style={{ paddingHorizontal: 24, gap: 10 }}>
          {filteredReceipts.length === 0 ? (
            <EmptyState />
          ) : (
            filteredReceipts.map((receipt, index) => (
              <Animated.View
                key={receipt.id}
                entering={FadeInDown.delay(index * 40)
                  .duration(300)
                  .springify()}
              >
                <Pressable
                  onPress={() =>
                    router.push(
                      `/receipts/${receipt.id}` as `${string}`
                    )
                  }
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
                  }}
                >
                  {/* Category icon */}
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      borderCurve: "continuous",
                      backgroundColor:
                        CATEGORY_COLORS[receipt.category] + "1A",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MaterialIcon
                      name={
                        CATEGORY_ICONS[receipt.category] ?? "receipt_long"
                      }
                      size={22}
                      color={CATEGORY_COLORS[receipt.category] ?? colors.onSurface}
                    />
                  </View>

                  {/* Text info */}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      className="text-on-surface font-extrabold text-sm"
                      numberOfLines={1}
                    >
                      {receipt.merchant}
                    </Text>
                    <Text
                      className="text-on-surface-variant text-xs"
                      selectable
                    >
                      {formatDate(receipt.date)}
                    </Text>
                  </View>

                  {/* Amount + status */}
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text
                      className="text-on-surface font-bold text-sm"
                      selectable
                    >
                      {formatCurrency(receipt.amount)}
                    </Text>
                    {receipt._pendingWrite ? (
                      <StatusPill label="Syncing" variant="neutral" />
                    ) : receipt.isWarranty ? (
                      <StatusPill label="Warranty" variant="primary" />
                    ) : null}
                  </View>
                </Pressable>
              </Animated.View>
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB — scan new receipt */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scan receipt"
        onPress={() => router.push("/scanner")}
        className="active:scale-95"
        style={{
          position: "absolute",
          right: 24,
          bottom: 112,
          width: 56,
          height: 56,
          borderRadius: 9999,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          borderCurve: "continuous",
          boxShadow: `0 6px 12px ${colors.primary}33`,
        }}
      >
        <MaterialIcon name="document_scanner" size={26} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

function EmptyState() {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 64,
        gap: 12,
      }}
    >
      <MaterialIcon
        name="receipt_long"
        size={64}
        color={colors.onSurfaceVariant}
      />
      <Text className="text-on-surface font-bold text-lg">
        No receipts yet
      </Text>
      <Text className="text-on-surface-variant text-sm text-center">
        Tap the scan button to add your first receipt
      </Text>
    </View>
  );
}
