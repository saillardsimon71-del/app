import { Image } from "expo-image";
import { router } from "expo-router";
import { View } from "react-native";

import { photoUrl, type Project } from "@/src/api";
import { Ionicons, PressScale, ProgressBar, StatusBadge, Txt, statusColors } from "@/src/components/ui";
import { daysFromToday, fmtDate } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function ProjectCard({ p }: { p: Project }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const sc = statusColors(colors, p.status);
  const cover = p.photos?.[0];
  return (
    <PressScale testID={`project-card-${p.id}`} onPress={() => router.push(`/project/${p.id}`)} style={styles.card}>
      <View style={styles.cover}>
        {cover ? (
          <Image source={{ uri: photoUrl(cover) }} style={styles.coverImg} contentFit="cover" transition={150} />
        ) : (
          <Ionicons name="flask-outline" size={22} color={colors.onBrandTertiary} />
        )}
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.top}>
          <Txt variant="headline" numberOfLines={1} style={{ flex: 1 }}>{p.name}</Txt>
          <StatusBadge status={p.status} />
        </View>
        <Txt variant="caption" numberOfLines={1}>
          {p.type} · {p.client_name} · MAD {fmtDate(p.mad_date)}
          {p.projected_mad && p.projected_mad > p.mad_date ? <Txt variant="caption" color={colors.warning}>{` · prévue +${daysFromToday(p.projected_mad) - daysFromToday(p.mad_date)} j`}</Txt> : null}
        </Txt>
        <ProgressBar value={p.progress} color={p.status === "en_retard" ? sc.fg : undefined} />
      </View>
    </PressScale>
  );
}

const useStyles = makeStyles((c) => ({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.md },
  cover: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  coverImg: { width: 60, height: 60 },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
}));
