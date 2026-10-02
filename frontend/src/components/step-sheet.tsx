import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, Switch, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Step, StepPatch } from "@/src/api";
import { DateField } from "@/src/components/date-field";
import { Button, Ionicons, Txt } from "@/src/components/ui";
import { fmtShort, toISO } from "@/src/format";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function StepSheet({ step, onClose, onSave, saving }: { step: Step | null; onClose: () => void; onSave: (patch: StepPatch) => void; saving?: boolean }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const [done, setDone] = useState(false);
  const [actual, setActual] = useState<string>(toISO(new Date()));
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (step) {
      setDone(step.done);
      setActual(step.actual_end ?? toISO(new Date()));
      setComment(step.comment ?? "");
    }
  }, [step]);

  return (
    <Modal visible={!!step} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="step-sheet-backdrop" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="step-sheet">
          <View style={styles.handle} />
          {step ? (
            <>
              <View style={{ gap: 4 }}>
                <Txt variant="headline">{step.name}</Txt>
                <Txt variant="caption">
                  Prévu du {fmtShort(step.start)} au {fmtShort(step.end)}
                  {step.client_validation ? " · Validation client" : ""}
                </Txt>
              </View>

              <View style={styles.card}>
                <View style={styles.row}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.brandPrimary} />
                  <Txt variant="body" style={{ flex: 1 }}>Étape terminée</Txt>
                  <Switch testID="step-sheet-done-switch" value={done} onValueChange={setDone} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} />
                </View>
                {done ? <DateField label="Date réelle" value={actual} onChange={setActual} testID="step-sheet-actual-date" last /> : null}
              </View>

              <View style={styles.card}>
                <TextInput
                  testID="step-sheet-comment-input"
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Commentaire (retour client, blocage, décision…)"
                  placeholderTextColor={colors.muted}
                  multiline
                  style={styles.input}
                />
              </View>

              <Button
                label="Enregistrer"
                loading={saving}
                testID="step-sheet-save-button"
                onPress={() => onSave({ done, actual_end: done ? actual : null, comment })}
              />
            </>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: c.overlay },
  sheet: {
    backgroundColor: c.surfaceSecondary,
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    padding: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  handle: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: c.surfaceTertiary, marginBottom: spacing.xs },
  card: { backgroundColor: c.surface, borderRadius: radius.md, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, minHeight: 52 },
  input: { fontFamily: fonts.regular, fontSize: 16, color: c.onSurface, padding: spacing.lg, minHeight: 88, textAlignVertical: "top" },
}));
