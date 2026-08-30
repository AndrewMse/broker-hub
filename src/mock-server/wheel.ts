import type { Currency, WheelCycle, WheelStep, WheelStepKind } from '@/api/types';
import type { NormalizedDividend, NormalizedOptionTrade, NormalizedStockTrade } from './adapter';
import { asOf, convert, daysBetween, instrumentById } from './market';
import { loadAll } from './server';

const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmt = (x: number, currency: Currency) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: Number.isInteger(x) ? 0 : 2 }).format(x);

type Event =
  | { date: string; order: number; kind: 'sold' | 'expired' | 'closed'; trade: NormalizedOptionTrade }
  | { date: string; order: number; kind: 'assigned'; trade: NormalizedOptionTrade; lot?: NormalizedStockTrade }
  | { date: string; order: number; kind: 'dividend'; dividend: NormalizedDividend };

/**
 * Rebuilds wheel cycles from trade history, per stock and broker:
 * puts sold until one is assigned, then calls on the shares until they're called away.
 * A run of covered calls on shares bought outright is a cycle that "started with shares".
 */
export async function getWheels(base: Currency): Promise<WheelCycle[]> {
  const all = await loadAll();
  const cycles: WheelCycle[] = [];

  for (const { adapter, positions } of all) {
    if (!adapter.fetchOptionTrades) continue;
    const [optionTrades, lots, dividends] = await Promise.all([adapter.fetchOptionTrades(), adapter.fetchStockTrades(), adapter.fetchDividends()]);
    const broker = adapter.broker;
    const byInstrument = new Set(optionTrades.map((t) => t.instrumentId));

    for (const instrumentId of byInstrument) {
      const inst = instrumentById.get(instrumentId)!;
      const toBase = (x: number) => convert(x, inst.currency, base);
      const sells = optionTrades.filter((t) => t.instrumentId === instrumentId && t.side === 'sell');
      const buys = optionTrades.filter((t) => t.instrumentId === instrumentId && t.side === 'buy');
      const sharesNow = positions.find((p) => p.instrumentId === instrumentId && p.form === 'share' && !p.option);

      const events: Event[] = [];
      for (const t of sells) {
        events.push({ date: t.date, order: 2, kind: 'sold', trade: t });
        if (t.outcome === 'expired') events.push({ date: t.expiry, order: 0, kind: 'expired', trade: t });
        if (t.outcome === 'assigned') {
          const lot = lots.find((l) => l.openedBy === t.id || l.closedBy === t.id);
          events.push({ date: t.expiry, order: 0, kind: 'assigned', trade: t, lot });
        }
      }
      for (const t of buys) events.push({ date: t.date, order: 1, kind: 'closed', trade: t });
      for (const d of dividends.filter((d) => d.instrumentId === instrumentId)) events.push({ date: d.payDate, order: 1, kind: 'dividend', dividend: d });
      events.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

      type Cycle = WheelCycle & { shareQty: number; costPerShare: number; fees: number };
      const st: { cur: Cycle | null } = { cur: null };
      let n = 0;
      const premiumOf = (t: NormalizedOptionTrade) => toBase((t.side === 'sell' ? 1 : -1) * t.price * t.multiplier * t.contracts - t.commission);
      const step = (date: string, kind: WheelStepKind, label: string, amount?: number, detail?: string): WheelStep => ({
        id: `${instrumentId}-${date}-${kind}-${st.cur!.steps.length}`,
        date,
        kind,
        label,
        detail,
        amount,
      });
      const open = (startedBy: 'put' | 'shares', started: string): Cycle => {
        st.cur = {
          id: `${broker.id}-${instrumentId}-${++n}`,
          instrument: inst,
          broker,
          startedBy,
          phase: startedBy === 'put' ? 'puts' : 'shares',
          started,
          days: 0,
          steps: [],
          capital: 0,
          premium: 0,
          capitalGain: 0,
          dividends: 0,
          total: 0,
          annualized: 0,
          shareQty: 0,
          costPerShare: 0,
          fees: 0,
        };
        return st.cur;
      };
      const close = (ended?: string) => {
        if (!st.cur) return;
        const c = st.cur;
        if (c.phase === 'shares' && c.shareQty > 0) {
          c.capitalGain = toBase((inst.price - c.costPerShare) * c.shareQty);
          const openCall = sells.find((t) => t.outcome === 'open' && t.right === 'call');
          c.shares = {
            quantity: c.shareQty,
            costPerShare: c.costPerShare,
            adjustedCostPerShare: c.costPerShare - convert(c.premium + c.dividends, base, inst.currency) / c.shareQty,
            openCall: openCall && { strike: openCall.strike, expiry: openCall.expiry },
          };
        }
        if (c.phase === 'puts') {
          const openPut = sells.find((t) => t.outcome === 'open' && t.right === 'put');
          if (openPut) c.openPut = { strike: openPut.strike, expiry: openPut.expiry };
        }
        c.ended = ended;
        c.days = Math.max(1, daysBetween(c.started, ended ?? asOf));
        c.total = c.premium + c.capitalGain + c.dividends - c.fees;
        const basis = c.startedBy === 'put' ? c.total : c.premium + c.dividends - c.fees;
        c.annualized = c.capital ? (basis / c.capital) * (365 / c.days) : 0;
        const { shareQty: _q, costPerShare: _c, fees: _f, ...cycle } = c;
        cycles.push(cycle);
        st.cur = null;
      };

      for (const e of events) {
        if (e.kind === 'dividend') {
          if (st.cur && st.cur.phase === 'shares') {
            const net = toBase(e.dividend.gross - e.dividend.withheld);
            st.cur.dividends += net;
            st.cur.steps.push(step(e.date, 'dividend', `Dividend, ${fmt(e.dividend.perShare, inst.currency)} a share`, net, 'After withholding'));
          }
          continue;
        }
        const t = e.trade;
        const units = t.contracts * t.multiplier;
        const label = `${fmt(t.strike, inst.currency)} ${t.right}`;

        if (e.kind === 'sold') {
          if (!st.cur) {
            if (t.right === 'put') open('put', t.date);
            else {
              const c = open('shares', t.date);
              c.shareQty = sharesNow?.quantity ?? units;
              c.costPerShare = sharesNow?.avgPrice ?? inst.price;
              c.capital = toBase(c.shareQty * c.costPerShare);
              c.steps.push(step(t.date, 'sharesBought', `Started with ${c.shareQty} shares at ${fmt(c.costPerShare, inst.currency)}`, undefined, 'Bought outright, not through a put'));
            }
          }
          const c = st.cur!;
          if (c.phase === 'puts') c.capital = Math.max(c.capital, toBase(t.strike * units));
          c.premium += premiumOf(t);
          c.steps.push(step(t.date, t.right === 'put' ? 'putSold' : 'callSold', `Sold ${t.contracts} × ${label}`, premiumOf(t), `Expires ${shortDate(t.expiry)}`));
        } else if (e.kind === 'expired') {
          st.cur?.steps.push(step(e.date, t.right === 'put' ? 'putExpired' : 'callExpired', `${label} expired worthless`, undefined, 'Premium kept'));
        } else if (e.kind === 'closed') {
          if (!st.cur) continue;
          st.cur.premium += premiumOf(t);
          st.cur.steps.push(step(e.date, t.right === 'put' ? 'putClosed' : 'callClosed', `Bought back ${t.contracts} × ${label}`, premiumOf(t)));
        } else if (e.kind === 'assigned') {
          if (!st.cur) continue;
          const c = st.cur;
          if (t.right === 'put') {
            c.shareQty = e.lot?.quantity ?? units;
            c.costPerShare = e.lot?.openPrice ?? t.strike;
            c.capital = toBase(c.shareQty * c.costPerShare);
            c.fees += toBase(e.lot?.fees ?? 0) / 2;
            c.phase = 'shares';
            c.steps.push(step(e.date, 'assigned', `Assigned: bought ${c.shareQty} shares at ${fmt(c.costPerShare, inst.currency)}`, -toBase(c.shareQty * c.costPerShare)));
          } else {
            const price = e.lot?.closePrice ?? t.strike;
            const qty = e.lot?.quantity ?? c.shareQty;
            c.capitalGain = toBase((price - c.costPerShare) * qty);
            c.fees += toBase(e.lot?.fees ?? 0) / 2;
            c.steps.push(step(e.date, 'calledAway', `Called away: sold ${qty} shares at ${fmt(price, inst.currency)}`, toBase(qty * price)));
            c.phase = 'completed';
            close(e.date);
          }
        }
      }
      close();
    }
  }

  const rank = { shares: 0, puts: 1, completed: 2 };
  return cycles.sort((a, b) => rank[a.phase] - rank[b.phase] || b.started.localeCompare(a.started));
}
