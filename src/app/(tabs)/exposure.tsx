import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useExposure } from '@/api/queries';
import type { Currency, StockExposure } from '@/api/types';
import { InstrumentAvatar } from '@/components/Avatar';
import { FlagBox } from '@/components/Flag';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Section } from '@/components/Section';
import { Segmented } from '@/components/Segmented';
import { ShareBar } from '@/components/ShareBar';
import { Stat, StatGrid } from '@/components/Stat';
import { LoadError, Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { compactMoney, money } from '@/lib/format';
import { color, formPalette, radius, space } from '@/theme/tokens';

type Breakdown = 'sector' | 'country' | 'currency';

export default function ExposureScreen() {
  const insets = useSafeAreaInsets();
  const exposure = useExposure();
  const [breakdown, setBreakdown] = useState<Breakdown>('sector');
  const e = exposure.data;

  const buckets = e ? { sector: e.bySector, country: e.byCountry, currency: e.byCurrency }[breakdown] : [];
  const optionsTotal = e?.stocks.reduce((s, x) => s + x.options, 0) ?? 0;
  const fundsTotal = e ? e.stocks.reduce((s, x) => s + x.funds, 0) + e.otherEquity : 0;

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: 32, gap: space.xl }}
      refreshControl={<RefreshControl refreshing={exposure.isRefetching} onRefresh={() => exposure.refetch()} tintColor={color.accent} />}
    >
      <ScreenHeader title="Exposure" />
      {exposure.isPending && <Loading />}
      {exposure.isError && <LoadError what="your exposure" onRetry={() => exposure.refetch()} />}

      {e && (
        <>
          <View style={{ gap: 2, marginTop: -8 }}>
            <Text variant="hero">{money(e.equity, e.currency, { decimals: 0 })}</Text>
            <Text variant="secondary" tone="inkMuted">
              Stock exposure, delta-adjusted. {Math.round((e.equity / e.netLiquidation) * 100)}% of your {compactMoney(e.netLiquidation, e.currency)} portfolio.
            </Text>
          </View>

          <StatGrid>
            <Stat label="If the S&P 500 drops 1%" value={money(e.spxDown1, e.currency, { decimals: 0 })} tone="loss" note="Using each stock's beta" />
            <Stat label="Beta-weighted" value={compactMoney(e.betaWeighted, e.currency)} note="In S&P 500 dollars" />
            <Stat label="Options adjust" value={compactMoney(optionsTotal, e.currency)} note="Short calls cut, short puts add" />
            <Stat label="Through funds" value={compactMoney(fundsTotal, e.currency)} note="ETFs and index CFDs, looked through" />
          </StatGrid>

          {e.alerts.length > 0 && (
            <View style={{ gap: 8 }}>
              {e.alerts.map((a) => {
                const s = e.stocks.find((x) => x.instrument.name === a.label);
                const before = s ? s.gross / e.netLiquidation : 0;
                return (
                  <FlagBox
                    key={a.label}
                    flag={{
                      kind: 'uncovered',
                      severity: 'high',
                      title:
                        a.basis === 'portfolio'
                          ? `${a.label} is ${(a.share * 100).toFixed(1)}% of your portfolio`
                          : `${a.label} is ${(a.share * 100).toFixed(0)}% of your stock exposure`,
                      detail:
                        a.basis === 'portfolio'
                          ? `Your limit is ${a.limit * 100}%.${s && s.options < 0 ? ` Short calls already bring it down from ${(before * 100).toFixed(1)}%.` : ''}`
                          : `Your limit for one sector is ${a.limit * 100}%.`,
                    }}
                  />
                );
              })}
            </View>
          )}

          <Section title="Stocks" aside={`Limit ${e.limits.stock * 100}% each`} bare>
            <View style={{ gap: space.m }}>
              {e.stocks.map((s) => (
                <StockRow key={s.instrument.id} s={s} currency={e.currency} limit={e.limits.stock} />
              ))}
            </View>
          </Section>

          <View style={{ gap: space.m }}>
            <Text variant="title" accessibilityRole="header">
              Breakdown
            </Text>
            <Segmented options={['sector', 'country', 'currency'] as const} value={breakdown} onChange={setBreakdown} labels={{ sector: 'Sector', country: 'Country', currency: 'Currency' }} />
            <View style={{ backgroundColor: color.surface, borderRadius: radius.panel, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, paddingVertical: 8 }}>
              {buckets.map((b) => (
                <ShareBar
                  key={b.label}
                  label={b.label}
                  value={compactMoney(b.value, e.currency)}
                  share={b.share}
                  limit={breakdown === 'sector' ? e.limits.sector : undefined}
                />
              ))}
            </View>
            <Text variant="small" weight="regular" tone="inkMuted">
              Shares of your stock exposure. Not counted: {money(e.nonEquity, e.currency, { decimals: 0 })} in crypto, commodities and bonds.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const parts = [
  { key: 'shares', label: 'Shares', tone: formPalette.share.fg },
  { key: 'cfd', label: 'CFD', tone: formPalette.cfd.fg },
  { key: 'funds', label: 'Funds', tone: formPalette.etf.fg },
  { key: 'options', label: 'Options', tone: formPalette.option.fg },
] as const;

function StockRow({ s, currency, limit }: { s: StockExposure; currency: Currency; limit: number }) {
  const over = s.share > limit;
  const positive = parts.map((p) => ({ ...p, v: Math.max(0, s[p.key]) }));
  const posSum = positive.reduce((a, p) => a + p.v, 0) || 1;
  const cut = Math.max(0, -s.options);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/instrument/[id]', params: { id: s.instrument.id } })}
      style={({ pressed }) => ({ backgroundColor: color.surface, borderRadius: radius.row, borderWidth: 1, borderColor: color.line, padding: 14, gap: 12, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <InstrumentAvatar instrument={s.instrument} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="body" numberOfLines={1}>
            {s.instrument.name}
          </Text>
          <Text variant="small" weight="regular" tone="inkMuted">
            {s.sector} · beta {s.beta.toFixed(2)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text variant="body">{money(s.total, currency, { decimals: 0 })}</Text>
          <Text variant="small" tone={over ? 'loss' : 'inkMuted'}>
            {(s.share * 100).toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Holdings as a stacked bar; the faded tail is the part short calls offset */}
      <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: color.sunken }}>
        {positive.map((p) => (p.v > 0 ? <View key={p.key} style={{ flex: p.v / posSum, backgroundColor: p.tone, opacity: 0.85 }} /> : null))}
        {cut > 0 && (
          <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${Math.min(100, (cut / posSum) * 100)}%`, backgroundColor: color.surface, opacity: 0.7 }} />
        )}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 }}>
        {parts.map((p) =>
          Math.abs(s[p.key]) >= 1 ? (
            <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: p.tone }} />
              <Text variant="small" weight="regular" tone="inkMuted">
                {p.label} {compactMoney(s[p.key], currency)}
              </Text>
            </View>
          ) : null,
        )}
      </View>
      {s.viaFunds.length > 0 && (
        <Text variant="small" weight="regular" tone="inkMuted">
          Via {s.viaFunds.map((f) => `${f.symbol} ${compactMoney(f.value, currency)}`).join(', ')}
        </Text>
      )}
    </Pressable>
  );
}
