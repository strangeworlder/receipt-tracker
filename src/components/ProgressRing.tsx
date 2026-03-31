import React from "react";
import Svg, { Circle } from "react-native-svg";
import { View, Text } from "@/tw";
import { colors } from "@/theme/colors";

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
}

export function ProgressRing({
  percentage,
  size = 80,
  strokeWidth = 8,
  color = colors.primary,
  trackColor = colors.surfaceContainerHigh,
  label,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset =
    circumference - (clampedPercentage / 100) * circumference;

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {label !== undefined && (
        <View className="absolute items-center">
          <Text
            style={{
              fontSize: size * 0.2,
              fontFamily: "Lexend_600SemiBold",
              color: colors.onSurface,
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </View>
  );
}
