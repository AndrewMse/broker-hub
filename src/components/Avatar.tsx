import { View } from 'react-native';
import type { Instrument } from '@/api/types';
import { color, font } from '@/theme/tokens';
import { Text } from './Text';

export function InstrumentAvatar({ instrument, size = 38 }: { instrument: Instrument; size?: number }) {
  // Tickers up to four letters fit whole (AAPL, VWCE); longer symbols like EURUSD shorten to two
  const clean = instrument.symbol.replace(/[^A-Z0-9]/g, '');
  const letters = clean.length > 4 ? clean.slice(0, 2) : clean;
  const fontSize = (letters.length > 3 ? 9.5 : letters.length > 2 ? 10.5 : 12.5) * (size / 38);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color.sunken,
        borderWidth: 1,
        borderColor: color.line,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: font.semibold, fontSize, color: color.ink, letterSpacing: -0.2 }}>{letters}</Text>
    </View>
  );
}
