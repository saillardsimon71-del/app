import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, useProject, useToggleStep, type Step } from "@/src/api";
import { ConfirmSheet } from "@/src/components/confirm-sheet";
import { Gantt } from "@/src/components/gantt";
import { useToast } from "@/src/components/toast";
import { Button, CenterState, Group, Ionicons, PressScale, ProgressBar, Row, StatusBadge, Txt } from "@/src/components/ui";
import { daysFromToday, fmtNum, fmtShort, PACKAGING_LABEL, TYPE_INFO, week } from "@/src/format";
import { hapticMedium } from "@/src/haptics";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const HERO = "https://images.unsplash.com/photo-1594125311687-3b1b3eafa9f4?crop=entropy&cs=srgb&fm=jpg&q=70&w=1200";

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useProject(id);
  const toggle = useToggleStep(id);
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const topBar = (
    <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
      <PressScale testID="project-detail-back-button" onPress={back} style={styles.circleBtn}>
        <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
      </PressScale>
      <View style={{ flex: 1 }} />
      {q.data ? (
        <>
          <PressScale testID="project-detail-edit-button" onPress={() => router.push({ pathname: "/project/form", params: { id } })} style={styles.circleBtn}>
            <Ionicons name="create-outline" size={20} color={colors.onSurface} />
          </PressScale>
          <PressScale testID="project-detail-delete-button" onPress={() => setConfirm(true)} style={styles.circleBtn}>
            <Ionicons name="trash-outline" size={19} color={colors.error} />
          </PressScale>
        </>
      ) : null}
    </View>
  );

  if (q.isLoading) return <View style={styles.root}>{topBar}<CenterState loading /></View>;
  if (q.isError || !q.data)
    return (
      <View style={styles.root}>
        {topBar}
        <CenterState icon="alert-circle-outline" title="Projet introuvable" action={<Button label="Réessayer" onPress={() => q.refetch()} testID="project-detail-retry-button" />} />
      </View>
    );

  const p = q.data;
  const doneCount = p.steps.filter((s) => s.done).length;
  const progress = p.steps.length ? doneCount / p.steps.length : 0;

  const onToggle = (s: Step) => {
    hapticMedium();
    toggle.mutate({ key: s.key, done: !s.done }, { onError: (e) => toast((e as Error).message, "error") });
  };

  const archive = async () => {
    setBusy(true);
    try {
      await api(`/projects/${id}/archive`, { method: "POST" });
      await qc.invalidateQueries();
      toast(p.archived ? "Projet réactivé" : "Projet archivé");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api(`/projects/${id}`, { method: "DELETE" });
      setConfirm(false);
      await qc.invalidateQueries({ queryKey: ["projects"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["clients"] });
      toast("Projet supprimé");
      back();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const madIn = daysFromToday(p.mad_date);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }} testID="project-detail-scroll">
        <View style={styles.hero}>
          <Image source={{ uri: HERO }} style={StyleTop} contentFit="cover" transition={250} />
          <LinearGradient colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.65)"]} style={StyleTop} />
          <View style={styles.heroText}>
            <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
              <View style={styles.heroType}>
                <Txt variant="mono" color={colors.onSurface} style={{ fontSize: 12 }}>{p.type}</Txt>
              </View>
              <Txt variant="caption" color={colors.onSurfaceInverse}>{TYPE_INFO[p.type].label}</Txt>
            </View>
            <Txt variant="largeTitle" color={colors.onSurfaceInverse} numberOfLines={2} testID="project-detail-name">{p.name}</Txt>
            <Txt variant="callout" color={colors.surfaceTertiary}>{p.client_name}{p.code ? ` · ${p.code}` : ""}</Txt>
          </View>
        </View>

        <View style={styles.body}>
          <Animated.View entering={FadeIn.duration(250)} style={styles.summary}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <StatusBadge status={p.status} testID="project-detail-status" />
              <Txt variant="caption" testID="project-detail-progress-text">{doneCount}/{p.steps.length} étapes · {Math.round(progress * 100)} %</Txt>
            </View>
            <ProgressBar value={progress} />
            <View style={styles.kpis}>
              <Kpi label="MAD" value={fmtNum(p.mad_date)} sub={`${week(p.mad_date)} · ${madIn >= 0 ? `J-${madIn}` : `+${-madIn} j`}`} testID="project-detail-mad" />
              <Kpi label="Démarrage" value={fmtNum(p.start_date)} sub={week(p.start_date)} testID="project-detail-start" />
              <Kpi label="Durée" value={`${p.total_weeks} sem.`} sub={`${p.total_days} j`} testID="project-detail-duration" />
            </View>
            {p.late_count > 0 ? (
              <View style={styles.alert} testID="project-detail-late-alert">
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Txt variant="callout" color={colors.error} style={{ flex: 1 }}>
                  {p.late_count} étape{p.late_count > 1 ? "s" : ""} en retard. Cochez les étapes terminées ou ajustez le planning.
                </Txt>
              </View>
            ) : null}
          </Animated.View>

          <View style={styles.card}>
            <Txt variant="headline">Vue Gantt</Txt>
            <Gantt phases={p.phases} start={p.start_date} end={p.mad_date} testID="project-detail-gantt" />
          </View>

          <Txt variant="title" style={{ marginTop: spacing.sm }}>Étapes</Txt>
          {p.phases.map((ph) => (
            <View key={ph.key} style={styles.phase} testID={`phase-${ph.key}`}>
              <View style={styles.phaseHead}>
                <View style={{ flex: 1 }}>
                  <Txt variant="headline">{ph.name}</Txt>
                  <Txt variant="caption">{fmtShort(ph.start)} → {fmtShort(ph.end)} · {week(ph.start)}–{week(ph.end)}</Txt>
                </View>
                <View style={[styles.phaseCount, ph.done === ph.total && { backgroundColor: colors.brandPrimary }]}>
                  <Txt variant="caption" color={ph.done === ph.total ? colors.onBrandPrimary : colors.onBrandTertiary} style={{ fontFamily: fonts.semibold }}>
                    {ph.done}/{ph.total}
                  </Txt>
                </View>
              </View>
              {p.steps.filter((s) => s.phase === ph.key).map((s, i, arr) => (
                <StepRow key={s.key} s={s} last={i === arr.length - 1} onPress={() => onToggle(s)} />
              ))}
            </View>
          ))}

          <Group title="Brief client">
            <Row label="MOQ" value={p.moq ? p.moq.toLocaleString("fr-FR") : "—"} />
            <Row label="Emballage" value={`${PACKAGING_LABEL[p.packaging_type]}${p.packaging_type === "ptf" ? ` · ${p.ptf_lead_days} j` : ""}`} />
            <Row label="Présérie" value={p.preseries_needed ? (p.preseries_mode === "parallele" ? "Parallèle à la prod." : "Séquentielle") : "Non"} />
            <Row label="Échantillonnages" value={`Verre ${p.type === "FLK" ? 0 : p.glass_cycles} · Décor ${p.decor_cycles}`} last={!p.tech_specs && !p.notes} />
            {p.tech_specs ? (
              <View style={styles.textBlock}>
                <Txt variant="caption">Spécificités techniques</Txt>
                <Txt variant="callout">{p.tech_specs}</Txt>
              </View>
            ) : null}
            {p.notes ? (
              <View style={styles.textBlock}>
                <Txt variant="caption">Notes</Txt>
                <Txt variant="callout">{p.notes}</Txt>
              </View>
            ) : null}
          </Group>

          <Group>
            <Row icon={p.archived ? "arrow-undo-outline" : "archive-outline"} label={busy ? "…" : p.archived ? "Réactiver le projet" : "Archiver le projet"} onPress={archive} last testID="project-detail-archive-row" />
          </Group>
        </View>
      </ScrollView>
      <View style={styles.floatingTop} pointerEvents="box-none">{topBar}</View>
      <ConfirmSheet
        visible={confirm}
        title="Supprimer ce projet ?"
        message="Le planning et le suivi des étapes seront définitivement supprimés."
        confirmLabel="Supprimer le projet"
        loading={busy}
        onConfirm={remove}
        onClose={() => setConfirm(false)}
      />
    </View>
  );
}

const StyleTop = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

function Kpi({ label, value, sub, testID }: { label: string; value: string; sub?: string; testID: string }) {
  const styles = useStyles();
  return (
    <View style={styles.kpi} testID={testID}>
      <Txt variant="caption">{label}</Txt>
      <Txt variant="label" numberOfLines={1}>{value}</Txt>
      {sub ? <Txt variant="caption" style={{ fontFamily: fonts.mono, fontSize: 11 }}>{sub}</Txt> : null}
    </View>
  );
}

function StepRow({ s, last, onPress }: { s: Step; last: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const late = !s.done && daysFromToday(s.end) < 0;
  const current = !s.done && daysFromToday(s.start) <= 0 && daysFromToday(s.end) >= 0;
  const nodeColor = s.done ? colors.brandPrimary : late ? colors.error : current ? colors.warning : colors.borderStrong;
  return (
    <Pressable testID={`step-row-${s.key}`} onPress={onPress} style={({ pressed }) => [styles.stepRow, pressed && { backgroundColor: colors.surfaceSecondary }]}>
      <View style={styles.rail}>
        <View style={[styles.node, { borderColor: nodeColor }, s.done && { backgroundColor: colors.brandPrimary }]} testID={`step-check-${s.key}`}>
          {s.done ? <Ionicons name="checkmark" size={14} color={colors.onBrandPrimary} /> : null}
        </View>
        {!last ? <View style={[styles.line, s.done && { backgroundColor: colors.brandPrimary }]} /> : null}
      </View>
      <View style={styles.stepBody}>
        <Txt variant="label" numberOfLines={2} style={s.done ? { color: colors.muted, textDecorationLine: "line-through" } : undefined}>
          {s.name}
        </Txt>
        <Txt variant="caption" style={{ fontFamily: fonts.mono, fontSize: 11 }} color={late ? colors.error : colors.muted}>
          {fmtShort(s.start)} → {fmtShort(s.end)} · {s.duration} j · {week(s.end)}
        </Txt>
        {(s.client_validation || late || current) ? (
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            {s.client_validation ? <Tag label="Validation client" bg={colors.infoSoft} fg={colors.info} /> : null}
            {late ? <Tag label={`Retard ${-daysFromToday(s.end)} j`} bg={colors.errorSoft} fg={colors.error} /> : null}
            {current ? <Tag label="En cours" bg={colors.warningSoft} fg={colors.warning} /> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function Tag({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, height: 20, borderRadius: 10, justifyContent: "center" }}>
      <Txt variant="caption" color={fg} style={{ fontSize: 11, fontFamily: fonts.semibold }}>{label}</Txt>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  floatingTop: { position: "absolute", top: 0, left: 0, right: 0 },
  topBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  circleBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  hero: { height: 300, justifyContent: "flex-end", backgroundColor: c.surfaceInverse },
  heroText: { padding: spacing.lg, paddingBottom: spacing.xl + spacing.md, gap: spacing.xs },
  heroType: { backgroundColor: c.surface, paddingHorizontal: 8, height: 22, borderRadius: radius.sm, justifyContent: "center" },
  body: { padding: spacing.lg, gap: spacing.lg, marginTop: -spacing.xl },
  summary: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  kpis: { flexDirection: "row", gap: spacing.sm },
  kpi: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  alert: { flexDirection: "row", gap: spacing.sm, backgroundColor: c.errorSoft, borderRadius: radius.md, padding: spacing.md, alignItems: "flex-start" },
  card: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  phase: { backgroundColor: c.surface, borderRadius: radius.lg, overflow: "hidden" },
  phaseHead: { flexDirection: "row", alignItems: "center", padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md },
  phaseCount: { backgroundColor: c.brandTertiary, paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: "center" },
  stepRow: { flexDirection: "row", paddingHorizontal: spacing.lg, minHeight: 64 },
  rail: { width: 28, alignItems: "center", paddingTop: spacing.md },
  node: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center", backgroundColor: c.surface },
  line: { flex: 1, width: 2, backgroundColor: c.surfaceTertiary, marginTop: 2 },
  stepBody: { flex: 1, paddingVertical: spacing.md, paddingLeft: spacing.md, gap: 3 },
  textBlock: { padding: spacing.lg, gap: 4, borderTopWidth: 1, borderTopColor: c.divider },
}));
