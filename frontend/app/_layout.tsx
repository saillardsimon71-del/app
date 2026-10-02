import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/toast";
import { queryClient } from "@/src/query-client";
import { colors } from "@/src/theme";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  // Prewarm icon + text fonts so icons render on Expo Go Android.
  const [loaded, error] = useFonts({
    Ionicons: require("@react-native-vector-icons/ionicons/fonts/Ionicons.ttf"),
    "Geist-Regular": require("../assets/fonts/Geist-Regular.ttf"),
    "Geist-Medium": require("../assets/fonts/Geist-Medium.ttf"),
    "Geist-SemiBold": require("../assets/fonts/Geist-SemiBold.ttf"),
    "Geist-Bold": require("../assets/fonts/Geist-Bold.ttf"),
    "GeistMono-Medium": require("../assets/fonts/GeistMono-Medium.ttf"),
  });

  if (!loaded && !error) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <ToastProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surfaceSecondary } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="project/[id]" />
                <Stack.Screen name="project/form" options={{ presentation: "modal" }} />
                <Stack.Screen name="client/form" options={{ presentation: "modal" }} />
              </Stack>
            </ToastProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
