import { View } from 'react-native';
import { color } from '@/theme/tokens';
import { Text } from './Text';

/**
 * Label, value and a thin bar for a share of some total.
 * `limit` draws a tick where a concentration limit sits; over-limit bars turn red.
 */
export function ShareBar({ label, value, share, max = 1, limit }: { label: string; value: string; share: number; max?: number; limit?: number }) {
  const over = limit !== undefined && share > limit;
  const w = Math.max(0, Math.min(1, share / max));
  return (
    <View style={{ gap: 6, paddingVertical: 8 }} accessibilityLabel={`${label}, ${value}, ${Math.round(share * 100)} percent`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Text variant="secondary" weight="medium" style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
        <Text variant="secondary" tone="inkMuted">
          {value}
        </Text>
        <Text variant="secondary" weight="medium" tone={over ? 'loss' : 'ink'} style={{ width: 52, textAlign: 'right' }}>
          {(share * 100).toFixed(1)}%
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: color.sunken }}>
        <View style={{ width: `${w * 100}%`, height: 6, borderRadius: 3, backgroundColor: over ? color.loss : color.accent }} />
        {limit !== undefined && limit < max && (
          <View style={{ position: 'absolute', left: `${(limit / max) * 100}%`, top: -2, width: 2, height: 10, borderRadius: 1, backgroundColor: color.ink, opacity: 0.35 }} />
        )}
      </View>
    </View>
  );
}
