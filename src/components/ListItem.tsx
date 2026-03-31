import React from "react";
import { View, Text, Pressable } from "@/tw";
import { twMerge } from "tailwind-merge";

interface ListItemProps {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  className?: string;
}

export function ListItem({
  title,
  subtitle,
  left,
  right,
  onPress,
  className,
}: ListItemProps) {
  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      className={twMerge(
        "flex-row items-center gap-3 py-2",
        onPress && "active:opacity-70",
        className
      )}
    >
      {left && (
        <View className="w-12 h-12 rounded-xl bg-surface-container items-center justify-center">
          {left}
        </View>
      )}
      <View className="flex-1 gap-0.5">
        <Text className="text-on-surface font-medium text-sm leading-tight">
          {title}
        </Text>
        {subtitle && (
          <Text className="text-on-surface-variant text-xs leading-tight">
            {subtitle}
          </Text>
        )}
      </View>
      {right && <View>{right}</View>}
    </Container>
  );
}
