import React, { useState } from "react";
import { Alert, Share, StyleSheet, ActivityIndicator } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { ScrollView, View, Text, Pressable, TextInput } from "@/tw";
import { Image } from "@/tw/image";
import { BlurView } from "expo-blur";
import { useLocalSearchParams, router } from "expo-router";
import { useReceiptStore } from "@/stores/receiptStore";
import { useWarrantyStore } from "@/stores/warrantyStore";
import { useTripStore } from "@/stores/tripStore";
import { MaterialIcon } from "@/components/MaterialIcon";
import { updateReceipt, deleteReceipt } from "@/services/receiptService";
import { deleteWarranty } from "@/services/warrantyService";
import { formatCurrency, formatDate } from "@/utils/format";
import { colors } from "@/theme/colors";
import type { ReceiptCategory } from "@/types";

// ─── Category options ─────────────────────────────────────────────────────────

const CATEGORIES: ReceiptCategory[] = [
  "food",
  "travel",
  "warranty",
  "utility",
  "shopping",
  "other",
];

const CATEGORY_LABELS: Record<ReceiptCategory, string> = {
  food: "Food",
  travel: "Travel",
  warranty: "Warranty",
  utility: "Utility",
  shopping: "Shopping",
  other: "Other",
};

// ─── Sync status badge ────────────────────────────────────────────────────────

function SyncBadge({ status }: { status?: "synced" | "pending" | "error" }) {
  if (!status) return null;

  const config = {
    synced: { icon: "cloud_done", label: "Synced", color: colors.primary },
    pending: { icon: "sync", label: "Saving…", color: colors.secondary },
    error: { icon: "cloud_off", label: "Error", color: colors.error },
  }[status];

  return (
    <View
      style={[
        styles.syncBadge,
        { backgroundColor: "rgba(0,0,0,0.55)" },
      ]}
    >
      <MaterialIcon name={config.icon} size={12} color="#fff" />
      <Text style={styles.syncBadgeText}>{config.label}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReceiptDetailScreen() {
  const { receiptId } = useLocalSearchParams<{ receiptId: string }>();
  const receipt = useReceiptStore((s) => s.getReceiptById(receiptId));
  const updateStoreReceipt = useReceiptStore((s) => s.updateReceipt);
  const deleteStoreReceipt = useReceiptStore((s) => s.deleteReceipt);

  const linkedWarranty = useWarrantyStore((s) =>
    s.warranties.find((w) => w.receiptId === receiptId)
  );
  const linkedTrip = useTripStore((s) =>
    receipt?.tripId ? s.getTrip(receipt.tripId) : undefined
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editMerchant, setEditMerchant] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState<ReceiptCategory>("other");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!receipt) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <MaterialIcon name="receipt_long" size={48} color={colors.onSurfaceVariant} />
        <Text className="text-on-surface-variant mt-3">Receipt not found.</Text>
      </View>
    );
  }

  const localFallbackUri = `${FileSystem.documentDirectory}receipts/${receiptId}.jpg`;
  const imageSource = receipt.imageUri ?? localFallbackUri;

  const startEditing = () => {
    setEditMerchant(receipt.merchant);
    setEditDate(receipt.date);
    setEditAmount(String(receipt.amount));
    setEditCategory(receipt.category);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const amount = parseFloat(editAmount);
    if (isNaN(amount)) {
      Alert.alert("Invalid Amount", "Please enter a valid number.");
      return;
    }
    setSaving(true);
    try {
      const updates = {
        merchant: editMerchant.trim(),
        date: editDate,
        amount,
        category: editCategory,
      };
      await updateReceipt(receiptId, updates);
      updateStoreReceipt(receiptId, updates);
      setIsEditing(false);
      Alert.alert("Saved", "Receipt updated.");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    const message = linkedWarranty
      ? "This will permanently delete the receipt, its image, and the linked warranty. This cannot be undone."
      : "This will permanently delete the receipt and its image. This cannot be undone.";

    Alert.alert("Delete Receipt", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteReceipt(receiptId);
            deleteStoreReceipt(receiptId);
            if (linkedWarranty) {
              await deleteWarranty(linkedWarranty.id);
            }
            router.back();
          } catch (e: any) {
            Alert.alert("Error", e.message ?? "Could not delete receipt.");
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Receipt from ${receipt.merchant} — ${formatCurrency(receipt.amount)}`,
        url: receipt.imageUri ?? localFallbackUri,
      });
    } catch {
      // dismissed
    }
  };

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="px-4 pt-14 pb-3 flex-row items-center gap-3">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center active:opacity-70"
        >
          <MaterialIcon name="arrow_back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text className="text-on-surface text-xl font-bold flex-1" numberOfLines={1}>
          {receipt.merchant}
        </Text>
        {deleting && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120, gap: 16, paddingHorizontal: 16 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section 1: Image viewer ── */}
        <View
          className="w-full rounded-3xl overflow-hidden"
          style={{ aspectRatio: 3 / 4 }}
        >
          {receipt.imageUri ? (
            <Image
              source={{ uri: imageSource }}
              style={{ flex: 1 }}
              contentFit="cover"
            />
          ) : (
            <PlaceholderImage />
          )}
          <View style={styles.syncBadgeContainer}>
            <SyncBadge status={receipt.syncStatus} />
          </View>
        </View>

        {/* ── Section 2: Receipt data card ── */}
        <View
          className="bg-surface-container-low rounded-3xl p-6 gap-4"
          style={{ borderCurve: "continuous" }}
        >
          {/* Low-confidence badge */}
          {receipt.confidence !== undefined && receipt.confidence < 0.7 && (
            <View className="bg-error-container rounded-full px-3 py-1 self-start flex-row items-center gap-1">
              <MaterialIcon name="warning" size={12} color={colors.error} />
              <Text className="text-on-error-container text-xs font-bold">
                Low confidence — please verify
              </Text>
            </View>
          )}

          {/* Merchant */}
          <View className="gap-1">
            <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
              Merchant
            </Text>
            {isEditing ? (
              <TextInput
                value={editMerchant}
                onChangeText={setEditMerchant}
                className="text-2xl font-extrabold text-primary border-b border-outline/30 py-1"
                style={{ borderCurve: "continuous" } as any}
              />
            ) : (
              <Text className="text-2xl font-extrabold text-primary">
                {receipt.merchant}
              </Text>
            )}
          </View>

          {/* Date */}
          <View className="flex-row items-center gap-3">
            <View className="w-8 h-8 bg-primary-container rounded-lg items-center justify-center" style={{ borderCurve: "continuous" }}>
              <MaterialIcon name="calendar_today" size={16} color={colors.primary} />
            </View>
            {isEditing ? (
              <TextInput
                value={editDate}
                onChangeText={setEditDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.outline}
                className="text-on-surface font-semibold flex-1 border-b border-outline/30 py-1"
                style={{ borderCurve: "continuous" } as any}
              />
            ) : (
              <Text className="text-on-surface font-semibold">
                {formatDate(receipt.date)}
              </Text>
            )}
          </View>

          {/* Amount */}
          <View className="flex-row items-center gap-3">
            <View className="w-8 h-8 bg-primary-container rounded-lg items-center justify-center" style={{ borderCurve: "continuous" }}>
              <MaterialIcon name="payments" size={16} color={colors.primary} />
            </View>
            {isEditing ? (
              <TextInput
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="decimal-pad"
                className="text-on-surface font-semibold flex-1 border-b border-outline/30 py-1"
                style={{ borderCurve: "continuous" } as any}
              />
            ) : (
              <Text className="text-on-surface font-semibold text-lg">
                {formatCurrency(receipt.amount)}
              </Text>
            )}
          </View>

          {/* Category */}
          {isEditing ? (
            <View className="gap-2">
              <Text className="text-xs font-bold text-on-surface-variant">
                Category
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setEditCategory(cat)}
                    className={
                      editCategory === cat
                        ? "bg-primary rounded-full px-4 py-2"
                        : "bg-surface-container rounded-full px-4 py-2"
                    }
                    style={{ borderCurve: "continuous" }}
                  >
                    <Text
                      className={
                        editCategory === cat
                          ? "text-on-primary font-bold text-xs"
                          : "text-on-surface-variant font-bold text-xs"
                      }
                    >
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View className="self-start bg-surface-container rounded-full px-4 py-2" style={{ borderCurve: "continuous" }}>
              <Text className="text-on-surface-variant text-xs font-bold capitalize">
                {CATEGORY_LABELS[receipt.category]}
              </Text>
            </View>
          )}
        </View>

        {/* ── Section 3: Warranty link (conditional) ── */}
        {receipt.isWarranty && linkedWarranty && (
          <View
            className="bg-secondary-container rounded-2xl p-5 gap-3"
            style={{ borderCurve: "continuous" }}
          >
            <View className="flex-row items-center gap-2">
              <MaterialIcon name="verified_user" size={20} color={colors.secondary} />
              <Text className="text-on-secondary-container font-bold text-base flex-1">
                Warranty Tracked
              </Text>
            </View>
            <Text className="text-on-secondary-container font-semibold">
              {linkedWarranty.productName}
            </Text>
            <Text className="text-on-secondary-container text-sm">
              Expires {formatDate(linkedWarranty.expirationDate)}
            </Text>
            <Pressable
              onPress={() => router.push("/(tabs)/warranty" as any)}
              className="self-start active:opacity-70"
            >
              <Text className="text-secondary font-bold text-sm">
                Edit Warranty →
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Section 4: Linked expense (conditional) ── */}
        {receipt.tripId && linkedTrip && (
          <Pressable
            onPress={() => router.push(`/(tabs)/trips/${receipt.tripId}` as any)}
            className="active:opacity-80"
          >
            <View
              className="bg-primary-container rounded-2xl p-5 gap-3"
              style={{ borderCurve: "continuous" }}
            >
              <View className="flex-row items-center gap-2">
                <MaterialIcon name="folder_shared" size={20} color={colors.primary} />
                <Text className="text-on-primary-container font-bold text-base flex-1">
                  {linkedTrip.name}
                </Text>
                <MaterialIcon name="arrow_forward" size={18} color={colors.primary} />
              </View>
              <Text className="text-on-primary-container text-sm">
                View in Trip
              </Text>
            </View>
          </Pressable>
        )}

        {/* ── Section 5: Actions row ── */}
        <View className="flex-row gap-3 mt-2">
          {isEditing ? (
            <>
              <Pressable
                onPress={() => setIsEditing(false)}
                className="flex-1 bg-surface-container rounded-full py-3 items-center active:opacity-70"
                style={{ borderCurve: "continuous" }}
              >
                <Text className="text-on-surface font-bold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                className="flex-1 bg-primary rounded-full py-3 items-center active:opacity-70"
                style={{ borderCurve: "continuous", opacity: saving ? 0.6 : 1 }}
              >
                <Text className="text-on-primary font-bold">
                  {saving ? "Saving…" : "Save"}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={startEditing}
                className="flex-1 bg-surface-container-low border border-outline/20 rounded-full py-3 items-center flex-row justify-center gap-2 active:opacity-70"
                style={{ borderCurve: "continuous" }}
              >
                <MaterialIcon name="edit" size={16} color={colors.onSurface} />
                <Text className="text-on-surface font-bold text-sm">Edit</Text>
              </Pressable>

              <Pressable
                onPress={handleShare}
                className="flex-1 bg-surface-container-low border border-outline/20 rounded-full py-3 items-center flex-row justify-center gap-2 active:opacity-70"
                style={{ borderCurve: "continuous" }}
              >
                <MaterialIcon name="share" size={16} color={colors.onSurface} />
                <Text className="text-on-surface font-bold text-sm">Share</Text>
              </Pressable>

              <Pressable
                onPress={handleDelete}
                className="px-5 py-3 items-center justify-center active:opacity-70"
              >
                <Text className="text-error font-bold text-sm">Delete</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Placeholder image when no receipt image is available ─────────────────────

function PlaceholderImage() {
  return (
    <View className="flex-1 bg-surface-container items-center justify-center gap-3">
      <MaterialIcon name="receipt_long" size={56} color={colors.onSurfaceVariant} />
      <Text className="text-on-surface-variant text-sm">No image available</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  syncBadgeContainer: {
    position: "absolute",
    bottom: 12,
    right: 12,
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  syncBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Lexend_600SemiBold",
  },
});
