import React from "react";
import { View } from "@/tw";
import { twMerge } from "tailwind-merge";

type CardVariant = "low" | "lowest" | "primary";

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  className?: string;
  rounded?: "2xl" | "3xl";
  bordered?: boolean;
}

const variantClasses: Record<CardVariant, string> = {
  low: "bg-surface-container-low",
  lowest: "bg-surface-container-lowest",
  primary: "bg-primary-container",
};

export function Card({
  children,
  variant = "low",
  className,
  rounded = "2xl",
  bordered = false,
}: CardProps) {
  return (
    <View
      className={twMerge(
        variantClasses[variant],
        rounded === "3xl" ? "rounded-3xl" : "rounded-2xl",
        bordered && "border border-outline/10",
        className
      )}
      style={{ borderCurve: "continuous" }}
    >
      {children}
    </View>
  );
}
