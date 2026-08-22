import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { Range, Series } from '@/api/types';
import { color, radius } from '@/theme/tokens';
import { Text } from './Text';

interface Props {
  series?: Series;
  range: Range;
  height?: number;
  /** Formats the change between the first point and the selected point. */
  formatDelta: (delta: number) => string;
}

const BAR_PITCH = 4.5;
const GLOW_SPAN = 0.2; // share of the width that lights up around the selected point

/**
 * The signature element: a dense field of thin volume bars with a line on top,
 * lighting up around the point under your finger.
 */
export function BarFieldChart({ series, range, height = 230, formatDelta }: Props) {
  const [width, setWidth] = useState(0);
  const [originX, setOriginX] = useState(0);
  // Selection belongs to one series; a new range or instrument falls back to the latest point
  const [selection, setSelection] = useState<{ series: Series; index: number } | null>(null);
  const container = useRef<View>(null);
  const touchStart = useRef({ x: 0, y: 0 });

  const n = series?.v.length ?? 0;
  const selected = selection && selection.series === series ? selection.index : n - 1;

  const geo = useMemo(() => {
    if (!series || !width) return null;
    const min = Math.min(...series.v);
    const max = Math.max(...series.v);
    const span = max - min || 1;
    const top = height * 0.26;
    const bottom = height * 0.8;
    const x = (i: number) => (i / (n - 1)) * width;
    const y = (v: number) => bottom - ((v - min) / span) * (bottom - top);
    const pts = series.v.map((v, i) => [x(i), y(v)] as const);

    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
    }

    const bars = Math.floor(width / BAR_PITCH);
    const barData = Array.from({ length: bars }, (_, b) => {
      const f = (b / (bars - 1)) * (n - 1);
      const i0 = Math.floor(f);
      const i1 = Math.min(n - 1, i0 + 1);
      const vol = series.volume[i0] + (series.volume[i1] - series.volume[i0]) * (f - i0);
      // Deterministic jitter keeps the field dense and uneven, like the reference
      const jitter = ((Math.sin(b * 12.9898) * 43758.5453) % 1 + 1) % 1;
      return { x: b * BAR_PITCH + 1, h: height * (0.28 + Math.min(1, vol) * 0.42 + jitter * 0.22) };
    });
    return { pts, d, barData, x, y };
  }, [series, width, height, n]);

  function pick(pageX: number) {
    if (!series || !width || n < 2) return;
    const i = Math.max(0, Math.min(n - 1, Math.round(((pageX - originX) / width) * (n - 1))));
    if (i !== selected) {
      Haptics.selectionAsync();
      setSelection({ series, index: i });
    }
  }

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
    container.current?.measureInWindow((x) => setOriginX(x));
  };

  const ax = geo ? geo.pts[selected][0] : 0;
  const ay = geo ? geo.pts[selected][1] : 0;
  const delta = series ? series.v[selected] - series.v[0] : 0;
  const tooltipW = 104;
  const tooltipLeft = Math.max(0, Math.min(width - tooltipW, ax - tooltipW - 14 < 0 ? ax + 14 : ax - tooltipW - 14));

  const labels = series ? axisLabels(series.t, range) : [];

  return (
    <View>
      <View
        ref={container}
        onLayout={onLayout}
        style={{ height }}
        onTouchStart={(e) => (touchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
        onMoveShouldSetResponder={(e) => {
          // Claim horizontal drags only, so vertical scrolling still works over the chart
          const dx = Math.abs(e.nativeEvent.pageX - touchStart.current.x);
          const dy = Math.abs(e.nativeEvent.pageY - touchStart.current.y);
          return dx > 6 && dx > dy;
        }}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => pick(e.nativeEvent.pageX)}
        onResponderMove={(e) => pick(e.nativeEvent.pageX)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={series ? `Chart. Change over ${range}: ${formatDelta(series.v[n - 1] - series.v[0])}` : 'Chart loading'}
      >
        {geo && (
          <Svg width={width} height={height}>
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor={color.accent} stopOpacity={0.28} />
                <Stop offset="0.55" stopColor={color.violet} stopOpacity={0.12} />
                <Stop offset="1" stopColor={color.violet} stopOpacity={0} />
              </RadialGradient>
              <LinearGradient id="line" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={color.accent} stopOpacity={0.25} />
                <Stop offset="0.35" stopColor={color.accent} stopOpacity={0.85} />
                <Stop offset="1" stopColor={color.accent} stopOpacity={1} />
              </LinearGradient>
            </Defs>

            <Ellipse cx={ax} cy={height * 0.72} rx={width * 0.32} ry={height * 0.5} fill="url(#glow)" />

            {geo.barData.map((b, i) => {
              const dist = Math.abs(b.x - ax) / (width * GLOW_SPAN);
              const lit = dist < 1;
              const strength = lit ? 1 - dist : 0;
              const h = Math.min(height * 0.96, b.h + strength * height * 0.12);
              return (
                <Rect
                  key={i}
                  x={b.x}
                  y={height - h}
                  width={1.4}
                  height={h}
                  fill={lit ? color.accent : color.accentMid}
                  opacity={lit ? 0.25 + strength * 0.65 : 0.22}
                />
              );
            })}

            <Path d={geo.d} stroke="url(#line)" strokeWidth={2.5} fill="none" strokeLinecap="round" />

            <Circle cx={ax} cy={ay} r={16} fill={color.accent} opacity={0.16} />
            <Circle cx={ax} cy={ay} r={6.5} fill={color.surface} stroke={color.accent} strokeWidth={3} />
          </Svg>
        )}

        {geo && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: tooltipLeft,
              top: Math.max(0, ay - 17),
              width: tooltipW,
              paddingVertical: 6,
              borderRadius: radius.control,
              backgroundColor: 'rgba(255,255,255,0.92)',
              borderWidth: 1,
              borderColor: color.line,
              alignItems: 'center',
            }}
          >
            <Text variant="secondary" weight="medium" numberOfLines={1} adjustsFontSizeToFit>
              {formatDelta(delta)}
            </Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        {labels.map((l, i) => (
          <Text key={i} variant="small" tone="inkMuted">
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

function axisLabels(t: number[], range: Range): string[] {
  const picks = [0, 0.33, 0.66, 1].map((f) => t[Math.round(f * (t.length - 1))]);
  const fmt: Intl.DateTimeFormatOptions =
    range === '1D'
      ? { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }
      : range === '1W'
        ? { weekday: 'short', timeZone: 'UTC' }
        : range === '1M'
          ? { month: 'short', day: 'numeric', timeZone: 'UTC' }
          : { month: 'short', year: '2-digit', timeZone: 'UTC' };
  const f = new Intl.DateTimeFormat('en-US', fmt);
  return picks.map((x) => f.format(new Date(x)));
}
