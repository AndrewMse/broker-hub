import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import type { Currency, OptionStrategy, StrategyKind } from '@/api/types';
import { days, money, number, optionLabel, percent, price } from '@/lib/format';
import { color, radius } from '@/theme/tokens';
import { InstrumentAvatar } from './Avatar';
import { BrokerDisc } from './BrokerDisc';
import { FlagBox } from './Flag';
import { Text } from './Text';

export const strategyLabel: Record<StrategyKind, string> = {
  coveredCall: 'Covered call',
  cashSecuredPut: 'Cash-secured put',
  uncoveredCall: 'Uncovered call',
  uncoveredPut: 'Uncovered put',
  long: 'Long option',
};

/** One short option and what backs it: price track, key numbers, Greeks and any risk flags. */
export function StrategyCard({ s, currency }: { s: OptionStrategy; currency: Currency }) {
  const o = s.leg.option;
  const ic = s.instrument.currency;
  const kept = o.openPrice ? (o.openPrice - o.mark) / o.openPrice : 0;
  const itm = s.cushion < 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${s.instrument.name} ${strategyLabel[s.kind]}, ${optionLabel(o, ic)}`}
      onPress={() => router.push({ pathname: '/instrument/[id]', params: { id: s.instrument.id } })}
      style={({ pressed }) => ({
        backgroundColor: color.surface,
        borderRadius: radius.panel,
        borderWidth: 1,
        borderColor: color.line,
        padding: 16,
        gap: 14,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <InstrumentAvatar instrument={s.instrument} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="body" numberOfLines={1}>
            {s.contracts} × {optionLabel(o, ic)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <BrokerDisc broker={s.broker} size={16} />
            <Text variant="small" weight="regular" tone="inkMuted">
              {strategyLabel[s.kind]} · {days(o.daysToExpiry)} left
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text variant="body">{money(s.premium, currency)}</Text>
          <Text variant="small" weight="regular" tone={kept >= 0 ? 'gain' : 'loss'}>
            {kept >= 0 ? `${Math.round(kept * 100)}% kept` : `Buyback ${(o.mark / o.openPrice).toFixed(1)}× premium`}
          </Text>
        </View>
      </View>

      <PriceTrack spot={s.instrument.price} strike={o.strike} breakeven={s.breakeven} currency={ic} itm={itm} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
        <Figure label="Breakeven" value={price(s.breakeven, ic)} />
        <Figure label="Max profit" value={Number.isFinite(s.maxProfit) ? money(s.maxProfit, currency, { decimals: 0 }) : 'Unlimited'} />
        <Figure label="Yield, annualized" value={s.kind === 'long' ? '—' : percent(s.annualizedYield).replace('+', '')} />
        <Figure label="Chance assigned" value={`${Math.round(o.probItm * 100)}%`} tone={o.probItm > 0.5 ? 'loss' : 'ink'} />
        <Figure label="Delta" value={`${o.greeks.delta > 0 ? '+' : ''}${number(o.greeks.delta, 0)} sh`} />
        <Figure label="Theta a day" value={money(o.greeks.theta, currency, { sign: true })} tone={o.greeks.theta >= 0 ? 'gain' : 'loss'} />
      </View>

      <Text variant="small" weight="regular" tone="inkMuted">
        {s.shares
          ? `Backed by ${number(s.shares.covered, 0)} shares at ${s.broker.shortName}, bought at ${price(s.shares.avgPrice, ic)}. Stock and call together: ${money(s.pnl, currency, { sign: true, decimals: 0 })}.`
          : s.collateral
            ? `${money(s.collateral.secured, currency, { decimals: 0 })} cash set aside at ${s.broker.shortName}. If assigned you'd own the shares at ${price(s.breakeven, ic)} after premium.`
            : `Open P&L ${money(s.pnl, currency, { sign: true })}.`}
      </Text>

      {s.flags.length > 0 && (
        <View style={{ gap: 8 }}>
          {s.flags.map((f) => (
            <FlagBox key={f.title} flag={f} />
          ))}
        </View>
      )}
    </Pressable>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'ink' | 'loss' | 'gain' }) {
  return (
    <View style={{ width: '33.33%', gap: 2, paddingRight: 8 }}>
      <Text variant="small" weight="regular" tone="inkMuted" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="secondary" weight="medium" tone={tone ?? 'ink'} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** Stock price on a line between breakeven and strike, so you can see the cushion at a glance. */
function PriceTrack({ spot, strike, breakeven, currency, itm }: { spot: number; strike: number; breakeven: number; currency: Currency; itm: boolean }) {
  const lo = Math.min(spot, strike, breakeven);
  const hi = Math.max(spot, strike, breakeven);
  const pad = (hi - lo) * 0.08 || hi * 0.02;
  const at = (x: number) => `${((x - lo + pad) / (hi - lo + 2 * pad)) * 100}%` as const;
  const cushion = Math.abs(strike / spot - 1);

  return (
    <View style={{ gap: 6 }}>
      <View style={{ height: 34, justifyContent: 'center' }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: color.sunken }} />
        <Marker left={at(breakeven)} label="BE" />
        <Marker left={at(strike)} label="Strike" strong />
        <View
          style={{
            position: 'absolute',
            left: at(spot),
            marginLeft: -7,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: itm ? color.loss : color.accent,
            borderWidth: 3,
            borderColor: color.surface,
          }}
        />
      </View>
      <Text variant="small" weight="regular" tone={itm ? 'loss' : 'inkMuted'}>
        Stock {price(spot, currency)}, {(cushion * 100).toFixed(1)}% {itm ? 'in the money' : 'from the strike'}
      </Text>
    </View>
  );
}

function Marker({ left, label, strong }: { left: `${number}%`; label: string; strong?: boolean }) {
  return (
    <View style={{ position: 'absolute', left, top: 0, alignItems: 'center', width: 44, marginLeft: -22 }}>
      <Text variant="small" weight="regular" tone="inkMuted" style={{ fontSize: 10, lineHeight: 12 }}>
        {label}
      </Text>
      <View style={{ width: 2, height: 12, borderRadius: 1, marginTop: 2, backgroundColor: strong ? color.ink : color.inkMuted }} />
    </View>
  );
}
