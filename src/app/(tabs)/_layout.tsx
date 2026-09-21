import { Tabs } from 'expo-router';
import { Icon } from '@/components/Icon';
import { color, font } from '@/theme/tokens';

export default function TabsLayout() {
  return (
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
  );
}
