import { View } from 'react-native';
import type { Broker } from '@/api/types';
import { color, font } from '@/theme/tokens';
import { Text } from './Text';

export function BrokerDisc({ broker, size = 18, dimmed }: { broker: Broker; size?: number; dimmed?: boolean }) {
  return (
    <View
      accessibilityLabel={broker.name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: dimmed ? color.line : broker.brandColor,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: color.surface,
      }}
    >
      <Text style={{ fontFamily: font.semibold, fontSize: size * 0.42, lineHeight: size * 0.5, color: dimmed ? color.inkMuted : '#fff' }}>
        {broker.monogram}
      </Text>
    </View>
  );
}
