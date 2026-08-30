import type { ConcentrationAlert, Currency, Exposure, ExposureBucket, StockExposure } from '@/api/types';
import { convert, countryCurrency, fundProfiles, instrumentById, stockProfiles } from './market';
import { getPortfolio, loadAll, toHolding } from './server';

/** Concentration limits: one stock vs the whole portfolio, one sector vs all stock exposure. */
const limits = { stock: 0.15, sector: 0.5 };

/**
 * Equity exposure across brokers, delta-adjusted:
 * shares and CFDs at notional, options at delta × underlying price,
 * ETFs and index products split into the stocks they hold (look-through).
 */
export async function getExposure(base: Currency): Promise<Exposure> {
  const [all, portfolio] = await Promise.all([loadAll(), getPortfolio(base)]);
  const netLiquidation = portfolio.totalBase;

  const stocks = new Map<string, StockExposure>();
  const stock = (id: string) => {
    let s = stocks.get(id);
    if (!s) {
      const p = stockProfiles[id];
      s = {
        instrument: instrumentById.get(id)!,
        sector: p.sector,
        country: p.country,
        beta: p.beta,
        shares: 0, cfd: 0, options: 0, funds: 0, total: 0, share: 0, gross: 0,
        viaFunds: [],
      };
      stocks.set(id, s);
    }
    return s;
  };

  const sector = new Map<string, number>();
  const country = new Map<string, number>();
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  let otherEquity = 0;
  let nonEquity = 0;
  let fundBetaDollars = 0;

  for (const { positions } of all) {
    for (const p of positions) {
      const h = toHolding(p, base);
      const inst = instrumentById.get(p.instrumentId)!;
      // Delta-adjusted value of this position
      const exposure = h.option ? convert(h.option.greeks.delta * inst.price, inst.currency, base) : h.valueBase;

      if (stockProfiles[p.instrumentId]) {
        const s = stock(p.instrumentId);
        if (h.option) s.options += exposure;
        else if (p.form === 'cfd') s.cfd += exposure;
        else s.shares += exposure;
        continue;
      }

      const fund = fundProfiles[p.instrumentId];
      if (!fund) {
        nonEquity += h.valueBase;
        continue;
      }
      let named = 0;
      for (const [id, w] of Object.entries(fund.constituents)) {
        const s = stock(id);
        s.funds += exposure * w;
        const label = p.via ?? inst.symbol;
        const existing = s.viaFunds.find((f) => f.symbol === label);
        if (existing) existing.value += exposure * w;
        else s.viaFunds.push({ symbol: label, value: exposure * w });
        named += w;
      }
      const rest = exposure * (1 - named);
      otherEquity += rest;
      fundBetaDollars += rest * fund.beta;
      spread(sector, fund.restBySector, rest);
      spread(country, fund.restByCountry, rest);
    }
  }

  const list = [...stocks.values()]
    .map((s) => {
      const gross = s.shares + s.cfd + s.funds;
      const total = gross + s.options;
      add(sector, s.sector, total);
      add(country, s.country, total);
      return { ...s, gross, total, share: total / netLiquidation, viaFunds: s.viaFunds.sort((a, b) => b.value - a.value) };
    })
    .sort((a, b) => b.total - a.total);

  const currency = new Map<string, number>();
  for (const [c, v] of country) add(currency, countryCurrency[c] ?? 'Other', v);

  const equity = list.reduce((s, x) => s + x.total, 0) + otherEquity;
  // Breakdowns are shares of stock exposure, so each one adds up to 100%
  const buckets = (m: Map<string, number>): ExposureBucket[] =>
    [...m.entries()]
      .map(([label, value]) => ({ label, value, share: value / equity }))
      .filter((b) => Math.abs(b.value) >= 0.5)
      .sort((a, b) => (a.label === 'Other' ? 1 : b.label === 'Other' ? -1 : b.value - a.value));

  const betaWeighted = list.reduce((s, x) => s + x.total * x.beta, 0) + fundBetaDollars;
  const bySector = buckets(sector);

  const alerts: ConcentrationAlert[] = [
    ...list
      .filter((s) => s.share > limits.stock)
      .map((s) => ({ label: s.instrument.name, share: s.share, limit: limits.stock, basis: 'portfolio' as const })),
    ...bySector
      .filter((b) => b.share > limits.sector)
      .map((b) => ({ label: b.label, share: b.share, limit: limits.sector, basis: 'stocks' as const })),
  ];

  return {
    currency: base,
    netLiquidation,
    equity,
    betaWeighted,
    spxDown1: -betaWeighted * 0.01,
    stocks: list,
    otherEquity,
    nonEquity,
    bySector,
    byCountry: buckets(country),
    byCurrency: buckets(currency),
    alerts,
    limits,
  };
}

function spread(m: Map<string, number>, weights: Record<string, number>, amount: number) {
  const sum = Object.values(weights).reduce((s, w) => s + w, 0);
  for (const [k, w] of Object.entries(weights)) m.set(k, (m.get(k) ?? 0) + (amount * w) / sum);
}
