import { View } from 'react-native';
import type { FlagSeverity, RiskFlag } from '@/api/types';
import { flagPalette, radius } from '@/theme/tokens';
import { Text } from './Text';

export function SeverityDot({ severity, size = 8 }: { severity: FlagSeverity; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: flagPalette[severity].dot }} />;
}

/** A risk flag on a strategy card: tinted box, title, one line of why. */
export function FlagBox({ flag }: { flag: RiskFlag }) {
  const c = flagPalette[flag.severity];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 10, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <SeverityDot severity={flag.severity} />
        <Text variant="secondary" weight="semibold" tone={c.fg} style={{ flex: 1 }}>
          {flag.title}
        </Text>
      </View>
      <Text variant="small" weight="regular" tone={c.fg} style={{ paddingLeft: 16 }}>
        {flag.detail}
      </Text>
    </View>
  );
}
