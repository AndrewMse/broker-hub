import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CountryRule, Currency } from '@/api/types';
import { storage } from '@/lib/storage';

export interface AlertPrefs {
  enabled: boolean;
  /** Uncovered, under-secured, in the money near expiry, early-assignment risk */
  assignment: boolean;
  /** Earnings and ex-dividend dates while you have a short option open */
  events: boolean;
  /** Two days before each expiry */
  expiry: boolean;
}

interface Settings {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  countryRule: CountryRule;
  setCountryRule: (r: CountryRule) => void;
  alerts: AlertPrefs;
  setAlerts: (a: AlertPrefs) => void;
}

const defaults = { currency: 'USD' as Currency, countryRule: 'issuer' as CountryRule, alerts: { enabled: false, assignment: true, events: true, expiry: true } };
const key = 'settings';

function load(): typeof defaults {
  try {
    const raw = storage.get(key);
    return raw ? { ...defaults, ...JSON.parse(raw), alerts: { ...defaults.alerts, ...JSON.parse(raw).alerts } } : defaults;
  } catch {
    return defaults;
  }
}

const SettingsContext = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(load);
  useEffect(() => {
    storage.set(key, JSON.stringify(state));
  }, [state]);
  const value = useMemo<Settings>(
    () => ({
      ...state,
      setCurrency: (currency) => setState((s) => ({ ...s, currency })),
      setCountryRule: (countryRule) => setState((s) => ({ ...s, countryRule })),
      setAlerts: (alerts) => setState((s) => ({ ...s, alerts })),
    }),
    [state],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
