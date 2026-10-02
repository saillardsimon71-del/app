import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Txt } from "@/src/components/ui";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export function ScreenHeader({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          {subtitle ? (
            <Txt variant="caption" color={colors.muted} style={styles.subtitle}>
              {subtitle}
            </Txt>
          ) : null}
          <Txt variant="largeTitle" testID="screen-title">
            {title}
          </Txt>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { backgroundColor: c.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: c.divider },
  top: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  subtitle: { textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
}));
