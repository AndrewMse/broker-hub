import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { color, radius } from '@/theme/tokens';
import { Text } from './Text';

/** White rounded panel used for grouped content. */
export function Panel({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ backgroundColor: color.surface, borderRadius: radius.panel, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, paddingVertical: 4 }, style]}>
      {children}
    </View>
  );
}

/** Title row plus a panel. `aside` sits right of the title; `bare` skips the panel. */
export function Section({ title, aside, bare, children }: { title: string; aside?: ReactNode; bare?: boolean; children: ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {typeof aside === 'string' ? (
          <Text variant="secondary" tone="inkMuted">
            {aside}
          </Text>
        ) : (
          aside
        )}
      </View>
      {bare ? children : <Panel>{children}</Panel>}
    </View>
  );
}
