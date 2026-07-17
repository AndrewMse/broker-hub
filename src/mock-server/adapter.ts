import type { Availability, Broker, Currency, Form, OptionRight, Side } from '@/api/types';

/** A position as each adapter normalizes it. Values are in the instrument's currency. */
export interface NormalizedPosition {
  id: string;
  brokerId: Broker['id'];
  instrumentId: string;
  form: Form;
  via?: string;
  quantity: number;
  unitLabel: string;
  avgPrice: number;
  /** Units of the underlying per unit held (bond face/100, future contract size). */
  multiplier: number;
  /** Set for option positions. `instrumentId` is then the underlying and `avgPrice` the premium per share. */
  option?: { right: OptionRight; strike: number; expiry: string };
}

/** A closed stock/ETF/CFD lot from the broker's history: what tax and the wheel tracker work from. */
export interface NormalizedStockTrade {
  id: string;
  brokerId: Broker['id'];
  instrumentId: string;
  form: Form;
  quantity: number;
  openDate: string;
  /** Instrument currency */
  openPrice: number;
  closeDate: string;
  closePrice: number;
  /** Instrument currency, both legs */
  fees: number;
  /** Option trade ids when a leg came from an assignment */
  openedBy?: string;
  closedBy?: string;
}

export interface NormalizedDividend {
  id: string;
  brokerId: Broker['id'];
  instrumentId: string;
  exDate: string;
  payDate: string;
  shares: number;
  perShare: number;
  /** Instrument currency */
  gross: number;
  withheld: number;
}

/** One option fill from the broker's trade history, used for the premium income tracker. */
export interface NormalizedOptionTrade {
  id: string;
  brokerId: Broker['id'];
  instrumentId: string;
  date: string;
  right: OptionRight;
  strike: number;
  expiry: string;
  contracts: number;
  side: 'sell' | 'buy';
  /** Per share, instrument currency */
  price: number;
  multiplier: number;
  /** Instrument currency */
  commission: number;
  outcome: 'open' | 'expired' | 'closed' | 'assigned';
}

export interface NormalizedAccount {
  currency: Currency;
  cash: number;
}

export interface QuoteInput {
  availability: Availability;
  side: Side;
  /** Order size in USD */
  notionalUsd: number;
  /** Price of one traded unit in USD */
  unitPriceUsd: number;
  quantity: number;
}

export interface Pricing {
  /** Price of the traded product in the instrument currency, and its contract size. */
  multiplier: number;
  wholeUnits: boolean;
  /** Instrument id whose price is used, when trading a proxy (SPY for S&P 500). */
  priceFrom?: string;
}

export interface QuoteResult {
  feeUsd: number;
  spreadPct: number;
}

/**
 * Every broker integration implements this. Raw broker payloads never leave the adapter.
 * Adding XTB, Trading 212 or Revolut later means writing one more of these.
 */
export interface BrokerAdapter {
  broker: Broker;
  fetchAccount(): Promise<NormalizedAccount>;
  fetchPositions(): Promise<NormalizedPosition[]>;
  fetchCatalog(): Promise<Availability[]>;
  fetchStockTrades(): Promise<NormalizedStockTrade[]>;
  fetchDividends(): Promise<NormalizedDividend[]>;
  /** Only brokers that offer options implement this. */
  fetchOptionTrades?(): Promise<NormalizedOptionTrade[]>;
  pricing(availability: Availability): Pricing;
  quote(input: QuoteInput): QuoteResult;
}
