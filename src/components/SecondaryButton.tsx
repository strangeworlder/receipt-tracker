import React from "react";
import { Pressable, Text } from "@/tw";
import { twMerge } from "tailwind-merge";

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  className,
}: SecondaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={twMerge(
        "bg-surface-container-high rounded-full px-6 py-4 items-center justify-center active:scale-95",
        disabled && "opacity-40",
        className
      )}
      style={{ borderCurve: "continuous" }}
    >
      <Text className="text-on-surface font-semibold text-base tracking-wide">
        {label}
      </Text>
    </Pressable>
  );
}
