import React, { useState, useMemo } from "react";
import { Alert, Share, StyleSheet, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ScrollView, View, Text, Pressable, TextInput } from "@/tw";
import { router } from "expo-router";
import { MaterialIcon } from "@/components/MaterialIcon";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useAuthStore } from "@/stores/authStore";
import {
  createTrip,
  createInvitation,
  buildInviteLink,
} from "@/services/tripService";
import { getUserProfile } from "@/services/userService";
import { requireAuth } from "@/services/utils";
import { generateUUID } from "@/utils/uuid";
import { formatDate } from "@/utils/format";
import { colors } from "@/theme/colors";
import type { TripParticipant } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GhostFormState {
  name: string;
  email: string;
  phone: string;
}

interface ParticipantDraft {
  isGhost: true;
  name: string;
  email?: string;
  phone?: string;
}

// ─── Participant Chip ─────────────────────────────────────────────────────────

function ParticipantChip({
  name,
  isCurrentUser,
  onRemove,
}: {
  name: string;
  isCurrentUser: boolean;
  onRemove: () => void;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <View
      className="flex-row items-center gap-2 bg-surface-container rounded-full pl-1 pr-3 py-1"
      style={{ borderCurve: "continuous" }}
    >
      <View className="w-7 h-7 rounded-full bg-primary items-center justify-center">
        <Text className="text-on-primary text-[10px] font-extrabold">
          {initials}
        </Text>
      </View>
      <Text className="text-on-surface text-sm font-semibold">{name}</Text>
      {!isCurrentUser && (
        <Pressable onPress={onRemove} hitSlop={8}>
          <MaterialIcon name="close" size={14} color={colors.onSurfaceVariant} />
        </Pressable>
      )}
    </View>
  );
}

// ─── Add Person Form ──────────────────────────────────────────────────────────

function AddPersonForm({
  onAdd,
  onCancel,
}: {
  onAdd: (p: ParticipantDraft) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<GhostFormState>({
    name: "",
    email: "",
    phone: "",
  });

  const canAdd = form.name.trim().length > 0;

  return (
    <View
      className="bg-surface-container-low rounded-2xl p-4 gap-3"
      style={{ borderCurve: "continuous" }}
    >
      <Text className="text-xs font-extrabold uppercase tracking-widest text-primary">
        Add Person
      </Text>

      <View className="gap-2">
        <Text className="text-xs font-bold text-on-surface-variant">
          Name <Text className="text-error">*</Text>
        </Text>
        <TextInput
          value={form.name}
          onChangeText={(v) => setForm((s) => ({ ...s, name: v }))}
          placeholder="Full name"
          placeholderTextColor={colors.outline}
          className="bg-surface rounded-xl px-4 py-3 text-on-surface font-semibold"
          style={{ borderCurve: "continuous" } as any}
        />
      </View>

      <View className="gap-2">
        <Text className="text-xs font-bold text-on-surface-variant">
          Email (optional)
        </Text>
        <TextInput
          value={form.email}
          onChangeText={(v) => setForm((s) => ({ ...s, email: v }))}
          placeholder="friend@example.com"
          placeholderTextColor={colors.outline}
          keyboardType="email-address"
          autoCapitalize="none"
          className="bg-surface rounded-xl px-4 py-3 text-on-surface font-semibold"
          style={{ borderCurve: "continuous" } as any}
        />
      </View>

      <View className="gap-2">
        <Text className="text-xs font-bold text-on-surface-variant">
          Phone (optional)
        </Text>
        <TextInput
          value={form.phone}
          onChangeText={(v) => setForm((s) => ({ ...s, phone: v }))}
          placeholder="+1 555 000 0000"
          placeholderTextColor={colors.outline}
          keyboardType="phone-pad"
          className="bg-surface rounded-xl px-4 py-3 text-on-surface font-semibold"
          style={{ borderCurve: "continuous" } as any}
        />
      </View>

      <View className="flex-row gap-2 mt-1">
        <Pressable
          className="flex-1 bg-surface-container-high rounded-xl py-3 items-center active:opacity-70"
          style={{ borderCurve: "continuous" }}
          onPress={onCancel}
        >
          <Text className="text-on-surface font-bold text-sm">Cancel</Text>
        </Pressable>
        <Pressable
          className="flex-1 bg-primary rounded-xl py-3 items-center active:opacity-70"
          style={{
            borderCurve: "continuous",
            opacity: canAdd ? 1 : 0.4,
          }}
          disabled={!canAdd}
          onPress={() => {
            onAdd({
              isGhost: true,
              name: form.name.trim(),
              email: form.email.trim() || undefined,
              phone: form.phone.trim() || undefined,
            });
          }}
        >
          <Text className="text-on-primary font-bold text-sm">Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NewTripScreen() {
  const authUser = useAuthStore((s) => s.user);

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const currentUserName = authUser?.displayName ?? "You";

  const isValid = useMemo(
    () => name.trim().length > 0 && startDate <= endDate,
    [name, startDate, endDate]
  );

  const removeParticipant = (index: number) => {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateTrip = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const uid = requireAuth();
      const profile = await getUserProfile(uid);

      const currentUserParticipant: TripParticipant = {
        id: uid,
        uid,
        name: profile?.displayName ?? currentUserName,
        avatarUri: profile?.avatarUrl,
        isGhost: false,
        amountPaid: 0,
        amountOwed: 0,
      };

      const allParticipants: TripParticipant[] = [
        currentUserParticipant,
        ...participants.map((p) => ({
          id: generateUUID(),
          name: p.name,
          email: p.email,
          phone: p.phone,
          isGhost: true as const,
          managedBy: uid,
          amountPaid: 0,
          amountOwed: 0,
        })),
      ];

      const tripId = await createTrip({
        name: name.trim(),
        startDate,
        endDate,
        participants: allParticipants,
      });

      // Create invitations for ghost participants with an email
      const emailParticipants = participants.filter((p) => p.email);
      if (emailParticipants.length > 0) {
        const firstInviteId = await createInvitation(tripId, uid, emailParticipants[0].email);
        const link = buildInviteLink(firstInviteId, tripId);
        setInviteLink(link);
      }

      if (emailParticipants.length === 0) {
        router.replace(`/(tabs)/trips/${tripId}` as any);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not create trip.");
    } finally {
      setSaving(false);
    }
  };

  const handleShareInvite = async () => {
    if (!inviteLink) return;
    try {
      await Share.share({
        message: `Join my trip on TripTrack: ${inviteLink}`,
        url: inviteLink,
      });
    } catch {
      // User dismissed share sheet — ignore
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
        <Text className="text-base font-bold text-on-surface">New Trip</Text>
        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 28 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
      >
        {/* ── Section 1: Trip Details ── */}
        <View className="gap-4">
          <Text className="text-xs font-extrabold uppercase tracking-widest text-primary">
            Trip Details
          </Text>

          {/* Name */}
          <View className="gap-2">
            <Text className="text-xs font-bold text-on-surface-variant">
              Trip Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Summer Road Trip"
              placeholderTextColor={colors.outline}
              className="bg-surface-container-low rounded-2xl px-4 py-4 text-on-surface font-semibold"
              style={{ borderCurve: "continuous" } as any}
            />
          </View>

          {/* Dates */}
          <View className="flex-row gap-3">
            {/* Start date */}
            <Pressable
              className="flex-1 gap-2"
              onPress={() => {
                setShowEndPicker(false);
                setShowStartPicker((v) => !v);
              }}
            >
              <Text className="text-xs font-bold text-on-surface-variant">
                Start Date
              </Text>
              <View
                className="bg-surface-container-low rounded-2xl px-4 py-4 flex-row items-center gap-2"
                style={{ borderCurve: "continuous" }}
              >
                <MaterialIcon
                  name="calendar_today"
                  size={16}
                  color={colors.primary}
                />
                <Text className="text-on-surface font-semibold text-sm flex-1">
                  {formatDate(startDate)}
                </Text>
              </View>
            </Pressable>

            {/* End date */}
            <Pressable
              className="flex-1 gap-2"
              onPress={() => {
                setShowStartPicker(false);
                setShowEndPicker((v) => !v);
              }}
            >
              <Text className="text-xs font-bold text-on-surface-variant">
                End Date
              </Text>
              <View
                className="bg-surface-container-low rounded-2xl px-4 py-4 flex-row items-center gap-2"
                style={{ borderCurve: "continuous" }}
              >
                <MaterialIcon
                  name="calendar_today"
                  size={16}
                  color={colors.primary}
                />
                <Text className="text-on-surface font-semibold text-sm flex-1">
                  {formatDate(endDate)}
                </Text>
              </View>
            </Pressable>
          </View>

          {showStartPicker && (
            <DateTimePicker
              value={new Date(startDate)}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(_e, date) => {
                if (date) {
                  const iso = date.toISOString().split("T")[0];
                  setStartDate(iso);
                  if (iso > endDate) setEndDate(iso);
                }
                if (Platform.OS !== "ios") setShowStartPicker(false);
              }}
              minimumDate={new Date()}
            />
          )}

          {showEndPicker && (
            <DateTimePicker
              value={new Date(endDate)}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(_e, date) => {
                if (date) setEndDate(date.toISOString().split("T")[0]);
                if (Platform.OS !== "ios") setShowEndPicker(false);
              }}
              minimumDate={new Date(startDate)}
            />
          )}

          {startDate > endDate && (
            <View className="flex-row items-center gap-2">
              <MaterialIcon name="warning" size={14} color={colors.error} />
              <Text className="text-error text-xs">
                End date must be on or after start date.
              </Text>
            </View>
          )}
        </View>

        {/* ── Section 2: Participants ── */}
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-extrabold uppercase tracking-widest text-primary">
              Who's Coming?
            </Text>
            {!showAddForm && (
              <Pressable
                onPress={() => setShowAddForm(true)}
                className="flex-row items-center gap-1 active:opacity-70"
              >
                <MaterialIcon name="add" size={16} color={colors.primary} />
                <Text className="text-primary text-xs font-bold">
                  Add Person
                </Text>
              </Pressable>
            )}
          </View>

          {/* Participant chips */}
          <View className="flex-row flex-wrap gap-2">
            {/* Current user (always first, non-removable) */}
            <ParticipantChip
              name={currentUserName}
              isCurrentUser={true}
              onRemove={() => {}}
            />
            {participants.map((p, i) => (
              <ParticipantChip
                key={i}
                name={p.name}
                isCurrentUser={false}
                onRemove={() => removeParticipant(i)}
              />
            ))}
          </View>

          {/* Add person inline form */}
          {showAddForm && (
            <AddPersonForm
              onAdd={(p) => {
                setParticipants((prev) => [...prev, p]);
                setShowAddForm(false);
              }}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          <Text className="text-xs text-on-surface-variant">
            Added people will be invited via the link you share after creating
            the trip. They'll be matched by email when they join.
          </Text>
        </View>

        {/* ── Section 3: Invite Link (post-save) ── */}
        {inviteLink && (
          <View
            className="bg-primary-container rounded-2xl p-5 gap-3"
            style={{ borderCurve: "continuous" }}
          >
            <View className="flex-row items-center gap-2">
              <MaterialIcon name="link" size={20} color={colors.primary} />
              <Text className="text-primary font-bold text-base flex-1">
                Trip Created!
              </Text>
            </View>
            <Text className="text-on-primary-container text-sm">
              Share the invite link so your guests can join and track expenses
              together.
            </Text>
            <View
              className="bg-surface rounded-xl px-3 py-2"
              style={{ borderCurve: "continuous" }}
            >
              <Text className="text-on-surface-variant text-xs font-mono" numberOfLines={1}>
                {inviteLink}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={handleShareInvite}
                className="flex-1 bg-primary rounded-xl py-3 items-center flex-row justify-center gap-2 active:opacity-80"
                style={{ borderCurve: "continuous" }}
              >
                <MaterialIcon name="share" size={16} color={colors.onPrimary} />
                <Text className="text-on-primary font-bold text-sm">
                  Share Invite
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  // Navigate after sharing or dismissing
                  const tripIdFromLink = inviteLink.split("tripId=")[1];
                  if (tripIdFromLink) {
                    router.replace(`/(tabs)/trips/${tripIdFromLink}` as any);
                  }
                }}
                className="flex-1 bg-surface-container-high rounded-xl py-3 items-center active:opacity-80"
                style={{ borderCurve: "continuous" }}
              >
                <Text className="text-on-surface font-bold text-sm">
                  View Trip
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Save button — pinned at bottom */}
      {!inviteLink && (
        <View
          className="px-4 pb-8 pt-3"
          style={styles.saveBar as any}
        >
          <Pressable
            onPress={handleCreateTrip}
            disabled={!isValid || saving}
            className="bg-primary rounded-full py-4 items-center active:opacity-80"
            style={{
              borderCurve: "continuous",
              opacity: !isValid || saving ? 0.5 : 1,
            }}
          >
            <Text className="text-on-primary font-bold text-base">
              {saving ? "Creating…" : "Create Trip"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  saveBar: {
    boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
  },
});
