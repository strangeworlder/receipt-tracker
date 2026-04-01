import React, { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { View, Text } from "@/tw";
import { useLocalSearchParams, useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import functions from "@react-native-firebase/functions";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { MaterialIcon } from "@/components/MaterialIcon";
import { colors } from "@/theme/colors";

export default function InviteLandingScreen() {
  const { inviteId } = useLocalSearchParams<{ inviteId: string; tripId: string }>();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();

  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    firestore()
      .collection("tripInvitations")
      .doc(inviteId)
      .get()
      .then((doc) => {
        if (!doc.exists()) {
          setError("This invitation link is invalid or has expired.");
        } else {
          setInvite(doc.data());
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load invitation. Please try again.");
        setLoading(false);
      });
  }, [inviteId]);

  async function handleJoin() {
    setJoining(true);
    try {
      const resolveGhost = functions().httpsCallable("resolveGhostParticipant");
      await resolveGhost({ tripId, inviteId });
      router.replace(`/(tabs)/trips/${tripId}` as any);
    } catch (e: any) {
      setError(e.message ?? "Failed to join trip. Please try again.");
      setJoining(false);
    }
  }

  // ── Loading state ──
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-surface px-6 gap-4">
        <View
          className="w-20 h-20 bg-error-container rounded-3xl items-center justify-center"
          style={{ borderCurve: "continuous" }}
        >
          <MaterialIcon name="error_outline" size={36} color={colors.error} />
        </View>
        <Text className="text-2xl font-extrabold text-on-surface text-center">
          Invalid Invite
        </Text>
        <Text className="text-on-surface-variant text-center text-base">
          {error}
        </Text>
        <SecondaryButton label="Go Home" onPress={() => router.replace("/(tabs)/" as any)} />
      </View>
    );
  }

  // ── Invite found ──
  return (
    <View className="flex-1 bg-surface px-6">
      {/* Centered content */}
      <View className="flex-1 items-center justify-center gap-5">
        <View
          className="w-20 h-20 bg-primary-container rounded-3xl items-center justify-center"
          style={{ borderCurve: "continuous" }}
        >
          <MaterialIcon name="terrain" size={36} color={colors.primary} />
        </View>

        <View className="items-center gap-2">
          <Text className="text-3xl font-extrabold text-on-surface text-center">
            You're invited!
          </Text>
          <Text className="text-on-surface-variant text-center text-base px-4">
            <Text className="font-bold text-on-surface">
              {invite.invitedByName}
            </Text>
            {" "}invited you to join{" "}
            <Text className="font-bold text-on-surface">
              {invite.tripName}
            </Text>
            .
          </Text>
        </View>
      </View>

      {/* Bottom actions */}
      <View className="gap-4 pb-12">
        {!auth().currentUser ? (
          <>
            <Text className="text-center text-on-surface-variant text-sm">
              Sign in to join this trip and track expenses together.
            </Text>
            <PrimaryButton
              label="Sign In to Join"
              onPress={() =>
                router.push(`/(auth)/onboarding?redirect=/invite/${inviteId}` as any)
              }
            />
          </>
        ) : (
          <PrimaryButton
            label={joining ? "Joining…" : "Join Trip"}
            onPress={handleJoin}
            disabled={joining}
          />
        )}
        <SecondaryButton
          label="Maybe Later"
          onPress={() => router.replace("/(tabs)/" as any)}
        />
      </View>
    </View>
  );
}
