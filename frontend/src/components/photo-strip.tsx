import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConfirmSheet } from "@/src/components/confirm-sheet";
import { Ionicons, PressScale, Txt } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export type StripItem = { key: string; uri: string; pending?: boolean };

export function PhotoStrip({
  items,
  onAdd,
  onRemove,
  busy,
  testID,
}: {
  items: StripItem[];
  onAdd: () => void;
  onRemove: (item: StripItem) => void | Promise<void>;
  busy?: boolean;
  testID: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<StripItem | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    if (!open) return;
    setRemoving(true);
    try {
      await onRemove(open);
      setConfirm(false);
      setOpen(null);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={{ flexGrow: 0 }} testID={testID}>
        <PressScale onPress={onAdd} disabled={busy} testID={`${testID}-add`} style={styles.add}>
          {busy ? <ActivityIndicator color={colors.brandPrimary} /> : <Ionicons name="camera-outline" size={24} color={colors.brandPrimary} />}
          <Txt variant="caption" color={colors.onBrandTertiary}>{busy ? "Envoi…" : "Ajouter"}</Txt>
        </PressScale>
        {items.map((it) => (
          <PressScale key={it.key} onPress={() => setOpen(it)} testID={`${testID}-item-${it.key}`} style={styles.thumbWrap}>
            <Image source={{ uri: it.uri }} style={styles.thumb} contentFit="cover" transition={150} />
            {it.pending ? (
              <View style={styles.pending}>
                <Ionicons name="time-outline" size={14} color={colors.onSurfaceInverse} />
              </View>
            ) : null}
          </PressScale>
        ))}
      </ScrollView>

      <Modal visible={!!open} animationType="fade" onRequestClose={() => setOpen(null)} statusBarTranslucent>
        <View style={styles.viewer} testID={`${testID}-viewer`}>
          {open ? <Image source={{ uri: open.uri }} style={{ flex: 1 }} contentFit="contain" /> : null}
          <View style={[styles.viewerBar, { top: insets.top + spacing.sm }]}>
            <Pressable onPress={() => setOpen(null)} style={styles.viewerBtn} testID={`${testID}-viewer-close`}>
              <Ionicons name="close" size={22} color={colors.onSurfaceInverse} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setConfirm(true)} style={styles.viewerBtn} testID={`${testID}-viewer-delete`}>
              <Ionicons name="trash-outline" size={20} color={colors.onSurfaceInverse} />
            </Pressable>
          </View>
        </View>
        <ConfirmSheet
          visible={confirm}
          title="Retirer cette photo ?"
          message="Elle ne sera plus visible sur le projet."
          confirmLabel="Retirer la photo"
          loading={removing}
          onConfirm={remove}
          onClose={() => setConfirm(false)}
        />
      </Modal>
    </>
  );
}

const SIZE = 84;

const useStyles = makeStyles((c) => ({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  add: { width: SIZE, height: SIZE, borderRadius: radius.md, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center", gap: 4 },
  thumbWrap: { width: SIZE, height: SIZE, borderRadius: radius.md, overflow: "hidden", backgroundColor: c.surfaceTertiary },
  thumb: { width: SIZE, height: SIZE },
  pending: { position: "absolute", right: 6, bottom: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: c.overlay, alignItems: "center", justifyContent: "center" },
  viewer: { flex: 1, backgroundColor: c.surfaceInverse },
  viewerBar: { position: "absolute", left: spacing.lg, right: spacing.lg, flexDirection: "row", alignItems: "center" },
  viewerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.overlay, alignItems: "center", justifyContent: "center" },
}));
