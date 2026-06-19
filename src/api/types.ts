/**
 * Public contract between the app and the aggregation backend.
 * Today it is served by `src/mock-server`; a real backend only has to return the same shapes.
 */

export type BrokerId = 'etoro' | 'ibkr';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'RON';
export const displayCurrencies: Currency[] = ['USD', 'EUR', 'GBP', 'RON'];

export type AssetClass = 'index' | 'stock' | 'etf' | 'crypto' | 'forex' | 'commodity' | 'bond';

/** How a broker gives you exposure to an instrument. */
export type Form = 'share' | 'etf' | 'cfd' | 'future' | 'option' | 'crypto' | 'spot' | 'bond';

export type Feature = 'fractional' | 'shorting' | 'margin' | 'copyTrading';

export type Range = '1D' | '1W' | '1M' | '6M' | '1Y';
export const ranges: Range[] = ['1D', '1W', '1M', '6M', '1Y'];

export interface Broker {
  id: BrokerId;
  name: string;
  shortName: string;
  monogram: string;
  brandColor: string;
  accountCurrency: Currency;
  /** Where the broker entity you contract with is based; used by the broker-country tax rule */
  country: string;
  forms: Form[];
  features: Feature[];
}

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  currency: Currency;
  price: number;
  /** Day change as a fraction, 0.012 = +1.2% */
  change1D: number;
}

/** One way a broker lets you trade an instrument. */
export interface Availability {
  brokerId: BrokerId;
  instrumentId: string;
  form: Form;
  /** Ticker of the product actually traded, when it differs (SPY for S&P 500, ES for futures). */
  via?: string;
  unitLabel: string;
  /** Short plain-language cost summary, e.g. "No commission, spread 0.09%" */
  costNote: string;
  previewable: boolean;
}

export interface Holding {
  id: string;
  brokerId: BrokerId;
  form: Form;
  via?: string;
  quantity: number;
  unitLabel: string;
  valueBase: number;
  costBase: number;
  option?: OptionInfo;
}

export interface PositionGroup {
  instrument: Instrument;
  holdings: Holding[];
  valueBase: number;
  /** Total return since purchase, fraction */
  returnPct: number;
}

export interface BrokerSlice {
  broker: Broker;
  valueBase: number;
  share: number;
}

export interface Portfolio {
  currency: Currency;
  totalBase: number;
  cashBase: number;
  groups: PositionGroup[];
  cash: { brokerId: BrokerId; amount: number; currency: Currency; valueBase: number }[];
  byBroker: BrokerSlice[];
}

export interface MarketRow {
  instrument: Instrument;
  availability: Availability[];
}

export interface InstrumentDetail extends MarketRow {
  holdings: Holding[];
  brokers: Broker[];
}

export interface BrokerAccount {
  broker: Broker;
  currency: Currency;
  value: number;
  cash: number;
  valueBase: number;
  holdingsCount: number;
  instrumentsOffered: number;
  onlyHere: number;
}

export interface Series {
  t: number[];
  v: number[];
  volume: number[];
}

export type Side = 'buy' | 'sell';

export interface TradePreviewRequest {
  instrumentId: string;
  side: Side;
  amount: number;
  currency: Currency;
}

export interface TradeRoute {
  availability: Availability;
  broker: Broker;
  status: 'ok' | 'belowMinimum' | 'notPreviewable' | 'notHeld';
  quantity: number;
  fee: number;
  spreadPct: number;
  /** Total cost (fee + half spread) in the request currency, used for ranking */
  cost: number;
  /** For buy: quantity received. For sell: cash received, in request currency. */
  receive: number;
  cashAvailable: number;
  heldValue: number;
  minimumAmount?: number;
}

export interface TradePreview {
  instrument: Instrument;
  routes: TradeRoute[];
  bestIndex: number;
}

/* ---------- Options ---------- */

export type OptionRight = 'call' | 'put';

/** Position-level Greeks: already multiplied by quantity × contract size, sign included. */
export interface PositionGreeks {
  /** Share-equivalent delta: +100 means the position moves like 100 shares. */
  delta: number;
  /** Change in `delta` for a 1-unit move in the underlying. */
  gamma: number;
  /** Value change per calendar day, base currency. */
  theta: number;
  /** Value change per 1 point of implied volatility, base currency. */
  vega: number;
}

export interface OptionInfo {
  right: OptionRight;
  strike: number;
  /** ISO date, YYYY-MM-DD */
  expiry: string;
  multiplier: number;
  /** Currency of strike, mark and premium (the underlying's) */
  currency: Currency;
  daysToExpiry: number;
  /** Price per share, instrument currency */
  mark: number;
  /** Premium per share at open, instrument currency */
  openPrice: number;
  iv: number;
  /** Risk-neutral probability of finishing in the money */
  probItm: number;
  intrinsic: number;
  greeks: PositionGreeks;
}

export type StrategyKind = 'coveredCall' | 'cashSecuredPut' | 'uncoveredCall' | 'uncoveredPut' | 'long';

export type FlagSeverity = 'info' | 'warn' | 'high';

export interface RiskFlag {
  kind: 'itmNearExpiry' | 'exDividend' | 'earnings' | 'uncovered' | 'underSecured';
  severity: FlagSeverity;
  title: string;
  detail: string;
}

export interface OptionStrategy {
  id: string;
  kind: StrategyKind;
  broker: Broker;
  instrument: Instrument;
  leg: Holding & { option: OptionInfo };
  contracts: number;
  /** Covered calls: shares at the same broker backing this leg. */
  shares?: { covered: number; avgPrice: number };
  /** Cash-secured puts: cash set aside at the broker, base currency. */
  collateral?: { required: number; secured: number };
  /** Premium received at open, base currency */
  premium: number;
  /** Stock price at which the whole strategy breaks even, instrument currency */
  breakeven: number;
  /** Best case at expiry, base currency */
  maxProfit: number;
  /** Stock and option together right now, base currency */
  pnl: number;
  /** Premium as a fraction of the capital tied up, and the same annualized */
  yieldToExpiry: number;
  annualizedYield: number;
  /** How far the stock is from the strike, fraction. Positive = out of the money. */
  cushion: number;
  flags: RiskFlag[];
}

export interface OptionsBook {
  currency: Currency;
  strategies: OptionStrategy[];
  totals: {
    /** Stock-dollar exposure from all option legs */
    deltaDollars: number;
    theta: number;
    vega: number;
    premiumOpen: number;
    /** Shares and cash tied up backing short options */
    collateral: number;
    openPnl: number;
  };
}

/* ---------- Exposure ---------- */

export interface StockExposure {
  instrument: Instrument;
  sector: string;
  country: string;
  beta: number;
  /** Delta-adjusted value in base currency, split by how the exposure is held */
  shares: number;
  cfd: number;
  options: number;
  funds: number;
  total: number;
  /** Share of net liquidation value */
  share: number;
  /** Before options: shares + CFDs + funds */
  gross: number;
  viaFunds: { symbol: string; value: number }[];
}

export interface ExposureBucket {
  label: string;
  value: number;
  share: number;
}

export interface ConcentrationAlert {
  label: string;
  share: number;
  limit: number;
  /** portfolio: share of net liquidation value. stocks: share of stock exposure (sectors). */
  basis: 'portfolio' | 'stocks';
}

export interface Exposure {
  currency: Currency;
  netLiquidation: number;
  /** All equity exposure, delta-adjusted */
  equity: number;
  /** Equity exposure expressed as S&P 500 dollars */
  betaWeighted: number;
  /** Value change if the S&P 500 falls 1% */
  spxDown1: number;
  stocks: StockExposure[];
  /** Fund holdings outside the named stocks */
  otherEquity: number;
  nonEquity: number;
  /** Breakdown shares are of `equity`, not of the portfolio */
  bySector: ExposureBucket[];
  byCountry: ExposureBucket[];
  byCurrency: ExposureBucket[];
  alerts: ConcentrationAlert[];
  limits: { stock: number; sector: number };
}

/* ---------- Calendar ---------- */

export type EventKind = 'earnings' | 'exDividend';

export interface CalendarEvent {
  id: string;
  instrument: Instrument;
  kind: EventKind;
  date: string;
  daysAway: number;
  timing?: 'Before open' | 'After close';
  /** Dividend per share, instrument currency */
  amount?: number;
  held: boolean;
  /** For ex-dividend dates: shares you hold that qualify, and what they pay after withholding (base currency) */
  yourShares?: number;
  yourNet?: number;
  /** Short options on this stock that are still open on the event date */
  affects: { strategyId: string; label: string; note: string; severity: FlagSeverity }[];
}

/* ---------- Premium income ---------- */

export interface PremiumTrade {
  id: string;
  date: string;
  broker: Broker;
  instrument: Instrument;
  country: string;
  right: OptionRight;
  strike: number;
  expiry: string;
  contracts: number;
  side: 'sell' | 'buy';
  /** Net cash, base currency: positive received, negative paid (commission included) */
  net: number;
  outcome: 'open' | 'expired' | 'closed' | 'assigned';
}

export interface PremiumMonth {
  month: string;
  calls: number;
  puts: number;
}

export interface PremiumByStock {
  instrument: Instrument;
  net: number;
  trades: number;
  shares: number;
  avgPrice: number;
  /** Average price minus net premium per share, instrument currency */
  adjustedPrice: number;
}

export interface PremiumIncome {
  currency: Currency;
  thisMonth: number;
  ytd: number;
  last12m: number;
  avgMonth: number;
  /** Last 12 months of premium over the capital currently tied up by short options */
  yieldOnCapital: number;
  months: PremiumMonth[];
  byStock: PremiumByStock[];
  trades: PremiumTrade[];
}

/* ---------- Dividends ---------- */

export interface DividendPayment {
  id: string;
  broker: Broker;
  instrument: Instrument;
  exDate: string;
  payDate: string;
  shares: number;
  /** Instrument currency */
  perShare: number;
  country: string;
  /** Base currency */
  gross: number;
  withheld: number;
  net: number;
}

export interface DividendProjection {
  currency: Currency;
  gross: number;
  withheld: number;
  net: number;
  byStock: {
    instrument: Instrument;
    shares: number;
    frequency: 'quarterly' | 'semiannual' | 'annual';
    /** Instrument currency, per share, next 12 months */
    perShareAnnual: number;
    withholdingRate: number;
    gross: number;
    net: number;
    nextExDate?: string;
    /** Broker positions that pay it */
    brokerIds: BrokerId[];
  }[];
  /** Positions that don't pay: CFDs, accumulating funds */
  excluded: { instrument: Instrument; reason: string }[];
}

/* ---------- Wheel ---------- */

export type WheelStepKind =
  | 'putSold'
  | 'putExpired'
  | 'putClosed'
  | 'assigned'
  | 'sharesBought'
  | 'callSold'
  | 'callExpired'
  | 'callClosed'
  | 'calledAway'
  | 'dividend';

export interface WheelStep {
  id: string;
  date: string;
  kind: WheelStepKind;
  label: string;
  detail?: string;
  /** Cash effect in base currency, signed. Undefined for events with no cash. */
  amount?: number;
}

export type WheelPhase = 'puts' | 'shares' | 'completed';

export interface WheelCycle {
  id: string;
  instrument: Instrument;
  broker: Broker;
  startedBy: 'put' | 'shares';
  phase: WheelPhase;
  started: string;
  ended?: string;
  days: number;
  steps: WheelStep[];
  /** Capital at risk: strike × shares while selling puts, share cost while holding */
  capital: number;
  premium: number;
  /** Realized when called away, otherwise the current unrealized gain on the shares */
  capitalGain: number;
  dividends: number;
  total: number;
  /** Put-started cycles: total return on capital. Shares-started: premium and dividends only, since the share gain predates the cycle. */
  annualized: number;
  /** While holding shares */
  shares?: { quantity: number; costPerShare: number; adjustedCostPerShare: number; openCall?: { strike: number; expiry: string } };
  /** While selling puts */
  openPut?: { strike: number; expiry: string };
}

/* ---------- Tax ---------- */

export type CountryRule = 'issuer' | 'broker';

export interface StockTrade {
  id: string;
  broker: Broker;
  instrument: Instrument;
  form: Form;
  quantity: number;
  openDate: string;
  openPrice: number;
  closeDate: string;
  closePrice: number;
  /** Base currency, commissions on both legs */
  fees: number;
  /** Premium folded in from an assigned option, base currency */
  premiumAdjustment: number;
  /** Net gain after fees and adjustments, base currency */
  gain: number;
  country: string;
  openedByAssignment: boolean;
  closedByAssignment: boolean;
}

export interface TaxCountry {
  country: string;
  /** Sum of positive results (stock lots + expired/closed option premium) */
  gains: number;
  losses: number;
  net: number;
  /** Losses from earlier years still available */
  carriedIn: number;
  taxable: number;
  tax: number;
  /** Losses to carry into next year */
  carriedOut: number;
  /** Of which, option premium */
  premium: number;
  trades: number;
  dividends: { gross: number; withheld: number; tax: number; credit: number; due: number };
}

export interface CassTier {
  multiple: number;
  /** Base currency */
  threshold: number;
  contribution: number;
}

export interface TaxYear {
  year: number;
  currency: Currency;
  rule: CountryRule;
  complete: boolean;
  countries: TaxCountry[];
  totals: { net: number; taxable: number; tax: number; dividendsGross: number; dividendTaxDue: number; carriedOut: number };
  cass: {
    /** Capital gains net + dividends gross + premium: what counts toward the thresholds */
    income: number;
    minimumWage: number;
    tiers: CassTier[];
    /** Index into tiers of the tier reached, or -1 */
    reached: number;
  };
  rates: { capitalGains: number; dividends: number; cass: number };
  trades: StockTrade[];
  optionTrades: PremiumTrade[];
  dividends: DividendPayment[];
  notes: string[];
}
