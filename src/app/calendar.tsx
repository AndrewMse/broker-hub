import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCalendar, useDividendProjection } from '@/api/queries';
import type { CalendarEvent, DividendProjection } from '@/api/types';
import { InstrumentAvatar } from '@/components/Avatar';
import { EventRow } from '@/components/EventRow';
import { Section } from '@/components/Section';
import { Segmented } from '@/components/Segmented';
import { Stat, StatGrid } from '@/components/Stat';
import { LoadError, Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { money, price, shortDate } from '@/lib/format';
import { useSettings } from '@/state/settings';
import { color, space } from '@/theme/tokens';

type Filter = 'all' | 'options' | 'earnings' | 'exDividend';

const monthTitle = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Earnings and ex-dividend dates for the stocks and funds you hold. */
export default function Calendar() {
  const insets = useSafeAreaInsets();
  const { currency } = useSettings();
  const calendar = useCalendar();
  const projection = useDividendProjection();
  const [filter, setFilter] = useState<Filter>('all');

  const months = useMemo(() => {
    const list = (calendar.data ?? []).filter(
      (e) => e.held && (filter === 'all' || (filter === 'options' ? e.affects.length > 0 : e.kind === filter)),
    );
    const byMonth = new Map<string, CalendarEvent[]>();
    for (const e of list) byMonth.set(e.date.slice(0, 7), [...(byMonth.get(e.date.slice(0, 7)) ?? []), e]);
    return [...byMonth.entries()];
  }, [calendar.data, filter]);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 4, paddingBottom: insets.bottom + 32, gap: space.xl }}>
      <Segmented
        options={['all', 'options', 'earnings', 'exDividend'] as const}
        value={filter}
        onChange={setFilter}
        labels={{ all: 'All', options: 'My options', earnings: 'Earnings', exDividend: 'Dividends' }}
      />
      {(filter === 'all' || filter === 'exDividend') && projection.data && <Dividends p={projection.data} />}
      {calendar.isPending && <Loading />}
      {calendar.isError && <LoadError what="the calendar" onRetry={() => calendar.refetch()} />}
      {calendar.data && !months.length && (
        <Text variant="secondary" tone="inkMuted" align="center" style={{ paddingVertical: 32 }}>
          Nothing coming up for this filter.
        </Text>
      )}
      {months.map(([m, events]) => (
        <Section key={m} title={monthTitle(`${m}-15`)}>
          {events.map((e, i) => (
            <EventRow key={e.id} event={e} first={i === 0} currency={currency} />
          ))}
        </Section>
      ))}
      {calendar.data && (
        <View style={{ paddingHorizontal: 4 }}>
          <Text variant="small" weight="regular" tone="inkMuted">
            A short call that is in the money before an ex-dividend date can be exercised early, the day before, when its time value is below the dividend.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const frequencyLabel = { quarterly: 'quarterly', semiannual: 'twice a year', annual: 'once a year' } as const;

/** What today's shares pay over the next 12 months, after foreign withholding. */
function Dividends({ p }: { p: DividendProjection }) {
  return (
    <View style={{ gap: space.m }}>
      <Text variant="title" accessibilityRole="header">
        Next 12 months
      </Text>
      <StatGrid>
        <Stat label="Dividends, after withholding" value={money(p.net, p.currency, { decimals: 0 })} tone="gain" note={`${money(p.gross, p.currency, { decimals: 0 })} gross, ${money(p.withheld, p.currency, { decimals: 0 })} withheld abroad`} />
        <Stat label="A month, on average" value={money(p.net / 12, p.currency, { decimals: 0 })} note={`From ${p.byStock.length} paying positions`} />
      </StatGrid>
      <View style={{ backgroundColor: color.surface, borderRadius: 20, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, paddingVertical: 4 }}>
        {p.byStock.map((s, i) => (
          <View key={s.instrument.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: color.line }}>
            <InstrumentAvatar instrument={s.instrument} size={34} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="secondary" weight="medium">
                {s.instrument.name}
              </Text>
              <Text variant="small" weight="regular" tone="inkMuted">
                {price(s.perShareAnnual, s.instrument.currency)} a share {frequencyLabel[s.frequency]}
                {s.nextExDate ? `, next ${shortDate(s.nextExDate)}` : ''}
                {s.withholdingRate ? ` · ${Math.round(s.withholdingRate * 1000) / 10}% withheld` : ''}
              </Text>
            </View>
            <Text variant="secondary" weight="medium" tone="gain">
              {money(s.net, p.currency, { decimals: 0 })}
            </Text>
          </View>
        ))}
        {p.excluded.length > 0 && (
          <Text variant="small" weight="regular" tone="inkMuted" style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: color.line }}>
            Not counted: {p.excluded.map((e) => `${e.instrument.symbol}: ${e.reason.charAt(0).toLowerCase()}${e.reason.slice(1)}`).join('. ')}.
          </Text>
        )}
      </View>
    </View>
  );
}
