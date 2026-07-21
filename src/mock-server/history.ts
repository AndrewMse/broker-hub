import type { AssetClass, Range, Series } from '@/api/types';

const rangeSpec: Record<Range, { points: number; stepMs: number; volScale: number }> = {
  '1D': { points: 78, stepMs: 5 * 60_000, volScale: 0.15 },
  '1W': { points: 84, stepMs: 2 * 3_600_000, volScale: 0.35 },
  '1M': { points: 90, stepMs: 8 * 3_600_000, volScale: 0.7 },
  '6M': { points: 120, stepMs: 36 * 3_600_000, volScale: 1.6 },
  '1Y': { points: 120, stepMs: 73 * 3_600_000, volScale: 2.4 },
};

const classVol: Record<AssetClass | 'portfolio', number> = {
  index: 0.006, stock: 0.012, etf: 0.006, crypto: 0.022, forex: 0.002, commodity: 0.009, bond: 0.0015, portfolio: 0.007,
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic random walk that ends exactly at `last`.
 * `endChange` pins the change over the range so the headline figure matches the chart.
 */
export function makeSeries(key: string, range: Range, last: number, assetClass: AssetClass | 'portfolio', endChange?: number): Series {
  const { points, stepMs, volScale } = rangeSpec[range];
  const rand = mulberry32(hash(`${key}:${range}`));
  const vol = classVol[assetClass] * volScale * 2;

  const walk = [0];
  for (let i = 1; i < points; i++) walk.push(walk[i - 1] + (rand() - 0.495) * vol * 2);

  // Brownian bridge (zero at both ends) on top of a straight log-line from start to last
  const n = points - 1;
  const cap = classVol[assetClass] * volScale * 8;
  const drift = endChange !== undefined ? Math.log(1 + endChange) : Math.max(-cap, Math.min(cap, walk[n]));
  const shaped = walk.map((w, i) => {
    const bridge = w - walk[n] * (i / n);
    return last * Math.exp(-drift * (1 - i / n) + bridge);
  });

  // Volume clusters around moves, like the reference chart
  const volume = shaped.map((x, i) => {
    const move = i === 0 ? 0 : Math.abs(x - shaped[i - 1]) / x;
    return 0.25 + rand() * 0.45 + Math.min(1.2, move / (vol || 1)) * 0.5;
  });

  const now = Date.UTC(2026, 8, 24, 15, 30);
  const t = shaped.map((_, i) => now - (points - 1 - i) * stepMs);
  return { t, v: shaped, volume };
}
