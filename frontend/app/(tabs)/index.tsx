import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, useDashboard, useInvalidateAll, type DashItem } from "@/src/api";
import { ScreenHeader } from "@/src/components/screen-header";
import { useToast } from "@/src/components/toast";
import { Button, CenterState, IconButton, Ionicons, PressScale, StatusBadge, Txt } from "@/src/components/ui";
import { daysFromToday, fmtDate } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

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
  const toFollow = [...data.late_steps.map((s) => ({ s, late: true })), ...data.upcoming.map((s) => ({ s, late: false }))].slice(0, 8);

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
          <View style={styles.metrics}>
            <Metric label="Projets actifs" value={data.active_count} color={colors.brandPrimary} testID="metric-active" />
            <View style={styles.vline} />
            <Metric label="En retard" value={data.counts.en_retard} color={data.counts.en_retard ? colors.error : colors.brandPrimary} testID="metric-late" />
          </View>

          <Section title="À suivre">
            {toFollow.length === 0 ? (
              <View style={styles.okBox} testID="dashboard-no-late">
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Txt variant="callout">Rien d&apos;urgent. Tout est dans les temps.</Txt>
              </View>
            ) : (
              <View style={styles.list}>
                {toFollow.map(({ s, late }, i) => (
                  <StepItem key={`${s.project_id}-${s.key}`} s={s} late={late} last={i === toFollow.length - 1} />
                ))}
              </View>
            )}
          </Section>

          <Section title="Projets">
            <View style={styles.list}>
              {data.next_mad.map((p, i) => (
                <PressScale key={p.id} testID={`dashboard-mad-${p.id}`} onPress={() => router.push(`/project/${p.id}`)} style={[styles.madRow, i < data.next_mad.length - 1 && styles.divider]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="headline" numberOfLines={1} style={{ fontSize: 16 }}>{p.name}</Txt>
                    <Txt variant="caption">
                      {p.client_name} · MAD {fmtDate(p.mad_date)}
                      {p.projected_mad && p.projected_mad > p.mad_date ? <Txt variant="caption" color={colors.warning}>{` · prévue +${daysFromToday(p.projected_mad) - daysFromToday(p.mad_date)} j`}</Txt> : null}
                    </Txt>
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

function Metric({ label, value, color, testID }: { label: string; value: number; color: string; testID: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }} testID={testID}>
      <Txt variant="largeTitle" style={{ color, fontSize: 36 }} testID={`${testID}-value`}>{value}</Txt>
      <Txt variant="caption">{label}</Txt>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.md }}>
      <Txt variant="title">{title}</Txt>
      {children}
    </View>
  );
}

function StepItem({ s, late, last }: { s: DashItem; late: boolean; last: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const when = late ? `+${s.days_late} j` : s.days_left === 0 ? "Aujourd'hui" : `J-${s.days_left}`;
  return (
    <PressScale testID={`dashboard-step-${s.project_id}-${s.key}`} onPress={() => router.push(`/project/${s.project_id}`)} style={[styles.stepRow, !last && styles.divider]}>
      <View style={[styles.dot, { backgroundColor: late ? colors.error : s.client_validation ? colors.info : colors.brandPrimary }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="body" numberOfLines={1} style={{ fontFamily: fonts.medium }}>{s.name}</Txt>
        <Txt variant="caption" numberOfLines={1}>{s.project_name}</Txt>
      </View>
      <Txt variant="label" color={late ? colors.error : colors.muted}>{when}</Txt>
    </PressScale>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  content: { padding: spacing.lg, gap: spacing.xl },
  metrics: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: radius.lg, paddingVertical: spacing.lg },
  vline: { width: 1, height: 40, backgroundColor: c.divider },
  list: { backgroundColor: c.surface, borderRadius: radius.lg, overflow: "hidden" },
  divider: { borderBottomWidth: 1, borderBottomColor: c.divider },
  okBox: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg },
  stepRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 60 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  madRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
}));
