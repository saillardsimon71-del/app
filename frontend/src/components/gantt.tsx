import { differenceInCalendarDays } from "date-fns";
import { View } from "react-native";

import type { Phase } from "@/src/api";
import { Txt } from "@/src/components/ui";
import { d, week } from "@/src/format";
import { fonts, makeStyles, spacing, useTheme } from "@/src/theme";

export function Gantt({ phases, start, end, testID }: { phases: Phase[]; start: string; end: string; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const s = d(start);
  const total = Math.max(1, differenceInCalendarDays(d(end), s));
  const todayPct = differenceInCalendarDays(new Date(), s) / total;
  const pct = (iso: string) => Math.min(1, Math.max(0, differenceInCalendarDays(d(iso), s) / total));

  return (
    <View testID={testID} style={styles.wrap}>
      {phases.map((p) => {
        const left = pct(p.start);
        const width = Math.max(0.02, pct(p.end) - left);
        const fill = p.total ? p.done / p.total : 0;
        const barColor = p.late ? colors.error : colors.brandPrimary;
        return (
          <View key={p.key} style={styles.row}>
            <Txt variant="caption" style={styles.label} numberOfLines={1}>
              {p.name}
            </Txt>
            <View style={styles.track}>
              <View style={[styles.bar, { left: `${left * 100}%`, width: `${width * 100}%`, backgroundColor: colors.brandTertiary }]}>
                <View style={{ width: `${fill * 100}%`, height: "100%", backgroundColor: barColor, borderRadius: 4 }} />
              </View>
            </View>
          </View>
        );
      })}
      <View style={styles.axis}>
        <View style={{ width: 84 }} />
        <View style={styles.axisInner}>
          <Txt variant="caption" style={styles.axisText}>{week(start)}</Txt>
          <Txt variant="caption" style={styles.axisText}>{week(end)}</Txt>
        </View>
      </View>
      {todayPct >= 0 && todayPct <= 1 ? (
        <View pointerEvents="none" style={[styles.todayWrap]}>
          <View style={{ width: 84 }} />
          <View style={{ flex: 1 }}>
            <View style={[styles.today, { left: `${todayPct * 100}%`, backgroundColor: colors.error }]} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.sm, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", height: 20 },
  label: { width: 84, color: c.onSurfaceSecondary },
  track: { flex: 1, height: 12, backgroundColor: c.surfaceSecondary, borderRadius: 4 },
  bar: { position: "absolute", top: 0, bottom: 0, borderRadius: 4, overflow: "hidden" },
  axis: { flexDirection: "row" },
  axisInner: { flex: 1, flexDirection: "row", justifyContent: "space-between" },
  axisText: { fontFamily: fonts.mono, fontSize: 11 },
  todayWrap: { position: "absolute", top: 0, bottom: 18, left: 0, right: 0, flexDirection: "row" },
  today: { position: "absolute", top: -4, bottom: 0, width: 2, borderRadius: 1 },
}));
