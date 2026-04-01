import React, { useState } from "react";
import { StyleSheet, Alert, Modal } from "react-native";
import { ScrollView, View, Text, Pressable, TextInput } from "@/tw";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { MaterialIcon } from "@/components/MaterialIcon";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { colors } from "@/theme/colors";
import { updateWarranty } from "@/services/warrantyService";
import { formatDate } from "@/utils/format";
import type { Warranty } from "@/types";

interface WarrantyEditSheetProps {
  warranty: Warranty;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function WarrantyEditSheet({
  warranty,
  visible,
  onClose,
  onSaved,
}: WarrantyEditSheetProps) {
  const [productName, setProductName] = useState(warranty.productName);
  const [manufacturer, setManufacturer] = useState(warranty.manufacturer);
  const [coverageType, setCoverageType] = useState(warranty.coverageType);
  const [expirationDate, setExpirationDate] = useState(warranty.expirationDate);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateWarranty(warranty.id, {
        productName,
        manufacturer,
        coverageType,
        expirationDate: expirationDate as any,
      });
      onSaved();
      onClose();
    } catch {
      Alert.alert("Error", "Failed to update warranty. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text className="text-on-surface text-xl font-bold">
            Edit Warranty
          </Text>
          <Pressable
            onPress={onClose}
            className="w-8 h-8 items-center justify-center"
          >
            <MaterialIcon name="close" size={20} color={colors.onSurfaceVariant} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Product Name */}
          <View style={styles.field}>
            <Text className="text-on-surface-variant text-xs font-semibold uppercase tracking-widest mb-2">
              Product Name
            </Text>
            <TextInput
              value={productName}
              onChangeText={setProductName}
              placeholder="e.g. Samsung TV 55&quot;"
              placeholderTextColor={colors.onSurfaceVariant}
              style={styles.input}
            />
          </View>

          {/* Manufacturer */}
          <View style={styles.field}>
            <Text className="text-on-surface-variant text-xs font-semibold uppercase tracking-widest mb-2">
              Manufacturer
            </Text>
            <TextInput
              value={manufacturer}
              onChangeText={setManufacturer}
              placeholder="e.g. Samsung"
              placeholderTextColor={colors.onSurfaceVariant}
              style={styles.input}
            />
          </View>

          {/* Coverage Type */}
          <View style={styles.field}>
            <Text className="text-on-surface-variant text-xs font-semibold uppercase tracking-widest mb-2">
              Coverage Type
            </Text>
            <TextInput
              value={coverageType}
              onChangeText={setCoverageType}
              placeholder="e.g. Standard 1-year"
              placeholderTextColor={colors.onSurfaceVariant}
              style={styles.input}
            />
          </View>

          {/* Expiration Date */}
          <View style={styles.field}>
            <Text className="text-on-surface-variant text-xs font-semibold uppercase tracking-widest mb-2">
              Expiration Date (YYYY-MM-DD)
            </Text>
            <TextInput
              value={expirationDate}
              onChangeText={setExpirationDate}
              placeholder="e.g. 2027-01-01"
              placeholderTextColor={colors.onSurfaceVariant}
              keyboardType="numbers-and-punctuation"
              style={styles.input}
            />
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <SecondaryButton
              label="Cancel"
              onPress={onClose}
              className="flex-1"
            />
            <PrimaryButton
              label={saving ? "Saving…" : "Save Changes"}
              onPress={handleSave}
              className="flex-1"
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
    maxHeight: "80%",
  } as any,
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outlineVariant,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.outlineVariant}4d`,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 16,
  },
  field: {
    gap: 0,
  },
  input: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Lexend_400Regular",
    color: colors.onSurface,
    borderCurve: "continuous",
  } as any,
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
});
