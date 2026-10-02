import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

import { Ionicons } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { colors, fonts } from "@/src/theme";

export default function TabsLayout() {
  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="house.fill" />
          <NativeTabs.Trigger.Label>Accueil</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="projects">
          <NativeTabs.Trigger.Icon sf="folder.fill" />
          <NativeTabs.Trigger.Label>Projets</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="clients">
          <NativeTabs.Trigger.Icon sf="person.2.fill" />
          <NativeTabs.Trigger.Label>Clients</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon sf="gearshape.fill" />
          <NativeTabs.Trigger.Label>Réglages</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  const icon = (name: string, outline: string) =>
    function TabIcon({ color, focused }: { color: string; focused: boolean }) {
      return <Ionicons name={(focused ? name : outline) as never} size={24} color={color} />;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil", tabBarButtonTestID: "tab-accueil", tabBarIcon: icon("home", "home-outline") }} />
      <Tabs.Screen name="projects" options={{ title: "Projets", tabBarButtonTestID: "tab-projets", tabBarIcon: icon("folder", "folder-outline") }} />
      <Tabs.Screen name="clients" options={{ title: "Clients", tabBarButtonTestID: "tab-clients", tabBarIcon: icon("people", "people-outline") }} />
      <Tabs.Screen name="settings" options={{ title: "Réglages", tabBarButtonTestID: "tab-reglages", tabBarIcon: icon("settings", "settings-outline") }} />
    </Tabs>
  );
}
