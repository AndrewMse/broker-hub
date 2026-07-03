import type { Currency, Form } from '@/api/types';

const moneyCache = new Map<string, Intl.NumberFormat>();

export function money(value: number, currency: Currency, opts: { decimals?: number; sign?: boolean } = {}) {
  const decimals = opts.decimals ?? (Math.abs(value) >= 100_000 ? 0 : 2);
  const key = `${currency}:${decimals}:${opts.sign}`;
  let f = moneyCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      signDisplay: opts.sign ? 'exceptZero' : 'auto',
    });
    moneyCache.set(key, f);
  }
  return f.format(value);
}

export function percent(fraction: number, decimals = 1) {
  const v = (fraction * 100).toFixed(decimals);
  return fraction > 0 ? `+${v}%` : fraction < 0 ? `−${v.replace('-', '')}%` : `${v}%`;
}

export function number(value: number, maxDecimals = 2) {
  const decimals = Math.abs(value) >= 1000 ? Math.min(maxDecimals, 2) : Math.abs(value) < 1 ? Math.max(maxDecimals, 4) : maxDecimals;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(value);
}

export function price(value: number, currency: Currency) {
  if (value < 10) return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 4 }).format(value);
  return money(value, currency);
}

export function quantity(q: number, unit: string) {
  return `${number(q, 4)} ${unit}`;
}

export const formLabel: Record<Form, string> = {
  share: 'Share',
  etf: 'ETF',
  cfd: 'CFD',
  future: 'Future',
  option: 'Option',
  crypto: 'Crypto',
  spot: 'Spot',
  bond: 'Bond',
};

/** "17 Oct", or "17 Oct 2027" outside the current year of the mock data. */
export function shortDate(iso: string, withYear = false) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: withYear ? 'numeric' : undefined,
    timeZone: 'UTC',
  });
}

export function monthLabel(yyyyMm: string) {
  return new Date(`${yyyyMm}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
}

/** "$250 call · 2 Oct" */
export function optionLabel(o: { right: 'call' | 'put'; strike: number; expiry: string }, currency: Currency) {
  const strike = Number.isInteger(o.strike) ? money(o.strike, currency, { decimals: 0 }) : price(o.strike, currency);
  return `${strike} ${o.right} · ${shortDate(o.expiry)}`;
}

/** "$12.4k", "$1.2M" for tight spaces. Hermes has no `notation: 'compact'`, so it's done by hand. */
export function compactMoney(value: number, currency: Currency) {
  const abs = Math.abs(value);
  const [div, suffix] = abs >= 1e6 ? [1e6, 'M'] : abs >= 1e3 ? [1e3, 'k'] : [1, ''];
  const scaled = value / div;
  const decimals = !suffix ? 0 : Math.abs(scaled) >= 100 ? 0 : 1;
  return `${money(scaled, currency, { decimals })}${suffix}`;
}

export function days(n: number) {
  return n === 0 ? 'today' : n === 1 ? '1 day' : `${n} days`;
}
