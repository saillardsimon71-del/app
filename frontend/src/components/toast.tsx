import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Ionicons } from "@/src/components/ui";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

type ToastT = { id: number; message: string; kind: "success" | "error" | "info" };
const Ctx = createContext<(message: string, kind?: ToastT["kind"]) => void>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastT | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const show = useCallback((message: string, kind: ToastT["kind"] = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, kind });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const icon = toast?.kind === "error" ? "alert-circle" : toast?.kind === "info" ? "information-circle" : "checkmark-circle";
  const iconColor = toast?.kind === "error" ? colors.error : toast?.kind === "info" ? colors.info : colors.success;

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center" }]}>
          <Animated.View
            key={toast.id}
            entering={FadeInUp.springify().damping(18)}
            exiting={FadeOutUp}
            testID="toast-message"
            style={[styles.toast, { top: insets.top + spacing.sm, backgroundColor: colors.surfaceInverse }]}
          >
            <Ionicons name={icon} size={20} color={iconColor} />
            <Text style={[styles.text, { color: colors.onSurfaceInverse }]}>{toast.message}</Text>
          </Animated.View>
        </View>
      ) : null}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    maxWidth: "90%",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: { fontFamily: fonts.medium, fontSize: 14, flexShrink: 1 },
});
