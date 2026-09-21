import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCalendar, useOptionsBook, usePremiumIncome, useWheels } from '@/api/queries';
import type { Currency, OptionsBook, PremiumIncome, StrategyKind, WheelCycle } from '@/api/types';
import { InstrumentAvatar } from '@/components/Avatar';
import { BrokerDisc } from '@/components/BrokerDisc';
import { EventRow } from '@/components/EventRow';
import { IconButton } from '@/components/IconButton';
import { MonthBars } from '@/components/MonthBars';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Section } from '@/components/Section';
import { Segmented } from '@/components/Segmented';
import { Stat, StatGrid } from '@/components/Stat';
import { LoadError, Loading } from '@/components/States';
import { StrategyCard } from '@/components/StrategyCard';
import { Text } from '@/components/Text';
import { WheelCard } from '@/components/WheelCard';
import { compactMoney, money, optionLabel, percent, price, shortDate } from '@/lib/format';
import { color, radius, space } from '@/theme/tokens';

type View_ = 'positions' | 'income' | 'wheel';

const groups: { title: string; kinds: StrategyKind[] }[] = [
  { title: 'Covered calls', kinds: ['coveredCall'] },
  { title: 'Cash-secured puts', kinds: ['cashSecuredPut'] },
  { title: 'Not covered', kinds: ['uncoveredCall', 'uncoveredPut'] },
  { title: 'Long options', kinds: ['long'] },
];

export default function Options() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ view?: View_ }>();
  const [view, setView] = useState<View_>(params.view === 'income' || params.view === 'wheel' ? params.view : 'positions');
  const book = useOptionsBook();
  const income = usePremiumIncome();
  const wheels = useWheels();
  const calendar = useCalendar();
  const active = view === 'positions' ? book : view === 'income' ? income : wheels;

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: 32, gap: space.xl }}
      refreshControl={
        <RefreshControl
          refreshing={book.isRefetching || income.isRefetching || wheels.isRefetching}
          onRefresh={() => {
            book.refetch();
            income.refetch();
            wheels.refetch();
            calendar.refetch();
          }}
          tintColor={color.accent}
        />
      }
    >
      <ScreenHeader title="Options" right={<IconButton icon="calendar" label="Earnings and dividend calendar" onPress={() => router.push('/calendar')} />} />
      <Segmented options={['positions', 'income', 'wheel'] as const} value={view} onChange={setView} labels={{ positions: 'Positions', income: 'Income', wheel: 'Wheel' }} />

      {active.isPending && <Loading />}
      {active.isError && <LoadError what={view === 'positions' ? 'your options' : view === 'income' ? 'premium income' : 'wheel history'} onRetry={() => active.refetch()} />}

      {view === 'positions' && book.data && (
        <Positions book={book.data} upcoming={(calendar.data ?? []).filter((e) => e.affects.length).slice(0, 3)} />
      )}
      {view === 'income' && income.data && <Income income={income.data} />}
      {view === 'wheel' && wheels.data && <Wheel cycles={wheels.data} currency={book.data?.currency ?? income.data?.currency ?? 'USD'} />}
    </ScrollView>
  );
}

function Positions({ book, upcoming }: { book: OptionsBook; upcoming: NonNullable<ReturnType<typeof useCalendar>['data']> }) {
  const { totals, currency, strategies } = book;
  const attention = strategies.filter((s) => s.flags.some((f) => f.severity !== 'info')).length;

  if (!strategies.length) {
    return (
      <Text variant="secondary" tone="inkMuted" align="center" style={{ paddingVertical: 32 }}>
        No open options at your brokers.
      </Text>
    );
  }

  return (
    <>
      <StatGrid>
        <Stat label="Theta, per day" value={money(totals.theta, currency, { sign: true })} tone={totals.theta >= 0 ? 'gain' : 'loss'} note="Earned as time passes" />
        <Stat label="Premium open" value={money(totals.premiumOpen, currency, { decimals: 0 })} note={`${money(totals.openPnl, currency, { sign: true, decimals: 0 })} so far`} />
        <Stat label="Options delta" value={compactMoney(totals.deltaDollars, currency)} note="In stock-dollar terms" />
        <Stat label="Vega, per vol point" value={money(totals.vega, currency, { sign: true, decimals: 0 })} tone={totals.vega >= 0 ? 'gain' : 'loss'} note="If implied vol rises 1" />
      </StatGrid>

      {attention > 0 && (
        <Text variant="secondary" tone="inkMuted">
          {attention === 1 ? '1 position has' : `${attention} positions have`} something to check before expiry.
        </Text>
      )}

      {groups.map((g) => {
        const list = strategies.filter((s) => g.kinds.includes(s.kind));
        if (!list.length) return null;
        return (
          <Section key={g.title} title={g.title} aside={String(list.length)} bare>
            <View style={{ gap: space.m }}>
              {list.map((s) => (
                <StrategyCard key={s.id} s={s} currency={currency} />
              ))}
            </View>
          </Section>
        );
      })}

      {upcoming.length > 0 && (
        <Section
          title="Before your expiries"
          aside={
            <Pressable accessibilityRole="link" onPress={() => router.push('/calendar')} hitSlop={8}>
              <Text variant="secondary" weight="medium" tone="accent">
                Full calendar
              </Text>
            </Pressable>
          }
        >
          {upcoming.map((e, i) => (
            <EventRow key={e.id} event={e} first={i === 0} currency={currency} />
          ))}
        </Section>
      )}
    </>
  );
}

const outcomeLabel = { open: 'Open', expired: 'Expired', closed: 'Closed', assigned: 'Assigned' } as const;

function Income({ income }: { income: PremiumIncome }) {
  const c: Currency = income.currency;
  const [all, setAll] = useState(false);
  const trades = all ? income.trades : income.trades.slice(0, 12);

  return (
    <>
      <StatGrid>
        <Stat label="This month" value={money(income.thisMonth, c, { decimals: 0 })} tone="gain" />
        <Stat label="This year" value={money(income.ytd, c, { decimals: 0 })} tone="gain" />
        <Stat label="Last 12 months" value={money(income.last12m, c, { decimals: 0 })} note={`${money(income.avgMonth, c, { decimals: 0 })} a month on average`} />
        <Stat label="Yield on capital" value={percent(income.yieldOnCapital).replace('+', '')} note="12 months over shares and cash backing options now" />
      </StatGrid>

      <Section title="By month" aside="Net of buybacks and fees">
        <View style={{ paddingVertical: 12 }}>
          <MonthBars months={income.months} currency={c} />
        </View>
      </Section>

      <Section title="By stock">
        {income.byStock.map((s, i) => (
          <View key={s.instrument.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: color.line }}>
            <InstrumentAvatar instrument={s.instrument} size={34} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="secondary" weight="medium">
                {s.instrument.name}
              </Text>
              <Text variant="small" weight="regular" tone="inkMuted">
                {s.shares > 0
                  ? `Cost ${price(s.avgPrice, s.instrument.currency)} → ${price(s.adjustedPrice, s.instrument.currency)} a share after premium`
                  : `${s.trades} trades, puts only so far`}
              </Text>
            </View>
            <Text variant="secondary" weight="medium" tone={s.net >= 0 ? 'gain' : 'loss'}>
              {money(s.net, c, { sign: true, decimals: 0 })}
            </Text>
          </View>
        ))}
      </Section>

      <Section title="Trades" aside={`${income.trades.length} in 12 months`}>
        {trades.map((t, i) => (
          <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: color.line }}>
            <BrokerDisc broker={t.broker} size={20} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="secondary" weight="medium" numberOfLines={1}>
                {t.side === 'sell' ? 'Sold' : 'Bought back'} {t.contracts} {t.instrument.symbol} {optionLabel(t, t.instrument.currency)}
              </Text>
              <Text variant="small" weight="regular" tone="inkMuted">
                {shortDate(t.date, true)} · {outcomeLabel[t.outcome]}
              </Text>
            </View>
            <Text variant="secondary" weight="medium" tone={t.net >= 0 ? 'gain' : 'loss'}>
              {money(t.net, c, { sign: true, decimals: 0 })}
            </Text>
          </View>
        ))}
        {income.trades.length > 12 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setAll((a) => !a)}
            style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: color.line, alignItems: 'center', borderRadius: radius.control }}
          >
            <Text variant="secondary" weight="medium" tone="accent">
              {all ? 'Show fewer' : `Show all ${income.trades.length}`}
            </Text>
          </Pressable>
        )}
      </Section>
    </>
  );
}

function Wheel({ cycles, currency }: { cycles: WheelCycle[]; currency: Currency }) {
  const active = cycles.filter((c) => c.phase !== 'completed');
  const done = cycles.filter((c) => c.phase === 'completed');
  const realized = done.reduce((s, c) => s + c.total, 0);
  const premium = cycles.reduce((s, c) => s + c.premium, 0);

  if (!cycles.length) {
    return (
      <Text variant="secondary" tone="inkMuted" align="center" style={{ paddingVertical: 32 }}>
        No option history to build a wheel from.
      </Text>
    );
  }
  return (
    <>
      <StatGrid>
        <Stat label="Cycles running" value={String(active.length)} note={`${active.filter((c) => c.phase === 'puts').length} selling puts, ${active.filter((c) => c.phase === 'shares').length} holding shares`} />
        <Stat label="Completed" value={String(done.length)} note={done.length ? `${money(realized, currency, { sign: true, decimals: 0 })} realized` : 'None yet'} tone={realized > 0 ? 'gain' : 'ink'} />
        <Stat label="Premium, all cycles" value={money(premium, currency, { decimals: 0 })} note="Net of buybacks and fees" />
        <Stat
          label="Best cycle"
          value={cycles.length ? percent(Math.max(...cycles.map((c) => c.annualized))).replace('+', '') : '—'}
          note={(() => {
            const best = cycles.reduce((b, c) => (c.annualized > b.annualized ? c : b), cycles[0]);
            return `${best.instrument.symbol}, annualized`;
          })()}
        />
      </StatGrid>

      <Text variant="secondary" tone="inkMuted">
        Puts sold until one is assigned, then calls on the shares until they’re called away. Each card is one turn of the wheel.
      </Text>

      {active.length > 0 && (
        <Section title="Running" aside={String(active.length)} bare>
          <View style={{ gap: space.m }}>
            {active.map((c) => (
              <WheelCard key={c.id} cycle={c} currency={currency} />
            ))}
          </View>
        </Section>
      )}
      {done.length > 0 && (
        <Section title="Completed" aside={String(done.length)} bare>
          <View style={{ gap: space.m }}>
            {done.map((c) => (
              <WheelCard key={c.id} cycle={c} currency={currency} />
            ))}
          </View>
        </Section>
      )}
    </>
  );
}
