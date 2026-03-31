import React from "react";
import { ScrollView, View, Text } from "@/tw";
import { TopAppBar } from "@/components/TopAppBar";
import { ListItem } from "@/components/ListItem";
import { StatusPill } from "@/components/StatusPill";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useReceiptStore } from "@/stores/receiptStore";
import { colors } from "@/theme/colors";

export default function ScansScreen() {
  const receipts = useReceiptStore((s) => s.receipts);

  return (
    <View className="flex-1 bg-surface">
      <TopAppBar />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 120, paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="px-4 gap-4">
          <Text className="text-on-surface text-2xl font-bold">Scans</Text>
          {receipts.map((receipt) => (
            <ListItem
              key={receipt.id}
              title={receipt.merchant}
              subtitle={`${receipt.date} · $${receipt.amount.toFixed(2)}`}
              left={
                <MaterialIcon
                  name="receipt"
                  size={22}
                  color={colors.onSurfaceVariant}
                />
              }
              right={
                receipt.syncStatus === "pending" ? (
                  <StatusPill label="Pending" variant="neutral" />
                ) : receipt.isWarranty ? (
                  <StatusPill label="Warranty" variant="primary" />
                ) : null
              }
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
