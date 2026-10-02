import Ionicons from "@react-native-vector-icons/ionicons";
import { type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import type { ProjectType, Status } from "@/src/api";
import { STATUS_LABEL } from "@/src/format";
import { hapticLight, hapticSelect } from "@/src/haptics";
import { fonts, makeStyles, radius, spacing, useTheme, type ThemeColors } from "@/src/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];
export { Ionicons };

type TxtProps = {
  children: ReactNode;
  variant?: "largeTitle" | "title" | "headline" | "body" | "callout" | "caption" | "mono" | "label";
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  testID?: string;
};

export function Txt({ children, variant = "body", color, style, numberOfLines, testID }: TxtProps) {
  const styles = useStyles();
  return (
    <Text testID={testID} numberOfLines={numberOfLines} style={[styles[variant], color ? { color } : null, style]}>
      {children}
    </Text>
  );
}

export function PressScale({
  children,
  onPress,
  style,
  testID,
  disabled,
  haptic = true,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  disabled?: boolean;
  haptic?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={() => {
        if (haptic) hapticLight();
        onPress?.();
      }}
      style={({ pressed }) => [style, { opacity: pressed ? 0.7 : disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      {children}
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "destructive" | "plain";
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const bg = { primary: colors.brandPrimary, secondary: colors.brandTertiary, destructive: colors.errorSoft, plain: "transparent" }[variant];
  const fg = { primary: colors.onBrandPrimary, secondary: colors.onBrandTertiary, destructive: colors.error, plain: colors.brandPrimary }[variant];
  return (
    <PressScale testID={testID} onPress={onPress} disabled={disabled || loading} style={[styles.button, { backgroundColor: bg }, style]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
        </>
      )}
    </PressScale>
  );
}

export function IconButton({ icon, onPress, testID, tinted }: { icon: IconName; onPress: () => void; testID: string; tinted?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <PressScale testID={testID} onPress={onPress} style={[styles.iconBtn, tinted && { backgroundColor: colors.brandPrimary }]}>
      <Ionicons name={icon} size={20} color={tinted ? colors.onBrandPrimary : colors.brandPrimary} />
    </PressScale>
  );
}

export function Group({ title, footer, children, testID }: { title?: string; footer?: string; children: ReactNode; testID?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.groupWrap} testID={testID}>
      {title ? <Text style={styles.groupTitle}>{title.toUpperCase()}</Text> : null}
      <View style={styles.group}>{children}</View>
      {footer ? <Text style={styles.groupFooter}>{footer}</Text> : null}
    </View>
  );
}

export function Row({
  label,
  value,
  icon,
  onPress,
  last,
  right,
  testID,
  destructive,
}: {
  label: string;
  value?: string;
  icon?: IconName;
  onPress?: () => void;
  last?: boolean;
  right?: ReactNode;
  testID?: string;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const content = (
    <View style={[styles.row, !last && styles.rowDivider]}>
      {icon ? (
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={16} color={colors.onBrandPrimary} />
        </View>
      ) : null}
      <Text style={[styles.rowLabel, destructive && { color: colors.error }]} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {onPress && !right ? <Ionicons name="chevron-forward" size={18} color={colors.borderStrong} /> : null}
    </View>
  );
  if (!onPress) return <View testID={testID}>{content}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceSecondary : "transparent" })}>
      {content}
    </Pressable>
  );
}

export function Field({ label, last, ...props }: TextInputProps & { label: string; last?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.field, !last && styles.rowDivider, props.multiline && { alignItems: "flex-start" }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        style={[styles.fieldInput, props.multiline && { minHeight: 72, textAlignVertical: "top" }]}
      />
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  testID,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  testID: string;
  suffix?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.stepper}>
      <Pressable
        testID={`${testID}-minus`}
        hitSlop={8}
        disabled={value <= min}
        onPress={() => {
          hapticSelect();
          onChange(Math.max(min, value - 1));
        }}
        style={[styles.stepBtn, value <= min && { opacity: 0.35 }]}
      >
        <Ionicons name="remove" size={18} color={colors.onSurface} />
      </Pressable>
      <Text testID={`${testID}-value`} style={styles.stepValue}>
        {value}
        {suffix ? ` ${suffix}` : ""}
      </Text>
      <Pressable
        testID={`${testID}-plus`}
        hitSlop={8}
        disabled={value >= max}
        onPress={() => {
          hapticSelect();
          onChange(Math.min(max, value + 1));
        }}
        style={[styles.stepBtn, value >= max && { opacity: 0.35 }]}
      >
        <Ionicons name="add" size={18} color={colors.onSurface} />
      </Pressable>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testID: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.segment} testID={testID}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={`${testID}-${o.value}`}
            onPress={() => {
              hapticSelect();
              onChange(o.value);
            }}
            style={[styles.segmentItem, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  testID: string;
}) {
  const styles = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipScroll}
      contentContainerStyle={styles.chipRow}
      testID={testID}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={`${testID}-${o.value}`}
            onPress={() => {
              hapticSelect();
              onChange(o.value);
            }}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {o.label}
              {o.count !== undefined ? ` · ${o.count}` : ""}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function statusColors(c: ThemeColors, s: Status) {
  return {
    en_retard: { bg: c.errorSoft, fg: c.error },
    a_risque: { bg: c.warningSoft, fg: c.warning },
    dans_les_temps: { bg: c.successSoft, fg: c.brandSecondary },
    a_venir: { bg: c.surfaceSecondary, fg: c.onSurfaceSecondary },
    termine: { bg: c.brandTertiary, fg: c.onBrandTertiary },
  }[s];
}

export function StatusBadge({ status, testID }: { status: Status; testID?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const sc = statusColors(colors, status);
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: sc.bg }]}>
      <View style={[styles.dot, { backgroundColor: sc.fg }]} />
      <Text style={[styles.badgeText, { color: sc.fg }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

export function TypeBadge({ type }: { type: ProjectType }) {
  const styles = useStyles();
  return (
    <View style={styles.typeBadge}>
      <Text style={styles.typeText}>{type}</Text>
    </View>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.round(value * 100)}%`, backgroundColor: color ?? colors.brandPrimary }]} />
    </View>
  );
}

export function CenterState({
  icon,
  title,
  message,
  action,
  loading,
  testID,
}: {
  icon?: IconName;
  title?: string;
  message?: string;
  action?: ReactNode;
  loading?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.center} testID={testID}>
      {loading ? <ActivityIndicator color={colors.brandPrimary} /> : null}
      {icon ? (
        <View style={styles.centerIcon}>
          <Ionicons name={icon} size={28} color={colors.brandPrimary} />
        </View>
      ) : null}
      {title ? <Txt variant="headline" style={{ textAlign: "center" }}>{title}</Txt> : null}
      {message ? (
        <Txt variant="callout" color={colors.muted} style={{ textAlign: "center" }}>
          {message}
        </Txt>
      ) : null}
      {action}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  largeTitle: { fontFamily: fonts.bold, fontSize: 32, color: c.onSurface, letterSpacing: -0.6 },
  title: { fontFamily: fonts.bold, fontSize: 22, color: c.onSurface, letterSpacing: -0.3 },
  headline: { fontFamily: fonts.semibold, fontSize: 17, color: c.onSurface, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 16, color: c.onSurface },
  callout: { fontFamily: fonts.regular, fontSize: 14, color: c.onSurfaceSecondary, lineHeight: 20 },
  caption: { fontFamily: fonts.medium, fontSize: 12, color: c.muted },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: c.onSurfaceSecondary },
  mono: { fontFamily: fonts.mono, fontSize: 13, color: c.onSurface },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  buttonLabel: { fontFamily: fonts.semibold, fontSize: 16 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: c.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  groupWrap: { marginBottom: spacing.xl },
  groupTitle: { fontFamily: fonts.medium, fontSize: 12, color: c.muted, marginLeft: spacing.lg, marginBottom: spacing.sm, letterSpacing: 0.4 },
  group: { backgroundColor: c.surface, borderRadius: radius.md, overflow: "hidden" },
  groupFooter: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, marginHorizontal: spacing.lg, marginTop: spacing.sm, lineHeight: 17 },
  row: { minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, gap: spacing.md, paddingVertical: spacing.sm },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: c.divider },
  rowIcon: { width: 28, height: 28, borderRadius: 7, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: c.onSurface },
  rowValue: { fontFamily: fonts.regular, fontSize: 15, color: c.muted, maxWidth: "55%" },
  field: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, minHeight: 48, gap: spacing.md },
  fieldLabel: { width: 110, fontFamily: fonts.regular, fontSize: 16, color: c.onSurface, paddingTop: 0 },
  fieldInput: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: c.onSurface, paddingVertical: spacing.md },
  stepper: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: radius.sm + 2 },
  stepBtn: { width: 40, height: 34, alignItems: "center", justifyContent: "center" },
  stepValue: { minWidth: 34, textAlign: "center", fontFamily: fonts.semibold, fontSize: 15, color: c.onSurface },
  segment: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: radius.sm + 3, padding: 2 },
  segmentItem: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: radius.sm + 1, paddingHorizontal: spacing.xs },
  segmentActive: {
    backgroundColor: c.surface,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentText: { fontFamily: fonts.medium, fontSize: 13, color: c.onSurfaceSecondary },
  segmentTextActive: { color: c.onSurface },
  chipScroll: { flexGrow: 0, height: 56 },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: c.surfaceInverse, borderColor: c.surfaceInverse },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: c.onSurfaceSecondary },
  chipTextActive: { color: c.onSurfaceInverse },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, height: 24, borderRadius: radius.pill, alignSelf: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 12 },
  typeBadge: { paddingHorizontal: 8, height: 22, borderRadius: radius.sm, backgroundColor: c.brandTertiary, justifyContent: "center" },
  typeText: { fontFamily: fonts.mono, fontSize: 11, color: c.onBrandTertiary, letterSpacing: 0.5 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  centerIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
}));
