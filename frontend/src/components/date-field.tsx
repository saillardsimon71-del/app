import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/src/components/ui";
import { d, fmtLong, toISO, week } from "@/src/format";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function DateField({ label, value, onChange, testID }: { label: string; value: string; onChange: (iso: string) => void; testID: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<Date>(d(value));
  const [webText, setWebText] = useState(value);

  if (Platform.OS === "web") {
    return (
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          testID={testID}
          value={webText}
          placeholder="AAAA-MM-JJ"
          placeholderTextColor={colors.muted}
          onChangeText={(t) => {
            setWebText(t);
            if (/^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(d(t).getTime())) onChange(t);
          }}
          style={styles.input}
        />
        <Text style={styles.week}>{week(value)}</Text>
      </View>
    );
  }

  const openPicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({ value: d(value), mode: "date", onChange: (e, date) => e.type === "set" && date && onChange(toISO(date)) });
    } else {
      setTemp(d(value));
      setOpen(true);
    }
  };

  return (
    <>
      <Pressable testID={testID} onPress={openPicker} style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} numberOfLines={1}>
          {fmtLong(value)}
        </Text>
        <Text style={styles.week}>{week(value)}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <DateTimePicker value={temp} mode="date" display="inline" locale="fr-FR" accentColor={colors.brandPrimary} onChange={(_, dt) => dt && setTemp(dt)} />
          <Button
            label="Valider la date"
            testID={`${testID}-confirm`}
            onPress={() => {
              onChange(toISO(temp));
              setOpen(false);
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, minHeight: 48, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  label: { width: 110, fontFamily: fonts.regular, fontSize: 16, color: c.onSurface },
  value: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: c.brandPrimary, textTransform: "capitalize" },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: c.onSurface, paddingVertical: spacing.md },
  week: { fontFamily: fonts.mono, fontSize: 12, color: c.muted },
  backdrop: { flex: 1, backgroundColor: c.overlay },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: radius.lg + 4, borderTopRightRadius: radius.lg + 4, padding: spacing.lg, gap: spacing.md },
}));
