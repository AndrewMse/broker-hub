import type { Availability, Broker, Currency, Form } from '@/api/types';
import { mulberry32 } from '../history';
import { addDays, asOf, dividendSchedules, exDates, fundCountry, stockProfiles, usdPer, withholdingByCountry } from '../market';
import type { BrokerAdapter, NormalizedDividend, NormalizedOptionTrade, NormalizedPosition, NormalizedStockTrade, Pricing, QuoteInput } from '../adapter';

/* ---------- Raw payloads, shaped like the IBKR Client Portal API ---------- */

type SecType = 'STK' | 'OPT' | 'FUT' | 'CASH' | 'CRYPTO' | 'BOND';

interface IbkrContract {
  conid: number;
  symbol: string;
  secType: SecType;
  currency: Currency;
  /** Canonical instrument this contract gives exposure to (resolved by our symbology service). */
  underlying: string;
  multiplier?: number;
  isEtf?: boolean;
  /** Option contracts only */
  right?: 'C' | 'P';
  strike?: number;
  /** YYYYMMDD */
  maturityDate?: string;
}

interface IbkrPosition {
  acctId: string;
  conid: number;
  position: number;
  avgCost: number;
}

const rawContracts: IbkrContract[] = [
  { conid: 416904, symbol: 'SPX', secType: 'OPT', currency: 'USD', underlying: 'SPX', multiplier: 100 },
  { conid: 495512, symbol: 'ES', secType: 'FUT', currency: 'USD', underlying: 'SPX', multiplier: 50 },
  { conid: 416843, symbol: 'NDX', secType: 'OPT', currency: 'USD', underlying: 'NDX', multiplier: 100 },
  { conid: 563947, symbol: 'NQ', secType: 'FUT', currency: 'USD', underlying: 'NDX', multiplier: 20 },
  { conid: 603558, symbol: 'FDAX', secType: 'FUT', currency: 'EUR', underlying: 'DAX', multiplier: 25 },
  { conid: 618873, symbol: 'Z', secType: 'FUT', currency: 'GBP', underlying: 'UKX', multiplier: 10 },
  { conid: 620730, symbol: 'N225M', secType: 'FUT', currency: 'JPY', underlying: 'N225', multiplier: 100 },
  { conid: 621358, symbol: 'FESX', secType: 'FUT', currency: 'EUR', underlying: 'SX5E', multiplier: 10 },

  { conid: 265598, symbol: 'AAPL', secType: 'STK', currency: 'USD', underlying: 'AAPL' },
  { conid: 265599, symbol: 'AAPL', secType: 'OPT', currency: 'USD', underlying: 'AAPL', multiplier: 100 },
  { conid: 272093, symbol: 'MSFT', secType: 'STK', currency: 'USD', underlying: 'MSFT' },
  { conid: 272094, symbol: 'MSFT', secType: 'OPT', currency: 'USD', underlying: 'MSFT', multiplier: 100 },
  { conid: 4815747, symbol: 'NVDA', secType: 'STK', currency: 'USD', underlying: 'NVDA' },
  { conid: 4815748, symbol: 'NVDA', secType: 'OPT', currency: 'USD', underlying: 'NVDA', multiplier: 100 },
  { conid: 76792991, symbol: 'TSLA', secType: 'STK', currency: 'USD', underlying: 'TSLA' },
  { conid: 76792992, symbol: 'TSLA', secType: 'OPT', currency: 'USD', underlying: 'TSLA', multiplier: 100 },
  { conid: 117902840, symbol: 'ASML', secType: 'STK', currency: 'EUR', underlying: 'ASML' },
  { conid: 14204, symbol: 'SAP', secType: 'STK', currency: 'EUR', underlying: 'SAP' },

  { conid: 431328, symbol: 'VWCE', secType: 'STK', currency: 'EUR', underlying: 'VWCE', isEtf: true },
  { conid: 756733, symbol: 'SPY', secType: 'STK', currency: 'USD', underlying: 'SPY', isEtf: true },
  { conid: 756734, symbol: 'SPY', secType: 'OPT', currency: 'USD', underlying: 'SPY', multiplier: 100 },
  { conid: 320227571, symbol: 'QQQ', secType: 'STK', currency: 'USD', underlying: 'QQQ', isEtf: true },
  { conid: 320227572, symbol: 'QQQ', secType: 'OPT', currency: 'USD', underlying: 'QQQ', multiplier: 100 },

  { conid: 479624278, symbol: 'BTC', secType: 'CRYPTO', currency: 'USD', underlying: 'BTC' },
  { conid: 495759171, symbol: 'MBT', secType: 'FUT', currency: 'USD', underlying: 'BTC', multiplier: 0.1 },
  { conid: 495759172, symbol: 'ETH', secType: 'CRYPTO', currency: 'USD', underlying: 'ETH' },

  { conid: 12087792, symbol: 'EUR.USD', secType: 'CASH', currency: 'USD', underlying: 'EURUSD' },
  { conid: 12087797, symbol: 'GBP.USD', secType: 'CASH', currency: 'USD', underlying: 'GBPUSD' },

  { conid: 693609539, symbol: 'GC', secType: 'FUT', currency: 'USD', underlying: 'XAU', multiplier: 100 },
  { conid: 657106325, symbol: 'BZ', secType: 'FUT', currency: 'USD', underlying: 'BRENT', multiplier: 1000 },

  { conid: 700001234, symbol: 'US-T 10Y', secType: 'BOND', currency: 'USD', underlying: 'US10Y', multiplier: 10 },
];

/** Specific option contracts the account holds. Not part of the tradable catalog above. */
const rawOptionContracts: IbkrContract[] = [
  { conid: 801122501, symbol: 'AAPL', secType: 'OPT', currency: 'USD', underlying: 'AAPL', multiplier: 100, right: 'C', strike: 250, maturityDate: '20261002' },
  { conid: 801122502, symbol: 'AAPL', secType: 'OPT', currency: 'USD', underlying: 'AAPL', multiplier: 100, right: 'C', strike: 270, maturityDate: '20261120' },
  { conid: 801122503, symbol: 'NVDA', secType: 'OPT', currency: 'USD', underlying: 'NVDA', multiplier: 100, right: 'C', strike: 200, maturityDate: '20261120' },
  { conid: 801122504, symbol: 'MSFT', secType: 'OPT', currency: 'USD', underlying: 'MSFT', multiplier: 100, right: 'P', strike: 490, maturityDate: '20261016' },
  { conid: 801122505, symbol: 'TSLA', secType: 'OPT', currency: 'USD', underlying: 'TSLA', multiplier: 100, right: 'P', strike: 290, maturityDate: '20261023' },
];

// Option avgCost is per contract (premium × 100); negative position = short
const rawPositions: IbkrPosition[] = [
  { acctId: 'U7731042', conid: 265598, position: 400, avgCost: 188.3 },
  { acctId: 'U7731042', conid: 4815747, position: 400, avgCost: 96.2 },
  { acctId: 'U7731042', conid: 801122501, position: -1, avgCost: 310 },
  { acctId: 'U7731042', conid: 801122502, position: -3, avgCost: 520 },
  { acctId: 'U7731042', conid: 801122503, position: -4, avgCost: 740 },
  { acctId: 'U7731042', conid: 801122504, position: -1, avgCost: 720 },
  { acctId: 'U7731042', conid: 801122505, position: -1, avgCost: 1050 },
  { acctId: 'U7731042', conid: 14204, position: 30, avgCost: 201.0 },
  { acctId: 'U7731042', conid: 431328, position: 120, avgCost: 118.4 },
  { acctId: 'U7731042', conid: 756733, position: 10, avgCost: 540.0 },
  { acctId: 'U7731042', conid: 117902840, position: 8, avgCost: 690.0 },
  { acctId: 'U7731042', conid: 479624278, position: 0.05, avgCost: 91000 },
  // Bond avgCost is per 1,000 face, i.e. price × 10
  { acctId: 'U7731042', conid: 700001234, position: 20, avgCost: 981.0 },
];

const rawLedger = { BASE: { cashbalance: 71250.4, currency: 'EUR' as const } };

/** Option fills, shaped like an IBKR Flex trade report. notes: Ep = expired, C = closed by a later trade, A = assigned. */
interface IbkrTrade {
  tradeID: string;
  symbol: string;
  putCall: 'C' | 'P';
  strike: number;
  expiry: string;
  tradeDate: string;
  buySell: 'BUY' | 'SELL';
  quantity: number;
  tradePrice: number;
  ibCommission: number;
  openCloseIndicator: 'O' | 'C';
  notes: '' | 'Ep' | 'C' | 'A';
}

/** Closed stock lots, like the Flex "Closed Lots" section. `assignedFrom` links an assignment to its option trade. */
interface IbkrClosedLot {
  lotID: string;
  conid: number;
  quantity: number;
  openDateTime: string;
  costPrice: number;
  closeDateTime: string;
  closePrice: number;
  ibCommission: number;
  openedByAssignment?: string;
  closedByAssignment?: string;
}

interface IbkrDividend {
  actionID: string;
  conid: number;
  exDate: string;
  payDate: string;
  quantity: number;
  grossRate: number;
  amount: number;
  tax: number;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replaceAll('-', '');
function thirdFriday(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return new Date(Date.UTC(year, month, 1 + ((5 - first + 7) % 7) + 14));
}

/**
 * A year of monthly covered calls on AAPL and NVDA, cash-secured puts on MSFT every other month,
 * a full TSLA wheel (put assigned in March, shares called away in June, back to puts), then the open positions.
 */
function buildTradeHistory(): { trades: IbkrTrade[]; lots: IbkrClosedLot[] } {
  const rand = mulberry32(20260925);
  const trades: IbkrTrade[] = [];
  const lots: IbkrClosedLot[] = [];
  let n = 0;
  const add = (t: Omit<IbkrTrade, 'tradeID' | 'ibCommission'>) => {
    const id = `T${(40210 + n++).toString()}`;
    trades.push({ ...t, tradeID: id, ibCommission: -0.65 * Math.abs(t.quantity) });
    return id;
  };

  const plan = [
    { symbol: 'AAPL', putCall: 'C' as const, contracts: 3, start: 205, step: 4, otm: 1.05, premium: [2.2, 2.4], every: 1, from: 0, closeAt: { 5: 1.8 } as Record<number, number> },
    { symbol: 'NVDA', putCall: 'C' as const, contracts: 4, start: 130, step: 5, otm: 1.08, premium: [3.5, 4], every: 1, from: 0, closeAt: { 8: 0.4 } as Record<number, number> },
    { symbol: 'MSFT', putCall: 'P' as const, contracts: 1, start: 470, step: 3, otm: 0.95, premium: [5, 4], every: 2, from: 0, closeAt: {} as Record<number, number> },
  ];

  for (let m = 0; m < 12; m++) {
    const year = 2025 + Math.floor((9 + m) / 12);
    const month = (9 + m) % 12;
    const expiry = thirdFriday(year, month);
    const opened = new Date(Date.UTC(year, month, 2));
    for (const p of plan) {
      if (m < p.from || (m - p.from) % p.every) continue;
      const spot = p.start + p.step * m;
      const strike = Math.round((spot * p.otm) / 5) * 5;
      const premium = +(p.premium[0] + rand() * p.premium[1]).toFixed(2);
      const closeMult = p.closeAt[m];
      const base = { symbol: p.symbol, putCall: p.putCall, strike, expiry: ymd(expiry) };
      add({ ...base, tradeDate: ymd(opened), buySell: 'SELL', quantity: -p.contracts, tradePrice: premium, openCloseIndicator: 'O', notes: closeMult ? 'C' : 'Ep' });
      if (closeMult) {
        const closed = new Date(Date.UTC(year, month, 12));
        add({ ...base, tradeDate: ymd(closed), buySell: 'BUY', quantity: p.contracts, tradePrice: +(premium * closeMult).toFixed(2), openCloseIndicator: 'C', notes: '' });
      }
    }
  }

  // TSLA wheel, cycle 1: two puts (second assigned), three calls (third called away)
  const tsla = (t: Omit<IbkrTrade, 'tradeID' | 'ibCommission' | 'symbol' | 'buySell' | 'quantity' | 'openCloseIndicator'>) =>
    add({ ...t, symbol: 'TSLA', buySell: 'SELL', quantity: -1, openCloseIndicator: 'O' });
  tsla({ putCall: 'P', strike: 250, expiry: '20260220', tradeDate: '20260105', tradePrice: 6.1, notes: 'Ep' });
  const putAssigned = tsla({ putCall: 'P', strike: 255, expiry: '20260320', tradeDate: '20260223', tradePrice: 7.4, notes: 'A' });
  tsla({ putCall: 'C', strike: 265, expiry: '20260417', tradeDate: '20260323', tradePrice: 5.2, notes: 'Ep' });
  tsla({ putCall: 'C', strike: 270, expiry: '20260515', tradeDate: '20260420', tradePrice: 4.8, notes: 'Ep' });
  const callAssigned = tsla({ putCall: 'C', strike: 275, expiry: '20260618', tradeDate: '20260518', tradePrice: 5.6, notes: 'A' });
  lots.push({
    lotID: 'L9001', conid: 76792991, quantity: 100, openDateTime: '20260320', costPrice: 255, closeDateTime: '20260618', closePrice: 275,
    ibCommission: -2, openedByAssignment: putAssigned, closedByAssignment: callAssigned,
  });
  // Cycle 2: back to puts
  tsla({ putCall: 'P', strike: 275, expiry: '20260717', tradeDate: '20260702', tradePrice: 9.3, notes: 'Ep' });
  tsla({ putCall: 'P', strike: 285, expiry: '20260918', tradeDate: '20260902', tradePrice: 10.85, notes: 'Ep' });

  // Other closed lots: a German loss, a Dutch gain, a Dutch loss in 2025 (carried forward), a US gain in 2025
  lots.push(
    { lotID: 'L9002', conid: 14204, quantity: 20, openDateTime: '20250612', costPrice: 231, closeDateTime: '20260512', closePrice: 214, ibCommission: -2.5 },
    { lotID: 'L9003', conid: 117902840, quantity: 4, openDateTime: '20250903', costPrice: 640, closeDateTime: '20260603', closePrice: 790, ibCommission: -2.5 },
    { lotID: 'L9004', conid: 117902840, quantity: 3, openDateTime: '20250210', costPrice: 890, closeDateTime: '20251022', closePrice: 650, ibCommission: -2.5 },
    { lotID: 'L9005', conid: 272093, quantity: 50, openDateTime: '20240815', costPrice: 402, closeDateTime: '20251114', closePrice: 512, ibCommission: -2 },
  );

  const openedOn: Record<number, string> = { 801122501: '20260918', 801122502: '20260922', 801122503: '20260921', 801122504: '20260919', 801122505: '20260923' };
  for (const p of rawPositions) {
    const c = rawOptionContracts.find((o) => o.conid === p.conid);
    if (!c) continue;
    add({
      symbol: c.symbol,
      putCall: c.right!,
      strike: c.strike!,
      expiry: c.maturityDate!,
      tradeDate: openedOn[c.conid],
      buySell: 'SELL',
      quantity: p.position,
      tradePrice: p.avgCost / c.multiplier!,
      openCloseIndicator: 'O',
      notes: '',
    });
  }
  return { trades, lots };
}

const { trades: rawTrades, lots: rawLots } = buildTradeHistory();

/** Dividends since the shares were bought, from the schedule: AAPL and NVDA held all year, SAP, ASML, SPY. */
function buildDividends(): IbkrDividend[] {
  const held: { conid: number; id: string; since: string; qty: number }[] = [
    { conid: 265598, id: 'AAPL', since: '2025-03-10', qty: 400 },
    { conid: 4815747, id: 'NVDA', since: '2025-01-20', qty: 400 },
    { conid: 14204, id: 'SAP', since: '2025-06-12', qty: 30 },
    { conid: 117902840, id: 'ASML', since: '2025-09-03', qty: 8 },
    { conid: 756733, id: 'SPY', since: '2025-04-01', qty: 10 },
  ];
  const out: IbkrDividend[] = [];
  for (const h of held) {
    const profile = stockProfiles[h.id];
    const rate = withholdingByCountry[profile?.country ?? fundCountry[h.id]] ?? 0;
    for (const ex of exDates(h.id, h.since, asOf)) {
      const perShare = dividendSchedules[h.id].perShare;
      const gross = perShare * h.qty;
      out.push({
        actionID: `D${h.conid}-${ex.replaceAll('-', '')}`,
        conid: h.conid,
        exDate: ex.replaceAll('-', ''),
        payDate: addDays(ex, dividendSchedules[h.id].payLag).replaceAll('-', ''),
        quantity: h.qty,
        grossRate: perShare,
        amount: gross,
        tax: -(gross * rate),
      });
    }
  }
  return out;
}

const rawDividends = buildDividends();

/* ---------- Normalization ---------- */

const byConid = new Map([...rawContracts, ...rawOptionContracts].map((c) => [c.conid, c]));
const isoDate = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

function formOf(c: IbkrContract): Form {
  switch (c.secType) {
    case 'STK':
      return c.isEtf ? 'etf' : 'share';
    case 'OPT':
      return 'option';
    case 'FUT':
      return 'future';
    case 'CASH':
      return 'spot';
    case 'CRYPTO':
      return 'crypto';
    case 'BOND':
      return 'bond';
  }
}

function unitLabel(c: IbkrContract): string {
  switch (c.secType) {
    case 'STK':
      return 'sh';
    case 'OPT':
    case 'FUT':
      return 'contracts';
    case 'CASH':
      return c.symbol.split('.')[0];
    case 'CRYPTO':
      return c.symbol;
    case 'BOND':
      return 'bonds';
  }
}

/** A contract is "via" something when its ticker isn't the instrument's own symbol. */
function viaOf(c: IbkrContract): string | undefined {
  if (c.secType === 'FUT') return c.symbol;
  return undefined;
}

function costNote(c: IbkrContract): string {
  switch (c.secType) {
    case 'STK':
      return c.currency === 'USD' ? '$0.005 per share, $1 minimum' : '0.05%, €1.25 minimum';
    case 'OPT':
      return '$0.65 per contract';
    case 'FUT':
      return '$2.25 per contract';
    case 'CASH':
      return '0.002%, $2 minimum';
    case 'CRYPTO':
      return '0.18%, $1.75 minimum';
    case 'BOND':
      return '0.002%, $5 minimum';
  }
}

const spreadOf: Record<SecType, number> = {
  STK: 0.0002, OPT: 0.01, FUT: 0.00004, CASH: 0.00002, CRYPTO: 0.001, BOND: 0.0005,
};

function contractFor(a: Availability): IbkrContract {
  return rawContracts.find((c) => c.underlying === a.instrumentId && formOf(c) === a.form && viaOf(c) === a.via)!;
}

const broker: Broker = {
  id: 'ibkr',
  name: 'Interactive Brokers',
  shortName: 'IBKR',
  monogram: 'IB',
  brandColor: '#D71920',
  accountCurrency: 'EUR',
  country: 'Ireland',
  forms: ['share', 'etf', 'option', 'future', 'spot', 'crypto', 'bond'],
  features: ['fractional', 'shorting', 'margin'],
};

const latency = () => new Promise((r) => setTimeout(r, 180 + Math.random() * 240));

export const ibkrAdapter: BrokerAdapter = {
  broker,

  async fetchAccount() {
    await latency();
    return { currency: rawLedger.BASE.currency, cash: rawLedger.BASE.cashbalance };
  },

  async fetchPositions() {
    await latency();
    return rawPositions.map((p): NormalizedPosition => {
      const c = byConid.get(p.conid)!;
      const multiplier = c.multiplier ?? 1;
      return {
        id: `ibkr-${p.acctId}-${p.conid}`,
        brokerId: 'ibkr',
        instrumentId: c.underlying,
        form: formOf(c),
        via: viaOf(c),
        quantity: p.position,
        unitLabel: unitLabel(c),
        avgPrice: p.avgCost / multiplier,
        multiplier,
        option: c.right ? { right: c.right === 'C' ? 'call' : 'put', strike: c.strike!, expiry: isoDate(c.maturityDate!) } : undefined,
      };
    });
  },

  async fetchStockTrades() {
    await latency();
    return rawLots.map((l): NormalizedStockTrade => {
      const c = byConid.get(l.conid)!;
      return {
        id: `ibkr-${l.lotID}`,
        brokerId: 'ibkr',
        instrumentId: c.underlying,
        form: formOf(c),
        quantity: l.quantity,
        openDate: isoDate(l.openDateTime),
        openPrice: l.costPrice,
        closeDate: isoDate(l.closeDateTime),
        closePrice: l.closePrice,
        fees: Math.abs(l.ibCommission),
        openedBy: l.openedByAssignment && `ibkr-${l.openedByAssignment}`,
        closedBy: l.closedByAssignment && `ibkr-${l.closedByAssignment}`,
      };
    });
  },

  async fetchDividends() {
    await latency();
    return rawDividends.map((d): NormalizedDividend => ({
      id: `ibkr-${d.actionID}`,
      brokerId: 'ibkr',
      instrumentId: byConid.get(d.conid)!.underlying,
      exDate: isoDate(d.exDate),
      payDate: isoDate(d.payDate),
      shares: d.quantity,
      perShare: d.grossRate,
      gross: d.amount,
      withheld: Math.abs(d.tax),
    }));
  },

  async fetchOptionTrades() {
    await latency();
    return rawTrades.map((t): NormalizedOptionTrade => {
      const expiry = isoDate(t.expiry);
      const outcome = t.openCloseIndicator === 'C' ? 'closed' : t.notes === 'Ep' ? 'expired' : t.notes === 'C' ? 'closed' : t.notes === 'A' ? 'assigned' : expiry >= asOf ? 'open' : 'expired';
      return {
        id: `ibkr-${t.tradeID}`,
        brokerId: 'ibkr',
        instrumentId: t.symbol,
        date: isoDate(t.tradeDate),
        right: t.putCall === 'C' ? 'call' : 'put',
        strike: t.strike,
        expiry,
        contracts: Math.abs(t.quantity),
        side: t.buySell === 'SELL' ? 'sell' : 'buy',
        price: t.tradePrice,
        multiplier: 100,
        commission: Math.abs(t.ibCommission),
        outcome,
      };
    });
  },

  async fetchCatalog() {
    await latency();
    return rawContracts.map(
      (c): Availability => ({
        brokerId: 'ibkr',
        instrumentId: c.underlying,
        form: formOf(c),
        via: viaOf(c),
        unitLabel: unitLabel(c),
        costNote: costNote(c),
        previewable: c.secType !== 'OPT',
      }),
    );
  },

  pricing(a): Pricing {
    const c = contractFor(a);
    const whole = c.secType === 'FUT' || c.secType === 'BOND' || (c.secType === 'STK' && c.currency !== 'USD');
    return { multiplier: c.multiplier ?? 1, wholeUnits: whole };
  },

  quote({ availability, notionalUsd, quantity }: QuoteInput) {
    const c = contractFor(availability);
    let feeUsd: number;
    switch (c.secType) {
      case 'STK':
        feeUsd =
          c.currency === 'USD'
            ? Math.max(1, Math.min(0.005 * quantity, 0.01 * notionalUsd))
            : Math.max(1.25 * usdPer.EUR, 0.0005 * notionalUsd);
        break;
      case 'OPT':
        feeUsd = 0.65 * quantity;
        break;
      case 'FUT':
        feeUsd = 2.25 * quantity;
        break;
      case 'CASH':
        feeUsd = Math.max(2, 0.00002 * notionalUsd);
        break;
      case 'CRYPTO':
        feeUsd = Math.max(1.75, 0.0018 * notionalUsd);
        break;
      case 'BOND':
        feeUsd = Math.max(5, 0.00002 * notionalUsd);
        break;
    }
    return { feeUsd, spreadPct: spreadOf[c.secType] };
  },
};
