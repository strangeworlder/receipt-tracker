import React from "react";
import { View, Text, Pressable } from "@/tw";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { MaterialIcon } from "./MaterialIcon";

interface TopAppBarProps {
  avatarUri?: string;
  userName?: string;
}

export function TopAppBar({ avatarUri, userName }: TopAppBarProps) {
  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "TT";

  return (
    <BlurView
      intensity={60}
      tint="light"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
      }}
    >
      <View className="flex-row items-center justify-between px-4 pt-14 pb-3">
        <Pressable
          onPress={() => router.push("/settings")}
          className="active:opacity-70"
        >
          <View className="w-10 h-10 rounded-full bg-primary-container items-center justify-center">
            {avatarUri ? null : (
              <Text className="text-on-primary-container font-semibold text-sm">
                {initials}
              </Text>
            )}
          </View>
        </Pressable>

        <Text className="text-primary font-bold text-xl tracking-tight">
          TripTrack
        </Text>

        <Pressable
          onPress={() => router.push("/settings")}
          className="w-10 h-10 items-center justify-center active:opacity-70"
        >
          <MaterialIcon name="settings" size={24} color="#02ba41" />
        </Pressable>
      </View>
    </BlurView>
  );
}
