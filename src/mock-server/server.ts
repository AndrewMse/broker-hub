import type {
  Availability,
  BrokerAccount,
  BrokerId,
  Currency,
  Holding,
  InstrumentDetail,
  MarketRow,
  OptionInfo,
  Portfolio,
  PositionGroup,
  Range,
  Series,
  TradePreview,
  TradePreviewRequest,
  TradeRoute,
} from '@/api/types';
import type { BrokerAdapter, NormalizedPosition } from './adapter';
import { blackScholes } from './greeks';
import { etoroAdapter } from './brokers/etoro';
import { ibkrAdapter } from './brokers/ibkr';
import { makeSeries } from './history';
import { asOf, convert, daysBetween, instrumentById, instruments, riskFree, stockProfiles, usdPer } from './market';

/**
 * The aggregation backend. It talks to every broker through its adapter and
 * returns one merged view. Swap `api/client.ts` to a real HTTP client later.
 */
export const adapters: BrokerAdapter[] = [etoroAdapter, ibkrAdapter];
const adapterFor = (id: BrokerId) => adapters.find((a) => a.broker.id === id)!;

/** Index exposure through an ETF, offered by any broker that lists the ETF. */
const etfProxies: Record<string, string> = { SPX: 'SPY', NDX: 'QQQ' };

export async function loadAll() {
  const perBroker = await Promise.all(
    adapters.map(async (a) => {
      const [account, positions, catalog] = await Promise.all([a.fetchAccount(), a.fetchPositions(), a.fetchCatalog()]);
      return { adapter: a, account, positions, catalog };
    }),
  );
  return perBroker;
}

function catalogWithProxies(catalog: Availability[]): Availability[] {
  const proxied = Object.entries(etfProxies).flatMap(([indexId, etfId]) =>
    catalog
      .filter((a) => a.instrumentId === etfId && a.form === 'etf')
      .map((a) => ({ ...a, instrumentId: indexId, via: etfId })),
  );
  return [...catalog, ...proxied];
}

const formOrder = ['share', 'etf', 'crypto', 'spot', 'bond', 'future', 'option', 'cfd'];
const sortAvailability = (list: Availability[]) =>
  [...list].sort(
    (a, b) =>
      adapters.findIndex((x) => x.broker.id === a.brokerId) - adapters.findIndex((x) => x.broker.id === b.brokerId) ||
      formOrder.indexOf(a.form) - formOrder.indexOf(b.form),
  );

function optionInfo(p: NormalizedPosition, base: Currency): OptionInfo {
  const { right, strike, expiry } = p.option!;
  const inst = instrumentById.get(p.instrumentId)!;
  const profile = stockProfiles[p.instrumentId];
  const daysToExpiry = Math.max(0, daysBetween(asOf, expiry));
  const bs = blackScholes({
    right,
    spot: inst.price,
    strike,
    t: daysToExpiry / 365,
    iv: profile?.iv ?? 0.3,
    rate: riskFree[inst.currency] ?? 0.03,
    dividendYield: profile?.dividendYield ?? 0,
  });
  const units = p.quantity * p.multiplier;
  const toBase = (x: number) => convert(x, inst.currency, base);
  return {
    right,
    strike,
    expiry,
    multiplier: p.multiplier,
    currency: inst.currency,
    daysToExpiry,
    mark: bs.price,
    openPrice: p.avgPrice,
    iv: profile?.iv ?? 0.3,
    probItm: bs.probItm,
    intrinsic: bs.intrinsic,
    greeks: { delta: bs.delta * units, gamma: bs.gamma * units, theta: toBase(bs.theta * units), vega: toBase(bs.vega * units) },
  };
}

export function toHolding(p: NormalizedPosition, base: Currency): Holding {
  const inst = instrumentById.get(p.instrumentId)!;
  const units = p.quantity * p.multiplier;
  if (p.option) {
    const option = optionInfo(p, base);
    return {
      id: p.id,
      brokerId: p.brokerId,
      form: p.form,
      quantity: p.quantity,
      unitLabel: p.unitLabel,
      valueBase: convert(units * option.mark, inst.currency, base),
      costBase: convert(units * p.avgPrice, inst.currency, base),
      option,
    };
  }
  return {
    id: p.id,
    brokerId: p.brokerId,
    form: p.form,
    via: p.via,
    quantity: p.quantity,
    unitLabel: p.unitLabel,
    valueBase: convert(units * inst.price, inst.currency, base),
    costBase: convert(units * p.avgPrice, inst.currency, base),
  };
}

/* ---------- Endpoints ---------- */

export async function getPortfolio(base: Currency): Promise<Portfolio> {
  const all = await loadAll();
  const holdings = all.flatMap(({ positions }) => positions.map((p) => ({ p, h: toHolding(p, base) })));

  const groupsById = new Map<string, PositionGroup>();
  for (const { p, h } of holdings) {
    const g = groupsById.get(p.instrumentId) ?? {
      instrument: instrumentById.get(p.instrumentId)!,
      holdings: [],
      valueBase: 0,
      returnPct: 0,
    };
    g.holdings.push(h);
    g.valueBase += h.valueBase;
    groupsById.set(p.instrumentId, g);
  }
  const groups = [...groupsById.values()]
    .map((g) => {
      const cost = g.holdings.reduce((s, h) => s + h.costBase, 0);
      // Divide by |cost| so short options (negative value and cost) keep the right sign
      return { ...g, returnPct: cost ? (g.valueBase - cost) / Math.abs(cost) : 0 };
    })
    .sort((a, b) => b.valueBase - a.valueBase);

  const cash = all.map(({ adapter, account }) => ({
    brokerId: adapter.broker.id,
    amount: account.cash,
    currency: account.currency,
    valueBase: convert(account.cash, account.currency, base),
  }));
  const cashBase = cash.reduce((s, c) => s + c.valueBase, 0);
  const totalBase = groups.reduce((s, g) => s + g.valueBase, 0) + cashBase;

  const byBroker = all.map(({ adapter }) => {
    const valueBase =
      holdings.filter(({ h }) => h.brokerId === adapter.broker.id).reduce((s, { h }) => s + h.valueBase, 0) +
      cash.find((c) => c.brokerId === adapter.broker.id)!.valueBase;
    return { broker: adapter.broker, valueBase, share: valueBase / totalBase };
  });

  return { currency: base, totalBase, cashBase, groups, cash, byBroker };
}

export async function getMarkets(): Promise<MarketRow[]> {
  const all = await loadAll();
  const catalog = catalogWithProxies(all.flatMap((b) => b.catalog));
  return instruments.map((instrument) => ({
    instrument,
    availability: sortAvailability(catalog.filter((a) => a.instrumentId === instrument.id)),
  }));
}

export async function getInstrument(id: string, base: Currency): Promise<InstrumentDetail> {
  const all = await loadAll();
  const instrument = instrumentById.get(id);
  if (!instrument) throw new Error(`Unknown instrument ${id}`);
  const catalog = catalogWithProxies(all.flatMap((b) => b.catalog));
  return {
    instrument,
    availability: sortAvailability(catalog.filter((a) => a.instrumentId === id)),
    holdings: all.flatMap((b) => b.positions.filter((p) => p.instrumentId === id).map((p) => toHolding(p, base))),
    brokers: adapters.map((a) => a.broker),
  };
}

export async function getBrokerAccounts(base: Currency): Promise<BrokerAccount[]> {
  const all = await loadAll();
  const catalog = catalogWithProxies(all.flatMap((b) => b.catalog));
  const offeredBy = (id: BrokerId) => new Set(catalog.filter((a) => a.brokerId === id).map((a) => a.instrumentId));
  const sets = new Map(adapters.map((a) => [a.broker.id, offeredBy(a.broker.id)]));

  return all.map(({ adapter, account, positions }) => {
    const id = adapter.broker.id;
    const mine = sets.get(id)!;
    const others = adapters.filter((a) => a.broker.id !== id).map((a) => sets.get(a.broker.id)!);
    const positionsValue = positions.reduce((s, p) => s + toHolding(p, account.currency).valueBase, 0);
    const value = positionsValue + account.cash;
    return {
      broker: adapter.broker,
      currency: account.currency,
      value,
      cash: account.cash,
      valueBase: convert(value, account.currency, base),
      holdingsCount: positions.length,
      instrumentsOffered: mine.size,
      onlyHere: [...mine].filter((i) => others.every((o) => !o.has(i))).length,
    };
  });
}

/** Portfolio value history. Mocked as a walk that ends at today's total, with a range-dependent change. */
const portfolioChange: Record<Range, number> = { '1D': 0.0042, '1W': 0.0131, '1M': 0.046, '6M': 0.118, '1Y': 0.214 };

export async function getHistory(key: string, range: Range, base: Currency): Promise<Series> {
  if (key === 'portfolio') {
    const p = await getPortfolio(base);
    return makeSeries('portfolio', range, p.totalBase, 'portfolio', portfolioChange[range]);
  }
  const inst = instrumentById.get(key)!;
  await new Promise((r) => setTimeout(r, 150));
  return makeSeries(key, range, inst.price, inst.assetClass, range === '1D' ? inst.change1D : undefined);
}

export async function previewTrade(req: TradePreviewRequest): Promise<TradePreview> {
  const detail = await getInstrument(req.instrumentId, req.currency);
  const all = await loadAll();
  const notionalUsd = req.amount * usdPer[req.currency];
  const fromUsd = (usd: number) => usd / usdPer[req.currency];

  const routes: TradeRoute[] = detail.availability.map((availability) => {
    const adapter = adapterFor(availability.brokerId);
    const account = all.find((b) => b.adapter.broker.id === availability.brokerId)!.account;
    // Proxy routes (S&P 500 via SPY) are quoted as the ETF itself
    const quoted = availability.via && etfProxies[availability.instrumentId] === availability.via
      ? { ...availability, instrumentId: availability.via, via: undefined }
      : availability;
    const inst = instrumentById.get(quoted.instrumentId)!;
    const pricing = adapter.pricing(quoted);
    const unitPriceUsd = inst.price * usdPer[inst.currency] * pricing.multiplier;
    const held = detail.holdings.filter((h) => h.brokerId === availability.brokerId && h.form === availability.form && h.via === availability.via);
    const heldValue = held.reduce((s, h) => s + h.valueBase, 0);

    const base = {
      availability,
      broker: adapter.broker,
      cashAvailable: convert(account.cash, account.currency, req.currency),
      heldValue,
    };

    if (!availability.previewable) {
      return { ...base, status: 'notPreviewable', quantity: 0, fee: 0, spreadPct: 0, cost: Infinity, receive: 0 };
    }
    if (req.side === 'sell' && heldValue <= 0) {
      return { ...base, status: 'notHeld', quantity: 0, fee: 0, spreadPct: 0, cost: Infinity, receive: 0 };
    }

    const rawQty = notionalUsd / unitPriceUsd;
    const quantity = pricing.wholeUnits ? Math.floor(rawQty) : rawQty;
    if (quantity <= 0) {
      const { feeUsd } = adapter.quote({ availability: quoted, side: req.side, notionalUsd: unitPriceUsd, unitPriceUsd, quantity: 1 });
      return {
        ...base,
        status: 'belowMinimum',
        quantity: 0,
        fee: 0,
        spreadPct: 0,
        cost: Infinity,
        receive: 0,
        minimumAmount: fromUsd(unitPriceUsd + feeUsd),
      };
    }

    const tradedUsd = quantity * unitPriceUsd;
    const { feeUsd, spreadPct } = adapter.quote({ availability: quoted, side: req.side, notionalUsd: tradedUsd, unitPriceUsd, quantity });
    const spreadUsd = tradedUsd * (spreadPct / 2);
    const fee = fromUsd(feeUsd);
    const cost = fee + fromUsd(spreadUsd);

    if (req.side === 'buy') {
      // Fees come out of the amount when the product is fractional
      const netQty = pricing.wholeUnits ? quantity : Math.max(0, (notionalUsd - feeUsd - spreadUsd) / unitPriceUsd);
      return { ...base, status: 'ok', quantity: netQty, fee, spreadPct, cost, receive: netQty };
    }
    return { ...base, status: 'ok', quantity, fee, spreadPct, cost, receive: fromUsd(tradedUsd - feeUsd - spreadUsd) };
  });

  let bestIndex = -1;
  routes.forEach((r, i) => {
    if (r.status === 'ok' && (bestIndex < 0 || r.cost < routes[bestIndex].cost)) bestIndex = i;
  });
  return { instrument: detail.instrument, routes, bestIndex };
}
