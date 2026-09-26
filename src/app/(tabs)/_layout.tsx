import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCalendar, useOptionsBook } from '@/api/queries';
import { Icon } from '@/components/Icon';
import { syncAlerts } from '@/lib/alerts';
import { useSettings } from '@/state/settings';
import { color, font } from '@/theme/tokens';

function useAlertSync() {
  const { alerts } = useSettings();
  const book = useOptionsBook();
  const calendar = useCalendar();
  useEffect(() => {
    if (book.data && calendar.data) syncAlerts(book.data, calendar.data, alerts).catch(() => {});
  }, [book.data, calendar.data, alerts]);
}

export default function TabsLayout() {
  useAlertSync();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: color.canvas },
          tabBarActiveTintColor: color.accent,
          tabBarInactiveTintColor: color.inkMuted,
          tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.line },
          tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Overview', tabBarIcon: ({ color: c }) => <Icon name="overview" tint={String(c)} /> }} />
        <Tabs.Screen name="exposure" options={{ title: 'Exposure', tabBarIcon: ({ color: c }) => <Icon name="exposure" tint={String(c)} /> }} />
        <Tabs.Screen name="options" options={{ title: 'Options', tabBarIcon: ({ color: c }) => <Icon name="options" tint={String(c)} /> }} />
        <Tabs.Screen name="markets" options={{ title: 'Markets', tabBarIcon: ({ color: c }) => <Icon name="markets" tint={String(c)} /> }} />
        <Tabs.Screen name="brokers" options={{ title: 'Brokers', tabBarIcon: ({ color: c }) => <Icon name="brokers" tint={String(c)} /> }} />
      </Tabs>
      {/* Tab screens scroll edge to edge; this keeps content from running under the clock */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: color.canvas, opacity: 0.94 }} />
    </View>
  );
}
