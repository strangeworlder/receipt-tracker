import React from "react";
import { ScrollView, View, Text } from "@/tw";
import { TopAppBar } from "@/components/TopAppBar";
import { ListItem } from "@/components/ListItem";
import { StatusPill } from "@/components/StatusPill";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useWarrantyStore } from "@/stores/warrantyStore";
import { colors } from "@/theme/colors";

export default function WarrantyScreen() {
  const warranties = useWarrantyStore((s) => s.warranties);

  return (
    <View className="flex-1 bg-surface">
      <TopAppBar />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 120, paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="px-4 gap-4">
          <Text className="text-on-surface text-2xl font-bold">Warranties</Text>
          {warranties.map((warranty) => {
            const expiresDate = new Date(warranty.expirationDate);
            const today = new Date();
            const daysLeft = Math.ceil(
              (expiresDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );
            const isExpiringSoon = daysLeft <= 90;

            return (
              <ListItem
                key={warranty.id}
                title={warranty.productName}
                subtitle={`${warranty.manufacturer} · Expires ${warranty.expirationDate}`}
                left={
                  <MaterialIcon
                    name="verified_user"
                    size={22}
                    color={colors.onSurfaceVariant}
                  />
                }
                right={
                  isExpiringSoon ? (
                    <StatusPill
                      label={`${daysLeft}d left`}
                      variant="error"
                    />
                  ) : (
                    <StatusPill label="Active" variant="primary" />
                  )
                }
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
