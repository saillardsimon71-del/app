import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Txt } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  loading,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="confirm-sheet-backdrop" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="confirm-sheet">
        <View style={styles.handle} />
        <Txt variant="headline">{title}</Txt>
        <Txt variant="callout" color={colors.muted}>
          {message}
        </Txt>
        <Button label={confirmLabel} variant="destructive" onPress={onConfirm} loading={loading} testID="confirm-sheet-confirm-button" />
        <Button label="Annuler" variant="plain" onPress={onClose} testID="confirm-sheet-cancel-button" />
      </View>
    </Modal>
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
}));
