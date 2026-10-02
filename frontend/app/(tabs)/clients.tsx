import { router } from "expo-router";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useClients } from "@/src/api";
import { ScreenHeader } from "@/src/components/screen-header";
import { Button, CenterState, IconButton, Ionicons, PressScale, Txt } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Clients() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const q = useClients();
  const list = q.data ?? [];

  return (
    <View style={styles.root}>
      <ScreenHeader title="Clients" right={<IconButton icon="add" tinted testID="clients-new-button" onPress={() => router.push("/client/form")} />} />
      {q.isLoading ? (
        <CenterState loading />
      ) : q.isError ? (
        <CenterState icon="cloud-offline-outline" title="Erreur de chargement" action={<Button label="Réessayer" onPress={() => q.refetch()} testID="clients-retry-button" />} />
      ) : (
        <FlatList
          testID="clients-list"
          data={list}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.content, { paddingBottom: bottomChrome + spacing.xl }, list.length === 0 && { flex: 1 }]}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
          renderItem={({ item, index }) => (
            <PressScale
              testID={`client-row-${item.id}`}
              onPress={() => router.push({ pathname: "/client/form", params: { id: item.id } })}
              style={[styles.row, index === 0 && styles.first, index === list.length - 1 && styles.last, index < list.length - 1 && styles.divider]}
            >
              <View style={styles.avatar}>
                <Txt variant="headline" color={colors.onBrandTertiary}>
                  {item.name.slice(0, 1).toUpperCase()}
                </Txt>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="headline" numberOfLines={1}>{item.name}</Txt>
                <Txt variant="caption" numberOfLines={1}>
                  {item.contact || "Aucun contact"} · {item.project_count ?? 0} projet{(item.project_count ?? 0) > 1 ? "s" : ""}
                </Txt>
              </View>
              <View style={styles.delay}>
                <Ionicons name="hourglass-outline" size={12} color={colors.onSurfaceSecondary} />
                <Txt variant="caption" color={colors.onSurfaceSecondary} style={{ fontFamily: fonts.mono }}>
                  {item.validation_delay_days} j
                </Txt>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.borderStrong} />
            </PressScale>
          )}
          ListHeaderComponent={
            list.length ? (
              <Txt variant="caption" style={styles.hint}>
                Le délai de validation client (en jours) ajuste chaque étape Retour / approbation et Homologation de ses projets.
              </Txt>
            ) : null
          }
          ListEmptyComponent={
            <CenterState
              testID="clients-empty"
              icon="people-outline"
              title="Aucun client"
              message="Ajoutez vos clients et leur délai de validation habituel."
              action={<Button label="Ajouter un client" icon="add" onPress={() => router.push("/client/form")} testID="clients-empty-create-button" />}
            />
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  content: { padding: spacing.lg },
  hint: { marginBottom: spacing.md, marginHorizontal: spacing.xs, lineHeight: 17 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 64 },
  first: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  last: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  divider: { borderBottomWidth: 1, borderBottomColor: c.divider },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  delay: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.surfaceSecondary, paddingHorizontal: spacing.sm, height: 24, borderRadius: radius.pill },
}));
