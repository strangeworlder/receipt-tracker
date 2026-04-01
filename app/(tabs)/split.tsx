import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
} from "@/tw";
import { Alert, Modal, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { TopAppBar } from "@/components/TopAppBar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useSplitStore } from "@/stores/splitStore";
import { useTripStore } from "@/stores/tripStore";
import { addExpense } from "@/services/tripService";
import { formatCurrency } from "@/utils/format";
import { twMerge } from "tailwind-merge";
import { colors } from "@/theme/colors";

// ─── Avatar initials helper ──────────────────────────────────────────────────

function AvatarInitials({
  name,
  size = 40,
  grayscale = false,
}: {
  name: string;
  size?: number;
  grayscale?: boolean;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: grayscale ? "#c8cdc6" : colors.primaryContainer,
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      <Text
        style={{
          fontSize: size * 0.38,
          fontFamily: "Lexend_700Bold",
          color: grayscale ? "#6b716a" : colors.onPrimaryContainer,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

// ─── Hero Amount Section ──────────────────────────────────────────────────────

function HeroAmount() {
  const totalAmount = useSplitStore((s) => s.totalAmount);
  const setTotalAmount = useSplitStore((s) => s.setTotalAmount);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<any>(null);

  function startEdit() {
    setDraft(totalAmount > 0 ? String(totalAmount) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function commitEdit() {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed >= 0) setTotalAmount(parsed);
    setEditing(false);
  }

  return (
    <View className="items-center pb-2">
      <Text className="text-on-surface-variant text-xs font-semibold tracking-widest uppercase mb-1">
        Roadtrip · Shopping split
      </Text>

      <Pressable onPress={startEdit} className="items-center">
        {editing ? (
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            onBlur={commitEdit}
            onSubmitEditing={commitEdit}
            keyboardType="decimal-pad"
            style={{
              fontFamily: "Lexend_900Black",
              fontSize: 52,
              color: colors.primary,
              letterSpacing: -2,
              minWidth: 120,
              textAlign: "center",
            }}
          />
        ) : (
          <Text
            style={{
              fontFamily: "Lexend_900Black",
              fontSize: 52,
              color: colors.primary,
              letterSpacing: -2,
            }}
          >
            {formatCurrency(totalAmount)}
          </Text>
        )}
      </Pressable>

      <Text className="text-on-surface-variant/70 text-sm font-medium mt-1">
        Total Bill Amount · tap to edit
      </Text>
    </View>
  );
}

// ─── Mode Switcher ────────────────────────────────────────────────────────────

function ModeSwitcher() {
  const splitMode = useSplitStore((s) => s.splitMode);
  const setSplitMode = useSplitStore((s) => s.setSplitMode);

  return (
    <View
      className="flex-row bg-surface-container-high rounded-full p-1"
      style={{ borderCurve: "continuous" }}
    >
      {(["equal", "custom"] as const).map((mode) => {
        const active = splitMode === mode;
        return (
          <Pressable
            key={mode}
            onPress={() => setSplitMode(mode)}
            className={twMerge(
              "flex-1 items-center py-2 rounded-full",
              active && "bg-primary"
            )}
            style={{ borderCurve: "continuous" }}
          >
            <Text
              className={twMerge(
                "text-sm font-bold",
                active ? "text-on-primary" : "text-on-surface-variant"
              )}
            >
              {mode === "equal" ? "Equal Split" : "Custom Split"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Participant Card ─────────────────────────────────────────────────────────

function ParticipantCard({
  participant,
}: {
  participant: {
    id: string;
    name: string;
    isIncluded: boolean;
    avatarUri?: string;
  };
}) {
  const toggleParticipant = useSplitStore((s) => s.toggleParticipant);

  return (
    <Pressable
      onPress={() => toggleParticipant(participant.id)}
      className={twMerge(
        "p-4 rounded-2xl flex-1",
        participant.isIncluded
          ? "bg-white"
          : "bg-surface-variant/40 opacity-60"
      )}
      style={[
        { borderCurve: "continuous" },
        participant.isIncluded && styles.activeCard,
      ]}
    >
      {/* Avatar with checkmark */}
      <View className="items-center mb-2">
        <View>
          <AvatarInitials
            name={participant.name}
            size={44}
            grayscale={!participant.isIncluded}
          />
          {participant.isIncluded && (
            <View
              style={styles.checkBadge}
            >
              <MaterialIcon name="check" size={10} color="#fff" />
            </View>
          )}
        </View>
      </View>

      {/* Name */}
      <Text
        className="text-center text-sm font-bold text-on-surface"
        numberOfLines={1}
      >
        {participant.name}
      </Text>

      {/* Status label */}
      <Text
        className={twMerge(
          "text-center text-[10px] font-black uppercase tracking-widest mt-0.5",
          participant.isIncluded ? "text-primary" : "text-on-surface-variant"
        )}
      >
        {participant.isIncluded ? "Sharing" : "Excluded"}
      </Text>
    </Pressable>
  );
}

// ─── Participant Grid ─────────────────────────────────────────────────────────

function ParticipantGrid() {
  const participants = useSplitStore((s) => s.participants);
  const includedCount = participants.filter((p) => p.isIncluded).length;

  // Pair participants into rows
  const rows: (typeof participants)[] = [];
  for (let i = 0; i < participants.length; i += 2) {
    rows.push(participants.slice(i, i + 2));
  }

  return (
    <View className="gap-3">
      {/* Header */}
      <View className="flex-row items-center justify-between">
        <Text className="text-xl font-bold text-on-surface">
          Select Participants
        </Text>
        <View
          className="bg-primary-container px-3 py-1 rounded-full"
          style={{ borderCurve: "continuous" }}
        >
          <Text className="text-primary text-[10px] font-black uppercase tracking-widest">
            {participants.length} in trip
          </Text>
        </View>
      </View>

      {/* Grid */}
      {rows.map((row, ri) => (
        <View key={ri} className="flex-row gap-3">
          {row.map((p) => (
            <ParticipantCard key={p.id} participant={p} />
          ))}
          {/* Spacer when odd count */}
          {row.length === 1 && <View className="flex-1" />}
        </View>
      ))}

      {includedCount < 2 && (
        <View className="bg-error-container rounded-2xl px-4 py-2" style={{ borderCurve: "continuous" }}>
          <Text className="text-on-error-container text-sm font-medium text-center">
            At least 2 participants required to split
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Split Summary Card ────────────────────────────────────────────────────────

function SplitSummaryCard() {
  const getPerPersonAmount = useSplitStore((s) => s.getPerPersonAmount);
  const participants = useSplitStore((s) => s.participants);
  const splitMode = useSplitStore((s) => s.splitMode);
  const getCustomTotal = useSplitStore((s) => s.getCustomTotal);

  const perPerson = getPerPersonAmount();
  const includedCount = participants.filter((p) => p.isIncluded).length;

  const customTotal = getCustomTotal();
  const totalAmount = useSplitStore((s) => s.totalAmount);
  const customMismatch =
    splitMode === "custom" && Math.abs(customTotal - totalAmount) > 0.01;

  return (
    <View
      className="rounded-3xl p-7 overflow-hidden"
      style={[
        { borderCurve: "continuous", backgroundColor: colors.primary },
        styles.summaryCardShadow,
      ]}
    >
      {/* Decorative circle */}
      <View style={styles.decorCircle} />

      <View className="flex-row items-center justify-between">
        {/* Left — amount */}
        <View className="flex-1">
          <Text
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: 10,
              fontFamily: "Lexend_800ExtraBold",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {splitMode === "equal" ? "Calculated Split" : "Custom Split"}
          </Text>

          <View className="flex-row items-end gap-1 mt-1">
            <Text
              style={{
                fontFamily: "Lexend_900Black",
                fontSize: 36,
                color: "#fff",
                letterSpacing: -1,
              }}
            >
              {splitMode === "equal"
                ? formatCurrency(perPerson)
                : customMismatch
                ? "!"
                : formatCurrency(perPerson)}
            </Text>
            {splitMode === "equal" && (
              <Text
                style={{
                  fontFamily: "Lexend_400Regular",
                  fontSize: 18,
                  color: "rgba(255,255,255,0.7)",
                  paddingBottom: 3,
                }}
              >
                each
              </Text>
            )}
          </View>

          <Text
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: 12,
              fontFamily: "Lexend_500Medium",
              marginTop: 4,
            }}
          >
            {includedCount} participant{includedCount !== 1 ? "s" : ""} sharing
          </Text>

          {customMismatch && (
            <Text
              style={{
                color: "#ffd6d6",
                fontSize: 11,
                fontFamily: "Lexend_600SemiBold",
                marginTop: 4,
              }}
            >
              {formatCurrency(customTotal)} entered · {formatCurrency(totalAmount)} needed
            </Text>
          )}
        </View>

        {/* Right — frosted icon */}
        <BlurView
          intensity={20}
          tint="light"
          style={[styles.blurContainer, { borderCurve: "continuous" } as any]}
        >
          <MaterialIcon name="groups" size={28} color="#fff" />
        </BlurView>
      </View>
    </View>
  );
}

// ─── Who Paid Section ─────────────────────────────────────────────────────────

function WhoPaidSection() {
  const participants = useSplitStore((s) => s.participants);
  const paidBy = useSplitStore((s) => s.paidBy);
  const setPaidBy = useSplitStore((s) => s.setPaidBy);
  const totalAmount = useSplitStore((s) => s.totalAmount);
  const [pickerVisible, setPickerVisible] = useState(false);

  const payer = participants.find((p) => p.id === paidBy) ?? participants[0];

  return (
    <View className="gap-3">
      <Text className="text-xl font-bold text-on-surface">Who Paid?</Text>

      <View
        className="bg-white rounded-3xl p-5 flex-row items-center gap-4"
        style={[{ borderCurve: "continuous" }, styles.payerCardShadow]}
      >
        {/* Avatar */}
        <View
          style={styles.payerAvatarRing}
        >
          <AvatarInitials name={payer?.name ?? "?"} size={48} />
        </View>

        {/* Info */}
        <View className="flex-1">
          <Text className="text-on-surface font-bold text-base">
            {payer?.name ?? "—"}
          </Text>
          <Text className="text-on-surface-variant text-sm font-medium">
            Primary Payer
          </Text>
        </View>

        {/* Right */}
        <View className="items-end gap-1">
          <Text className="text-primary font-bold text-base">
            {formatCurrency(totalAmount)}
          </Text>
          <Pressable onPress={() => setPickerVisible(true)}>
            <Text className="text-primary text-sm font-semibold">Change</Text>
          </Pressable>
        </View>
      </View>

      {/* Payer picker modal */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPickerVisible(false)}
        >
          <View
            className="bg-surface rounded-t-3xl p-6"
            style={{ borderCurve: "continuous" }}
          >
            <Text className="text-lg font-bold text-on-surface mb-4">
              Select Payer
            </Text>
            {participants
              .filter((p) => p.isIncluded)
              .map((p) => (
                <Pressable
                  key={p.id}
                  className="flex-row items-center gap-3 py-3"
                  onPress={() => {
                    setPaidBy(p.id);
                    setPickerVisible(false);
                  }}
                >
                  <AvatarInitials name={p.name} size={36} />
                  <Text className="text-on-surface font-medium flex-1">
                    {p.name}
                  </Text>
                  {p.id === paidBy && (
                    <MaterialIcon
                      name="check"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </Pressable>
              ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Custom Amount Row ────────────────────────────────────────────────────────

function CustomAmountRow({
  participant,
}: {
  participant: {
    id: string;
    name: string;
    isIncluded: boolean;
    customAmount?: number;
  };
}) {
  const setCustomAmount = useSplitStore((s) => s.setCustomAmount);
  const totalAmount = useSplitStore((s) => s.totalAmount);
  const [draft, setDraft] = useState(
    participant.customAmount != null ? String(participant.customAmount) : ""
  );

  const pct =
    totalAmount > 0 && participant.customAmount != null
      ? Math.round((participant.customAmount / totalAmount) * 100)
      : 0;

  function commit() {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed >= 0) setCustomAmount(participant.id, parsed);
  }

  return (
    <View className="flex-row items-center gap-3 py-2">
      <AvatarInitials name={participant.name} size={36} />
      <Text className="text-on-surface font-medium flex-1">
        {participant.name}
      </Text>
      {pct > 0 && (
        <Text className="text-on-surface-variant text-sm">{pct}%</Text>
      )}
      <View
        className="bg-surface-container-low rounded-xl px-3 py-2"
        style={{ borderCurve: "continuous" }}
      >
        <TextInput
          value={draft}
          onChangeText={(v) => {
            setDraft(v);
          }}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.onSurfaceVariant}
          style={{
            fontFamily: "Lexend_600SemiBold",
            fontSize: 15,
            color: colors.onSurface,
            minWidth: 72,
            textAlign: "right",
          }}
        />
      </View>
    </View>
  );
}

// ─── Shared Items List ────────────────────────────────────────────────────────

function SharedItemsList() {
  const sharedItems = useSplitStore((s) => s.sharedItems);
  const removeSharedItem = useSplitStore((s) => s.removeSharedItem);
  const addSharedItem = useSplitStore((s) => s.addSharedItem);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  function handleAddItem() {
    const price = parseFloat(newItemPrice);
    if (!newItemName.trim() || isNaN(price)) return;
    addSharedItem({ name: newItemName.trim(), price });
    setNewItemName("");
    setNewItemPrice("");
    setAddingItem(false);
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-bold text-on-surface">
          Shared Items{sharedItems.length > 0 ? ` (${sharedItems.length})` : ""}
        </Text>
        <Pressable
          onPress={() => setAddingItem(true)}
          className="flex-row items-center gap-1"
        >
          <MaterialIcon name="add" size={16} color={colors.primary} />
          <Text className="text-primary text-sm font-semibold">Add Item</Text>
        </Pressable>
      </View>

      {sharedItems.map((item) => (
        <View
          key={item.id}
          className="bg-surface-container-low rounded-2xl p-4 flex-row items-center gap-3"
          style={{ borderCurve: "continuous" }}
        >
          <View className="flex-1">
            <Text className="text-on-surface font-semibold">{item.name}</Text>
            <Text className="text-on-surface-variant text-sm">
              {formatCurrency(item.price)}
            </Text>
          </View>
          <Pressable onPress={() => removeSharedItem(item.id)}>
            <MaterialIcon name="delete" size={18} color={colors.onSurfaceVariant} />
          </Pressable>
        </View>
      ))}

      {addingItem && (
        <View
          className="bg-surface-container-low rounded-2xl p-4 gap-3"
          style={{ borderCurve: "continuous" }}
        >
          <TextInput
            value={newItemName}
            onChangeText={setNewItemName}
            placeholder="Item name"
            placeholderTextColor={colors.onSurfaceVariant}
            style={{
              fontFamily: "Lexend_500Medium",
              fontSize: 15,
              color: colors.onSurface,
            }}
          />
          <TextInput
            value={newItemPrice}
            onChangeText={setNewItemPrice}
            placeholder="Price"
            placeholderTextColor={colors.onSurfaceVariant}
            keyboardType="decimal-pad"
            style={{
              fontFamily: "Lexend_500Medium",
              fontSize: 15,
              color: colors.onSurface,
            }}
          />
          <View className="flex-row gap-2">
            <SecondaryButton
              label="Cancel"
              onPress={() => setAddingItem(false)}
              className="flex-1"
            />
            <PrimaryButton
              label="Add"
              onPress={handleAddItem}
              className="flex-1"
            />
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Advanced Split Section ───────────────────────────────────────────────────

function AdvancedSplitSection() {
  const participants = useSplitStore((s) => s.participants);
  const autoBalance = useSplitStore((s) => s.autoBalance);
  const totalAmount = useSplitStore((s) => s.totalAmount);
  const getCustomTotal = useSplitStore((s) => s.getCustomTotal);

  const included = participants.filter((p) => p.isIncluded);
  const customTotal = getCustomTotal();
  const mismatch = Math.abs(customTotal - totalAmount) > 0.01;

  return (
    <View className="gap-4">
      {/* Shared items */}
      <SharedItemsList />

      {/* Per-participant amounts */}
      <View className="gap-2">
        <Text className="text-base font-bold text-on-surface">
          Custom Amounts
        </Text>
        <View
          className="bg-surface-container-low rounded-2xl px-4"
          style={{ borderCurve: "continuous" }}
        >
          {included.map((p) => (
            <CustomAmountRow key={p.id} participant={p} />
          ))}
        </View>
      </View>

      {/* Auto-balance */}
      <Pressable
        onPress={autoBalance}
        className="flex-row items-center justify-center gap-2 bg-secondary-container rounded-2xl py-3"
        style={{ borderCurve: "continuous" }}
      >
        <MaterialIcon name="balance" size={18} color={colors.onSecondaryContainer} />
        <Text className="text-on-secondary-container font-semibold text-sm">
          Auto-Balance Remaining
        </Text>
      </Pressable>

      {/* Validation warning */}
      {mismatch && customTotal > 0 && (
        <View
          className="bg-error-container rounded-2xl px-4 py-3 flex-row items-center gap-2"
          style={{ borderCurve: "continuous" }}
        >
          <MaterialIcon name="warning" size={16} color={colors.error} />
          <Text className="text-on-error-container text-sm font-medium flex-1">
            Amounts total {formatCurrency(customTotal)} · need{" "}
            {formatCurrency(totalAmount)}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SplitScreen() {
  const totalAmount = useSplitStore((s) => s.totalAmount);
  const splitMode = useSplitStore((s) => s.splitMode);
  const participants = useSplitStore((s) => s.participants);
  const paidBy = useSplitStore((s) => s.paidBy);
  const sharedItems = useSplitStore((s) => s.sharedItems);
  const getCustomTotal = useSplitStore((s) => s.getCustomTotal);
  const resetSplit = useSplitStore((s) => s.resetSplit);
  const setTotalAmount = useSplitStore((s) => s.setTotalAmount);

  const [saving, setSaving] = useState(false);

  const hasActiveSplit = totalAmount > 0;
  const activeParticipants = participants.filter((p) => p.isIncluded);

  function handleCreateSplit() {
    setTotalAmount(150);
  }

  async function handleSaveSplit() {
    // Validate
    if (activeParticipants.length < 2) {
      Alert.alert("Not enough participants", "At least 2 participants required.");
      return;
    }
    if (totalAmount <= 0) {
      Alert.alert("No amount", "Enter an amount greater than 0.");
      return;
    }
    if (splitMode === "custom") {
      const customTotal = getCustomTotal();
      if (Math.abs(customTotal - totalAmount) > 0.01) {
        Alert.alert(
          "Amounts don't match",
          `Custom amounts total ${formatCurrency(customTotal)} but bill is ${formatCurrency(totalAmount)}.`
        );
        return;
      }
    }

    // Build expense
    const expense = {
      description: "Split expense",
      amount: totalAmount,
      paidBy,
      splitAmong: activeParticipants.map((p) => p.id),
      splitType: (splitMode === "equal" ? "equal" : "custom") as
        | "equal"
        | "custom",
      customAmounts:
        splitMode === "custom"
          ? Object.fromEntries(
              activeParticipants.map((p) => [p.id, p.customAmount ?? 0])
            )
          : undefined,
    };

    const tripId = useTripStore.getState().getAllTrips()[0]?.id;
    setSaving(true);
    try {
      if (tripId) {
        await addExpense(tripId, expense);
      }
      resetSplit();
      Alert.alert("Split saved!", "The expense has been recorded.");
    } catch {
      Alert.alert("Error", "Failed to save split. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-surface">
      <TopAppBar />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 120, paddingBottom: 120 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-4 gap-6">
          {/* ── Header ── */}
          <Text className="text-on-surface text-2xl font-bold">Split</Text>

          {!hasActiveSplit ? (
            /* ── Empty State ── */
            <View className="items-center gap-5 pt-12">
              <View
                className="bg-primary-container rounded-full p-6"
                style={{ borderCurve: "continuous" }}
              >
                <MaterialIcon
                  name="call_split"
                  size={48}
                  color={colors.primary}
                />
              </View>
              <View className="items-center gap-2">
                <Text className="text-on-surface text-xl font-bold">
                  No active splits
                </Text>
                <Text className="text-on-surface-variant text-sm text-center px-8">
                  Create a split to divide expenses equally or customize amounts
                  for each person.
                </Text>
              </View>
              <PrimaryButton
                label="Create Split"
                onPress={handleCreateSplit}
                className="w-full"
              />
            </View>
          ) : (
            /* ── Active Split ── */
            <>
              {/* Hero amount */}
              <HeroAmount />

              {/* Mode switcher */}
              <ModeSwitcher />

              {/* Participant grid */}
              <ParticipantGrid />

              {/* Split summary card */}
              <SplitSummaryCard />

              {/* Who paid */}
              <WhoPaidSection />

              {/* Advanced section (custom mode only) */}
              {splitMode === "custom" && <AdvancedSplitSection />}

              {/* Save CTA */}
              <Pressable
                onPress={handleSaveSplit}
                disabled={saving}
                className={twMerge(
                  "w-full bg-primary rounded-3xl py-5 flex-row items-center justify-center gap-2",
                  saving && "opacity-50"
                )}
                style={[{ borderCurve: "continuous" }, styles.saveShadow]}
              >
                <MaterialIcon name="receipt_long" size={20} color="#fff" />
                <Text
                  style={{
                    fontFamily: "Lexend_900Black",
                    fontSize: 16,
                    color: "#fff",
                    letterSpacing: 0.5,
                  }}
                >
                  {saving ? "Saving…" : "Save Split"}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  activeCard: {
    boxShadow: "0 2px 8px rgba(2, 186, 65, 0.12)",
    borderWidth: 2,
    borderColor: colors.primary,
  },
  checkBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCardShadow: {
    boxShadow: `0 8px 24px ${colors.primary}33`,
  },
  decorCircle: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  blurContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  payerCardShadow: {
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
  },
  payerAvatarRing: {
    borderRadius: 16,
    borderWidth: 4,
    borderColor: `${colors.primary}1a`,
    overflow: "hidden",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  saveShadow: {
    boxShadow: `0 6px 20px ${colors.primary}4d`,
  },
});
