import type { OptionRight } from '@/api/types';

/** Standard normal density and cumulative distribution (Abramowitz & Stegun 7.1.26). */
const pdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
function cdf(x: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

export interface BlackScholesInput {
  right: OptionRight;
  spot: number;
  strike: number;
  /** Years to expiry */
  t: number;
  iv: number;
  rate: number;
  dividendYield: number;
}

/** Per-share price and Greeks of one European option. Theta is per calendar day, vega per 1 vol point. */
export function blackScholes({ right, spot: s, strike: k, t, iv, rate: r, dividendYield: q }: BlackScholesInput) {
  const intrinsic = Math.max(0, right === 'call' ? s - k : k - s);
  if (t <= 0) {
    const itm = intrinsic > 0;
    return { price: intrinsic, delta: itm ? (right === 'call' ? 1 : -1) : 0, gamma: 0, theta: 0, vega: 0, probItm: itm ? 1 : 0, intrinsic };
  }
  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(s / k) + (r - q + (iv * iv) / 2) * t) / (iv * sqrtT);
  const d2 = d1 - iv * sqrtT;
  const dq = Math.exp(-q * t);
  const dr = Math.exp(-r * t);
  const decay = (-s * dq * pdf(d1) * iv) / (2 * sqrtT);

  const call = right === 'call';
  const price = call ? s * dq * cdf(d1) - k * dr * cdf(d2) : k * dr * cdf(-d2) - s * dq * cdf(-d1);
  const delta = call ? dq * cdf(d1) : dq * (cdf(d1) - 1);
  const thetaYear = call
    ? decay - r * k * dr * cdf(d2) + q * s * dq * cdf(d1)
    : decay + r * k * dr * cdf(-d2) - q * s * dq * cdf(-d1);

  return {
    price,
    delta,
    gamma: (dq * pdf(d1)) / (s * iv * sqrtT),
    theta: thetaYear / 365,
    vega: (s * dq * pdf(d1) * sqrtT) / 100,
    probItm: call ? cdf(d2) : cdf(-d2),
    intrinsic,
  };
}
