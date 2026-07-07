import type { Currency, Instrument } from '@/api/types';

/** Reference market data, standing in for a market-data provider. Canonical ids are used across brokers. */
export const instruments: Instrument[] = [
  { id: 'SPX', symbol: 'SPX', name: 'S&P 500', assetClass: 'index', currency: 'USD', price: 6812.4, change1D: 0.0061 },
  { id: 'NDX', symbol: 'NDX', name: 'Nasdaq 100', assetClass: 'index', currency: 'USD', price: 24810.2, change1D: 0.0094 },
  { id: 'DAX', symbol: 'DAX', name: 'DAX 40', assetClass: 'index', currency: 'EUR', price: 24120.5, change1D: -0.0032 },
  { id: 'UKX', symbol: 'UKX', name: 'FTSE 100', assetClass: 'index', currency: 'GBP', price: 9480.1, change1D: 0.0018 },
  { id: 'N225', symbol: 'N225', name: 'Nikkei 225', assetClass: 'index', currency: 'JPY', price: 45210, change1D: -0.0047 },
  { id: 'SX5E', symbol: 'SX5E', name: 'Euro Stoxx 50', assetClass: 'index', currency: 'EUR', price: 5620.3, change1D: -0.0011 },

  { id: 'AAPL', symbol: 'AAPL', name: 'Apple', assetClass: 'stock', currency: 'USD', price: 252.4, change1D: 0.0112 },
  { id: 'MSFT', symbol: 'MSFT', name: 'Microsoft', assetClass: 'stock', currency: 'USD', price: 512.2, change1D: 0.0043 },
  { id: 'NVDA', symbol: 'NVDA', name: 'Nvidia', assetClass: 'stock', currency: 'USD', price: 184.6, change1D: 0.0231 },
  { id: 'TSLA', symbol: 'TSLA', name: 'Tesla', assetClass: 'stock', currency: 'USD', price: 318.1, change1D: -0.0186 },
  { id: 'ASML', symbol: 'ASML', name: 'ASML Holding', assetClass: 'stock', currency: 'EUR', price: 812.3, change1D: 0.0067 },
  { id: 'SAP', symbol: 'SAP', name: 'SAP', assetClass: 'stock', currency: 'EUR', price: 238.5, change1D: -0.0054 },

  { id: 'VWCE', symbol: 'VWCE', name: 'Vanguard FTSE All-World', assetClass: 'etf', currency: 'EUR', price: 142.8, change1D: 0.0029 },
  { id: 'SPY', symbol: 'SPY', name: 'SPDR S&P 500 ETF', assetClass: 'etf', currency: 'USD', price: 679.3, change1D: 0.006 },
  { id: 'QQQ', symbol: 'QQQ', name: 'Invesco QQQ', assetClass: 'etf', currency: 'USD', price: 604.1, change1D: 0.0092 },

  { id: 'BTC', symbol: 'BTC', name: 'Bitcoin', assetClass: 'crypto', currency: 'USD', price: 112850, change1D: 0.0214 },
  { id: 'ETH', symbol: 'ETH', name: 'Ethereum', assetClass: 'crypto', currency: 'USD', price: 4320, change1D: -0.0138 },

  { id: 'EURUSD', symbol: 'EUR/USD', name: 'Euro / US dollar', assetClass: 'forex', currency: 'USD', price: 1.172, change1D: 0.0008 },
  { id: 'GBPUSD', symbol: 'GBP/USD', name: 'British pound / US dollar', assetClass: 'forex', currency: 'USD', price: 1.351, change1D: -0.0012 },

  { id: 'XAU', symbol: 'XAU', name: 'Gold', assetClass: 'commodity', currency: 'USD', price: 3755.4, change1D: 0.0041 },
  { id: 'BRENT', symbol: 'BRENT', name: 'Brent crude oil', assetClass: 'commodity', currency: 'USD', price: 68.2, change1D: -0.0093 },

  { id: 'US10Y', symbol: 'US10Y', name: 'US Treasury 10-year', assetClass: 'bond', currency: 'USD', price: 99.85, change1D: 0.0006 },
];

export const instrumentById = new Map(instruments.map((i) => [i.id, i]));

/** Value of one unit of each currency, in USD. */
export const usdPer: Record<Currency, number> = {
  USD: 1,
  EUR: 1.172,
  GBP: 1.351,
  JPY: 0.00672,
  RON: 0.2305,
};

export function convert(amount: number, from: Currency, to: Currency): number {
  return (amount * usdPer[from]) / usdPer[to];
}

/** Fixed "today" for the mock data, so days-to-expiry and calendar distances stay stable. */
export const asOf = '2026-09-25';

const dayMs = 86_400_000;
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / dayMs);

/** Annual risk-free rate per currency, used for option pricing. */
export const riskFree: Partial<Record<Currency, number>> = { USD: 0.04, EUR: 0.021 };

export interface StockProfile {
  sector: string;
  country: string;
  beta: number;
  dividendYield: number;
  /** Implied volatility used for this stock's options */
  iv: number;
}

export const stockProfiles: Record<string, StockProfile> = {
  AAPL: { sector: 'Technology', country: 'United States', beta: 1.2, dividendYield: 0.0041, iv: 0.26 },
  MSFT: { sector: 'Technology', country: 'United States', beta: 1.05, dividendYield: 0.0071, iv: 0.24 },
  NVDA: { sector: 'Technology', country: 'United States', beta: 1.75, dividendYield: 0.0002, iv: 0.44 },
  TSLA: { sector: 'Consumer discretionary', country: 'United States', beta: 2.1, dividendYield: 0, iv: 0.58 },
  ASML: { sector: 'Technology', country: 'Netherlands', beta: 1.3, dividendYield: 0.009, iv: 0.33 },
  SAP: { sector: 'Technology', country: 'Germany', beta: 1.0, dividendYield: 0.011, iv: 0.27 },
};

export interface FundProfile {
  beta: number;
  /** Weights of the stocks we track individually */
  constituents: Record<string, number>;
  /** Relative weights of everything else; scaled to fill the remainder */
  restBySector: Record<string, number>;
  restByCountry: Record<string, number>;
}

const sp500: FundProfile = {
  beta: 1,
  constituents: { NVDA: 0.076, MSFT: 0.068, AAPL: 0.066, TSLA: 0.021 },
  restBySector: {
    Technology: 0.16, Financials: 0.135, 'Health care': 0.095, 'Consumer discretionary': 0.085, Communication: 0.1,
    Industrials: 0.085, 'Consumer staples': 0.05, Energy: 0.03, Utilities: 0.025, 'Real estate': 0.02, Materials: 0.019,
  },
  restByCountry: { 'United States': 1 },
};

const nasdaq100: FundProfile = {
  beta: 1.15,
  constituents: { NVDA: 0.096, MSFT: 0.085, AAPL: 0.082, TSLA: 0.031, ASML: 0.012 },
  restBySector: {
    Technology: 0.3, Communication: 0.3, 'Consumer discretionary': 0.2, 'Health care': 0.06, 'Consumer staples': 0.07, Industrials: 0.05, Other: 0.02,
  },
  restByCountry: { 'United States': 0.97, Other: 0.03 },
};

/** Look-through data for funds and indexes. A CFD on an index counts like holding the ETF. */
export const fundProfiles: Record<string, FundProfile> = {
  SPY: sp500,
  SPX: sp500,
  QQQ: nasdaq100,
  NDX: nasdaq100,
  VWCE: {
    beta: 0.95,
    constituents: { NVDA: 0.045, MSFT: 0.04, AAPL: 0.039, TSLA: 0.012, ASML: 0.005, SAP: 0.004 },
    restBySector: {
      Technology: 0.15, Financials: 0.17, Industrials: 0.11, 'Consumer discretionary': 0.1, 'Health care': 0.1, Communication: 0.08,
      'Consumer staples': 0.06, Energy: 0.04, Materials: 0.04, Utilities: 0.03, 'Real estate': 0.02,
    },
    restByCountry: {
      'United States': 0.6, Japan: 0.055, 'United Kingdom': 0.035, France: 0.025, Germany: 0.02, Netherlands: 0.01, Canada: 0.03, China: 0.03, Other: 0.195,
    },
  },
};

/** Dividend withholding a Romanian resident faces, by the issuer's country (treaty rates, W-8BEN filed for the US). */
export const withholdingByCountry: Record<string, number> = {
  'United States': 0.1,
  Netherlands: 0.15,
  Germany: 0.26375,
  Ireland: 0,
};

/** Issuer country for funds; stocks use `stockProfiles`. */
export const fundCountry: Record<string, string> = { SPY: 'United States', QQQ: 'United States', VWCE: 'Ireland' };

export interface DividendSchedule {
  perShare: number;
  frequency: 'quarterly' | 'semiannual' | 'annual';
  /** Ex-dividend day-of-month and the months (1-12) it falls in */
  exDay: number;
  months: number[];
  /** Days from ex-date to pay date */
  payLag: number;
}

export const dividendSchedules: Record<string, DividendSchedule> = {
  AAPL: { perShare: 0.27, frequency: 'quarterly', exDay: 9, months: [2, 5, 8, 11], payLag: 6 },
  MSFT: { perShare: 0.91, frequency: 'quarterly', exDay: 19, months: [2, 5, 8, 11], payLag: 22 },
  NVDA: { perShare: 0.01, frequency: 'quarterly', exDay: 4, months: [3, 6, 9, 12], payLag: 22 },
  ASML: { perShare: 1.6, frequency: 'quarterly', exDay: 28, months: [1, 4, 7, 10], payLag: 12 },
  SAP: { perShare: 2.6, frequency: 'annual', exDay: 14, months: [5], payLag: 4 },
  SPY: { perShare: 1.85, frequency: 'quarterly', exDay: 18, months: [3, 6, 9, 12], payLag: 33 },
  QQQ: { perShare: 0.7, frequency: 'quarterly', exDay: 22, months: [3, 6, 9, 12], payLag: 9 },
};

const pad = (n: number) => String(n).padStart(2, '0');
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * dayMs).toISOString().slice(0, 10);

/** Every ex-dividend date for an instrument in [from, to]. */
export function exDates(instrumentId: string, from: string, to: string): string[] {
  const s = dividendSchedules[instrumentId];
  if (!s) return [];
  const out: string[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    for (const m of s.months) {
      const d = `${y}-${pad(m)}-${pad(s.exDay)}`;
      if (d >= from && d <= to) out.push(d);
    }
  }
  return out.sort();
}

/**
 * Romanian tax parameters. Rates changed in the 2025 fiscal package; check them each year.
 * Minimum wage is the gross monthly figure the CASS thresholds are based on.
 */
export const roTax = {
  capitalGains: 0.1,
  dividends: { 2025: 0.1, 2026: 0.16 } as Record<number, number>,
  cass: 0.1,
  cassMultiples: [6, 12, 24],
  minimumWageRon: { 2025: 4050, 2026: 4325 } as Record<number, number>,
  /** Years a net loss can be carried forward */
  lossCarryYears: 7,
};

export const countryCurrency: Record<string, string> = {
  'United States': 'USD', Germany: 'EUR', Netherlands: 'EUR', France: 'EUR', Japan: 'JPY', 'United Kingdom': 'GBP',
};

export interface MarketEvent {
  instrumentId: string;
  kind: 'earnings' | 'exDividend';
  date: string;
  timing?: 'Before open' | 'After close';
  amount?: number;
}

const earnings: MarketEvent[] = [
  { instrumentId: 'ASML', kind: 'earnings', date: '2026-10-14', timing: 'Before open' },
  { instrumentId: 'TSLA', kind: 'earnings', date: '2026-10-21', timing: 'After close' },
  { instrumentId: 'SAP', kind: 'earnings', date: '2026-10-21', timing: 'After close' },
  { instrumentId: 'MSFT', kind: 'earnings', date: '2026-10-28', timing: 'After close' },
  { instrumentId: 'AAPL', kind: 'earnings', date: '2026-10-29', timing: 'After close' },
  { instrumentId: 'NVDA', kind: 'earnings', date: '2026-11-18', timing: 'After close' },
  { instrumentId: 'ASML', kind: 'earnings', date: '2027-01-27', timing: 'Before open' },
  { instrumentId: 'TSLA', kind: 'earnings', date: '2027-01-27', timing: 'After close' },
  { instrumentId: 'MSFT', kind: 'earnings', date: '2027-01-27', timing: 'After close' },
  { instrumentId: 'SAP', kind: 'earnings', date: '2027-01-28', timing: 'After close' },
  { instrumentId: 'AAPL', kind: 'earnings', date: '2027-01-28', timing: 'After close' },
  { instrumentId: 'NVDA', kind: 'earnings', date: '2027-02-24', timing: 'After close' },
];

/** Earnings dates plus a year of ex-dividend dates from the schedules. */
export const marketEvents: MarketEvent[] = [
  ...earnings,
  ...Object.entries(dividendSchedules).flatMap(([id, sch]) =>
    exDates(id, asOf, addDays(asOf, 365)).map((date): MarketEvent => ({ instrumentId: id, kind: 'exDividend', date, amount: sch.perShare })),
  ),
].sort((a, b) => a.date.localeCompare(b.date));
