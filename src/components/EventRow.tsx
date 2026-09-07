import { View } from 'react-native';
import type { CalendarEvent, Currency } from '@/api/types';
import { days, money, number, price } from '@/lib/format';
import { color } from '@/theme/tokens';
import { SeverityDot } from './Flag';
import { Text } from './Text';

const month = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });

/** Date block, what happens, and which of your short options are still open on that day. */
export function EventRow({ event: e, first, currency }: { event: CalendarEvent; first?: boolean; currency?: Currency }) {
  const what =
    e.kind === 'earnings'
      ? `Earnings${e.timing ? ` · ${e.timing.toLowerCase()}` : ''}`
      : `Ex-dividend${e.amount ? ` · ${price(e.amount, e.instrument.currency)} a share` : ''}`;
  return (
    <View style={{ flexDirection: 'row', gap: 14, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: color.line }}>
      <View style={{ width: 40, alignItems: 'center' }}>
        <Text variant="small" weight="medium" tone={e.kind === 'earnings' ? 'accent' : 'inkMuted'}>
          {month(e.date).toUpperCase()}
        </Text>
        <Text variant="title" weight="medium">
          {Number(e.date.slice(8))}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text variant="secondary" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
            {e.instrument.name}
          </Text>
          <Text variant="small" weight="regular" tone="inkMuted">
            in {days(e.daysAway)}
          </Text>
        </View>
        <Text variant="small" weight="regular" tone="inkMuted">
          {what}
        </Text>
        {e.yourShares && e.yourNet !== undefined && currency && (
          <Text variant="small" weight="medium" tone="gain">
            About {money(e.yourNet, currency)} for your {number(e.yourShares, 2)} shares, after withholding
          </Text>
        )}
        {e.affects.map((a) => (
          <View key={a.strategyId} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <SeverityDot severity={a.severity} size={7} />
            <Text variant="small" weight="medium" style={{ flex: 1 }}>
              Your short {a.label} is open that day
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
