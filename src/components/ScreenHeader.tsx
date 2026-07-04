import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from './Text';

export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  );
}
