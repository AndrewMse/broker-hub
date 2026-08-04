import { View } from 'react-native';
import type { BrokerSlice } from '@/api/types';
import { color } from '@/theme/tokens';
import { BrokerDisc } from './BrokerDisc';
import { Text } from './Text';

const tones = [color.accent, color.accentMid, color.violet];

/** How the portfolio splits across brokers. Segment colors are neutral; the discs name the broker. */
export function SplitBar({ slices }: { slices: BrokerSlice[] }) {
  return (
    <View style={{ gap: 10 }} accessibilityLabel={slices.map((s) => `${s.broker.name} ${Math.round(s.share * 100)}%`).join(', ')}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {slices.map((s, i) => (
          <View key={s.broker.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tones[i % tones.length] }} />
            <BrokerDisc broker={s.broker} size={20} />
            <Text variant="secondary" weight="medium">
              {s.broker.shortName}
            </Text>
            <Text variant="secondary" tone="inkMuted">
              {Math.round(s.share * 100)}%
            </Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', height: 8, gap: 3 }}>
        {slices.map((s, i) => (
          <View key={s.broker.id} style={{ flex: s.share, backgroundColor: tones[i % tones.length], borderRadius: 4 }} />
        ))}
      </View>
    </View>
  );
}
