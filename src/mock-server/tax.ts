import type { CountryRule, Currency, DividendPayment, PremiumTrade, StockTrade, TaxCountry, TaxYear } from '@/api/types';
import type { NormalizedOptionTrade } from './adapter';
import { issuerCountry, taxCountry } from './country';
import { getDividends } from './dividends';
import { asOf, convert, instrumentById, roTax } from './market';
import { adapters } from './server';

/** First year the mock history covers; nothing is carried in from before it. */
const firstYear = 2025;

async function loadHistory() {
  const [stock, option] = await Promise.all([
    Promise.all(adapters.map((a) => a.fetchStockTrades())),
    Promise.all(adapters.map((a) => a.fetchOptionTrades?.() ?? Promise.resolve([]))),
  ]);
  return { stock: stock.flat(), option: option.flat() };
}

/** When an option's result counts: at expiry, or on the day it was bought back. */
function realizedDate(t: NormalizedOptionTrade, all: NormalizedOptionTrade[]) {
  if (t.side === 'buy') return t.date;
  if (t.outcome === 'expired') return t.expiry;
  if (t.outcome === 'closed') {
    const buy = all.find((b) => b.side === 'buy' && b.brokerId === t.brokerId && b.instrumentId === t.instrumentId && b.strike === t.strike && b.expiry === t.expiry && b.date >= t.date);
    return buy?.date ?? t.expiry;
  }
  return null;
}

/**
 * Romanian declaration view of one year: results per source country, losses offset only within a
 * country and carried forward, dividend tax net of foreign withholding, and the CASS thresholds.
 * Figures are in the display currency; the form itself needs RON at the BNR rate of each date.
 */
export async function getTaxYear(base: Currency, year: number, rule: CountryRule): Promise<TaxYear> {
  const [{ stock, option }, allDividends] = await Promise.all([loadHistory(), getDividends(base)]);
  const brokers = new Map(adapters.map((a) => [a.broker.id, a.broker]));
  const yr = (d: string) => Number(d.slice(0, 4));
  const premiumOf = (t: NormalizedOptionTrade) => (t.side === 'sell' ? 1 : -1) * t.price * t.multiplier * t.contracts - t.commission;

  const trades: StockTrade[] = stock
    .filter((l) => yr(l.closeDate) === year && instrumentById.get(l.instrumentId)!.assetClass !== 'crypto')
    .map((l) => {
      const instrument = instrumentById.get(l.instrumentId)!;
      const toBase = (x: number) => convert(x, instrument.currency, base);
      const opened = l.openedBy ? option.find((t) => t.id === l.openedBy) : undefined;
      const closed = l.closedBy ? option.find((t) => t.id === l.closedBy) : undefined;
      const premiumAdjustment = toBase((opened ? premiumOf(opened) : 0) + (closed ? premiumOf(closed) : 0));
      const raw = l.quantity >= 0 ? (l.closePrice - l.openPrice) * l.quantity : (l.openPrice - l.closePrice) * -l.quantity;
      return {
        id: l.id,
        broker: brokers.get(l.brokerId)!,
        instrument,
        form: l.form,
        quantity: Math.abs(l.quantity),
        openDate: l.openDate,
        openPrice: l.openPrice,
        closeDate: l.closeDate,
        closePrice: l.closePrice,
        fees: toBase(l.fees),
        premiumAdjustment,
        gain: toBase(raw - l.fees) + premiumAdjustment,
        country: taxCountry(l.instrumentId, l.form, l.brokerId, rule),
        openedByAssignment: !!l.openedBy,
        closedByAssignment: !!l.closedBy,
      };
    })
    .sort((a, b) => b.closeDate.localeCompare(a.closeDate));

  const optionTrades: PremiumTrade[] = option
    .flatMap((t) => {
      const date = realizedDate(t, option);
      if (!date || yr(date) !== year) return [];
      const instrument = instrumentById.get(t.instrumentId)!;
      return [
        {
          id: t.id,
          date,
          broker: brokers.get(t.brokerId)!,
          instrument,
          country: taxCountry(t.instrumentId, 'option', t.brokerId, rule),
          right: t.right,
          strike: t.strike,
          expiry: t.expiry,
          contracts: t.contracts,
          side: t.side,
          net: convert(premiumOf(t), instrument.currency, base),
          outcome: t.outcome,
        },
      ];
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const dividends: DividendPayment[] = allDividends.filter((d) => yr(d.payDate) === year);
  const dividendRate = roTax.dividends[year] ?? roTax.dividends[Math.max(...Object.keys(roTax.dividends).map(Number))];

  const carried = new Map<string, number>();
  if (year > firstYear) {
    const prev = await getTaxYear(base, year - 1, rule);
    for (const c of prev.countries) if (c.carriedOut > 0) carried.set(c.country, c.carriedOut);
  }

  const countries = new Map<string, TaxCountry>();
  const country = (name: string) => {
    let c = countries.get(name);
    if (!c) {
      c = {
        country: name,
        gains: 0, losses: 0, net: 0,
        carriedIn: carried.get(name) ?? 0,
        taxable: 0, tax: 0, carriedOut: 0, premium: 0, trades: 0,
        dividends: { gross: 0, withheld: 0, tax: 0, credit: 0, due: 0 },
      };
      countries.set(name, c);
    }
    return c;
  };
  for (const [name, loss] of carried) country(name).carriedIn = loss;
  for (const t of trades) {
    const c = country(t.country);
    c.trades += 1;
    if (t.gain >= 0) c.gains += t.gain;
    else c.losses += -t.gain;
  }
  for (const t of optionTrades) {
    const c = country(t.country);
    c.trades += 1;
    c.premium += t.net;
    if (t.net >= 0) c.gains += t.net;
    else c.losses += -t.net;
  }
  for (const d of dividends) {
    const c = country(issuerCountry(d.instrument.id));
    const tax = d.gross * dividendRate;
    const credit = Math.min(d.withheld, tax);
    c.dividends.gross += d.gross;
    c.dividends.withheld += d.withheld;
    c.dividends.tax += tax;
    c.dividends.credit += credit;
    c.dividends.due += tax - credit;
  }
  const list = [...countries.values()]
    .map((c) => {
      c.net = c.gains - c.losses;
      const remaining = c.net - c.carriedIn;
      c.taxable = Math.max(0, remaining);
      c.carriedOut = Math.max(0, -remaining);
      c.tax = c.taxable * roTax.capitalGains;
      return c;
    })
    .sort((a, b) => Math.abs(b.net) + b.dividends.gross - (Math.abs(a.net) + a.dividends.gross));

  const totals = list.reduce(
    (t, c) => ({
      net: t.net + c.net,
      taxable: t.taxable + c.taxable,
      tax: t.tax + c.tax,
      dividendsGross: t.dividendsGross + c.dividends.gross,
      dividendTaxDue: t.dividendTaxDue + c.dividends.due,
      carriedOut: t.carriedOut + c.carriedOut,
    }),
    { net: 0, taxable: 0, tax: 0, dividendsGross: 0, dividendTaxDue: 0, carriedOut: 0 },
  );

  const wageRon = roTax.minimumWageRon[year] ?? roTax.minimumWageRon[Math.max(...Object.keys(roTax.minimumWageRon).map(Number))];
  const minimumWage = convert(wageRon, 'RON', base);
  const income = totals.taxable + totals.dividendsGross;
  const tiers = roTax.cassMultiples.map((multiple) => ({ multiple, threshold: multiple * minimumWage, contribution: multiple * minimumWage * roTax.cass }));
  const reached = tiers.reduce((r, t, i) => (income >= t.threshold ? i : r), -1);

  return {
    year,
    currency: base,
    rule,
    complete: year < Number(asOf.slice(0, 4)),
    countries: list,
    totals,
    cass: { income, minimumWage, tiers, reached },
    rates: { capitalGains: roTax.capitalGains, dividends: dividendRate, cass: roTax.cass },
    trades,
    optionTrades,
    dividends,
    notes: [
      `Amounts are in ${base}. The declaration wants RON at the BNR rate on each transaction date.`,
      'Losses offset gains only within the same country; what is left carries forward for up to 7 years.',
      rule === 'issuer'
        ? "Country follows the company or fund. CFDs are contracts with the broker, so they sit under the broker's country."
        : 'Country follows the broker: IBKR Ireland, eToro Cyprus. Dividends always follow the issuer, since that is where the withholding happened.',
      'Assigned options adjust the share cost or sale price instead of counting as premium.',
      'Crypto gains are declared separately and are not included here.',
      'Rates and thresholds change yearly; confirm them with your accountant before filing.',
    ],
  };
}
