import React from "react";
import { View, Text } from "@/tw";
import { Image } from "@/tw/image";

interface AvatarProps {
  uri?: string;
  name: string;
  size?: number;
}

interface AvatarStackProps {
  avatars: AvatarProps[];
  maxVisible?: number;
  size?: number;
}

function Avatar({ uri, name, size = 32 }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: "#f7fbf3",
        }}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: "#f7fbf3",
        backgroundColor: "#d5e8cf",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: size * 0.35,
          fontFamily: "Lexend_600SemiBold",
          color: "#111f0f",
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

export function AvatarStack({
  avatars,
  maxVisible = 4,
  size = 32,
}: AvatarStackProps) {
  const visible = avatars.slice(0, maxVisible);
  const overflow = avatars.length - maxVisible;
  const overlap = size * 0.3;

  return (
    <View className="flex-row items-center">
      {visible.map((avatar, index) => (
        <View
          key={index}
          style={{ marginLeft: index === 0 ? 0 : -overlap, zIndex: index }}
        >
          <Avatar uri={avatar.uri} name={avatar.name} size={size} />
        </View>
      ))}
      {overflow > 0 && (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: "#f7fbf3",
            backgroundColor: "#ebefe7",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: -overlap,
            zIndex: maxVisible,
          }}
        >
          <Text
            style={{
              fontSize: size * 0.3,
              fontFamily: "Lexend_600SemiBold",
              color: "#424940",
            }}
          >
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}
