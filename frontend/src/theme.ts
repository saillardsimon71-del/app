// Design tokens for this app. Light theme only (iOS-Native Clean, see design_guidelines.json).
// Keys match the "color" block of /app/design_guidelines.json.
// A plain key is a background, its `on` partner is the text/icon color on top of it.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#1C1C1E",
  surfaceSecondary: "#F2F2F7",
  onSurfaceSecondary: "#3A3A3C",
  surfaceTertiary: "#E5E5EA",
  onSurfaceTertiary: "#8E8E93",
  surfaceInverse: "#1C1C1E",
  onSurfaceInverse: "#FFFFFF",
  muted: "#8E8E93",

  brand: "#4A6B53",
  onBrand: "#FFFFFF",
  brandPrimary: "#4A6B53",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#385240",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#E7F0E9",
  onBrandTertiary: "#2C4233",

  success: "#34C759",
  onSuccess: "#FFFFFF",
  warning: "#FF9F0A",
  onWarning: "#FFFFFF",
  error: "#FF3B30",
  onError: "#FFFFFF",
  info: "#0A84FF",
  onInfo: "#FFFFFF",

  // Soft status fills for badges
  successSoft: "#E3F7E8",
  warningSoft: "#FFF2DE",
  errorSoft: "#FFE7E5",
  infoSoft: "#E1EFFF",

  border: "#E5E5EA",
  borderStrong: "#C6C6C8",
  divider: "#E5E5EA",
  overlay: "rgba(0,0,0,0.35)",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export const colors = light;

export const fonts = {
  regular: "Geist-Regular",
  medium: "Geist-Medium",
  semibold: "Geist-SemiBold",
  bold: "Geist-Bold",
  mono: "GeistMono-Medium",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 16, pill: 999 };

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
