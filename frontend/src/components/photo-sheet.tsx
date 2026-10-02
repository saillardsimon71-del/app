import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Linking, Modal, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { LocalPhoto } from "@/src/api";
import { Button, Ionicons, PressScale, Txt, type IconName } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Source = "camera" | "library";

async function ensurePermission(source: Source): Promise<"granted" | "blocked"> {
  if (Platform.OS === "web") return "granted";
  const get = source === "camera" ? ImagePicker.getCameraPermissionsAsync : ImagePicker.getMediaLibraryPermissionsAsync;
  const request = source === "camera" ? ImagePicker.requestCameraPermissionsAsync : ImagePicker.requestMediaLibraryPermissionsAsync;
  let perm = await get();
  if (perm.granted) return "granted";
  if (!perm.canAskAgain) return "blocked";
  perm = await request();
  return perm.granted ? "granted" : "blocked";
}

function toLocalPhoto(a: ImagePicker.ImagePickerAsset): LocalPhoto {
  const type = a.mimeType ?? "image/jpeg";
  const ext = type.split("/")[1] ?? "jpg";
  return { uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.${ext}`, type };
}

export function PhotoSourceSheet({ visible, onClose, onPicked }: { visible: boolean; onClose: () => void; onPicked: (p: LocalPhoto) => void }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const [blocked, setBlocked] = useState<Source | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setBlocked(null);
    onClose();
  };

  const pick = async (source: Source) => {
    setBusy(true);
    try {
      const status = await ensurePermission(source);
      if (status === "blocked") return setBlocked(source);
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7 };
      const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (!res.canceled && res.assets[0]) {
        onPicked(toLocalPhoto(res.assets[0]));
        close();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} testID="photo-sheet-backdrop" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="photo-sheet">
        <View style={styles.handle} />
        {blocked ? (
          <>
            <Txt variant="headline">{blocked === "camera" ? "Appareil photo désactivé" : "Accès aux photos désactivé"}</Txt>
            <Txt variant="callout" color={colors.muted}>
              Autorisez l&apos;accès dans les réglages de votre téléphone pour ajouter les croquis du client.
            </Txt>
            <Button label="Ouvrir les réglages" icon="settings-outline" onPress={() => Linking.openSettings()} testID="photo-sheet-open-settings" />
            <Button label="Annuler" variant="plain" onPress={close} testID="photo-sheet-cancel-button" />
          </>
        ) : (
          <>
            <Txt variant="headline">Ajouter une photo</Txt>
            <Txt variant="callout" color={colors.muted}>Croquis, dessin ou idée apportée par le client.</Txt>
            <View style={styles.options}>
              <Option icon="camera-outline" label="Appareil photo" disabled={busy} onPress={() => pick("camera")} testID="photo-sheet-camera" />
              <Option icon="images-outline" label="Galerie" disabled={busy} onPress={() => pick("library")} testID="photo-sheet-library" />
            </View>
            <Button label="Annuler" variant="plain" onPress={close} testID="photo-sheet-cancel-button" />
          </>
        )}
      </View>
    </Modal>
  );
}

function Option({ icon, label, onPress, disabled, testID }: { icon: IconName; label: string; onPress: () => void; disabled: boolean; testID: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <PressScale onPress={onPress} disabled={disabled} testID={testID} style={styles.option}>
      <Ionicons name={icon} size={26} color={colors.brandPrimary} />
      <Txt variant="label" color={colors.onSurface}>{label}</Txt>
    </PressScale>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: c.overlay },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    padding: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  handle: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: c.surfaceTertiary, marginBottom: spacing.sm },
  options: { flexDirection: "row", gap: spacing.md },
  option: { flex: 1, height: 96, borderRadius: radius.lg, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center", gap: spacing.sm },
}));
