import React, { useRef, useState, useEffect, useCallback } from "react";
import { Switch, ActivityIndicator, Linking, AppState } from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import { Picker } from "@react-native-picker/picker";
import { View, Text, ScrollView, Pressable } from "@/tw";
import { MaterialIcon } from "@/components/MaterialIcon";
import { processReceiptImage, type OCRResult } from "@/services/ocrService";
import { createReceiptRecord } from "@/services/receiptService";
import { createFromReceipt } from "@/services/warrantyService";
import { queueDriveUpload } from "@/services/driveService";
import { useReceiptStore } from "@/stores/receiptStore";
import { formatCurrency, formatDate } from "@/utils/format";
import { colors } from "@/theme/colors";
import type { ReceiptCategory } from "@/types";

type ScannerMode = "camera" | "preview";

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScannerMode>("camera");
  const [flashOn, setFlashOn] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [category, setCategory] = useState<ReceiptCategory>("food");
  const [isWarranty, setIsWarranty] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Scan line animation
  const scanLineY = useSharedValue(0);
  useEffect(() => {
    scanLineY.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.linear }),
      -1,
      true
    );
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value * 300 }],
  }));

  // Request permission on mount
  useEffect(() => {
    if (!permission?.granted && !permission?.canAskAgain) return;
    if (!permission?.granted) requestPermission();
  }, []);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    if (process.env.EXPO_OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });
      if (!photo) return;

      setCapturedUri(photo.uri);
      setMode("preview");
      setIsProcessing(true);

      const result = await processReceiptImage(photo.uri);
      setOcrResult(result);
    } catch (error) {
      console.error("Capture failed:", error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setCapturedUri(uri);
      setMode("preview");
      setIsProcessing(true);

      try {
        const ocrRes = await processReceiptImage(uri);
        setOcrResult(ocrRes);
      } catch (error) {
        console.error("OCR failed:", error);
      } finally {
        setIsProcessing(false);
      }
    }
  }, []);

  const handleRetake = useCallback(() => {
    setMode("camera");
    setCapturedUri(null);
    setOcrResult(null);
    setCategory("food");
    setIsWarranty(false);
  }, []);

  const handleConfirmSave = useCallback(async () => {
    if (!ocrResult || !capturedUri) return;
    setIsSaving(true);

    try {
      // 1. Save locally + create Firestore record; kicks off Storage upload non-blocking
      const receiptId = await createReceiptRecord(
        ocrResult,
        capturedUri,
        category,
        isWarranty
      );

      // 2. Queue Google Drive backup
      await queueDriveUpload(
        receiptId,
        capturedUri,
        ocrResult.merchant,
        ocrResult.date
      );

      // 3. If warranty, create warranty entry
      if (isWarranty) {
        await createFromReceipt(receiptId, ocrResult);
      }

      // 4. Optimistic store update
      useReceiptStore.getState().addReceipt({
        id: receiptId,
        merchant: ocrResult.merchant,
        date: ocrResult.date,
        amount: ocrResult.amount,
        category,
        isWarranty,
        syncStatus: "pending",
      });

      // 5. Navigate back
      router.replace("/(tabs)/");
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsSaving(false);
    }
  }, [ocrResult, capturedUri, category, isWarranty]);

  // Permission denied
  if (permission && !permission.granted && !permission.canAskAgain) {
    return (
      <View
        className="flex-1 bg-on-surface items-center justify-center"
        style={{ gap: 16, paddingHorizontal: 32 }}
      >
        <MaterialIcon name="camera_alt" size={64} color={colors.surfaceContainerLowest} />
        <Text
          className="text-surface font-bold text-xl"
          style={{ textAlign: "center" }}
        >
          Camera Access Required
        </Text>
        <Text
          className="text-surface-variant text-sm"
          style={{ textAlign: "center" }}
        >
          Grant camera permission in Settings to scan receipts
        </Text>
        <Pressable
          onPress={() => Linking.openSettings()}
          className="active:scale-95"
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 9999,
            marginTop: 8,
          }}
        >
          <Text
            style={{ color: colors.onPrimary, fontWeight: "700", fontSize: 14 }}
          >
            Open Settings
          </Text>
        </Pressable>
        <Pressable onPress={() => router.back()} className="active:opacity-70">
          <Text style={{ color: colors.surfaceContainerLowest, fontSize: 14, marginTop: 8 }}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  // Camera loading
  if (!permission?.granted) {
    return (
      <View className="flex-1 bg-on-surface items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-on-surface">
      {mode === "camera" ? (
        /* ── CAMERA MODE ── */
        <View className="flex-1">
          {/* Camera */}
          <View
            style={{
              flex: 1,
              margin: 16,
              borderRadius: 24,
              borderCurve: "continuous",
              overflow: "hidden",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            <CameraView
              ref={cameraRef}
              style={{ flex: 1 }}
              facing="back"
              flash={flashOn ? "on" : "off"}
            />

            {/* Frame guide overlay */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: "85%",
                  height: "75%",
                  borderWidth: 2,
                  borderColor: `${colors.primary}99`,
                  borderRadius: 16,
                  borderCurve: "continuous",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  paddingBottom: 16,
                }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  Capture Receipt
                </Text>

                {/* Scan line */}
                <Animated.View
                  style={[
                    {
                      position: "absolute",
                      top: 20,
                      left: 0,
                      right: 0,
                      height: 2,
                    },
                    scanLineStyle,
                  ]}
                >
                  <View
                    style={{
                      width: "100%",
                      height: "100%",
                      experimental_backgroundImage:
                        "linear-gradient(to right, transparent, #02ba41, transparent)",
                    } as any}
                  />
                </Animated.View>
              </View>
            </View>
          </View>

          {/* Top bar: close + flash */}
          <View
            style={{
              position: "absolute",
              top: 56,
              left: 24,
              right: 24,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Pressable
              onPress={() => router.back()}
              className="active:opacity-70"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BlurView
                intensity={40}
                tint="dark"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
              />
              <MaterialIcon
                name="close"
                size={22}
                color={colors.surfaceContainerLowest}
              />
            </Pressable>

            <Pressable
              onPress={() => setFlashOn(!flashOn)}
              className="active:opacity-70"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BlurView
                intensity={40}
                tint="dark"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
              />
              <MaterialIcon
                name={flashOn ? "flash_on" : "flash_off"}
                size={22}
                color={colors.surfaceContainerLowest}
              />
            </Pressable>
          </View>

          {/* Bottom: capture button + gallery */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingBottom: 48,
              paddingTop: 16,
              gap: 32,
            }}
          >
            <Pressable
              onPress={handlePickImage}
              className="active:opacity-70"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                borderCurve: "continuous",
                backgroundColor: "rgba(255,255,255,0.15)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcon
                name="photo_library"
                size={24}
                color={colors.surfaceContainerLowest}
              />
            </Pressable>

            <Pressable
              onPress={handleCapture}
              className="active:scale-90"
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                borderWidth: 4,
                borderColor: colors.surfaceContainerLowest,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: colors.surfaceContainerLowest,
                }}
              />
            </Pressable>

            <View style={{ width: 44 }} />
          </View>
        </View>
      ) : (
        /* ── PREVIEW MODE ── */
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingTop: 64, gap: 24 }}
          contentInsetAdjustmentBehavior="automatic"
        >
          {/* Close button */}
          <Pressable
            onPress={() => router.back()}
            className="active:opacity-70"
            style={{
              position: "absolute",
              top: 56,
              right: 24,
              zIndex: 10,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialIcon
              name="close"
              size={20}
              color={colors.surfaceContainerLowest}
            />
          </Pressable>

          {/* Preview container */}
          <Animated.View entering={FadeInDown.duration(400).springify()}>
            <View
              style={{
                backgroundColor: colors.surfaceContainerLow,
                borderRadius: 24,
                borderCurve: "continuous",
                padding: 24,
                borderWidth: 1,
                borderColor: "rgba(114, 121, 111, 0.1)",
                gap: 20,
              }}
            >
              {/* Section A: Detected Merchant */}
              <View style={{ gap: 4 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "500",
                    color: colors.onSurfaceVariant,
                  }}
                >
                  Detected Merchant
                </Text>
                {isProcessing ? (
                  <View
                    style={{
                      height: 32,
                      backgroundColor: colors.surfaceContainer,
                      borderRadius: 8,
                    }}
                  />
                ) : (
                  <>
                    <Text
                      className="text-primary font-extrabold text-2xl"
                      selectable
                    >
                      {ocrResult?.merchant ?? "Unknown"}
                    </Text>
                    {ocrResult && ocrResult.confidence < 0.7 && (
                      <View
                        style={{
                          backgroundColor: colors.errorContainer,
                          borderRadius: 9999,
                          paddingHorizontal: 12,
                          paddingVertical: 4,
                          alignSelf: "flex-start",
                          marginTop: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "600",
                            color: colors.onErrorContainer,
                          }}
                        >
                          Low confidence — please verify
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Section B: Date + Amount */}
              <View
                style={{
                  flexDirection: "row",
                  gap: 16,
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "500",
                      color: colors.onSurfaceVariant,
                    }}
                  >
                    Date
                  </Text>
                  {isProcessing ? (
                    <View
                      style={{
                        height: 20,
                        backgroundColor: colors.surfaceContainer,
                        borderRadius: 6,
                      }}
                    />
                  ) : (
                    <Text
                      className="text-on-surface font-semibold"
                      selectable
                    >
                      {ocrResult ? formatDate(ocrResult.date) : "—"}
                    </Text>
                  )}
                </View>

                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "500",
                      color: colors.onSurfaceVariant,
                    }}
                  >
                    Amount
                  </Text>
                  {isProcessing ? (
                    <View
                      style={{
                        height: 24,
                        backgroundColor: colors.surfaceContainer,
                        borderRadius: 6,
                      }}
                    />
                  ) : (
                    <Text
                      className="text-on-surface font-bold text-xl"
                      selectable
                      style={{ fontVariant: ["tabular-nums"] }}
                    >
                      {ocrResult ? formatCurrency(ocrResult.amount) : "—"}
                    </Text>
                  )}
                </View>
              </View>

              {/* Section C: Category */}
              <View style={{ gap: 4 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "500",
                    color: colors.onSurfaceVariant,
                  }}
                >
                  Category
                </Text>
                <View
                  style={{
                    backgroundColor: colors.surfaceContainer,
                    borderRadius: 12,
                    borderCurve: "continuous",
                    overflow: "hidden",
                  }}
                >
                  <Picker
                    selectedValue={category}
                    onValueChange={(val) => setCategory(val as ReceiptCategory)}
                    style={{ color: colors.onSurface }}
                  >
                    <Picker.Item label="Food" value="food" />
                    <Picker.Item label="Travel" value="travel" />
                    <Picker.Item label="Warranty" value="warranty" />
                    <Picker.Item label="Utility" value="utility" />
                    <Picker.Item label="Shopping" value="shopping" />
                    <Picker.Item label="Other" value="other" />
                  </Picker>
                </View>
              </View>

              {/* Section D: Warranty toggle */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <MaterialIcon
                  name="verified_user"
                  size={22}
                  color={isWarranty ? colors.primary : colors.onSurfaceVariant}
                />
                <View style={{ flex: 1 }}>
                  <Text className="text-on-surface font-semibold text-sm">
                    Flag as Warranty
                  </Text>
                  <Text className="text-on-surface-variant text-xs">
                    Track for future claims
                  </Text>
                </View>
                <Switch
                  value={isWarranty}
                  onValueChange={setIsWarranty}
                  trackColor={{
                    false: colors.surfaceContainerHigh,
                    true: colors.primary,
                  }}
                />
              </View>

              {/* Section E: Action buttons */}
              <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                <Pressable
                  onPress={handleRetake}
                  className="active:scale-95"
                  style={{
                    flex: 1,
                    backgroundColor: colors.surfaceContainerHigh,
                    paddingVertical: 16,
                    borderRadius: 16,
                    borderCurve: "continuous",
                    alignItems: "center",
                  }}
                >
                  <Text className="text-on-surface font-semibold">
                    Retake
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleConfirmSave}
                  disabled={isSaving || isProcessing}
                  className="active:scale-95"
                  style={{
                    flex: 2,
                    backgroundColor: colors.primary,
                    paddingVertical: 16,
                    borderRadius: 16,
                    borderCurve: "continuous",
                    alignItems: "center",
                    opacity: isSaving || isProcessing ? 0.6 : 1,
                    boxShadow: `0 4px 12px ${colors.primary}33`,
                  }}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Text
                      style={{
                        color: colors.onPrimary,
                        fontWeight: "700",
                        fontSize: 15,
                      }}
                    >
                      Confirm & Save
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}
