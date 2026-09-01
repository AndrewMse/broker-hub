import type { BrokerId, Currency, DividendPayment, DividendProjection } from '@/api/types';
import { issuerCountry } from './country';
import { addDays, asOf, convert, dividendSchedules, exDates, instrumentById, withholdingByCountry } from './market';
import { adapters, loadAll } from './server';

export async function getDividends(base: Currency): Promise<DividendPayment[]> {
  const lists = await Promise.all(adapters.map((a) => a.fetchDividends()));
  const brokers = new Map(adapters.map((a) => [a.broker.id, a.broker]));
  return lists
    .flat()
    .map((d): DividendPayment => {
      const instrument = instrumentById.get(d.instrumentId)!;
      const toBase = (x: number) => convert(x, instrument.currency, base);
      return {
        id: d.id,
        broker: brokers.get(d.brokerId)!,
        instrument,
        exDate: d.exDate,
        payDate: d.payDate,
        shares: d.shares,
        perShare: d.perShare,
        country: issuerCountry(d.instrumentId),
        gross: toBase(d.gross),
        withheld: toBase(d.withheld),
        net: toBase(d.gross - d.withheld),
      };
    })
    .sort((a, b) => b.payDate.localeCompare(a.payDate));
}

/** What the shares and ETFs you hold today would pay over the next 12 months, after withholding. */
export async function getDividendProjection(base: Currency): Promise<DividendProjection> {
  const all = await loadAll();
  const horizon = addDays(asOf, 365);
  const byStock = new Map<string, { shares: number; brokerIds: Set<BrokerId> }>();
  const excluded: DividendProjection['excluded'] = [];
  const seenExcluded = new Set<string>();

  for (const { positions } of all) {
    for (const p of positions) {
      if (p.option || !['share', 'etf', 'cfd'].includes(p.form)) continue;
      const inst = instrumentById.get(p.instrumentId)!;
      if (!['stock', 'etf', 'index'].includes(inst.assetClass)) continue;
      const sch = dividendSchedules[p.instrumentId];
      const reason =
        p.form === 'cfd'
          ? 'A CFD gets a cash adjustment on the ex-date, not a dividend'
          : !sch
            ? p.instrumentId === 'VWCE'
              ? 'Accumulating fund, dividends are reinvested'
              : 'Pays no dividend'
            : null;
      if (reason) {
        if (!seenExcluded.has(`${p.instrumentId}:${reason}`)) {
          seenExcluded.add(`${p.instrumentId}:${reason}`);
          excluded.push({ instrument: inst, reason });
        }
        continue;
      }
      const s = byStock.get(p.instrumentId) ?? { shares: 0, brokerIds: new Set<BrokerId>() };
      s.shares += p.quantity;
      s.brokerIds.add(p.brokerId);
      byStock.set(p.instrumentId, s);
    }
  }

  const rows = [...byStock.entries()]
    .map(([id, s]) => {
      const instrument = instrumentById.get(id)!;
      const sch = dividendSchedules[id];
      const dates = exDates(id, addDays(asOf, 1), horizon);
      const perShareAnnual = sch.perShare * dates.length;
      const withholdingRate = withholdingByCountry[issuerCountry(id)] ?? 0;
      const gross = convert(perShareAnnual * s.shares, instrument.currency, base);
      return {
        instrument,
        shares: s.shares,
        frequency: sch.frequency,
        perShareAnnual,
        withholdingRate,
        gross,
        net: gross * (1 - withholdingRate),
        nextExDate: dates[0],
        brokerIds: [...s.brokerIds],
      };
    })
    .sort((a, b) => b.net - a.net);

  const gross = rows.reduce((t, r) => t + r.gross, 0);
  const net = rows.reduce((t, r) => t + r.net, 0);
  return { currency: base, gross, withheld: gross - net, net, byStock: rows, excluded };
}
