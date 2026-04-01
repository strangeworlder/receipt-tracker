import React, { useState, useMemo } from "react";
import { StyleSheet, Alert } from "react-native";
import { ScrollView, View, Text, Pressable, TextInput } from "@/tw";
import { useLocalSearchParams, router } from "expo-router";
import { useTripStore } from "@/stores/tripStore";
import { createCarpool } from "@/services/tripService";
import { MaterialIcon } from "@/components/MaterialIcon";
import { colors } from "@/theme/colors";
import type { CarpoolPassenger } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type RoleOption = CarpoolPassenger["role"];

interface SelectedPassenger {
  participantId: string;
  name: string;
  role: RoleOption;
}

// ─── Role Picker Chip ─────────────────────────────────────────────────────────

const ROLES: { value: RoleOption; label: string; icon: string }[] = [
  { value: "driver", label: "Driver", icon: "directions_car" },
  { value: "navigator", label: "Nav", icon: "route" },
  { value: "passenger", label: "Rider", icon: "person" },
];

function RolePicker({
  role,
  onSelect,
}: {
  role: RoleOption;
  onSelect: (r: RoleOption) => void;
}) {
  return (
    <View className="flex-row gap-1">
      {ROLES.map((r) => {
        const active = r.value === role;
        return (
          <Pressable
            key={r.value}
            onPress={() => onSelect(r.value)}
            className={
              active
                ? "bg-primary rounded-lg px-2 py-1 flex-row items-center gap-1"
                : "bg-surface-container rounded-lg px-2 py-1 flex-row items-center gap-1"
            }
            style={{ borderCurve: "continuous" }}
          >
            <MaterialIcon
              name={r.icon}
              size={12}
              color={active ? colors.onPrimary : colors.onSurfaceVariant}
            />
            <Text
              className={
                active
                  ? "text-on-primary text-[10px] font-bold"
                  : "text-on-surface-variant text-[10px] font-bold"
              }
            >
              {r.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CarpoolNewScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const trip = useTripStore((s) => s.getTrip(tripId));

  const [name, setName] = useState("");
  const [route, setRoute] = useState("");
  const [distance, setDistance] = useState("");
  const [fuelCost, setFuelCost] = useState("");
  const [selected, setSelected] = useState<SelectedPassenger[]>([]);
  const [saving, setSaving] = useState(false);

  const participants = trip?.participants ?? [];

  const toggleParticipant = (participantId: string, pName: string) => {
    setSelected((prev) => {
      const exists = prev.find((s) => s.participantId === participantId);
      if (exists) return prev.filter((s) => s.participantId !== participantId);
      return [...prev, { participantId, name: pName, role: "passenger" as RoleOption }];
    });
  };

  const setRole = (participantId: string, role: RoleOption) => {
    setSelected((prev) =>
      prev.map((s) => (s.participantId === participantId ? { ...s, role } : s))
    );
  };

  const distanceNum = parseFloat(distance) || 0;
  const fuelCostNum = parseFloat(fuelCost) || 0;
  const hasDriver = selected.some((s) => s.role === "driver");

  const isValid = useMemo(
    () =>
      name.trim().length > 0 &&
      route.trim().length > 0 &&
      distanceNum > 0 &&
      fuelCostNum > 0 &&
      selected.length >= 2 &&
      hasDriver,
    [name, route, distanceNum, fuelCostNum, selected.length, hasDriver]
  );

  const perPerson = selected.length > 0 ? fuelCostNum / selected.length : 0;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const passengers: CarpoolPassenger[] = selected.map((s) => ({
        participantId: s.participantId,
        role: s.role,
        amountOwed: Math.round(perPerson * 100) / 100,
        settled: false,
      }));
      await createCarpool(tripId, {
        name: name.trim(),
        route: route.trim(),
        distance: distanceNum,
        fuelCost: fuelCostNum,
        passengers,
      });
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not create carpool.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="px-4 pt-14 pb-3 flex-row items-center justify-between">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center active:opacity-70"
        >
          <MaterialIcon name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text className="text-base font-bold text-on-surface">New Carpool</Text>
        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 24 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
      >
        {/* Section 1: Details */}
        <View className="gap-4">
          <Text className="text-xs font-extrabold uppercase tracking-widest text-primary">
            Carpool Details
          </Text>

          <View className="gap-2">
            <Text className="text-xs font-bold text-on-surface-variant">Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Highway 1 Road Trip"
              placeholderTextColor={colors.outline}
              className="bg-surface-container-low rounded-2xl px-4 py-4 text-on-surface font-semibold"
              style={{ borderCurve: "continuous" } as any}
            />
          </View>

          <View className="gap-2">
            <Text className="text-xs font-bold text-on-surface-variant">Route</Text>
            <TextInput
              value={route}
              onChangeText={setRoute}
              placeholder="e.g. San Francisco → Big Sur"
              placeholderTextColor={colors.outline}
              className="bg-surface-container-low rounded-2xl px-4 py-4 text-on-surface font-semibold"
              style={{ borderCurve: "continuous" } as any}
            />
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 gap-2">
              <Text className="text-xs font-bold text-on-surface-variant">Distance (miles)</Text>
              <TextInput
                value={distance}
                onChangeText={setDistance}
                placeholder="0"
                placeholderTextColor={colors.outline}
                keyboardType="decimal-pad"
                className="bg-surface-container-low rounded-2xl px-4 py-4 text-on-surface font-semibold"
                style={{ borderCurve: "continuous" } as any}
              />
            </View>
            <View className="flex-1 gap-2">
              <Text className="text-xs font-bold text-on-surface-variant">Fuel Cost ($)</Text>
              <TextInput
                value={fuelCost}
                onChangeText={setFuelCost}
                placeholder="0.00"
                placeholderTextColor={colors.outline}
                keyboardType="decimal-pad"
                className="bg-surface-container-low rounded-2xl px-4 py-4 text-on-surface font-semibold"
                style={{ borderCurve: "continuous" } as any}
              />
            </View>
          </View>
        </View>

        {/* Section 2: Passengers */}
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-extrabold uppercase tracking-widest text-primary">
              Passengers
            </Text>
            <Text className="text-xs text-on-surface-variant">
              {selected.length} selected · {hasDriver ? "✓ driver" : "⚠ need a driver"}
            </Text>
          </View>

          {participants.map((p) => {
            const isSelected = selected.some((s) => s.participantId === p.id);
            const sel = selected.find((s) => s.participantId === p.id);

            return (
              <Pressable
                key={p.id}
                onPress={() => toggleParticipant(p.id, p.name)}
                className="active:opacity-80"
              >
                <View
                  className={`rounded-2xl p-4 border ${
                    isSelected
                      ? "bg-primary-container border-primary/30"
                      : "bg-surface-container-low border-outline/10"
                  }`}
                  style={{ borderCurve: "continuous" }}
                >
                  <View className="flex-row items-center gap-3">
                    {/* Avatar initials */}
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center ${
                        isSelected ? "bg-primary" : "bg-surface-container-high"
                      }`}
                    >
                      {isSelected ? (
                        <MaterialIcon name="check" size={18} color={colors.onPrimary} />
                      ) : (
                        <Text className="text-sm font-bold text-on-surface-variant">
                          {p.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </Text>
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-on-surface">{p.name}</Text>
                      {p.isGhost && (
                        <Text className="text-xs text-on-surface-variant">Guest</Text>
                      )}
                    </View>
                    {isSelected && sel && (
                      <RolePicker role={sel.role} onSelect={(r) => setRole(p.id, r)} />
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}

          {participants.length === 0 && (
            <View className="items-center py-6 gap-2">
              <MaterialIcon name="group" size={32} color={colors.onSurfaceVariant} />
              <Text className="text-sm text-on-surface-variant text-center">
                No trip participants yet. Add participants to the trip first.
              </Text>
            </View>
          )}
        </View>

        {/* Per-person preview */}
        {selected.length > 0 && fuelCostNum > 0 && (
          <View
            className="bg-surface-container-low rounded-2xl p-4 flex-row items-center justify-between"
            style={{ borderCurve: "continuous" }}
          >
            <Text className="text-sm text-on-surface-variant">Estimated per person</Text>
            <Text className="text-lg font-bold text-primary">
              ${perPerson.toFixed(2)}
            </Text>
          </View>
        )}

        {/* Validation hint */}
        {!isValid && name.length > 0 && (
          <View className="flex-row items-center gap-2 px-1">
            <MaterialIcon name="info" size={14} color={colors.outline} />
            <Text className="text-xs text-on-surface-variant">
              {!hasDriver && selected.length >= 2
                ? "Assign at least one driver."
                : selected.length < 2
                ? "Select at least 2 passengers."
                : "Fill in all fields to continue."}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Save button */}
      <View className="px-4 pb-8 pt-3" style={{ boxShadow: "0 -2px 12px rgba(0,0,0,0.06)" } as any}>
        <Pressable
          onPress={handleSave}
          disabled={!isValid || saving}
          className="bg-primary rounded-full py-4 items-center active:opacity-80"
          style={{ borderCurve: "continuous", opacity: !isValid || saving ? 0.5 : 1 }}
        >
          <Text className="text-on-primary font-bold text-base">
            {saving ? "Creating…" : "Create Carpool"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
