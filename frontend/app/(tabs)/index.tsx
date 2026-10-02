import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, useDashboard, useInvalidateAll, type DashItem } from "@/src/api";
import { ScreenHeader } from "@/src/components/screen-header";
import { useToast } from "@/src/components/toast";
import { Button, CenterState, IconButton, Ionicons, PressScale, ProgressBar, StatusBadge, Txt, TypeBadge, type IconName } from "@/src/components/ui";
import { fmtDate, fmtShort, week } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Dashboard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const q = useDashboard();
  const invalidate = useInvalidateAll();
  const toast = useToast();
  const [seeding, setSeeding] = useState(false);

  const seed = async () => {
    setSeeding(true);
    try {
      await api("/demo/seed", { method: "POST" });
      await invalidate();
      toast("Données de démo chargées");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSeeding(false);
    }
  };

  const header = (
    <ScreenHeader
      title="Accueil"
      subtitle={format(new Date(), "EEEE d MMMM", { locale: fr })}
      right={<IconButton icon="add" tinted testID="dashboard-new-project-button" onPress={() => router.push("/project/form")} />}
    />
  );

  if (q.isLoading) return <View style={styles.root}>{header}<CenterState loading /></View>;
  if (q.isError || !q.data)
    return (
      <View style={styles.root}>
        {header}
        <CenterState
          icon="cloud-offline-outline"
          title="Impossible de charger le tableau de bord"
          message="Vérifiez votre connexion."
          action={<Button label="Réessayer" onPress={() => q.refetch()} testID="dashboard-retry-button" />}
        />
      </View>
    );

  const data = q.data;
  const empty = data.active_count === 0 && data.next_mad.length === 0;

  return (
    <View style={styles.root}>
      {header}
      {empty ? (
        <CenterState
          testID="dashboard-empty"
          icon="flask-outline"
          title="Aucun projet en cours"
          message="Créez votre premier projet : le rétroplanning est calculé automatiquement depuis la date MAD."
          action={
            <View style={{ gap: spacing.sm, alignSelf: "stretch" }}>
              <Button label="Créer un projet" icon="add" onPress={() => router.push("/project/form")} testID="dashboard-empty-create-button" />
              <Button label="Charger des exemples" variant="secondary" loading={seeding} onPress={seed} testID="dashboard-seed-demo-button" />
            </View>
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomChrome + spacing.xl }]}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
          testID="dashboard-scroll"
        >
          <View style={styles.grid}>
            <Metric i={0} icon="layers-outline" label="Projets actifs" value={data.active_count} color={colors.brandPrimary} testID="metric-active" />
            <Metric i={1} icon="alert-circle" label="En retard" value={data.counts.en_retard} color={colors.error} testID="metric-late" />
            <Metric i={2} icon="time-outline" label="À risque (7 j)" value={data.counts.a_risque} color={colors.warning} testID="metric-risk" />
            <Metric i={3} icon="person-circle-outline" label="Validations client" value={data.pending_validations} color={colors.info} testID="metric-validations" />
          </View>

          <Section title="Alertes de retard" count={data.late_steps.length}>
            {data.late_steps.length === 0 ? (
              <View style={styles.okBox} testID="dashboard-no-late">
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Txt variant="callout">Aucune étape en retard. Tout est dans les temps.</Txt>
              </View>
            ) : (
              <View style={styles.list}>
                {data.late_steps.slice(0, 8).map((s, i) => (
                  <StepItem key={`${s.project_id}-${s.key}`} s={s} last={i === Math.min(7, data.late_steps.length - 1)} late />
                ))}
              </View>
            )}
          </Section>

          <Section title="Échéances" count={data.upcoming.length} hint="3 semaines">
            {data.upcoming.length === 0 ? (
              <Txt variant="callout" color={colors.muted}>Rien de prévu dans les 3 prochaines semaines.</Txt>
            ) : (
              <View style={styles.list}>
                {data.upcoming.slice(0, 8).map((s, i) => (
                  <StepItem key={`${s.project_id}-${s.key}`} s={s} last={i === Math.min(7, data.upcoming.length - 1)} />
                ))}
              </View>
            )}
          </Section>

          <Section title="Prochaines MAD">
            <View style={styles.list}>
              {data.next_mad.map((p, i) => (
                <PressScale key={p.id} testID={`dashboard-mad-${p.id}`} onPress={() => router.push(`/project/${p.id}`)} style={[styles.madRow, i < data.next_mad.length - 1 && styles.divider]}>
                  <View style={styles.madDate}>
                    <Txt variant="mono" color={colors.onBrandTertiary}>{week(p.mad_date)}</Txt>
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <TypeBadge type={p.type} />
                      <Txt variant="label" numberOfLines={1} style={{ flex: 1 }}>{p.name}</Txt>
                    </View>
                    <ProgressBar value={p.progress} />
                    <Txt variant="caption">{p.client_name} · MAD {fmtDate(p.mad_date)}</Txt>
                  </View>
                  <StatusBadge status={p.status} />
                </PressScale>
              ))}
            </View>
          </Section>
        </ScrollView>
      )}
    </View>
  );
}

function Metric({ icon, label, value, color, testID, i }: { icon: IconName; label: string; value: number; color: string; testID: string; i: number }) {
  const styles = useStyles();
  return (
    <Animated.View entering={FadeInDown.delay(i * 60).springify().damping(18)} style={styles.metric} testID={testID}>
      <Ionicons name={icon} size={20} color={color} />
      <Txt variant="largeTitle" style={{ color }} testID={`${testID}-value`}>{value}</Txt>
      <Txt variant="caption">{label}</Txt>
    </Animated.View>
  );
}

function Section({ title, count, hint, children }: { title: string; count?: number; hint?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
        <Txt variant="title">{title}</Txt>
        {count !== undefined ? <Txt variant="caption">{count}</Txt> : null}
        <View style={{ flex: 1 }} />
        {hint ? <Txt variant="caption" color={colors.muted}>{hint}</Txt> : null}
      </View>
      {children}
    </View>
  );
}

function StepItem({ s, late, last }: { s: DashItem; late?: boolean; last?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <PressScale testID={`dashboard-step-${s.project_id}-${s.key}`} onPress={() => router.push(`/project/${s.project_id}`)} style={[styles.stepRow, !last && styles.divider]}>
      <View style={[styles.stepIcon, { backgroundColor: late ? colors.errorSoft : s.client_validation ? colors.infoSoft : colors.brandTertiary }]}>
        <Ionicons
          name={late ? "alert" : s.client_validation ? "person-outline" : "calendar-outline"}
          size={16}
          color={late ? colors.error : s.client_validation ? colors.info : colors.brandPrimary}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="label" numberOfLines={1}>{s.name}</Txt>
        <Txt variant="caption" numberOfLines={1}>{s.project_name} · {s.client_name}</Txt>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Txt variant="mono" color={late ? colors.error : colors.onSurface}>{fmtShort(s.end)}</Txt>
        <Txt variant="caption" color={late ? colors.error : colors.muted}>
          {late ? `+${s.days_late} j` : s.days_left === 0 ? "aujourd'hui" : `J-${s.days_left}`}
        </Txt>
      </View>
    </PressScale>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  content: { padding: spacing.lg, gap: spacing.xl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metric: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 2,
  },
  list: { backgroundColor: c.surface, borderRadius: radius.lg, overflow: "hidden" },
  divider: { borderBottomWidth: 1, borderBottomColor: c.divider },
  okBox: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg },
  stepRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, paddingHorizontal: spacing.lg, minHeight: 60 },
  stepIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  madRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  madDate: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
}));
