import {
  View as RNView,
  Text as RNText,
  ScrollView as RNScrollView,
  Pressable as RNPressable,
  TextInput as RNTextInput,
  TouchableHighlight as RNTouchableHighlight,
} from "react-native";
import Animated from "react-native-reanimated";
import { Link as ExpoLink } from "expo-router";
import { styled } from "react-native-css";

export const View = styled(RNView);
export const Text = styled(RNText);
export const ScrollView = styled(RNScrollView);
export const Pressable = styled(RNPressable);
export const TextInput = styled(RNTextInput);
export const TouchableHighlight = styled(RNTouchableHighlight);
export const AnimatedView = styled(Animated.View);
export const AnimatedScrollView = styled(Animated.ScrollView);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Link = styled(ExpoLink as any);
