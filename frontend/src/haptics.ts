import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const native = Platform.OS !== "web";

export const hapticLight = () => native && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
export const hapticMedium = () => native && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
export const hapticSelect = () => native && Haptics.selectionAsync();
export const hapticSuccess = () => native && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
