import {
  HankenGrotesk_300Light,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  useFonts,
} from '@expo-google-fonts/hanken-grotesk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureNotifications } from '@/lib/alerts';
import { SettingsProvider } from '@/state/settings';
import { color, font } from '@/theme/tokens';

configureNotifications();

export default function RootLayout() {
  const [loaded] = useFonts({ HankenGrotesk_300Light, HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold });
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <SettingsProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: color.canvas },
              headerStyle: { backgroundColor: color.canvas },
              headerShadowVisible: false,
              headerTintColor: color.ink,
              headerTitleStyle: { fontFamily: font.semibold, fontSize: 17 },
              headerBackButtonDisplayMode: 'minimal',
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="instrument/[id]" options={{ title: '' }} />
            <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
            <Stack.Screen name="tax" options={{ title: 'Tax' }} />
            <Stack.Screen
              name="trade"
              options={{
                presentation: 'formSheet',
                headerShown: false,
                sheetAllowedDetents: [0.94],
                sheetGrabberVisible: true,
                sheetCornerRadius: 28,
                contentStyle: { backgroundColor: color.canvas },
              }}
            />
            <Stack.Screen
              name="settings"
              options={{
                presentation: 'formSheet',
                headerShown: false,
                sheetAllowedDetents: [0.94],
                sheetGrabberVisible: true,
                sheetCornerRadius: 28,
                contentStyle: { backgroundColor: color.canvas },
              }}
            />
          </Stack>
        </SettingsProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
