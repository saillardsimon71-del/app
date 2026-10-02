import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, deleteClientDocument, fileUrl, uploadClientDocument, useClients, useSettings, type Client, type ClientInput, type LocalPhoto } from "@/src/api";
import { ConfirmSheet } from "@/src/components/confirm-sheet";
import { PhotoSourceSheet } from "@/src/components/photo-sheet";
import { PhotoStrip, type StripItem } from "@/src/components/photo-strip";
import { useToast } from "@/src/components/toast";
import { Button, Field, Group, Row, Stepper, Txt } from "@/src/components/ui";
import { makeStyles, spacing } from "@/src/theme";

export default function ClientForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const toast = useToast();
  const clients = useClients();
  const settings = useSettings();
  const existing = clients.data?.find((c) => c.id === id);

  const [form, setForm] = useState<ClientInput>({ name: "", contact: "", email: "", validation_delay_days: 10, notes: "" });
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [picker, setPicker] = useState(false);
  const [pending, setPending] = useState<LocalPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  const isPdf = (f: LocalPhoto) => f.type === "application/pdf";
  const docItems: StripItem[] = [
    ...(existing?.documents ?? []).map((d) => ({ key: d.id, uri: fileUrl(d), kind: d.kind, name: d.name })),
    ...pending.map((f) => ({ key: f.uri, uri: f.uri, pending: true, kind: isPdf(f) ? ("pdf" as const) : ("image" as const), name: f.name })),
  ];

  const onPicked = async (file: LocalPhoto) => {
    if (!id) return setPending((l) => [...l, file]);
    setUploading(true);
    try {
      await uploadClientDocument(id, file);
      await qc.invalidateQueries({ queryKey: ["clients"] });
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setUploading(false);
    }
  };

  const onRemoveDoc = async (item: StripItem) => {
    if (item.pending) return setPending((l) => l.filter((f) => f.uri !== item.key));
    try {
      await deleteClientDocument(id!, item.key);
      await qc.invalidateQueries({ queryKey: ["clients"] });
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  useEffect(() => {
    if (existing) setForm({ name: existing.name, contact: existing.contact ?? "", email: existing.email ?? "", validation_delay_days: existing.validation_delay_days, notes: existing.notes ?? "" });
  }, [existing]);
  useEffect(() => {
    if (!id && settings.data) setForm((f) => ({ ...f, validation_delay_days: settings.data.default_validation_delay }));
  }, [id, settings.data]);

  const save = async () => {
    if (!form.name.trim()) return toast("Le nom du client est obligatoire", "error");
    setSaving(true);
    try {
      const c = await api<Client>(id ? `/clients/${id}` : "/clients", { method: id ? "PUT" : "POST", body: { ...form, name: form.name.trim() } });
      let failed = 0;
      for (const f of pending) {
        try {
          await uploadClientDocument(c.id, f);
        } catch {
          failed += 1;
        }
      }
      await qc.invalidateQueries();
      toast(failed ? `Client ajouté · ${failed} fichier${failed > 1 ? "s" : ""} non envoyé${failed > 1 ? "s" : ""}` : id ? "Client mis à jour" : "Client ajouté", failed ? "info" : "success");
      router.back();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api(`/clients/${id}`, { method: "DELETE" });
      await qc.invalidateQueries();
      setConfirm(false);
      toast("Client supprimé");
      router.back();
    } catch (e) {
      setConfirm(false);
      toast((e as Error).message, "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
        <Button label="Annuler" variant="plain" onPress={() => router.back()} testID="client-form-cancel-button" style={styles.headerBtn} />
        <Txt variant="headline">{id ? "Modifier le client" : "Nouveau client"}</Txt>
        <View style={styles.headerBtn} />
      </View>
      <KeyboardAwareScrollView bottomOffset={96} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Group title="Client">
          <Field label="Nom" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="Ex. Maison Lumière" testID="client-form-name-input" />
          <Field label="Contact" value={form.contact ?? ""} onChangeText={(t) => setForm({ ...form, contact: t })} placeholder="Nom du contact" testID="client-form-contact-input" />
          <Field
            label="Email"
            value={form.email ?? ""}
            onChangeText={(t) => setForm({ ...form, email: t })}
            placeholder="contact@client.com"
            keyboardType="email-address"
            autoCapitalize="none"
            last
            testID="client-form-email-input"
          />
        </Group>
        <Group title="Réactivité" footer="10 jours = planning standard. Un client plus rapide raccourcit ses étapes de validation.">
          <Row
            label="Délai de validation"
            last
            right={<Stepper testID="client-form-delay" value={form.validation_delay_days} min={1} max={60} suffix="j" onChange={(v) => setForm({ ...form, validation_delay_days: v })} />}
          />
        </Group>
        <Group title="Photos & documents" footer="Croquis, idées, cahiers des charges PDF apportés par le client.">
          <PhotoStrip testID="client-form-documents" items={docItems} busy={uploading} onAdd={() => setPicker(true)} onRemove={onRemoveDoc} />
        </Group>
        <Group title="Notes">
          <Field label="Notes" value={form.notes ?? ""} onChangeText={(t) => setForm({ ...form, notes: t })} placeholder="Préférences, interlocuteurs…" multiline last testID="client-form-notes-input" />
        </Group>
        {id ? (
          <Group>
            <Row label="Supprimer le client" destructive last onPress={() => setConfirm(true)} testID="client-form-delete-row" />
          </Group>
        ) : null}
      </KeyboardAwareScrollView>
      <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button label={id ? "Enregistrer" : "Ajouter le client"} onPress={save} loading={saving} testID="client-form-save-button" />
        </View>
      </KeyboardStickyView>
      <PhotoSourceSheet visible={picker} onClose={() => setPicker(false)} onPicked={onPicked} allowDocuments />
      <ConfirmSheet
        visible={confirm}
        title="Supprimer ce client ?"
        message="Impossible si des projets lui sont encore rattachés."
        confirmLabel="Supprimer"
        loading={deleting}
        onConfirm={remove}
        onClose={() => setConfirm(false)}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, backgroundColor: c.surfaceSecondary },
  headerBtn: { minWidth: 88, paddingHorizontal: spacing.sm },
  content: { padding: spacing.lg, paddingBottom: 120 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: c.surfaceSecondary },
}));
