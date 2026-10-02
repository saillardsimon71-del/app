import { router } from "expo-router";
import { View } from "react-native";

import type { Project } from "@/src/api";
import { Ionicons, PressScale, ProgressBar, StatusBadge, Txt, TypeBadge, statusColors } from "@/src/components/ui";
import { fmtDate, week } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function ProjectCard({ p }: { p: Project }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const sc = statusColors(colors, p.status);
  return (
    <PressScale testID={`project-card-${p.id}`} onPress={() => router.push(`/project/${p.id}`)} style={styles.card}>
      <View style={styles.top}>
        <TypeBadge type={p.type} />
        <Txt variant="caption" style={{ flex: 1 }} numberOfLines={1}>
          {p.client_name}
        </Txt>
        <StatusBadge status={p.status} />
      </View>
      <Txt variant="headline" numberOfLines={2}>
        {p.name}
      </Txt>
      {p.next_step ? (
        <Txt variant="callout" numberOfLines={1}>
          Prochaine étape : {p.next_step.name}
        </Txt>
      ) : null}
      <ProgressBar value={p.progress} color={p.status === "en_retard" ? sc.fg : undefined} />
      <View style={styles.bottom}>
        <Ionicons name="flag-outline" size={14} color={colors.muted} />
        <Txt variant="mono" color={colors.onSurfaceSecondary}>
          MAD {fmtDate(p.mad_date)} · {week(p.mad_date)}
        </Txt>
        <View style={{ flex: 1 }} />
        <Txt variant="caption">
          {p.done_count}/{p.step_count}
        </Txt>
        <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} />
      </View>
    </PressScale>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bottom: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
}));
