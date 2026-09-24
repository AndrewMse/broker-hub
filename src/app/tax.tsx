import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTaxYear } from '@/api/queries';
import type { Currency, TaxCountry, TaxYear } from '@/api/types';
import { BrokerDisc } from '@/components/BrokerDisc';
import { Panel, Section } from '@/components/Section';
import { Segmented } from '@/components/Segmented';
import { Stat, StatGrid } from '@/components/Stat';
import { LoadError, Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { formLabel, money, number, optionLabel, price, shortDate } from '@/lib/format';
import { useSettings } from '@/state/settings';
import { color, radius, space } from '@/theme/tokens';

const years = ['2025', '2026'] as const;
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

/** Romanian declaration view: results by source country, dividend tax after withholding credit, CASS thresholds. */
export default function Tax() {
  const insets = useSafeAreaInsets();
  const { countryRule, setCountryRule } = useSettings();
  const [year, setYear] = useState<(typeof years)[number]>('2026');
  const tax = useTaxYear(Number(year));
  const t = tax.data;

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 4, paddingBottom: insets.bottom + 32, gap: space.xl }}>
      <View style={{ gap: space.m }}>
        <Segmented options={years} value={year} onChange={setYear} labels={{ '2025': '2025', '2026': '2026, so far' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text variant="secondary" tone="inkMuted" style={{ flex: 1 }}>
            Country follows
          </Text>
          <Segmented options={['issuer', 'broker'] as const} value={countryRule} onChange={setCountryRule} labels={{ issuer: 'The company', broker: 'The broker' }} style={{ flex: 1.6 }} />
        </View>
      </View>

      {tax.isPending && <Loading />}
      {tax.isError && <LoadError what="the tax summary" onRetry={() => tax.refetch()} />}

      {t && (
        <>
          <StatGrid>
            <Stat label="Net result" value={money(t.totals.net, t.currency, { decimals: 0 })} tone={t.totals.net >= 0 ? 'gain' : 'loss'} note="Gains and premium, minus losses" />
            <Stat label={`Tax on gains, ${pct(t.rates.capitalGains)}`} value={money(t.totals.tax, t.currency, { decimals: 0 })} note={`On ${money(t.totals.taxable, t.currency, { decimals: 0 })} after carried losses`} />
            <Stat label="Dividend tax still due" value={money(t.totals.dividendTaxDue, t.currency, { decimals: 0 })} note={`${pct(t.rates.dividends)} minus what was withheld abroad`} />
            <Stat label="Losses carried forward" value={money(t.totals.carriedOut, t.currency, { decimals: 0 })} note="Usable against the same country" />
          </StatGrid>

          <Section title="By country" bare>
            <View style={{ gap: space.m }}>
              {t.countries.map((c) => (
                <CountryCard key={c.country} c={c} currency={t.currency} rates={t.rates} />
              ))}
            </View>
          </Section>

          <Cass t={t} />

          <Section title="Closed positions" aside={`${t.trades.length}`}>
            {t.trades.length ? (
              t.trades.map((s, i) => (
                <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: color.line }}>
                  <BrokerDisc broker={s.broker} size={20} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="secondary" weight="medium" numberOfLines={1}>
                      {number(s.quantity, 4)} {s.instrument.symbol} {formLabel[s.form]}, {price(s.openPrice, s.instrument.currency)} → {price(s.closePrice, s.instrument.currency)}
                    </Text>
                    <Text variant="small" weight="regular" tone="inkMuted">
                      {shortDate(s.closeDate, true)} · {s.country}
                      {s.openedByAssignment ? ' · bought by assignment' : ''}
                      {s.closedByAssignment ? ' · called away' : ''}
                    </Text>
                  </View>
                  <Text variant="secondary" weight="medium" tone={s.gain >= 0 ? 'gain' : 'loss'}>
                    {money(s.gain, t.currency, { sign: true, decimals: 0 })}
                  </Text>
                </View>
              ))
            ) : (
              <Empty>No positions closed this year.</Empty>
            )}
          </Section>

          <OptionResults t={t} />

          <Section title="Dividends" aside={`${t.dividends.length}`}>
            {t.dividends.length ? (
              t.dividends.map((d, i) => (
                <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: color.line }}>
                  <BrokerDisc broker={d.broker} size={20} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="secondary" weight="medium" numberOfLines={1}>
                      {d.instrument.name}, {number(d.shares, 2)} sh × {price(d.perShare, d.instrument.currency)}
                    </Text>
                    <Text variant="small" weight="regular" tone="inkMuted">
                      Paid {shortDate(d.payDate, true)} · {d.country} · {money(d.withheld, t.currency)} withheld
                    </Text>
                  </View>
                  <Text variant="secondary" weight="medium">
                    {money(d.gross, t.currency)}
                  </Text>
                </View>
              ))
            ) : (
              <Empty>No dividends paid this year.</Empty>
            )}
          </Section>

          <View style={{ gap: 6, paddingHorizontal: 4 }}>
            {t.notes.map((n) => (
              <Text key={n} variant="small" weight="regular" tone="inkMuted">
                · {n}
              </Text>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function CountryCard({ c, currency, rates }: { c: TaxCountry; currency: Currency; rates: TaxYear['rates'] }) {
  const hasGains = c.trades > 0;
  const hasDiv = c.dividends.gross > 0;
  return (
    <Panel style={{ paddingVertical: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <Text variant="body" weight="semibold">
          {c.country}
        </Text>
        <Text variant="secondary" weight="medium" tone={c.tax + c.dividends.due > 0 ? 'ink' : 'inkMuted'}>
          {money(c.tax + c.dividends.due, currency, { decimals: 0 })} due
        </Text>
      </View>
      {hasGains && (
        <>
          <Row label={c.trades === 1 ? 'Gains, 1 result' : `Gains, ${c.trades} results`} value={money(c.gains, currency, { decimals: 0 })} note={c.premium ? `${money(c.premium, currency, { decimals: 0 })} of it option premium` : undefined} />
          {c.losses > 0 && <Row label="Losses" value={money(-c.losses, currency, { decimals: 0 })} tone="loss" />}
          {c.carriedIn > 0 && <Row label="Losses carried in" value={money(-c.carriedIn, currency, { decimals: 0 })} tone="loss" />}
          <Row label={`Taxable at ${pct(rates.capitalGains)}`} value={money(c.taxable, currency, { decimals: 0 })} strong />
          {c.carriedOut > 0 && <Row label="Carried to next year" value={money(c.carriedOut, currency, { decimals: 0 })} note="Only against gains from this country" />}
        </>
      )}
      {hasDiv && (
        <>
          <Row label="Dividends, gross" value={money(c.dividends.gross, currency, { decimals: 0 })} note={`${money(c.dividends.withheld, currency)} withheld there`} />
          <Row label={`Due here after credit`} value={money(c.dividends.due, currency)} strong note={c.dividends.due === 0 ? 'The withholding covers the Romanian tax' : `${pct(rates.dividends)} minus the ${money(c.dividends.credit, currency)} credit`} />
        </>
      )}
    </Panel>
  );
}

function Row({ label, value, note, tone, strong }: { label: string; value: string; note?: string; tone?: 'loss' | 'ink'; strong?: boolean }) {
  return (
    <View style={{ paddingVertical: 6, gap: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Text variant="secondary" weight={strong ? 'medium' : 'regular'} tone={strong ? 'ink' : 'inkMuted'} style={{ flex: 1 }}>
          {label}
        </Text>
        <Text variant="secondary" weight={strong ? 'semibold' : 'medium'} tone={tone ?? 'ink'}>
          {value}
        </Text>
      </View>
      {note && (
        <Text variant="small" weight="regular" tone="inkMuted">
          {note}
        </Text>
      )}
    </View>
  );
}

/** Health contribution meter: the three thresholds as ticks, your income as the fill. */
function Cass({ t }: { t: TaxYear }) {
  const { cass, currency } = t;
  const top = cass.tiers[cass.tiers.length - 1].threshold * 1.15;
  const fill = Math.min(1, cass.income / top);
  const tier = cass.reached >= 0 ? cass.tiers[cass.reached] : undefined;
  const next = cass.tiers[cass.reached + 1];
  return (
    <Section title="Health contribution (CASS)" aside={tier ? money(tier.contribution, currency, { decimals: 0 }) : 'None'}>
      <View style={{ paddingVertical: 12, gap: 14 }}>
        <View style={{ height: 28, justifyContent: 'center' }}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: color.sunken }}>
            <View style={{ width: `${fill * 100}%`, height: 8, borderRadius: 4, backgroundColor: tier ? color.accent : color.accentMid }} />
          </View>
          {cass.tiers.map((x) => (
            <View key={x.multiple} style={{ position: 'absolute', left: `${(x.threshold / top) * 100}%`, top: 0, alignItems: 'center', width: 40, marginLeft: -20 }}>
              <View style={{ width: 2, height: 14, backgroundColor: color.ink, opacity: 0.4, borderRadius: 1, marginTop: 7 }} />
              <Text variant="small" weight="regular" tone="inkMuted" style={{ fontSize: 10, lineHeight: 12 }}>
                {x.multiple}×
              </Text>
            </View>
          ))}
        </View>
        <Text variant="secondary" tone="inkMuted">
          Investment income of {money(cass.income, currency, { decimals: 0 })} this year
          {tier
            ? ` is above ${tier.multiple} minimum wages, so the contribution is ${money(tier.contribution, currency, { decimals: 0 })} (${pct(t.rates.cass)} of ${tier.multiple} wages)`
            : ` is below 6 minimum wages (${money(cass.tiers[0].threshold, currency, { decimals: 0 })}), so nothing is owed`}
          {next ? `. The next step is at ${money(next.threshold, currency, { decimals: 0 })}.` : '.'}
        </Text>
        <Text variant="small" weight="regular" tone="inkMuted">
          Based on a minimum wage of {money(cass.minimumWage, currency, { decimals: 0 })} a month. Counts taxable gains plus gross dividends.
        </Text>
      </View>
    </Section>
  );
}

function OptionResults({ t }: { t: TaxYear }) {
  const [all, setAll] = useState(false);
  const list = all ? t.optionTrades : t.optionTrades.slice(0, 6);
  const net = t.optionTrades.reduce((s, x) => s + x.net, 0);
  return (
    <Section title="Option results" aside={`${money(net, t.currency, { sign: true, decimals: 0 })} from ${t.optionTrades.length}`}>
      {list.length ? (
        list.map((o, i) => (
          <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: color.line }}>
            <BrokerDisc broker={o.broker} size={20} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="secondary" weight="medium" numberOfLines={1}>
                {o.side === 'sell' ? 'Sold' : 'Bought back'} {o.contracts} {o.instrument.symbol} {optionLabel(o, o.instrument.currency)}
              </Text>
              <Text variant="small" weight="regular" tone="inkMuted">
                {o.outcome === 'expired' ? 'Expired' : 'Closed'} {shortDate(o.date, true)} · {o.country}
              </Text>
            </View>
            <Text variant="secondary" weight="medium" tone={o.net >= 0 ? 'gain' : 'loss'}>
              {money(o.net, t.currency, { sign: true, decimals: 0 })}
            </Text>
          </View>
        ))
      ) : (
        <Empty>No option results this year.</Empty>
      )}
      {t.optionTrades.length > 6 && (
        <Pressable accessibilityRole="button" onPress={() => setAll((a) => !a)} style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: color.line, alignItems: 'center', borderRadius: radius.control }}>
          <Text variant="secondary" weight="medium" tone="accent">
            {all ? 'Show fewer' : `Show all ${t.optionTrades.length}`}
          </Text>
        </Pressable>
      )}
    </Section>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <Text variant="secondary" tone="inkMuted" style={{ paddingVertical: 10 }}>
      {children}
    </Text>
  );
}
