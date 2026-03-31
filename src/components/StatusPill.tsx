import React from "react";
import { View, Text } from "@/tw";
import { twMerge } from "tailwind-merge";

type PillVariant = "primary" | "secondary" | "error" | "neutral";

interface StatusPillProps {
  label: string;
  variant?: PillVariant;
  className?: string;
}

const variantClasses: Record<PillVariant, { container: string; text: string }> =
  {
    primary: {
      container: "bg-primary-container",
      text: "text-on-primary-container",
    },
    secondary: {
      container: "bg-secondary-container",
      text: "text-on-secondary-container",
    },
    error: {
      container: "bg-error-container",
      text: "text-on-error-container",
    },
    neutral: {
      container: "bg-surface-container-high",
      text: "text-on-surface-variant",
    },
  };

export function StatusPill({
  label,
  variant = "neutral",
  className,
}: StatusPillProps) {
  const { container, text } = variantClasses[variant];
  return (
    <View
      className={twMerge(
        "rounded-full px-3 py-1 self-start",
        container,
        className
      )}
    >
      <Text className={twMerge("text-xs font-medium", text)}>{label}</Text>
    </View>
  );
}
