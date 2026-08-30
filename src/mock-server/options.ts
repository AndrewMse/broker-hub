import type {
  CalendarEvent,
  Currency,
  OptionsBook,
  OptionStrategy,
  PremiumByStock,
  PremiumIncome,
  PremiumMonth,
  PremiumTrade,
  RiskFlag,
} from '@/api/types';
import type { NormalizedOptionTrade } from './adapter';
import { issuerCountry } from './country';
import { asOf, convert, daysBetween, instrumentById, marketEvents, withholdingByCountry } from './market';
import { adapters, loadAll, toHolding } from './server';

const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmt = (x: number, currency: Currency) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: x < 10 ? 2 : 0 }).format(x);

async function loadTrades(): Promise<NormalizedOptionTrade[]> {
  const lists = await Promise.all(adapters.map((a) => a.fetchOptionTrades?.() ?? Promise.resolve([])));
  return lists.flat();
}

/**
 * Pairs every short option with what backs it at the same broker:
 * short calls take real shares (not CFDs), short puts take cash. Earliest expiry is backed first.
 */
export async function getOptionsBook(base: Currency): Promise<OptionsBook> {
  const [all, trades] = await Promise.all([loadAll(), loadTrades()]);
  const strategies: OptionStrategy[] = [];

  for (const { adapter, account, positions } of all) {
    const broker = adapter.broker;
    const sharePool = new Map<string, { qty: number; avg: number }>();
    for (const p of positions) {
      if (p.form === 'share' && !p.option && p.quantity > 0) sharePool.set(p.instrumentId, { qty: p.quantity, avg: p.avgPrice });
    }
    let cashLeft = convert(account.cash, account.currency, base);

    const legs = positions
      .filter((p) => p.option)
      .sort((a, b) => a.option!.expiry.localeCompare(b.option!.expiry) || a.option!.strike - b.option!.strike);

    for (const p of legs) {
      const holding = toHolding(p, base);
      const o = holding.option!;
      const inst = instrumentById.get(p.instrumentId)!;
      const toBase = (x: number) => convert(x, inst.currency, base);
      const contracts = Math.abs(p.quantity);
      const units = contracts * o.multiplier;
      const spot = inst.price;
      const short = p.quantity < 0;
      const flags: RiskFlag[] = [];

      const opened = trades.find(
        (t) => t.brokerId === p.brokerId && t.instrumentId === p.instrumentId && t.outcome === 'open' && t.right === o.right && t.strike === o.strike && t.expiry === o.expiry,
      );
      const heldDays = Math.max(1, opened ? daysBetween(opened.date, o.expiry) : o.daysToExpiry);
      const premium = toBase(o.openPrice * units) * (short ? 1 : -1);
      const optionPnl = toBase((o.openPrice - o.mark) * units) * (short ? 1 : -1);

      let s: Omit<OptionStrategy, 'id' | 'broker' | 'instrument' | 'leg' | 'contracts' | 'premium' | 'flags' | 'annualizedYield'>;

      if (!short) {
        s = {
          kind: 'long',
          breakeven: o.right === 'call' ? o.strike + o.openPrice : o.strike - o.openPrice,
          maxProfit: o.right === 'call' ? Infinity : toBase((o.strike - o.openPrice) * units),
          pnl: optionPnl,
          yieldToExpiry: 0,
          cushion: o.right === 'call' ? o.strike / spot - 1 : 1 - o.strike / spot,
        };
      } else if (o.right === 'call') {
        const pool = sharePool.get(p.instrumentId);
        const covered = Math.min(units, pool?.qty ?? 0);
        if (pool) pool.qty -= covered;
        const avg = pool?.avg ?? 0;
        if (covered < units) {
          const naked = Math.ceil((units - covered) / o.multiplier);
          flags.push({
            kind: 'uncovered',
            severity: 'high',
            title: covered ? `${naked} of ${contracts} contracts not covered` : 'Not covered by shares',
            detail: `You need ${units - covered} more shares of ${inst.symbol} at ${broker.shortName}. Shares at other brokers or held as CFDs don't count.`,
          });
        }
        s = covered
          ? {
              kind: 'coveredCall',
              shares: { covered, avgPrice: avg },
              breakeven: avg - o.openPrice,
              maxProfit: toBase((o.strike - avg) * covered + o.openPrice * units),
              pnl: toBase((spot - avg) * covered) + optionPnl,
              yieldToExpiry: o.openPrice / spot,
              cushion: o.strike / spot - 1,
            }
          : {
              kind: 'uncoveredCall',
              breakeven: o.strike + o.openPrice,
              maxProfit: premium,
              pnl: optionPnl,
              yieldToExpiry: o.openPrice / o.strike,
              cushion: o.strike / spot - 1,
            };
      } else {
        const required = toBase(o.strike * units);
        const secured = Math.min(required, Math.max(0, cashLeft));
        cashLeft -= secured;
        if (secured < required - 1) {
          flags.push({
            kind: 'underSecured',
            severity: 'high',
            title: secured ? 'Only partly cash-secured' : 'Not cash-secured',
            detail: `Assignment would cost ${fmt(required, base)}. ${broker.shortName} has ${fmt(Math.max(0, secured), base)} of free cash left for it.`,
          });
        }
        s = {
          kind: secured > 0 ? 'cashSecuredPut' : 'uncoveredPut',
          collateral: { required, secured },
          breakeven: o.strike - o.openPrice,
          maxProfit: premium,
          pnl: optionPnl,
          yieldToExpiry: o.openPrice / o.strike,
          cushion: 1 - o.strike / spot,
        };
      }

      if (short && o.intrinsic > 0) {
        const nearExpiry = o.daysToExpiry <= 7;
        flags.push({
          kind: 'itmNearExpiry',
          severity: nearExpiry ? 'warn' : 'info',
          title: nearExpiry ? `In the money, expires in ${o.daysToExpiry} days` : 'In the money',
          detail:
            o.right === 'call'
              ? `${Math.round(o.probItm * 100)}% chance of assignment. Your ${units} shares would be sold at ${fmt(o.strike, inst.currency)} unless you roll.`
              : `${Math.round(o.probItm * 100)}% chance of assignment. You would buy ${units} shares at ${fmt(o.strike, inst.currency)} unless you roll.`,
        });
      }

      if (short) {
        for (const e of marketEvents) {
          if (e.instrumentId !== p.instrumentId || e.date < asOf || e.date > o.expiry) continue;
          if (e.kind === 'earnings') {
            flags.push({
              kind: 'earnings',
              severity: 'warn',
              title: `Earnings ${shortDate(e.date)}, before expiry`,
              detail: `The stock can gap through your ${fmt(o.strike, inst.currency)} strike on the report.`,
            });
          } else if (o.right === 'call' && e.amount) {
            const extrinsic = o.mark - o.intrinsic;
            const risky = o.intrinsic > 0 && extrinsic < e.amount;
            flags.push({
              kind: 'exDividend',
              severity: risky ? 'high' : 'info',
              title: risky ? `Early assignment risk before ex-dividend ${shortDate(e.date)}` : `Ex-dividend ${shortDate(e.date)}, before expiry`,
              detail: risky
                ? `Time value left (${fmt(extrinsic, inst.currency)}) is below the ${fmt(e.amount, inst.currency)} dividend, so the buyer is likely to exercise the day before.`
                : `Early assignment is unlikely while the time value left (${fmt(extrinsic, inst.currency)}) stays above the ${fmt(e.amount, inst.currency)} dividend.`,
            });
          }
        }
      }

      const order = { high: 0, warn: 1, info: 2 };
      flags.sort((a, b) => order[a.severity] - order[b.severity]);

      strategies.push({
        ...s,
        id: p.id,
        broker,
        instrument: inst,
        leg: { ...holding, option: o },
        contracts,
        premium,
        flags,
        annualizedYield: (s.yieldToExpiry * 365) / heldDays,
      });
    }
  }

  strategies.sort((a, b) => a.leg.option.expiry.localeCompare(b.leg.option.expiry));

  const totals = strategies.reduce(
    (t, s) => {
      const inst = s.instrument;
      t.deltaDollars += convert(s.leg.option.greeks.delta * inst.price, inst.currency, base);
      t.theta += s.leg.option.greeks.theta;
      t.vega += s.leg.option.greeks.vega;
      t.premiumOpen += Math.max(0, s.premium);
      t.collateral += s.collateral ? s.collateral.secured : s.shares ? convert(s.shares.covered * inst.price, inst.currency, base) : 0;
      t.openPnl += s.leg.valueBase - s.leg.costBase;
      return t;
    },
    { deltaDollars: 0, theta: 0, vega: 0, premiumOpen: 0, collateral: 0, openPnl: 0 },
  );

  return { currency: base, strategies, totals };
}

export async function getPremiumIncome(base: Currency): Promise<PremiumIncome> {
  const [all, trades, book] = await Promise.all([loadAll(), loadTrades(), getOptionsBook(base)]);
  const brokers = new Map(adapters.map((a) => [a.broker.id, a.broker]));

  const netInstrument = (t: NormalizedOptionTrade) => (t.side === 'sell' ? 1 : -1) * t.price * t.multiplier * t.contracts - t.commission;

  const list: PremiumTrade[] = trades
    .map((t) => {
      const instrument = instrumentById.get(t.instrumentId)!;
      return {
        id: t.id,
        date: t.date,
        broker: brokers.get(t.brokerId)!,
        instrument,
        country: issuerCountry(t.instrumentId),
        right: t.right,
        strike: t.strike,
        expiry: t.expiry,
        contracts: t.contracts,
        side: t.side,
        net: convert(netInstrument(t), instrument.currency, base),
        outcome: t.outcome,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  // Twelve calendar months ending with the as-of month
  const end = new Date(`${asOf}T00:00:00Z`);
  const months: PremiumMonth[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11 + i, 1));
    return { month: d.toISOString().slice(0, 7), calls: 0, puts: 0 };
  });
  for (const t of list) {
    const m = months.find((x) => x.month === t.date.slice(0, 7));
    if (m) m[t.right === 'call' ? 'calls' : 'puts'] += t.net;
  }
  const last12m = months.reduce((s, m) => s + m.calls + m.puts, 0);
  const thisMonth = months[11].calls + months[11].puts;
  const ytd = list.filter((t) => t.date.startsWith(asOf.slice(0, 4))).reduce((s, t) => s + t.net, 0);

  const shares = new Map<string, { qty: number; cost: number }>();
  for (const { positions } of all) {
    for (const p of positions) {
      if (p.form !== 'share' || p.option || p.quantity <= 0) continue;
      const s = shares.get(p.instrumentId) ?? { qty: 0, cost: 0 };
      s.qty += p.quantity;
      s.cost += p.quantity * p.avgPrice;
      shares.set(p.instrumentId, s);
    }
  }

  const byId = new Map<string, { netInst: number; trades: number }>();
  for (const t of trades) {
    const x = byId.get(t.instrumentId) ?? { netInst: 0, trades: 0 };
    x.netInst += netInstrument(t);
    x.trades += 1;
    byId.set(t.instrumentId, x);
  }
  const byStock: PremiumByStock[] = [...byId.entries()]
    .map(([id, x]) => {
      const instrument = instrumentById.get(id)!;
      const s = shares.get(id);
      const avgPrice = s ? s.cost / s.qty : 0;
      return {
        instrument,
        net: convert(x.netInst, instrument.currency, base),
        trades: x.trades,
        shares: s?.qty ?? 0,
        avgPrice,
        adjustedPrice: s ? avgPrice - x.netInst / s.qty : 0,
      };
    })
    .sort((a, b) => b.net - a.net);

  return {
    currency: base,
    thisMonth,
    ytd,
    last12m,
    avgMonth: last12m / 12,
    yieldOnCapital: book.totals.collateral ? last12m / book.totals.collateral : 0,
    months,
    byStock,
    trades: list,
  };
}

export async function getCalendar(base: Currency): Promise<CalendarEvent[]> {
  const [all, book] = await Promise.all([loadAll(), getOptionsBook(base)]);
  const held = new Set(all.flatMap((b) => b.positions.map((p) => p.instrumentId)));
  const sharesOf = (id: string) =>
    all.flatMap((b) => b.positions).filter((p) => p.instrumentId === id && !p.option && (p.form === 'share' || p.form === 'etf')).reduce((s, p) => s + p.quantity, 0);

  return marketEvents
    .filter((e) => e.date >= asOf)
    .map((e, i) => {
      const affects = book.strategies
        .filter((s) => s.instrument.id === e.instrumentId && s.leg.quantity < 0 && s.leg.option.expiry >= e.date)
        .flatMap((s) => {
          const o = s.leg.option;
          const label = `${fmt(o.strike, s.instrument.currency)} ${o.right} · ${shortDate(o.expiry)}`;
          const flag = s.flags.find((f) => f.kind === (e.kind === 'earnings' ? 'earnings' : 'exDividend') && f.title.includes(shortDate(e.date)));
          if (!flag) return [];
          return [{ strategyId: s.id, label, note: flag.detail, severity: flag.severity }];
        });
      const instrument = instrumentById.get(e.instrumentId)!;
      const yourShares = e.kind === 'exDividend' ? sharesOf(e.instrumentId) : 0;
      const rate = withholdingByCountry[issuerCountry(e.instrumentId)] ?? 0;
      return {
        id: `${e.instrumentId}-${e.kind}-${i}`,
        instrument,
        kind: e.kind,
        date: e.date,
        daysAway: daysBetween(asOf, e.date),
        timing: e.timing,
        amount: e.amount,
        held: held.has(e.instrumentId),
        yourShares: yourShares || undefined,
        yourNet: yourShares && e.amount ? convert(yourShares * e.amount * (1 - rate), instrument.currency, base) : undefined,
        affects,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
