import Svg, { Circle, Path } from 'react-native-svg';
import { color } from '@/theme/tokens';

export type IconName =
  | 'overview'
  | 'markets'
  | 'brokers'
  | 'settings'
  | 'chevron-down'
  | 'chevron-right'
  | 'swap'
  | 'check'
  | 'search'
  | 'exposure'
  | 'options'
  | 'calendar';

export function Icon({ name, size = 22, tint = color.ink, strokeWidth = 1.75 }: { name: IconName; size?: number; tint?: string; strokeWidth?: number }) {
  const p = { stroke: tint, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'overview' && (
        <>
          <Path d="M4 19V11M9 19V5M14 19v-6M19 19V8" {...p} />
        </>
      )}
      {name === 'markets' && (
        <>
          <Path d="M3 17l5-5 4 3 8-8" {...p} />
          <Path d="M15 7h5v5" {...p} />
        </>
      )}
      {name === 'brokers' && (
        <>
          <Circle cx="8" cy="12" r="5" {...p} />
          <Circle cx="16" cy="12" r="5" {...p} />
        </>
      )}
      {name === 'settings' && (
        <>
          <Circle cx="12" cy="12" r="3" {...p} />
          <Path
            d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"
            {...p}
          />
        </>
      )}
      {name === 'exposure' && (
        <>
          <Path d="M12 3a9 9 0 109 9h-9z" {...p} />
          <Path d="M15 3.5A9 9 0 0120.5 9H15z" {...p} />
        </>
      )}
      {name === 'options' && (
        <>
          <Path d="M12 4l8 4-8 4-8-4z" {...p} />
          <Path d="M4 12l8 4 8-4M4 16l8 4 8-4" {...p} />
        </>
      )}
      {name === 'calendar' && (
        <>
          <Path d="M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1zM4 10h16M8 4v4M16 4v4" {...p} />
        </>
      )}
      {name === 'chevron-down' && <Path d="M6 9l6 6 6-6" {...p} />}
      {name === 'chevron-right' && <Path d="M9 6l6 6-6 6" {...p} />}
      {name === 'swap' && <Path d="M8 4v16M8 20l-3-3M8 20l3-3M16 20V4M16 4l-3 3M16 4l3 3" {...p} />}
      {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 7.5" {...p} />}
      {name === 'search' && (
        <>
          <Circle cx="11" cy="11" r="6.5" {...p} />
          <Path d="M20 20l-4.2-4.2" {...p} />
        </>
      )}
    </Svg>
  );
}
