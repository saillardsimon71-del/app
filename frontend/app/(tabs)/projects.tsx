import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, RefreshControl, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useProjects, type ProjectType } from "@/src/api";
import { ProjectCard } from "@/src/components/project-card";
import { ScreenHeader } from "@/src/components/screen-header";
import { Button, CenterState, ChipRow, IconButton, Ionicons } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Filter = "all" | ProjectType | "late" | "archived";

export default function Projects() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const q = useProjects();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const all = useMemo(() => q.data ?? [], [q.data]);
  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all
      .filter((p) => (filter === "archived" ? p.archived : !p.archived))
      .filter((p) => (filter === "all" || filter === "archived" ? true : filter === "late" ? p.status === "en_retard" : p.type === filter))
      .filter((p) => !s || `${p.name} ${p.client_name} ${p.code ?? ""}`.toLowerCase().includes(s));
  }, [all, filter, search]);

  const active = all.filter((p) => !p.archived);
  const options: { value: Filter; label: string; count?: number }[] = [
    { value: "all", label: "Tous", count: active.length },
    { value: "late", label: "En retard", count: active.filter((p) => p.status === "en_retard").length },
    ...(["NPD", "DUP", "FLK", "MLD"] as const).map((t) => ({ value: t, label: t, count: active.filter((p) => p.type === t).length })),
    { value: "archived", label: "Archivés" },
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader title="Projets" right={<IconButton icon="add" tinted testID="projects-new-button" onPress={() => router.push("/project/form")} />}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.muted} />
          <TextInput
            testID="projects-search-input"
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher projet, client, référence"
            placeholderTextColor={colors.muted}
            style={styles.search}
            returnKeyType="search"
          />
        </View>
        <ChipRow options={options} value={filter} onChange={setFilter} testID="projects-filter" />
      </ScreenHeader>
      {q.isLoading ? (
        <CenterState loading />
      ) : q.isError ? (
        <CenterState icon="cloud-offline-outline" title="Erreur de chargement" action={<Button label="Réessayer" onPress={() => q.refetch()} testID="projects-retry-button" />} />
      ) : (
        <FlatList
          testID="projects-list"
          data={list}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <ProjectCard p={item} />}
          contentContainerStyle={[styles.content, { paddingBottom: bottomChrome + spacing.xl }, list.length === 0 && { flex: 1 }]}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={
            <CenterState
              testID="projects-empty"
              icon="folder-open-outline"
              title="Aucun projet trouvé"
              message={all.length ? "Essayez un autre filtre." : "Créez votre premier projet PGP Glass."}
              action={all.length ? null : <Button label="Nouveau projet" icon="add" onPress={() => router.push("/project/form")} testID="projects-empty-create-button" />}
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    height: 38,
    borderRadius: radius.md - 2,
    backgroundColor: c.surfaceTertiary,
  },
  search: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: c.onSurface, paddingVertical: 0 },
}));
