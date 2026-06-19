import type { TextStyle } from 'react-native';
import type { Form } from '@/api/types';

export const color = {
  canvas: '#EDEDF0',
  surface: '#FFFFFF',
  sunken: '#F5F5F7',
  line: '#E4E4E9',
  ink: '#16171B',
  inkMuted: '#80828C',
  accent: '#6C7FF2',
  accentSoft: '#E7EAFE',
  accentMid: '#B9C2F9',
  violet: '#B49CF4',
  gain: '#159A86',
  loss: '#E04F5F',
} as const;

/** Pill colors encode the form of exposure, nothing else. */
export const formPalette: Record<Form, { bg: string; fg: string }> = {
  share: { bg: '#DDF4F4', fg: '#12838A' },
  etf: { bg: color.accentSoft, fg: '#4F63DB' },
  cfd: { bg: '#FDE8EA', fg: '#D9475A' },
  future: { bg: '#F0EBFE', fg: '#7A5CE0' },
  option: { bg: '#F0EBFE', fg: '#7A5CE0' },
  crypto: { bg: '#FDF1DC', fg: '#B7791F' },
  spot: { bg: color.sunken, fg: '#5B5E68' },
  bond: { bg: color.sunken, fg: '#5B5E68' },
};

/** Risk flags: info is neutral, warn is amber, high reuses the loss red. */
export const flagPalette = {
  info: { bg: color.sunken, fg: '#5B5E68', dot: color.inkMuted },
  warn: { bg: '#FDF1DC', fg: '#9A6415', dot: '#D8962B' },
  high: { bg: '#FDE8EA', fg: '#C23A4D', dot: color.loss },
} as const;

export const radius = { sheet: 28, panel: 20, row: 14, control: 12, round: 999 } as const;
export const space = { gutter: 16, xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;

export const font = {
  light: 'HankenGrotesk_300Light',
  regular: 'HankenGrotesk_400Regular',
  medium: 'HankenGrotesk_500Medium',
  semibold: 'HankenGrotesk_600SemiBold',
} as const;

export const type = {
  hero: { fontFamily: font.light, fontSize: 44, lineHeight: 50, letterSpacing: -1.5 },
  value: { fontFamily: font.light, fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  title: { fontFamily: font.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  body: { fontFamily: font.medium, fontSize: 16, lineHeight: 22 },
  secondary: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  small: { fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
