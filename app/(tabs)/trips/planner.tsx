import React, { useState, useCallback } from "react";
import { StyleSheet, Alert, useWindowDimensions } from "react-native";
import { ScrollView, View, Text, Pressable } from "@/tw";
import { useLocalSearchParams, router } from "expo-router";
import { useTripStore } from "@/stores/tripStore";
import { useAuthStore } from "@/stores/authStore";
import { claimPlannerItem, unclaimPlannerItem } from "@/services/tripService";
import { MaterialIcon } from "@/components/MaterialIcon";
import { AvatarStack } from "@/components/AvatarStack";
import { ProgressRing } from "@/components/ProgressRing";
import { colors } from "@/theme/colors";

// ─── Item Card Variants (D3) ──────────────────────────────────────────────────

function ItemCard({
  item,
  tripId,
  currentUid,
  onClaimed,
}: {
  item: any;
  tripId: string;
  currentUid: string | undefined;
  onClaimed: () => void;
}) {
  const [claiming, setClaiming] = useState(false);
  const isMineToClaim = item.status === "unassigned";
  const isAssignedToMe = item.status !== "unassigned" && item.assignedTo === currentUid;
  const isAssignedToOther = item.status !== "unassigned" && item.assignedTo !== currentUid;

  const handleClaim = useCallback(async () => {
    setClaiming(true);
    try {
      await claimPlannerItem(tripId, item.id);
      onClaimed();
    } catch {
      Alert.alert("Error", "Could not claim item. Please try again.");
    } finally {
      setClaiming(false);
    }
  }, [tripId, item.id, onClaimed]);

  const handleUnclaim = useCallback(async () => {
    setClaiming(true);
    try {
      await unclaimPlannerItem(tripId, item.id);
      onClaimed();
    } catch {
      Alert.alert("Error", "Could not unclaim item. Please try again.");
    } finally {
      setClaiming(false);
    }
  }, [tripId, item.id, onClaimed]);

  return (
    <View
      className="bg-surface-container-lowest rounded-xl border border-outline/10 p-4 gap-2"
      style={{ borderCurve: "continuous" }}
    >
      {/* Status icon */}
      <View className="w-8 h-8 items-center justify-center">
        {isAssignedToMe ? (
          <MaterialIcon name="check_circle" size={24} color={colors.primary} />
        ) : isAssignedToOther ? (
          <MaterialIcon name="person" size={24} color={colors.secondary} />
        ) : (
          <MaterialIcon name="check_circle_outline" size={24} color={colors.outline} />
        )}
      </View>

      {/* Item name + description */}
      <View className="gap-0.5">
        <Text className="text-sm font-bold text-on-surface" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="text-xs text-on-surface-variant" numberOfLines={2}>
          {item.description}
        </Text>
      </View>

      {/* Assignment label / claim button */}
      {isAssignedToMe && (
        <Pressable onPress={handleUnclaim} className="active:opacity-70">
          <Text className="text-xs font-bold text-primary">Brought By You ✓</Text>
        </Pressable>
      )}
      {isAssignedToOther && (
        <Text className="text-xs text-on-surface-variant">
          Assigned To {item.assignedTo}
        </Text>
      )}
      {isMineToClaim && (
        <Pressable
          onPress={handleClaim}
          disabled={claiming}
          className="bg-primary rounded-lg py-2 items-center active:opacity-80"
          style={{ borderCurve: "continuous", opacity: claiming ? 0.6 : 1 }}
        >
          <Text className="text-xs font-bold text-on-primary">
            {claiming ? "Claiming…" : "Claim Item"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Category Sections — Bento Grid (D2) ─────────────────────────────────────

function CategorySection({
  category,
  tripId,
  currentUid,
  onClaimed,
}: {
  category: { id: string; name: string; icon: string; items: any[] };
  tripId: string;
  currentUid: string | undefined;
  onClaimed: () => void;
}) {
  const isTertiary = category.name === "Navigation";
  const isFullWidth = category.name === "Food & Snacks";
  const isLarge = category.name === "Camping Gear";

  const bgClass = isTertiary
    ? "bg-tertiary"
    : "bg-surface-container";

  const titleColor = isTertiary ? colors.onTertiary : colors.onSurface;
  const subtitleColor = isTertiary ? `${colors.onTertiary}b3` : colors.onSurfaceVariant;

  const assignedCount = category.items.filter(
    (i) => i.status === "assigned" || i.status === "brought"
  ).length;
  const progress = category.items.length > 0
    ? Math.round((assignedCount / category.items.length) * 100)
    : 0;

  return (
    <View
      className={`${bgClass} rounded-3xl p-5 overflow-hidden`}
      style={{
        flex: isFullWidth ? undefined : isLarge ? 2 : 1,
        width: isFullWidth ? "100%" : undefined,
        borderCurve: "continuous",
      }}
    >
      {/* Decorative circle for tertiary */}
      {isTertiary && (
        <View
          style={{
            position: "absolute",
            top: -20,
            right: -20,
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: "rgba(255,255,255,0.1)",
          }}
        />
      )}

      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <MaterialIcon name={category.icon as any} size={18} color={titleColor} />
          <Text className="text-sm font-bold" style={{ color: titleColor }}>
            {category.name}
          </Text>
        </View>
        <View
          className="bg-black/10 rounded-full px-2 py-0.5"
          style={{ borderCurve: "continuous" }}
        >
          <Text className="text-xs font-bold" style={{ color: titleColor }}>
            {category.items.length} items
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View
        className="rounded-full overflow-hidden mb-3"
        style={{ height: 4, backgroundColor: isTertiary ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)" }}
      >
        <View
          className="rounded-full"
          style={{
            width: `${progress}%`,
            height: 4,
            backgroundColor: isTertiary ? colors.onTertiary : colors.primary,
          }}
        />
      </View>
      <Text className="text-xs mb-3" style={{ color: subtitleColor }}>
        Progress {progress}%
      </Text>

      {/* Items */}
      {isFullWidth ? (
        // 3-column grid for full-width category
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {category.items.map((item) => (
            <View key={item.id} style={{ flex: 1, minWidth: 100 }}>
              <ItemCard
                item={item}
                tripId={tripId}
                currentUid={currentUid}
                onClaimed={onClaimed}
              />
            </View>
          ))}
        </View>
      ) : (
        // Vertical list for other categories
        <View className="gap-2">
          {category.items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              tripId={tripId}
              currentUid={currentUid}
              onClaimed={onClaimed}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Progress Summary Banner (D4) ─────────────────────────────────────────────

function ProgressBanner({
  progress,
  tripId,
}: {
  progress: { total: number; assigned: number; percentage: number };
  tripId: string;
}) {
  const unassigned = progress.total - progress.assigned;

  return (
    <View
      className="bg-primary rounded-3xl p-6 gap-4"
      style={{ borderCurve: "continuous", boxShadow: "0 8px 24px rgba(2,186,65,0.25)" } as any}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        {/* Progress ring */}
        <ProgressRing
          percentage={progress.percentage}
          size={80}
          strokeWidth={8}
          color={colors.onPrimary}
          trackColor="rgba(255,255,255,0.25)"
          label={`${progress.percentage}%`}
        />
        {/* Text */}
        <View className="flex-1 gap-1">
          <Text className="text-lg font-extrabold text-on-primary">
            Ready for Adventure?
          </Text>
          <Text className="text-sm text-on-primary/80">
            {unassigned === 0
              ? "Everything is packed! 🎉"
              : `${unassigned} item${unassigned !== 1 ? "s" : ""} still unassigned`}
          </Text>
        </View>
      </View>

      {/* Action buttons */}
      <View className="flex-row gap-3">
        <Pressable
          className="flex-1 bg-on-primary rounded-2xl py-3 items-center active:opacity-80"
          style={{ borderCurve: "continuous" }}
        >
          <Text className="text-sm font-bold text-primary">See All Open Items</Text>
        </Pressable>
        <Pressable
          className="flex-1 border border-on-primary/40 rounded-2xl py-3 items-center active:opacity-80"
          style={{ borderCurve: "continuous" }}
          onPress={() =>
            Alert.alert("Remind Everyone", "Reminders will be sent to all participants.")
          }
        >
          <Text className="text-sm font-bold text-on-primary">Remind Everyone</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Tablet Navigation Drawer (D6) ───────────────────────────────────────────

function TabletDrawer({ tripId }: { tripId: string }) {
  const navLinks = [
    { label: "Personal Ledger", icon: "attach_money" },
    { label: "Trip History", icon: "calendar_today" },
    { label: "Trip Planner", icon: "camping" },
    { label: "Currency Settings", icon: "settings" },
  ];

  return (
    <View
      className="bg-surface-container-low border-r border-outline/10"
      style={{ width: 240, paddingTop: 60, paddingHorizontal: 16, gap: 8 }}
    >
      {navLinks.map((link) => (
        <Pressable
          key={link.label}
          className="flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:bg-surface-container"
          style={{ borderCurve: "continuous" }}
        >
          <MaterialIcon name={link.icon as any} size={18} color={colors.onSurfaceVariant} />
          <Text className="text-sm font-semibold text-on-surface-variant">{link.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PlannerScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const trip = useTripStore((s) => s.getTrip(tripId));
  const plannerItems = useTripStore((s) => s.getPlannerItems(tripId));
  const progress = useTripStore((s) => s.getPlannerProgress(tripId));
  const currentUid = useAuthStore((s) => s.user?.uid);

  // Force re-render when items change
  const [, setRefresh] = useState(0);
  const handleClaimed = useCallback(() => setRefresh((n) => n + 1), []);

  // Group items by categoryId
  const categories: Array<{ id: string; name: string; icon: string; items: any[] }> =
    trip?.categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      items: plannerItems.filter((item) => item.categoryId === cat.id),
    })) ?? [];

  // Fallback demo categories if no real categories yet
  const displayCategories =
    categories.length > 0
      ? categories
      : [
          {
            id: "gear",
            name: "Camping Gear",
            icon: "camping",
            items: plannerItems.filter((i) => i.category === "gear"),
          },
          {
            id: "nav",
            name: "Navigation",
            icon: "route",
            items: plannerItems.filter((i) => i.category === "navigation"),
          },
          {
            id: "food",
            name: "Food & Snacks",
            icon: "restaurant",
            items: plannerItems.filter((i) => i.category === "food"),
          },
        ];

  const content = (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 60, gap: 24 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      {/* D1: Hero Section */}
      <View className="px-4 pt-6 gap-2">
        <Text className="text-xs font-extrabold uppercase tracking-widest text-primary">
          Trip Planner
        </Text>
        <Text className="text-4xl font-extrabold text-on-surface">{trip?.name ?? "Planner"}</Text>
        <Text className="text-sm text-on-surface-variant">Who Brings What: Essential Logistics</Text>
        {trip && (
          <AvatarStack
            avatars={trip.participants.map((p) => ({ name: p.name, uri: p.avatarUri }))}
            maxVisible={6}
            size={32}
          />
        )}
      </View>

      {/* D2 + D3: Category Sections Bento Grid */}
      <View className="px-4">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {displayCategories.map((cat) => (
            <CategorySection
              key={cat.id}
              category={cat}
              tripId={tripId}
              currentUid={currentUid}
              onClaimed={handleClaimed}
            />
          ))}
        </View>
      </View>

      {/* D4: Progress Summary Banner */}
      <View className="px-4">
        <ProgressBanner progress={progress} tripId={tripId} />
      </View>
    </ScrollView>
  );

  if (isTablet) {
    return (
      <View className="flex-1 bg-surface flex-row">
        {/* D6: Tablet sidebar drawer */}
        <TabletDrawer tripId={tripId} />
        <View className="flex-1">
          {/* Header */}
          <View className="px-4 pt-14 pb-2 flex-row items-center gap-2">
            <Pressable onPress={() => router.back()} className="w-10 h-10 items-center justify-center active:opacity-70">
              <MaterialIcon name="arrow_back" size={24} color={colors.onSurface} />
            </Pressable>
          </View>
          {content}
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <View className="px-4 pt-14 pb-2 flex-row items-center gap-2">
        <Pressable onPress={() => router.back()} className="w-10 h-10 items-center justify-center active:opacity-70">
          <MaterialIcon name="arrow_back" size={24} color={colors.onSurface} />
        </Pressable>
      </View>
      {content}
    </View>
  );
}
