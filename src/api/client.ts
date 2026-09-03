import { getDividendProjection } from '@/mock-server/dividends';
import { getExposure } from '@/mock-server/exposure';
import { getCalendar, getOptionsBook, getPremiumIncome } from '@/mock-server/options';
import * as server from '@/mock-server/server';
import { getTaxYear } from '@/mock-server/tax';
import { getWheels } from '@/mock-server/wheel';
import type {
  BrokerAccount,
  CalendarEvent,
  CountryRule,
  Currency,
  DividendProjection,
  Exposure,
  InstrumentDetail,
  MarketRow,
  OptionsBook,
  Portfolio,
  PremiumIncome,
  TaxYear,
  WheelCycle,
  Range,
  Series,
  TradePreview,
  TradePreviewRequest,
} from './types';

/**
 * The only thing screens talk to. Backed by the in-app mock server for now;
 * replace each method with a `fetch` to the real aggregation API later.
 */
export const api = {
  portfolio: (currency: Currency): Promise<Portfolio> => server.getPortfolio(currency),
  markets: (): Promise<MarketRow[]> => server.getMarkets(),
  instrument: (id: string, currency: Currency): Promise<InstrumentDetail> => server.getInstrument(id, currency),
  brokers: (currency: Currency): Promise<BrokerAccount[]> => server.getBrokerAccounts(currency),
  history: (key: string, range: Range, currency: Currency): Promise<Series> => server.getHistory(key, range, currency),
  previewTrade: (req: TradePreviewRequest): Promise<TradePreview> => server.previewTrade(req),
  exposure: (currency: Currency): Promise<Exposure> => getExposure(currency),
  options: (currency: Currency): Promise<OptionsBook> => getOptionsBook(currency),
  premiumIncome: (currency: Currency): Promise<PremiumIncome> => getPremiumIncome(currency),
  calendar: (currency: Currency): Promise<CalendarEvent[]> => getCalendar(currency),
  wheels: (currency: Currency): Promise<WheelCycle[]> => getWheels(currency),
  dividendProjection: (currency: Currency): Promise<DividendProjection> => getDividendProjection(currency),
  taxYear: (currency: Currency, year: number, rule: CountryRule): Promise<TaxYear> => getTaxYear(currency, year, rule),
};
