import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, Text, Pressable } from "@/tw";
import { MaterialIcon } from "@/components/MaterialIcon";
import { colors } from "@/theme/colors";
import { useToast } from "@/hooks/useToast";

type ToastVariant = "success" | "error" | "info";

const VARIANT_STYLES: Record<
  ToastVariant,
  { bg: string; text: string; icon: string; iconColor: string }
> = {
  success: {
    bg: colors.primary,
    text: colors.onPrimary,
    icon: "check_circle",
    iconColor: colors.onPrimary,
  },
  error: {
    bg: colors.error,
    text: colors.onError,
    icon: "error",
    iconColor: colors.onError,
  },
  info: {
    bg: colors.surfaceContainerHigh,
    text: colors.onSurface,
    icon: "info",
    iconColor: colors.primary,
  },
};

const AUTO_DISMISS_MS = 3000;

export function Toast() {
  const { visible, message, variant, hideToast } = useToast();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => hideToast(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible, message, hideToast]);

  if (!visible) return null;

  const v = VARIANT_STYLES[variant];

  return (
    <Animated.View
      entering={FadeInDown.duration(260).springify()}
      exiting={FadeOutUp.duration(200)}
      style={[
        styles.container,
        {
          top: insets.top + 12,
          backgroundColor: v.bg,
          borderCurve: "continuous",
        } as any,
      ]}
      pointerEvents="box-none"
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
      >
        <MaterialIcon name={v.icon} size={20} color={v.iconColor} />
        <Text
          style={[styles.message, { color: v.text }]}
          numberOfLines={2}
        >
          {message}
        </Text>
        <Pressable onPress={hideToast} style={{ marginLeft: "auto" }}>
          <MaterialIcon name="close" size={16} color={v.text} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.16)",
  } as any,
  message: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Lexend_600SemiBold",
  },
});
