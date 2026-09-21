import { useState } from 'react';
import { LayoutAnimation, Pressable, View } from 'react-native';
import type { Currency, WheelCycle, WheelPhase, WheelStepKind } from '@/api/types';
import { money, number, optionLabel, percent, price, shortDate } from '@/lib/format';
import { color, formPalette, radius } from '@/theme/tokens';
import { InstrumentAvatar } from './Avatar';
import { BrokerDisc } from './BrokerDisc';
import { Text } from './Text';

const phaseStyle: Record<WheelPhase, { label: string; bg: string; fg: string }> = {
  puts: { label: 'Selling puts', bg: color.accentSoft, fg: '#4F63DB' },
  shares: { label: 'Holding shares', bg: formPalette.share.bg, fg: formPalette.share.fg },
  completed: { label: 'Completed', bg: color.sunken, fg: '#5B5E68' },
};

/** Step dots: money in is accent, money out is muted, the two assignment events are ink. */
const dotTone: Record<WheelStepKind, string> = {
  putSold: color.accent,
  callSold: color.accent,
  dividend: color.gain,
  putExpired: color.inkMuted,
  callExpired: color.inkMuted,
  putClosed: color.loss,
  callClosed: color.loss,
  assigned: color.ink,
  calledAway: color.ink,
  sharesBought: color.ink,
};

/** One wheel cycle: header with phase and return, key figures, then the step-by-step timeline. */
export function WheelCard({ cycle: c, currency }: { cycle: WheelCycle; currency: Currency }) {
  const [all, setAll] = useState(false);
  const ph = phaseStyle[c.phase];
  const ic = c.instrument.currency;
  const steps = all ? c.steps : c.steps.slice(-4);
  const hidden = c.steps.length - steps.length;

  const status =
    c.phase === 'completed'
      ? `${shortDate(c.started)} to ${shortDate(c.ended!)}, ${c.days} days`
      : c.phase === 'puts'
        ? c.openPut
          ? `Open: ${optionLabel({ right: 'put', ...c.openPut }, ic)}. Assignment would put ${money(c.capital, currency, { decimals: 0 })} into shares at ${price(c.openPut.strike, ic)}.`
          : 'No put open right now'
        : c.shares
          ? `${c.startedBy === 'shares' ? 'Started with ' : ''}${number(c.shares.quantity, 0)} shares at ${price(c.shares.costPerShare, ic)}, ${price(c.shares.adjustedCostPerShare, ic)} after premium and dividends${
              c.shares.openCall ? `. Open: ${optionLabel({ right: 'call', ...c.shares.openCall }, ic)}` : ''
            }`
          : '';

  return (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.panel, borderWidth: 1, borderColor: color.line, padding: 16, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <InstrumentAvatar instrument={c.instrument} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="body" numberOfLines={1}>
            {c.instrument.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <BrokerDisc broker={c.broker} size={16} />
            <View style={{ backgroundColor: ph.bg, borderRadius: radius.round, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text variant="small" tone={ph.fg}>
                {ph.label}
              </Text>
            </View>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
          <Text variant="body" tone={c.total >= 0 ? 'gain' : 'loss'}>
            {money(c.total, currency, { sign: true, decimals: 0 })}
          </Text>
          <Text variant="small" weight="regular" tone="inkMuted">
            {percent(c.annualized).replace('+', '')} a year{c.startedBy === 'shares' ? ', income' : ''}
          </Text>
        </View>
      </View>

      <Text variant="small" weight="regular" tone="inkMuted">
        {status}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 }}>
        <Figure label="Capital" value={money(c.capital, currency, { decimals: 0 })} />
        <Figure label="Premium" value={money(c.premium, currency, { sign: true, decimals: 0 })} tone={c.premium >= 0 ? 'gain' : 'loss'} />
        <Figure
          label={c.phase === 'completed' ? 'Share gain' : c.phase === 'shares' ? 'Shares, unrealized' : 'Share gain'}
          value={c.phase === 'puts' ? '—' : money(c.capitalGain, currency, { sign: true, decimals: 0 })}
          tone={c.phase === 'puts' ? 'ink' : c.capitalGain >= 0 ? 'gain' : 'loss'}
        />
        <Figure label="Dividends" value={c.dividends ? money(c.dividends, currency, { sign: true, decimals: 0 }) : '—'} tone={c.dividends ? 'gain' : 'ink'} />
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: color.line, paddingTop: 4 }}>
        {hidden > 0 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'));
              setAll(true);
            }}
            style={{ paddingVertical: 8 }}
          >
            <Text variant="small" tone="accent">
              Show {hidden} earlier steps
            </Text>
          </Pressable>
        )}
        {steps.map((s, i) => (
          <View key={s.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 7 }}>
            <View style={{ width: 10, alignItems: 'center' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 5, backgroundColor: dotTone[s.kind] }} />
              {i < steps.length - 1 && <View style={{ flex: 1, width: 1, marginTop: 3, backgroundColor: color.line }} />}
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="secondary" weight="medium" numberOfLines={2}>
                {s.label}
              </Text>
              <Text variant="small" weight="regular" tone="inkMuted">
                {shortDate(s.date, true)}
                {s.detail ? ` · ${s.detail}` : ''}
              </Text>
            </View>
            {s.amount !== undefined && (
              <Text variant="secondary" weight="medium" tone={s.amount >= 0 ? 'gain' : 'ink'}>
                {money(s.amount, currency, { sign: true, decimals: 0 })}
              </Text>
            )}
          </View>
        ))}
        {all && c.steps.length > 4 && (
          <Pressable accessibilityRole="button" onPress={() => setAll(false)} style={{ paddingVertical: 8 }}>
            <Text variant="small" tone="accent">
              Show fewer
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'ink' | 'loss' | 'gain' }) {
  return (
    <View style={{ width: '50%', gap: 2, paddingRight: 8 }}>
      <Text variant="small" weight="regular" tone="inkMuted" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="secondary" weight="medium" tone={tone ?? 'ink'} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
