import { Text as RNText, type TextProps } from 'react-native';
import { color, font, type, type TypeVariant } from '@/theme/tokens';

interface Props extends TextProps {
  variant?: TypeVariant;
  tone?: keyof typeof color | (string & {});
  weight?: keyof typeof font;
  align?: 'left' | 'right' | 'center';
}

export function Text({ variant = 'body', tone = 'ink', weight, align, style, ...rest }: Props) {
  const c = tone in color ? color[tone as keyof typeof color] : tone;
  return (
    <RNText
      {...rest}
      style={[
        type[variant],
        { color: c, fontVariant: ['tabular-nums'] },
        weight && { fontFamily: font[weight] },
        align && { textAlign: align },
        style,
      ]}
    />
  );
}
