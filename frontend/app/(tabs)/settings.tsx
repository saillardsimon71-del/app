import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, useInvalidateAll, useSettings, type Settings } from "@/src/api";
import { ScreenHeader } from "@/src/components/screen-header";
import { useToast } from "@/src/components/toast";
import { Button, CenterState, Group, Row, Stepper, Txt } from "@/src/components/ui";
import { TYPE_DEFAULTS, TYPE_INFO } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function SettingsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const q = useSettings();
  const qc = useQueryClient();
  const toast = useToast();
  const invalidate = useInvalidateAll();
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (q.data) setS(q.data);
  }, [q.data]);

  const dirty = !!s && !!q.data && (s.order_offset_days !== q.data.order_offset_days || s.default_validation_delay !== q.data.default_validation_delay);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    try {
      const r = await api<Settings>("/settings", { method: "PUT", body: s });
      qc.setQueryData(["settings"], r);
      toast("Réglages enregistrés");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const seed = async () => {
    setSeeding(true);
    try {
      const r = await api<{ created: number }>("/demo/seed", { method: "POST" });
      await invalidate();
      toast(r.created ? `${r.created} projets d'exemple ajoutés` : "Exemples déjà présents", "info");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Réglages" />
      {!s ? (
        <CenterState loading={q.isLoading} title={q.isError ? "Erreur de chargement" : undefined} />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomChrome + spacing.xl }]} testID="settings-scroll">
          <Group
            title="Rétroplanning"
            footer="Les étapes Commande (présérie et production) démarrent ce nombre de jours avant le début de leur phase. Le délai par défaut s'applique aux nouveaux clients (référence : 10 j, soit les durées du planning standard)."
          >
            <Row
              icon="cart-outline"
              label="Décalage commandes"
              testID="settings-order-offset-row"
              right={<Stepper testID="settings-order-offset" value={s.order_offset_days} min={0} max={180} suffix="j" onChange={(v) => setS({ ...s, order_offset_days: v })} />}
            />
            <Row
              icon="hourglass-outline"
              label="Validation client"
              last
              testID="settings-default-delay-row"
              right={<Stepper testID="settings-default-delay" value={s.default_validation_delay} min={1} max={60} suffix="j" onChange={(v) => setS({ ...s, default_validation_delay: v })} />}
            />
          </Group>
          {dirty ? <Button label="Enregistrer" onPress={save} loading={saving} testID="settings-save-button" style={{ marginBottom: spacing.xl }} /> : null}

          <Group title="Cycles par défaut selon le type" footer="Proposition du document « Processus de développement produit ». Modifiables projet par projet.">
            {(Object.keys(TYPE_INFO) as (keyof typeof TYPE_INFO)[]).map((t, i, arr) => (
              <Row key={t} label={`${t} · ${TYPE_INFO[t].label}`} value={`Verre ${TYPE_DEFAULTS[t].glass} · Décor ${TYPE_DEFAULTS[t].decor}`} last={i === arr.length - 1} />
            ))}
          </Group>

          <Group title="Leviers d'optimisation" footer="Activez-les dans la fiche projet lorsque la MAD est contrainte. Combinés, ils ramènent un NPD d'environ 49 à 35 semaines.">
            <Row label="Verre — 2 échantillons" value="≈ 7 sem." />
            <Row label="Décor — 2 échantillons" value="≈ 3-4 sem." />
            <Row label="Présérie ∥ Production" value="≈ 7 sem." last />
          </Group>

          <Group title="Données">
            <Row icon="sparkles-outline" label={seeding ? "Chargement…" : "Charger des projets d'exemple"} onPress={seed} last testID="settings-seed-demo-row" />
          </Group>

          <Txt variant="caption" color={colors.muted} style={{ textAlign: "center" }}>
            PGP Glass · Suivi de projets
          </Txt>
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  content: { padding: spacing.lg },
}));
