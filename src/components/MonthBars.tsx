import { View } from 'react-native';
import type { Currency, PremiumMonth } from '@/api/types';
import { compactMoney, monthLabel } from '@/lib/format';
import { color } from '@/theme/tokens';
import { Text } from './Text';

const callTone = color.accent;
const putTone = color.violet;

/** Stacked monthly bars, calls below puts. Negative months (buybacks) show as an empty bar. */
export function MonthBars({ months, currency, height = 120 }: { months: PremiumMonth[]; currency: Currency; height?: number }) {
  const max = Math.max(1, ...months.map((m) => Math.max(0, m.calls) + Math.max(0, m.puts)));
  const best = months.reduce((b, m) => (m.calls + m.puts > b.calls + b.puts ? m : b), months[0]);

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Legend tone={callTone} label="Calls" />
          <Legend tone={putTone} label="Puts" />
        </View>
        <Text variant="small" weight="regular" tone="inkMuted">
          Best {monthLabel(best.month)}: {compactMoney(best.calls + best.puts, currency)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 5 }}>
        {months.map((m) => {
          const calls = Math.max(0, m.calls);
          const puts = Math.max(0, m.puts);
          return (
            <View
              key={m.month}
              accessibilityLabel={`${monthLabel(m.month)}: calls ${compactMoney(m.calls, currency)}, puts ${compactMoney(m.puts, currency)}`}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end', gap: 2 }}
            >
              {puts > 0 && <View style={{ height: (puts / max) * height, backgroundColor: putTone, borderRadius: 3 }} />}
              {calls > 0 && <View style={{ height: (calls / max) * height, backgroundColor: callTone, borderRadius: 3 }} />}
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {months.map((m, i) => (
          <Text key={m.month} variant="small" weight="regular" tone="inkMuted" align="center" style={{ flex: 1, fontSize: 10 }}>
            {i % 2 === 0 ? monthLabel(m.month).slice(0, 3) : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: tone }} />
      <Text variant="small" weight="regular" tone="inkMuted">
        {label}
      </Text>
    </View>
  );
}
