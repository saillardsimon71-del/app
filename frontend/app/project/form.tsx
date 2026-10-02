import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, deletePhoto, photoUrl, uploadPhoto, useClients, useProject, type LocalPhoto, type Preview, type Project, type ProjectInput, type ProjectType } from "@/src/api";
import { DateField } from "@/src/components/date-field";
import { Gantt } from "@/src/components/gantt";
import { PhotoSourceSheet } from "@/src/components/photo-sheet";
import { PhotoStrip, type StripItem } from "@/src/components/photo-strip";
import { useToast } from "@/src/components/toast";
import { Button, Field, Group, Ionicons, Row, Segmented, Stepper, Txt } from "@/src/components/ui";
import { fmtNumShort, toISO, TYPE_DEFAULTS, TYPE_INFO } from "@/src/format";
import { hapticSelect, hapticSuccess } from "@/src/haptics";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const TYPES: ProjectType[] = ["NPD", "DUP", "FLK", "MLD"];

const blank = (): ProjectInput => ({
  name: "",
  code: "",
  client_id: "",
  type: "NPD",
  mad_date: toISO(addDays(new Date(), 350)),
  moq: null,
  tech_specs: "",
  preseries_needed: true,
  preseries_mode: "sequentielle",
  packaging_type: "croisillons",
  ptf_lead_days: 40,
  glass_cycles: 4,
  decor_cycles: 3,
  notes: "",
});

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function ProjectForm() {
  const { id, clientId } = useLocalSearchParams<{ id?: string; clientId?: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const toast = useToast();
  const clients = useClients();
  const existing = useProject(id);
  const [form, setForm] = useState<ProjectInput>(blank);
  const [saving, setSaving] = useState(false);
  const [helper, setHelper] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [picker, setPicker] = useState(false);
  const [pending, setPending] = useState<LocalPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (existing.data && !loadedRef.current) {
      loadedRef.current = true;
      const p = existing.data;
      setForm({
        name: p.name, code: p.code ?? "", client_id: p.client_id, type: p.type, mad_date: p.mad_date, moq: p.moq ?? null,
        tech_specs: p.tech_specs ?? "", preseries_needed: p.preseries_needed, preseries_mode: p.preseries_mode,
        packaging_type: p.packaging_type, ptf_lead_days: p.ptf_lead_days, glass_cycles: p.glass_cycles, decor_cycles: p.decor_cycles,
        notes: p.notes ?? "", archived: p.archived,
      });
    }
  }, [existing.data]);

  useEffect(() => {
    if (!id && !form.client_id && clients.data?.length) {
      setForm((f) => ({ ...f, client_id: clientId && clients.data!.some((c) => c.id === clientId) ? clientId : clients.data![0].id }));
    }
  }, [clients.data, id, clientId, form.client_id]);

  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setType = (t: ProjectType) => {
    hapticSelect();
    setForm((f) => ({ ...f, type: t, glass_cycles: TYPE_DEFAULTS[t].glass, decor_cycles: TYPE_DEFAULTS[t].decor }));
  };

  const planInput = useDebounced(form, 350);
  const preview = useQuery({
    queryKey: ["preview", { ...planInput, name: "", code: "", notes: "", tech_specs: "" }],
    queryFn: () => api<Preview>("/planning/preview", { method: "POST", body: { ...planInput, name: planInput.name || "x" } }),
    enabled: !!planInput.client_id,
    placeholderData: (prev) => prev,
  });

  // Photos : upload immédiat si le projet existe, sinon en attente jusqu'à la création.
  const onPicked = async (photo: LocalPhoto) => {
    if (!id) return setPending((l) => [...l, photo]);
    setUploading(true);
    try {
      const updated = await uploadPhoto(id, photo);
      qc.setQueryData(["project", id], updated);
      qc.invalidateQueries({ queryKey: ["projects"] });
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setUploading(false);
    }
  };

  const onRemovePhoto = async (item: StripItem) => {
    if (item.pending) return setPending((l) => l.filter((p) => p.uri !== item.key));
    try {
      const updated = await deletePhoto(id!, item.key);
      qc.setQueryData(["project", id], updated);
      qc.invalidateQueries({ queryKey: ["projects"] });
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const photoItems: StripItem[] = [
    ...(existing.data?.photos ?? []).map((ph) => ({ key: ph.id, uri: photoUrl(ph) })),
    ...pending.map((ph) => ({ key: ph.uri, uri: ph.uri, pending: true })),
  ];

  const save = async () => {
    if (!form.name.trim()) return toast("Donnez un nom au projet", "error");
    if (!form.client_id) return toast("Choisissez un client", "error");
    setSaving(true);
    try {
      const body = { ...form, name: form.name.trim(), moq: form.moq || null };
      let p = await api<Project>(id ? `/projects/${id}` : "/projects", { method: id ? "PUT" : "POST", body });
      let failed = 0;
      for (const photo of pending) {
        try {
          p = await uploadPhoto(p.id, photo);
        } catch {
          failed += 1;
        }
      }
      qc.setQueryData(["project", p.id], p);
      await qc.invalidateQueries({ queryKey: ["projects"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["clients"] });
      hapticSuccess();
      toast(failed ? `Projet créé · ${failed} photo${failed > 1 ? "s" : ""} non envoyée${failed > 1 ? "s" : ""}` : id ? "Planning recalculé" : "Projet créé", failed ? "info" : "success");
      if (id) router.back();
      else router.replace(`/project/${p.id}`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const pv = preview.data;
  const noClients = clients.data && clients.data.length === 0;
  const levers = pv?.levers.filter((l) => l.gain_days > 0) ?? [];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
        <Button label="Annuler" variant="plain" onPress={() => router.back()} testID="project-form-cancel-button" style={styles.headerBtn} />
        <Txt variant="headline">{id ? "Modifier le projet" : "Nouveau projet"}</Txt>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAwareScrollView bottomOffset={110} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="project-form-scroll">
        <Group title="Projet">
          <Field label="Nom" value={form.name} onChangeText={(t) => set("name", t)} placeholder="Ex. Flacon Éclat 50 ml" testID="project-form-name-input" />
          {noClients ? (
            <View style={[styles.inlineBlock, { gap: spacing.md }]}>
              <Txt variant="callout">Ajoutez d&apos;abord un client.</Txt>
              <Button label="Ajouter un client" icon="add" variant="secondary" onPress={() => router.push("/client/form")} testID="project-form-add-client-button" />
            </View>
          ) : (
            <View style={styles.clientBlock}>
              <Txt variant="body" style={styles.clientLabel}>Client</Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clientRow} style={{ flexGrow: 0 }}>
                {(clients.data ?? []).map((c) => {
                  const active = c.id === form.client_id;
                  return (
                    <Pressable key={c.id} testID={`project-form-client-${c.id}`} onPress={() => { hapticSelect(); set("client_id", c.id); }} style={[styles.clientChip, active && styles.clientChipActive]}>
                      <Txt variant="label" color={active ? colors.onSurfaceInverse : colors.onSurface}>{c.name}</Txt>
                    </Pressable>
                  );
                })}
                <Pressable testID="project-form-new-client-chip" onPress={() => router.push("/client/form")} style={[styles.clientChip, styles.clientChipAdd]}>
                  <Ionicons name="add" size={16} color={colors.brandPrimary} />
                  <Txt variant="label" color={colors.brandPrimary}>Nouveau</Txt>
                </Pressable>
              </ScrollView>
            </View>
          )}
          <DateField label="MAD" value={form.mad_date} onChange={(v) => set("mad_date", v)} testID="project-form-mad-date" last />
        </Group>

        <Group title="Type de projet" footer={`${TYPE_INFO[form.type].short} — ${TYPE_INFO[form.type].desc}`}>
          <View style={styles.inlineBlock}>
            <Segmented testID="project-form-type" value={form.type} onChange={setType} options={TYPES.map((t) => ({ value: t, label: t }))} />
          </View>
          <Row label="Quel type choisir ?" onPress={() => setHelper((h) => !h)} last testID="project-form-type-helper-toggle"
            right={<Ionicons name={helper ? "chevron-up" : "chevron-down"} size={18} color={colors.borderStrong} />} />
          {helper ? <TypeHelper onPick={(t) => { setType(t); setHelper(false); }} /> : null}
        </Group>

        <Group title="Photos & croquis" footer="Idées, dessins ou références apportés par le client.">
          <PhotoStrip testID="project-form-photos" items={photoItems} busy={uploading} onAdd={() => setPicker(true)} onRemove={onRemovePhoto} />
        </Group>

        <Group>
          <Row label="Options avancées" icon="options-outline" onPress={() => setAdvanced((a) => !a)} last={!advanced} testID="project-form-advanced-toggle"
            right={<Ionicons name={advanced ? "chevron-up" : "chevron-down"} size={18} color={colors.borderStrong} />} />
          {advanced ? (
            <>
              <Field label="Référence" value={form.code ?? ""} onChangeText={(t) => set("code", t)} placeholder="Optionnel" autoCapitalize="characters" testID="project-form-code-input" />
              <Field label="MOQ" value={form.moq ? String(form.moq) : ""} onChangeText={(t) => set("moq", t.replace(/\D/g, "") ? Number(t.replace(/\D/g, "")) : null)} placeholder="Quantité minimale" keyboardType="number-pad" testID="project-form-moq-input" />
              <Field label="Spécificités" value={form.tech_specs ?? ""} onChangeText={(t) => set("tech_specs", t)} placeholder="Forme, bague, contenance…" multiline testID="project-form-specs-input" />
              <Row label="Présérie" testID="project-form-preseries-row"
                right={<Switch testID="project-form-preseries-switch" value={form.preseries_needed} onValueChange={(v) => set("preseries_needed", v)} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} />} />
              {form.preseries_needed ? (
                <View style={styles.inlineBlock}>
                  <Segmented testID="project-form-preseries-mode" value={form.preseries_mode} onChange={(v) => set("preseries_mode", v)}
                    options={[{ value: "sequentielle", label: "Séquentielle" }, { value: "parallele", label: "Parallèle à la prod." }]} />
                </View>
              ) : null}
              <View style={[styles.inlineBlock, { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                <Txt variant="body">Emballage</Txt>
                <Segmented testID="project-form-packaging" value={form.packaging_type} onChange={(v) => set("packaging_type", v)}
                  options={[{ value: "croisillons", label: "Croisillons" }, { value: "barquettes", label: "Barquettes" }, { value: "ptf", label: "PTF" }]} />
                {form.packaging_type === "ptf" ? (
                  <View style={styles.inlineRow}>
                    <Txt variant="callout" style={{ flex: 1 }}>Délai sous-traitant PTF</Txt>
                    <Stepper testID="project-form-ptf-days" value={form.ptf_lead_days} min={1} max={180} suffix="j" onChange={(v) => set("ptf_lead_days", v)} />
                  </View>
                ) : null}
              </View>
              <Row label="Échantillonnages verre" testID="project-form-glass-row"
                right={<Stepper testID="project-form-glass-cycles" value={form.type === "FLK" ? 0 : form.glass_cycles} min={form.type === "FLK" ? 0 : 1} max={form.type === "FLK" ? 0 : 8} onChange={(v) => set("glass_cycles", v)} />} />
              <Row label="Échantillonnages décor" testID="project-form-decor-row"
                right={<Stepper testID="project-form-decor-cycles" value={form.decor_cycles} min={0} max={8} onChange={(v) => set("decor_cycles", v)} />} />
              <Field label="Notes" value={form.notes ?? ""} onChangeText={(t) => set("notes", t)} placeholder="Informations complémentaires" multiline last testID="project-form-notes-input" />
            </>
          ) : null}
        </Group>

        <Group title="Rétroplanning" testID="project-form-preview">
          {!pv ? (
            <View style={{ padding: spacing.xl, alignItems: "center" }}>
              {preview.isFetching ? <ActivityIndicator color={colors.brandPrimary} /> : <Txt variant="callout" color={colors.muted}>Choisissez un client pour voir le planning.</Txt>}
            </View>
          ) : (
            <View style={{ padding: spacing.lg, gap: spacing.lg }}>
              <View style={styles.kpis}>
                <Kpi label="Durée" value={`${pv.total_weeks} sem.`} testID="preview-total-weeks" />
                <Kpi label="Démarrage" value={fmtNumShort(pv.start_date)} testID="preview-start-date" />
                <Kpi label="Étapes" value={String(pv.steps.length)} testID="preview-step-count" />
              </View>
              {pv.start_in_past_days > 0 ? (
                <View style={styles.warn} testID="preview-past-warning">
                  <Ionicons name="warning" size={18} color={colors.error} />
                  <Txt variant="callout" color={colors.error} style={{ flex: 1 }}>
                    MAD trop serrée : il aurait fallu démarrer il y a {pv.start_in_past_days} jours.
                  </Txt>
                </View>
              ) : null}
              <Gantt phases={pv.phases} start={pv.start_date} end={form.mad_date} testID="preview-gantt" />
              {levers.length ? (
                <View style={{ gap: spacing.sm }}>
                  <Txt variant="label">Gagner du temps</Txt>
                  {levers.map((l) => (
                    <View key={l.key} style={styles.lever} testID={`preview-lever-${l.key}`}>
                      <Txt variant="label" style={{ flex: 1 }} color={colors.onBrandTertiary}>{l.label}</Txt>
                      <Txt variant="mono" color={colors.brandPrimary}>−{l.gain_weeks} sem.</Txt>
                      <Pressable testID={`preview-lever-apply-${l.key}`} hitSlop={6} onPress={() => { hapticSelect(); setForm((f) => ({ ...f, ...l.patch })); }} style={styles.applyBtn}>
                        <Txt variant="caption" color={colors.onBrandPrimary} style={{ fontFamily: fonts.semibold }}>Appliquer</Txt>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        </Group>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            label={id ? "Enregistrer" : "Créer le projet"}
            onPress={save}
            loading={saving}
            disabled={!form.client_id}
            testID="project-form-save-button"
          />
        </View>
      </KeyboardStickyView>
      <PhotoSourceSheet visible={picker} onClose={() => setPicker(false)} onPicked={onPicked} />
    </View>
  );
}

function Kpi({ label, value, testID }: { label: string; value: string; testID: string }) {
  const styles = useStyles();
  return (
    <View style={styles.kpi} testID={testID}>
      <Txt variant="caption">{label}</Txt>
      <Txt variant="headline" numberOfLines={1} style={{ fontSize: 15 }}>{value}</Txt>
    </View>
  );
}

function TypeHelper({ onPick }: { onPick: (t: ProjectType) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [a, setA] = useState<boolean | null>(null);
  const [b, setB] = useState<boolean | null>(null);
  const [c, setC] = useState<boolean | null>(null);
  const result: ProjectType | null = a === false ? "NPD" : a && b === false ? "DUP" : a && b && c !== null ? (c ? "MLD" : "FLK") : null;

  const Q = ({ q, v, onV, id }: { q: string; v: boolean | null; onV: (x: boolean) => void; id: string }) => (
    <View style={styles.helperQ}>
      <Txt variant="callout" style={{ flex: 1 }}>{q}</Txt>
      {[true, false].map((x) => (
        <Pressable key={String(x)} testID={`type-helper-${id}-${x ? "oui" : "non"}`} onPress={() => { hapticSelect(); onV(x); }}
          style={[styles.yn, v === x && { backgroundColor: colors.surfaceInverse }]}>
          <Txt variant="label" color={v === x ? colors.onSurfaceInverse : colors.onSurface}>{x ? "Oui" : "Non"}</Txt>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={styles.helper} testID="type-helper">
      <Q id="q1" q="Le produit existe-t-il déjà sur le marché ?" v={a} onV={(x) => { setA(x); setB(null); setC(null); }} />
      {a ? <Q id="q2" q="Le verre existe-t-il déjà dans notre gamme ?" v={b} onV={(x) => { setB(x); setC(null); }} /> : null}
      {a && b ? <Q id="q3" q="Faut-il modifier le moule ?" v={c} onV={setC} /> : null}
      {result ? (
        <Button label={`Choisir ${result} · ${TYPE_INFO[result].short}`} variant="secondary" onPress={() => onPick(result)} testID="type-helper-apply-button" />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, backgroundColor: c.surfaceSecondary },
  headerBtn: { minWidth: 88, paddingHorizontal: spacing.sm },
  content: { padding: spacing.lg, paddingBottom: 140 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: c.surfaceSecondary },
  clientBlock: { borderBottomWidth: 1, borderBottomColor: c.divider, paddingTop: spacing.md },
  clientLabel: { paddingHorizontal: spacing.lg },
  clientRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  clientChip: { flexShrink: 0, paddingHorizontal: spacing.lg, height: 40, borderRadius: radius.pill, backgroundColor: c.surfaceSecondary, justifyContent: "center" },
  clientChipActive: { backgroundColor: c.surfaceInverse },
  clientChipAdd: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.brandTertiary },
  inlineBlock: { padding: spacing.lg, gap: spacing.md },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  kpis: { flexDirection: "row", gap: spacing.sm },
  kpi: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  warn: { flexDirection: "row", gap: spacing.sm, backgroundColor: c.errorSoft, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  lever: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.brandTertiary, borderRadius: radius.md, padding: spacing.md },
  applyBtn: { backgroundColor: c.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 30, justifyContent: "center" },
  helper: { padding: spacing.lg, gap: spacing.md, borderTopWidth: 1, borderTopColor: c.divider, backgroundColor: c.surface },
  helperQ: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  yn: { paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, backgroundColor: c.surfaceSecondary, justifyContent: "center" },
}));
