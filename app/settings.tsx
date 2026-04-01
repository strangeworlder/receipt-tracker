import React, { useState } from "react";
import { Alert, Switch } from "react-native";
import { ScrollView, View, Text, Pressable } from "@/tw";
import { Image } from "@/tw/image";
import { router } from "expo-router";
import { MaterialIcon } from "@/components/MaterialIcon";
import { Card } from "@/components/Card";
import { colors } from "@/theme/colors";
import { useAuthStore } from "@/stores/authStore";
import { signOut, linkWithGoogle } from "@/services/authService";
import { updateNotificationPreference } from "@/services/userService";

function providerBadge(isAnonymous: boolean, driveLinked: boolean): string {
  if (isAnonymous) return "Offline";
  if (driveLinked) return "Google";
  return "Apple";
}

export default function SettingsScreen() {
  const { user, isAnonymous, driveLinked, notificationsEnabled, setNotificationsEnabled } = useAuthStore();
  const [linkingDrive, setLinkingDrive] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleToggleNotifications(enabled: boolean) {
    setNotificationsEnabled(enabled);
    try {
      await updateNotificationPreference(enabled);
    } catch {
      // Revert optimistic update on failure
      setNotificationsEnabled(!enabled);
    }
  }

  async function handleLinkGoogle() {
    setLinkingDrive(true);
    try {
      await linkWithGoogle();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to link Google account.";
      Alert.alert("Link failed", message);
    } finally {
      setLinkingDrive(false);
    }
  }

  function handleSignOut() {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            setSigningOut(true);
            try {
              await signOut();
              // Auth state observer in root layout redirects to onboarding
            } catch (err: unknown) {
              const message =
                err instanceof Error ? err.message : "Sign-out failed.";
              Alert.alert("Error", message);
              setSigningOut(false);
            }
          },
        },
      ]
    );
  }

  const badge = providerBadge(isAnonymous, driveLinked);

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="px-4 pt-14 pb-3 flex-row items-center justify-between">
        <Text className="text-on-surface text-xl font-bold">Settings</Text>
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center active:opacity-70"
        >
          <MaterialIcon name="close" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, gap: 16 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Profile card */}
        <Card variant="low" className="p-4">
          <View className="flex-row items-center gap-4">
            {user?.avatarUrl ? (
              <Image
                source={{ uri: user.avatarUrl }}
                className="w-16 h-16 rounded-full"
                contentFit="cover"
              />
            ) : (
              <View className="w-16 h-16 rounded-full bg-primary-container items-center justify-center">
                <MaterialIcon
                  name="person"
                  size={32}
                  color={colors.onPrimaryContainer}
                />
              </View>
            )}
            <View className="flex-1 gap-0.5">
              <Text className="text-on-surface font-semibold text-base">
                {user?.displayName ?? (isAnonymous ? "Offline user" : "Unknown")}
              </Text>
              {user?.email ? (
                <Text className="text-on-surface-variant text-sm">
                  {user.email}
                </Text>
              ) : null}
              <View className="mt-1 self-start bg-secondary-container px-2 py-0.5 rounded-full">
                <Text className="text-on-secondary-container text-xs font-medium">
                  {badge}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Google Drive sync */}
        <Card variant="low" className="p-4">
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <MaterialIcon
                name="drive_folder_upload"
                size={20}
                color={colors.primary}
              />
              <Text className="text-on-surface font-semibold text-base">
                Google Drive Backup
              </Text>
            </View>

            {isAnonymous ? (
              <Text className="text-on-surface-variant text-sm">
                Sign in to enable automatic receipt backup to Google Drive.
              </Text>
            ) : driveLinked ? (
              <View className="flex-row items-center gap-2">
                <View className="w-2 h-2 rounded-full bg-primary" />
                <Text className="text-on-surface-variant text-sm flex-1">
                  Active — your receipts are backed up automatically.
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                <Text className="text-on-surface-variant text-sm">
                  Link your Google account to enable Drive backup.
                </Text>
                <Pressable
                  onPress={handleLinkGoogle}
                  disabled={linkingDrive}
                  className="flex-row items-center justify-center gap-2 bg-primary-container rounded-2xl py-3 active:scale-95"
                  style={{
                    borderCurve: "continuous",
                    opacity: linkingDrive ? 0.6 : 1,
                  }}
                >
                  <MaterialIcon
                    name="link"
                    size={18}
                    color={colors.onPrimaryContainer}
                  />
                  <Text className="text-on-primary-container font-semibold text-sm">
                    {linkingDrive ? "Linking…" : "Link Google Account"}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </Card>

        {/* Notifications */}
        <Card variant="low" className="p-4">
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-row items-center gap-3 flex-1">
              <MaterialIcon
                name="notifications_active"
                size={20}
                color={colors.primary}
              />
              <View className="flex-1">
                <Text className="text-on-surface font-semibold text-base">
                  Notifications
                </Text>
                <Text className="text-on-surface-variant text-xs">
                  Warranty expiry reminders and settlement alerts
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{
                false: colors.outlineVariant,
                true: colors.primary,
              }}
              thumbColor={colors.onPrimary}
            />
          </View>
        </Card>

        {/* Sign out */}
        <Pressable
          onPress={handleSignOut}
          disabled={signingOut}
          className="items-center py-4 active:opacity-70"
        >
          <Text
            className="text-base font-semibold"
            style={{ color: signingOut ? colors.onSurfaceVariant : colors.error }}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
