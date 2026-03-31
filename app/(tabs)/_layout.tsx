import React from "react";
import { Tabs } from "expo-router";
import { View, Text } from "@/tw";
import { MaterialIcon } from "@/components/MaterialIcon";
import { colors } from "@/theme/colors";

interface TabIconProps {
  name: string;
  focused: boolean;
  label: string;
}

function TabIcon({ name, focused, label }: TabIconProps) {
  return (
    <View className="items-center gap-0.5 pt-1">
      <View
        className={
          focused
            ? "bg-primary-container rounded-full px-4 py-1.5"
            : "px-4 py-1.5"
        }
        style={{ borderCurve: "continuous" }}
      >
        <MaterialIcon
          name={name}
          size={22}
          color={focused ? colors.onPrimaryContainer : colors.onSurfaceVariant}
        />
      </View>
      <Text
        style={{
          fontSize: 9,
          fontFamily: focused ? "Lexend_700Bold" : "Lexend_500Medium",
          color: focused ? colors.onPrimaryContainer : colors.onSurfaceVariant,
          letterSpacing: 0.8,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "rgba(255,255,255,0.92)",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 80,
          paddingBottom: 8,
          paddingTop: 4,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="dashboard" focused={focused} label="Home" />
          ),
        }}
      />
      <Tabs.Screen
        name="scans"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="document_scanner" focused={focused} label="Scans" />
          ),
        }}
      />
      <Tabs.Screen
        name="split"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="call_split" focused={focused} label="Split" />
          ),
        }}
      />
      <Tabs.Screen
        name="warranty"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="verified_user" focused={focused} label="Warranty" />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="folder_shared" focused={focused} label="Trips" />
          ),
        }}
      />
    </Tabs>
  );
}
