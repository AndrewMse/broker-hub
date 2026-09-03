import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSettings } from '@/state/settings';
import { api } from './client';
import type { Range, Side } from './types';

export function usePortfolio() {
  const { currency } = useSettings();
  return useQuery({ queryKey: ['portfolio', currency], queryFn: () => api.portfolio(currency) });
}

export function useMarkets() {
  return useQuery({ queryKey: ['markets'], queryFn: api.markets });
}

export function useInstrument(id: string) {
  const { currency } = useSettings();
  return useQuery({ queryKey: ['instrument', id, currency], queryFn: () => api.instrument(id, currency) });
}

export function useBrokerAccounts() {
  const { currency } = useSettings();
  return useQuery({ queryKey: ['brokers', currency], queryFn: () => api.brokers(currency) });
}

export function useHistory(key: string, range: Range) {
  const { currency } = useSettings();
  return useQuery({
    queryKey: ['history', key, range, currency],
    queryFn: () => api.history(key, range, currency),
    placeholderData: keepPreviousData,
  });
}

export function useTradePreview(instrumentId: string, side: Side, amount: number) {
  const { currency } = useSettings();
  return useQuery({
    queryKey: ['preview', instrumentId, side, amount, currency],
    queryFn: () => api.previewTrade({ instrumentId, side, amount, currency }),
    enabled: amount > 0,
    placeholderData: keepPreviousData,
  });
}

export function useExposure() {
  const { currency } = useSettings();
  return useQuery({ queryKey: ['exposure', currency], queryFn: () => api.exposure(currency) });
}

export function useOptionsBook() {
  const { currency } = useSettings();
  return useQuery({ queryKey: ['options', currency], queryFn: () => api.options(currency) });
}

export function usePremiumIncome() {
  const { currency } = useSettings();
  return useQuery({ queryKey: ['premium', currency], queryFn: () => api.premiumIncome(currency) });
}

export function useCalendar() {
  const { currency } = useSettings();
  return useQuery({ queryKey: ['calendar', currency], queryFn: () => api.calendar(currency) });
}

export function useWheels() {
  const { currency } = useSettings();
  return useQuery({ queryKey: ['wheels', currency], queryFn: () => api.wheels(currency) });
}

export function useDividendProjection() {
  const { currency } = useSettings();
  return useQuery({ queryKey: ['dividendProjection', currency], queryFn: () => api.dividendProjection(currency) });
}

export function useTaxYear(year: number) {
  const { currency, countryRule } = useSettings();
  return useQuery({
    queryKey: ['tax', year, currency, countryRule],
    queryFn: () => api.taxYear(currency, year, countryRule),
    placeholderData: keepPreviousData,
  });
}
