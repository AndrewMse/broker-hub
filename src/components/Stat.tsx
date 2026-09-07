import { View } from 'react-native';
import { color, radius } from '@/theme/tokens';
import { Text } from './Text';

/** Small labelled figure. Put two to a row inside `StatGrid`. */
export function Stat({ label, value, tone, note }: { label: string; value: string; tone?: 'gain' | 'loss' | 'ink'; note?: string }) {
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: color.surface, borderRadius: radius.row, borderWidth: 1, borderColor: color.line, padding: 14, gap: 4 }}>
      <Text variant="small" weight="regular" tone="inkMuted">
        {label}
      </Text>
      <Text variant="title" weight="medium" tone={tone ?? 'ink'} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {note && (
        <Text variant="small" weight="regular" tone="inkMuted">
          {note}
        </Text>
      )}
    </View>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{children}</View>;
}
