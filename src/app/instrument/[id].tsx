import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCalendar, useHistory, useInstrument } from '@/api/queries';
import { ranges, type Range } from '@/api/types';
import { BarFieldChart } from '@/components/BarFieldChart';
import { BrokerDisc } from '@/components/BrokerDisc';
import { Button } from '@/components/Button';
import { EventRow } from '@/components/EventRow';
import { HoldingLine } from '@/components/HoldingLine';
import { FormPill } from '@/components/Pill';
import { Section } from '@/components/Section';
import { Segmented } from '@/components/Segmented';
import { LoadError, Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { money, percent, price } from '@/lib/format';
import { useSettings } from '@/state/settings';
import { color, space } from '@/theme/tokens';

export default function InstrumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { currency } = useSettings();
  const [range, setRange] = useState<Range>('1M');
  const detail = useInstrument(id);
  const history = useHistory(id, range);
  const calendar = useCalendar();
  const d = detail.data;
  const events = calendar.data?.filter((e) => e.instrument.id === id) ?? [];

  const held = d?.holdings.reduce((s, h) => s + h.valueBase, 0) ?? 0;
  const change = history.data ? history.data.v[history.data.v.length - 1] / history.data.v[0] - 1 : 0;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: d?.instrument.symbol ?? '' }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 4, paddingBottom: 120 + insets.bottom, gap: space.xl }}>
        {detail.isPending && <Loading />}
        {detail.isError && <LoadError what="this market" onRetry={() => detail.refetch()} />}

        {d && (
          <>
            <View style={{ gap: 2 }}>
              <Text variant="secondary" tone="inkMuted">
                {d.instrument.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                <Text variant="hero">{price(d.instrument.price, d.instrument.currency)}</Text>
                <Text variant="body" weight="regular" tone={change >= 0 ? 'gain' : 'loss'} style={{ marginBottom: 7 }}>
                  {percent(change, 2)}
                </Text>
              </View>
            </View>

            <View style={{ gap: space.l }}>
              <Segmented options={ranges} value={range} onChange={setRange} />
              <BarFieldChart
                series={history.data}
                range={range}
                height={200}
                formatDelta={(x) => (d.instrument.price < 10 ? x.toFixed(4) : money(x, d.instrument.currency, { sign: true }))}
              />
            </View>

            <Section title="Your holdings" aside={held ? money(held, currency) : undefined}>
              {d.holdings.length ? (
                d.holdings.map((h) => <HoldingLine key={h.id} holding={h} broker={d.brokers.find((b) => b.id === h.brokerId)!} currency={currency} />)
              ) : (
                <Text variant="secondary" tone="inkMuted" style={{ paddingVertical: 8 }}>
                  You don’t hold this at any connected broker.
                </Text>
              )}
            </Section>

            {events.length > 0 && (
              <Section title="Coming up">
                {events.map((e, i) => (
                  <EventRow key={e.id} event={e} first={i === 0} currency={currency} />
                ))}
              </Section>
            )}

            <Section title="Ways to trade">
              {d.brokers.map((b, i) => {
                const routes = d.availability.filter((a) => a.brokerId === b.id);
                return (
                  <View key={b.id} style={{ paddingVertical: 12, gap: 8, borderTopWidth: i ? 1 : 0, borderTopColor: color.line }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <BrokerDisc broker={b} size={22} dimmed={!routes.length} />
                      <Text variant="secondary" weight="medium" tone={routes.length ? 'ink' : 'inkMuted'}>
                        {b.name}
                      </Text>
                    </View>
                    {routes.length ? (
                      routes.map((a) => (
                        <View key={`${a.form}${a.via ?? ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 32 }}>
                          <FormPill form={a.form} via={a.via} />
                          <Text variant="small" tone="inkMuted" style={{ flex: 1 }}>
                            {a.costNote}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text variant="small" tone="inkMuted" style={{ paddingLeft: 32 }}>
                        Not offered
                      </Text>
                    )}
                  </View>
                );
              })}
            </Section>
          </>
        )}
      </ScrollView>

      {d && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            flexDirection: 'row',
            gap: 10,
            paddingHorizontal: space.gutter,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            backgroundColor: color.canvas,
            borderTopWidth: 1,
            borderTopColor: color.line,
          }}
        >
          <Button label="Preview buy" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/trade', params: { id, side: 'buy' } })} />
          {d.holdings.length > 0 && (
            <Button label="Preview sell" kind="secondary" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/trade', params: { id, side: 'sell' } })} />
          )}
        </View>
      )}
    </View>
  );
}
