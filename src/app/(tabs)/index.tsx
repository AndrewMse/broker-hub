import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHistory, usePortfolio, useTaxYear } from '@/api/queries';
import { ranges, type Range } from '@/api/types';
import { BarFieldChart } from '@/components/BarFieldChart';
import { BrokerDisc } from '@/components/BrokerDisc';
import { IconButton } from '@/components/IconButton';
import { PositionGroupRow } from '@/components/PositionGroupRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented } from '@/components/Segmented';
import { SplitBar } from '@/components/SplitBar';
import { LoadError, Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { Icon } from '@/components/Icon';
import { money, percent } from '@/lib/format';
import { color, radius, space } from '@/theme/tokens';

export default function Overview() {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<Range>('1M');
  const portfolio = usePortfolio();
  const history = useHistory('portfolio', range);
  const tax = useTaxYear(2026);
  const p = portfolio.data;

  const brokers = useMemo(() => new Map(p?.byBroker.map((s) => [s.broker.id, s.broker])), [p]);
  const change = history.data ? history.data.v[history.data.v.length - 1] / history.data.v[0] - 1 : 0;

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: 32, gap: space.xl }}
      refreshControl={
        <RefreshControl
          refreshing={portfolio.isRefetching}
          onRefresh={() => {
            portfolio.refetch();
            history.refetch();
          }}
          tintColor={color.accent}
        />
      }
    >
      <ScreenHeader
        title="Portfolio"
        right={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon="calendar" label="Earnings and dividend calendar" onPress={() => router.push('/calendar')} />
            <IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />
          </View>
        }
      />

      {portfolio.isPending && <Loading />}
      {portfolio.isError && <LoadError what="your portfolio" onRetry={() => portfolio.refetch()} />}

      {p && (
        <>
          <View style={{ gap: 2, marginTop: -8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <Text variant="hero" accessibilityLabel={`Total value ${money(p.totalBase, p.currency)}`}>
                {money(p.totalBase, p.currency)}
              </Text>
              <Text variant="body" weight="regular" tone={change >= 0 ? 'gain' : 'loss'} style={{ marginBottom: 7 }}>
                {percent(change)}
              </Text>
            </View>
            <Text variant="secondary" tone="inkMuted">
              Across {p.byBroker.length} brokers, including {money(p.cashBase, p.currency, { decimals: 0 })} cash
            </Text>
          </View>

          <View style={{ gap: space.l }}>
            <Segmented options={ranges} value={range} onChange={setRange} />
            <BarFieldChart
              series={history.data}
              range={range}
              formatDelta={(d) => money(d, p.currency, { sign: true })}
            />
          </View>

          <SplitBar slices={p.byBroker} />

          <View style={{ gap: space.m }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text variant="title" accessibilityRole="header">
                Positions
              </Text>
              <Text variant="secondary" tone="inkMuted">
                {p.groups.length}
              </Text>
            </View>
            {p.groups.map((g) => (
              <PositionGroupRow key={g.instrument.id} group={g} brokers={brokers} currency={p.currency} />
            ))}

            <View style={{ backgroundColor: color.surface, borderRadius: radius.row, borderWidth: 1, borderColor: color.line, padding: 14, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="body">Cash</Text>
                <Text variant="body">{money(p.cashBase, p.currency)}</Text>
              </View>
              {p.cash.map((c) => (
                <View key={c.brokerId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <BrokerDisc broker={brokers.get(c.brokerId)!} size={20} />
                  <Text variant="secondary" style={{ flex: 1 }}>
                    {brokers.get(c.brokerId)!.shortName}
                  </Text>
                  <Text variant="secondary" tone="inkMuted">
                    {money(c.amount, c.currency)}
                  </Text>
                </View>
              ))}
            </View>

            {tax.data && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tax summary"
                onPress={() => router.push('/tax')}
                style={({ pressed }) => ({ backgroundColor: color.surface, borderRadius: radius.row, borderWidth: 1, borderColor: color.line, padding: 14, gap: 8, opacity: pressed ? 0.7 : 1 })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text variant="body" style={{ flex: 1 }}>
                    Tax {tax.data.year}, so far
                  </Text>
                  <Text variant="body">{money(tax.data.totals.tax + tax.data.totals.dividendTaxDue, p.currency, { decimals: 0 })}</Text>
                  <Icon name="chevron-right" size={18} tint={color.inkMuted} />
                </View>
                <Text variant="small" weight="regular" tone="inkMuted">
                  {tax.data.countries
                    .filter((c) => c.trades > 0)
                    .map((c) => `${c.country} ${money(c.net, p.currency, { sign: true, decimals: 0 })}`)
                    .join(' · ')}
                  {tax.data.cass.reached >= 0 ? ` · CASS ${money(tax.data.cass.tiers[tax.data.cass.reached].contribution, p.currency, { decimals: 0 })}` : ''}
                </Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
