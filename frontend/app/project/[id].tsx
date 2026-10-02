import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, deletePhoto, exportPdfUrl, patchStep, photoUrl, replanApply, replanPreview, uploadPhoto, useProject, useToggleStep, type LocalPhoto, type ReplanPreview, type Step, type StepPatch } from "@/src/api";
import { ConfirmSheet } from "@/src/components/confirm-sheet";
import { Gantt } from "@/src/components/gantt";
import { PhotoSourceSheet } from "@/src/components/photo-sheet";
import { PhotoStrip, type StripItem } from "@/src/components/photo-strip";
import { StepSheet } from "@/src/components/step-sheet";
import { useToast } from "@/src/components/toast";
import { Button, CenterState, Group, Ionicons, PressScale, ProgressBar, Row, StatusBadge, Txt } from "@/src/components/ui";
import { daysFromToday, fmtDate, fmtNumShort, fmtShort, PACKAGING_LABEL, TYPE_INFO } from "@/src/format";
import { hapticMedium, hapticSuccess } from "@/src/haptics";
import { sharePdf } from "@/src/share";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

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
  const [showGantt, setShowGantt] = useState(false);
  const [picker, setPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replan, setReplan] = useState<ReplanPreview | null>(null);
  const [replanning, setReplanning] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [savingStep, setSavingStep] = useState(false);
  const [sharing, setSharing] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const share = async () => {
    if (!q.data) return;
    setSharing(true);
    try {
      await sharePdf(exportPdfUrl(id), q.data.name);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSharing(false);
    }
  };

  const topBar = (
    <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
      <PressScale testID="project-detail-back-button" onPress={back} style={styles.circleBtn}>
        <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
      </PressScale>
      <View style={{ flex: 1 }} />
      {q.data ? (
        <>
          <PressScale testID="project-detail-share-button" onPress={share} disabled={sharing} style={styles.circleBtn}>
            {sharing ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Ionicons name="share-outline" size={20} color={colors.onSurface} />}
          </PressScale>
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
  const cover = p.photos?.[0];

  const onToggle = (s: Step) => {
    hapticMedium();
    toggle.mutate({ key: s.key, done: !s.done }, { onError: (e) => toast((e as Error).message, "error") });
  };

  const saveStep = async (patch: StepPatch) => {
    if (!editingStep) return;
    setSavingStep(true);
    try {
      const updated = await patchStep(id, editingStep.key, patch);
      qc.setQueryData(["project", id], updated);
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setEditingStep(null);
      hapticSuccess();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSavingStep(false);
    }
  };

  const openReplan = async () => {
    try {
      setReplan(await replanPreview(id));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const applyReplan = async () => {
    setReplanning(true);
    try {
      const updated = await replanApply(id);
      qc.setQueryData(["project", id], updated);
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setReplan(null);
      hapticSuccess();
      toast("Planning replanifié");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setReplanning(false);
    }
  };

  const addPhoto = async (photo: LocalPhoto) => {
    setUploading(true);
    try {
      const updated = await uploadPhoto(id, photo);
      qc.setQueryData(["project", id], updated);
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast("Photo ajoutée");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (item: StripItem) => {
    try {
      const updated = await deletePhoto(id, item.key);
      qc.setQueryData(["project", id], updated);
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast("Photo retirée");
    } catch (e) {
      toast((e as Error).message, "error");
    }
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
  const madSlip = p.projected_mad && p.projected_mad > p.mad_date ? daysFromToday(p.projected_mad) - madIn : 0;
  const ganttEnd = madSlip > 0 && p.projected_mad ? p.projected_mad : p.mad_date;
  const preseries = p.preseries_needed ? (p.preseries_mode === "parallele" ? "Parallèle à la production" : "Séquentielle") : "Non";
  const briefRows = [
    p.moq ? { label: "MOQ", value: p.moq.toLocaleString("fr-FR") } : null,
    { label: "Emballage", value: `${PACKAGING_LABEL[p.packaging_type]}${p.packaging_type === "ptf" ? ` · ${p.ptf_lead_days} j` : ""}` },
    { label: "Présérie", value: preseries },
  ].filter((r): r is { label: string; value: string } => !!r);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }} testID="project-detail-scroll">
        <View style={styles.hero}>
          {cover ? (
            <Image source={{ uri: photoUrl(cover) }} style={StyleTop} contentFit="cover" transition={250} testID="project-detail-cover" />
          ) : (
            <LinearGradient colors={[colors.brandSecondary, colors.brandPrimary]} style={StyleTop} />
          )}
          {cover ? <LinearGradient colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.65)"]} style={StyleTop} /> : null}
          <View style={styles.heroText}>
            <Txt variant="caption" color={colors.onBrandPrimary} style={{ opacity: 0.85 }}>{p.type} · {TYPE_INFO[p.type].short}</Txt>
            <Txt variant="largeTitle" color={colors.onSurfaceInverse} numberOfLines={2} testID="project-detail-name">{p.name}</Txt>
            <Txt variant="callout" color={colors.onBrandPrimary} style={{ opacity: 0.9 }}>{p.client_name}{p.code ? ` · ${p.code}` : ""}</Txt>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.summary}>
            <View style={styles.between}>
              <StatusBadge status={p.status} testID="project-detail-status" />
              <Txt variant="caption" testID="project-detail-progress-text">{doneCount}/{p.steps.length} étapes</Txt>
            </View>
            <ProgressBar value={progress} />
            <View style={styles.kpis}>
              <Kpi
                label="MAD"
                value={fmtNumShort(p.mad_date)}
                sub={madSlip > 0 ? `prévue +${madSlip} j` : madIn >= 0 ? `dans ${madIn} j` : `dépassée de ${-madIn} j`}
                subColor={madSlip > 0 ? colors.warning : undefined}
                testID="project-detail-mad"
              />
              <Kpi label="Démarrage" value={fmtNumShort(p.start_date)} testID="project-detail-start" />
              <Kpi label="Durée" value={`${p.total_weeks} sem.`} testID="project-detail-duration" />
            </View>
            {p.late_count > 0 ? (
              <View style={styles.alert} testID="project-detail-late-alert">
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Txt variant="callout" color={colors.error} style={{ flex: 1 }}>
                  {p.late_count} étape{p.late_count > 1 ? "s" : ""} en retard
                </Txt>
                <Pressable onPress={openReplan} style={styles.replanBtn} testID="project-detail-replan-button">
                  <Txt variant="caption" color={colors.onError} style={{ fontFamily: fonts.semibold }}>Replanifier</Txt>
                </Pressable>
              </View>
            ) : null}
            <Pressable onPress={() => setShowGantt((v) => !v)} style={styles.ganttToggle} testID="project-detail-gantt-toggle">
              <Txt variant="label" color={colors.brandPrimary}>{showGantt ? "Masquer le planning" : "Voir le planning"}</Txt>
              <Ionicons name={showGantt ? "chevron-up" : "chevron-down"} size={16} color={colors.brandPrimary} />
            </Pressable>
            {showGantt ? <Gantt phases={p.phases} start={p.start_date} end={ganttEnd} testID="project-detail-gantt" /> : null}
          </View>

          <View style={styles.card}>
            <Txt variant="headline" style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>Photos & croquis</Txt>
            <PhotoStrip
              testID="project-detail-photos"
              busy={uploading}
              items={(p.photos ?? []).map((ph) => ({ key: ph.id, uri: photoUrl(ph) }))}
              onAdd={() => setPicker(true)}
              onRemove={removePhoto}
            />
          </View>

          <Txt variant="title" style={{ marginTop: spacing.sm }}>Étapes</Txt>
          {p.phases.map((ph) => (
            <View key={ph.key} style={styles.phase} testID={`phase-${ph.key}`}>
              <View style={styles.phaseHead}>
                <Txt variant="headline" style={{ flex: 1 }}>{ph.name}</Txt>
                <Txt variant="caption" color={ph.done === ph.total ? colors.brandPrimary : colors.muted} style={{ fontFamily: fonts.semibold }}>
                  {ph.done}/{ph.total}
                </Txt>
              </View>
              {p.steps.filter((s) => s.phase === ph.key).map((s, i, arr) => (
                <StepRow key={s.key} s={s} last={i === arr.length - 1} onToggle={() => onToggle(s)} onOpen={() => setEditingStep(s)} />
              ))}
            </View>
          ))}

          <Group title="Brief client">
            {briefRows.map((r, i) => (
              <Row key={r.label} label={r.label} value={r.value} last={i === briefRows.length - 1 && !p.tech_specs && !p.notes} />
            ))}
            {p.tech_specs ? (
              <View style={styles.textBlock}>
                <Txt variant="caption">Spécificités</Txt>
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
      <PhotoSourceSheet visible={picker} onClose={() => setPicker(false)} onPicked={addPhoto} />
      <StepSheet step={editingStep} onClose={() => setEditingStep(null)} onSave={saveStep} saving={savingStep} />
      <ConfirmSheet
        visible={!!replan}
        title="Replanifier les étapes restantes ?"
        message={
          replan
            ? `${replan.shifted_count} étape${replan.shifted_count > 1 ? "s" : ""} décalée${replan.shifted_count > 1 ? "s" : ""} de ${replan.delta_days} j à partir d'aujourd'hui. Les étapes terminées ne bougent pas.`
            : ""
        }
        confirmLabel="Replanifier"
        variant="primary"
        loading={replanning}
        onConfirm={applyReplan}
        onClose={() => setReplan(null)}
      >
        {replan ? (
          <View style={styles.replanBox} testID="replan-preview">
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="caption">MAD cible</Txt>
              <Txt variant="label" color={colors.onSurface}>{fmtDate(replan.mad_date)}</Txt>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.muted} />
            <View style={{ flex: 1, gap: 2, alignItems: "flex-end" }}>
              <Txt variant="caption">MAD prévue</Txt>
              <Txt variant="label" color={colors.warning} testID="replan-projected-mad">
                {fmtDate(replan.projected_mad)} (+{daysFromToday(replan.projected_mad) - daysFromToday(replan.mad_date)} j)
              </Txt>
            </View>
          </View>
        ) : null}
      </ConfirmSheet>
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

function Kpi({ label, value, sub, subColor, testID }: { label: string; value: string; sub?: string; subColor?: string; testID: string }) {
  const styles = useStyles();
  return (
    <View style={styles.kpi} testID={testID}>
      <Txt variant="caption">{label}</Txt>
      <Txt variant="label" numberOfLines={1} style={{ fontSize: 14 }}>{value}</Txt>
      {sub ? <Txt variant="caption" numberOfLines={1} color={subColor} style={subColor ? { fontFamily: fonts.semibold } : undefined}>{sub}</Txt> : null}
    </View>
  );
}

function StepRow({ s, last, onToggle, onOpen }: { s: Step; last: boolean; onToggle: () => void; onOpen: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const lateDays = -daysFromToday(s.end);
  const late = !s.done && lateDays > 0;
  const current = !s.done && daysFromToday(s.start) <= 0 && daysFromToday(s.end) >= 0;
  const nodeColor = s.done ? colors.brandPrimary : late ? colors.error : current ? colors.warning : colors.borderStrong;
  const dateLabel = s.done && s.actual_end ? `fait le ${fmtShort(s.actual_end)}` : late ? `+${lateDays} j` : fmtShort(s.end);
  return (
    <View style={styles.stepRow} testID={`step-row-${s.key}`}>
      <Pressable onPress={onToggle} hitSlop={8} style={styles.rail} testID={`step-check-${s.key}`}>
        <View style={[styles.node, { borderColor: nodeColor }, s.done && { backgroundColor: colors.brandPrimary }]}>
          {s.done ? <Ionicons name="checkmark" size={14} color={colors.onBrandPrimary} /> : null}
        </View>
        {!last ? <View style={[styles.line, s.done && { backgroundColor: colors.brandPrimary }]} /> : null}
      </Pressable>
      <Pressable onPress={onOpen} style={({ pressed }) => [styles.stepBody, pressed && { opacity: 0.6 }]} testID={`step-open-${s.key}`}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
          {s.client_validation ? <Ionicons name="person-outline" size={14} color={colors.info} /> : null}
          <Txt variant="body" numberOfLines={2} style={[{ flexShrink: 1, fontSize: 15 }, s.done && { color: colors.muted, textDecorationLine: "line-through" }]}>
            {s.name}
          </Txt>
          {s.comment ? <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.muted} /> : null}
        </View>
        <Txt variant="caption" color={late ? colors.error : current ? colors.warning : colors.muted} style={{ fontFamily: fonts.semibold }}>
          {dateLabel}
        </Txt>
      </Pressable>
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
  hero: { height: 280, justifyContent: "flex-end", backgroundColor: c.brandPrimary },
  heroText: { padding: spacing.lg, paddingBottom: spacing.xl + spacing.md, gap: spacing.xs },
  body: { padding: spacing.lg, gap: spacing.lg, marginTop: -spacing.xl },
  summary: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kpis: { flexDirection: "row", gap: spacing.sm },
  kpi: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  alert: { flexDirection: "row", gap: spacing.sm, backgroundColor: c.errorSoft, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  replanBtn: { backgroundColor: c.error, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 30, justifyContent: "center" },
  replanBox: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  ganttToggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 44 },
  card: { backgroundColor: c.surface, borderRadius: radius.lg },
  phase: { backgroundColor: c.surface, borderRadius: radius.lg, overflow: "hidden" },
  phaseHead: { flexDirection: "row", alignItems: "center", padding: spacing.lg, paddingBottom: spacing.xs, gap: spacing.md },
  stepRow: { flexDirection: "row", paddingHorizontal: spacing.lg, minHeight: 52 },
  rail: { width: 36, alignItems: "center", paddingTop: spacing.md },
  node: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center", backgroundColor: c.surface },
  line: { flex: 1, width: 2, backgroundColor: c.surfaceTertiary, marginTop: 2 },
  stepBody: { flex: 1, flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, paddingLeft: spacing.md, gap: spacing.md },
  textBlock: { padding: spacing.lg, gap: 4, borderTopWidth: 1, borderTopColor: c.divider },
}));
