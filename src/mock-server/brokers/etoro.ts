import type { Availability, Broker, Form } from '@/api/types';
import type { BrokerAdapter, NormalizedDividend, NormalizedPosition, NormalizedStockTrade, Pricing, QuoteInput } from '../adapter';
import { addDays, asOf, dividendSchedules, exDates, stockProfiles, withholdingByCountry } from '../market';

/* ---------- Raw payloads, shaped like eToro's API ---------- */

// eToro instrument type ids
const T = { currencies: 1, commodities: 2, indices: 4, stocks: 5, etf: 6, crypto: 10 } as const;

interface EtoroInstrument {
  InstrumentID: number;
  SymbolFull: string;
  InstrumentTypeID: (typeof T)[keyof typeof T];
}

interface EtoroPosition {
  PositionID: number;
  InstrumentID: number;
  IsBuy: boolean;
  Leverage: number;
  Units: number;
  OpenRate: number;
}

const rawInstruments: EtoroInstrument[] = [
  { InstrumentID: 27, SymbolFull: 'SPX500', InstrumentTypeID: T.indices },
  { InstrumentID: 28, SymbolFull: 'NSDQ100', InstrumentTypeID: T.indices },
  { InstrumentID: 32, SymbolFull: 'GER40', InstrumentTypeID: T.indices },
  { InstrumentID: 30, SymbolFull: 'UK100', InstrumentTypeID: T.indices },
  { InstrumentID: 35, SymbolFull: 'JPN225', InstrumentTypeID: T.indices },
  { InstrumentID: 33, SymbolFull: 'EUSTX50', InstrumentTypeID: T.indices },
  { InstrumentID: 1001, SymbolFull: 'AAPL', InstrumentTypeID: T.stocks },
  { InstrumentID: 1004, SymbolFull: 'MSFT', InstrumentTypeID: T.stocks },
  { InstrumentID: 1137, SymbolFull: 'NVDA', InstrumentTypeID: T.stocks },
  { InstrumentID: 1111, SymbolFull: 'TSLA', InstrumentTypeID: T.stocks },
  { InstrumentID: 4507, SymbolFull: 'ASML.NV', InstrumentTypeID: T.stocks },
  { InstrumentID: 1289, SymbolFull: 'SAP.DE', InstrumentTypeID: T.stocks },
  { InstrumentID: 3006, SymbolFull: 'SPY', InstrumentTypeID: T.etf },
  { InstrumentID: 3008, SymbolFull: 'QQQ', InstrumentTypeID: T.etf },
  { InstrumentID: 100000, SymbolFull: 'BTC', InstrumentTypeID: T.crypto },
  { InstrumentID: 100001, SymbolFull: 'ETH', InstrumentTypeID: T.crypto },
  { InstrumentID: 1, SymbolFull: 'EURUSD', InstrumentTypeID: T.currencies },
  { InstrumentID: 2, SymbolFull: 'GBPUSD', InstrumentTypeID: T.currencies },
  { InstrumentID: 18, SymbolFull: 'GOLD', InstrumentTypeID: T.commodities },
  { InstrumentID: 22, SymbolFull: 'OIL.BRENT', InstrumentTypeID: T.commodities },
];

const rawPositions: EtoroPosition[] = [
  { PositionID: 2150001, InstrumentID: 1001, IsBuy: true, Leverage: 1, Units: 20, OpenRate: 205.1 },
  { PositionID: 2150002, InstrumentID: 1137, IsBuy: true, Leverage: 1, Units: 35.5, OpenRate: 121.4 },
  { PositionID: 2150003, InstrumentID: 100000, IsBuy: true, Leverage: 1, Units: 0.12, OpenRate: 68200 },
  { PositionID: 2150004, InstrumentID: 100001, IsBuy: true, Leverage: 1, Units: 1.8, OpenRate: 3150 },
  { PositionID: 2150005, InstrumentID: 27, IsBuy: true, Leverage: 5, Units: 1.2, OpenRate: 6420 },
  { PositionID: 2150006, InstrumentID: 18, IsBuy: true, Leverage: 2, Units: 2, OpenRate: 3310 },
  { PositionID: 2150007, InstrumentID: 1111, IsBuy: true, Leverage: 2, Units: 6, OpenRate: 262.8 },
];

const rawCash = { Credit: 2410.55, Currency: 'USD' as const };

/** Closed positions, like eToro's account statement. Leverage > 1 or a sell means it was a CFD. */
interface EtoroClosedPosition {
  PositionID: number;
  InstrumentID: number;
  IsBuy: boolean;
  Leverage: number;
  Units: number;
  OpenRate: number;
  CloseRate: number;
  OpenDateTime: string;
  CloseDateTime: string;
  Fees: number;
}

const rawClosed: EtoroClosedPosition[] = [
  { PositionID: 2140011, InstrumentID: 1004, IsBuy: true, Leverage: 1, Units: 10, OpenRate: 415, CloseRate: 440, OpenDateTime: '2025-09-15', CloseDateTime: '2026-02-10', Fees: 0 },
  { PositionID: 2140012, InstrumentID: 1001, IsBuy: true, Leverage: 5, Units: 12, OpenRate: 262, CloseRate: 236, OpenDateTime: '2026-03-20', CloseDateTime: '2026-04-08', Fees: 4.2 },
  { PositionID: 2140013, InstrumentID: 1111, IsBuy: true, Leverage: 1, Units: 5, OpenRate: 380, CloseRate: 340, OpenDateTime: '2025-07-02', CloseDateTime: '2025-12-09', Fees: 0 },
  { PositionID: 2140014, InstrumentID: 27, IsBuy: false, Leverage: 5, Units: 2, OpenRate: 6180, CloseRate: 6320, OpenDateTime: '2025-11-03', CloseDateTime: '2025-11-20', Fees: 6.1 },
];

/** Real share positions and when they were opened, for dividends. */
const heldSince: Record<number, string> = { 1001: '2025-02-14', 1137: '2025-05-06' };

/* ---------- Normalization ---------- */

const toCanonical: Record<string, string> = {
  SPX500: 'SPX', NSDQ100: 'NDX', GER40: 'DAX', UK100: 'UKX', JPN225: 'N225', EUSTX50: 'SX5E',
  'ASML.NV': 'ASML', 'SAP.DE': 'SAP', GOLD: 'XAU', 'OIL.BRENT': 'BRENT',
};
const canonicalId = (i: EtoroInstrument) => toCanonical[i.SymbolFull] ?? i.SymbolFull;
const byEtoroId = new Map(rawInstruments.map((i) => [i.InstrumentID, i]));

/** Forms eToro offers per instrument type. Only unleveraged buys of stocks, ETFs and crypto are real. */
function formsFor(type: EtoroInstrument['InstrumentTypeID']): Form[] {
  switch (type) {
    case T.stocks:
      return ['share', 'cfd'];
    case T.etf:
      return ['etf', 'cfd'];
    case T.crypto:
      return ['crypto'];
    default:
      return ['cfd'];
  }
}

function unitLabel(form: Form, symbol: string) {
  if (form === 'share') return 'sh';
  if (form === 'etf') return 'sh';
  if (form === 'crypto') return symbol;
  return 'units';
}

function costNote(form: Form, type: EtoroInstrument['InstrumentTypeID']) {
  if (form === 'crypto') return '1% fee, no commission';
  if (form === 'cfd') return type === T.stocks ? 'Spread 0.15%, overnight fees' : 'Spread about 0.01%, overnight fees';
  return 'No commission, spread 0.09%';
}

const spreadFor = (form: Form, instrumentId: string): number => {
  if (form === 'crypto') return 0;
  if (form === 'cfd') return ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'ASML', 'SAP', 'SPY', 'QQQ'].includes(instrumentId) ? 0.0015 : 0.00012;
  return 0.0009;
};

const broker: Broker = {
  id: 'etoro',
  name: 'eToro',
  shortName: 'eToro',
  monogram: 'eT',
  brandColor: '#13C636',
  accountCurrency: 'USD',
  country: 'Cyprus',
  forms: ['share', 'etf', 'crypto', 'cfd'],
  features: ['fractional', 'shorting', 'copyTrading'],
};

const latency = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 180));

export const etoroAdapter: BrokerAdapter = {
  broker,

  async fetchAccount() {
    await latency();
    return { currency: rawCash.Currency, cash: rawCash.Credit };
  },

  async fetchPositions() {
    await latency();
    return rawPositions.map((p): NormalizedPosition => {
      const inst = byEtoroId.get(p.InstrumentID)!;
      const real = p.IsBuy && p.Leverage === 1 && formsFor(inst.InstrumentTypeID)[0] !== 'cfd';
      const form: Form = real ? formsFor(inst.InstrumentTypeID)[0] : 'cfd';
      return {
        id: `etoro-${p.PositionID}`,
        brokerId: 'etoro',
        instrumentId: canonicalId(inst),
        form,
        quantity: p.IsBuy ? p.Units : -p.Units,
        unitLabel: unitLabel(form, inst.SymbolFull),
        avgPrice: p.OpenRate,
        multiplier: 1,
      };
    });
  },

  async fetchStockTrades() {
    await latency();
    return rawClosed.map((p): NormalizedStockTrade => {
      const inst = byEtoroId.get(p.InstrumentID)!;
      const real = p.IsBuy && p.Leverage === 1 && formsFor(inst.InstrumentTypeID)[0] !== 'cfd';
      return {
        id: `etoro-${p.PositionID}`,
        brokerId: 'etoro',
        instrumentId: canonicalId(inst),
        form: real ? formsFor(inst.InstrumentTypeID)[0] : 'cfd',
        quantity: p.IsBuy ? p.Units : -p.Units,
        openDate: p.OpenDateTime,
        openPrice: p.OpenRate,
        closeDate: p.CloseDateTime,
        closePrice: p.CloseRate,
        fees: p.Fees,
      };
    });
  },

  async fetchDividends() {
    await latency();
    return rawPositions
      .filter((p) => heldSince[p.InstrumentID] && p.IsBuy && p.Leverage === 1)
      .flatMap((p): NormalizedDividend[] => {
        const inst = byEtoroId.get(p.InstrumentID)!;
        const id = canonicalId(inst);
        const sch = dividendSchedules[id];
        if (!sch) return [];
        const rate = withholdingByCountry[stockProfiles[id]?.country] ?? 0;
        return exDates(id, heldSince[p.InstrumentID], asOf).map((ex) => {
          const gross = sch.perShare * p.Units;
          return {
            id: `etoro-div-${p.PositionID}-${ex}`,
            brokerId: 'etoro',
            instrumentId: id,
            exDate: ex,
            payDate: addDays(ex, sch.payLag),
            shares: p.Units,
            perShare: sch.perShare,
            gross,
            withheld: gross * rate,
          };
        });
      });
  },

  async fetchCatalog() {
    await latency();
    return rawInstruments.flatMap((i) =>
      formsFor(i.InstrumentTypeID).map(
        (form): Availability => ({
          brokerId: 'etoro',
          instrumentId: canonicalId(i),
          form,
          unitLabel: unitLabel(form, i.SymbolFull),
          costNote: costNote(form, i.InstrumentTypeID),
          previewable: true,
        }),
      ),
    );
  },

  pricing(): Pricing {
    return { multiplier: 1, wholeUnits: false };
  },

  quote({ availability, notionalUsd }: QuoteInput) {
    const feeUsd = availability.form === 'crypto' ? notionalUsd * 0.01 : 0;
    return { feeUsd, spreadPct: spreadFor(availability.form, availability.instrumentId) };
  },
};
