import * as Haptics from 'expo-haptics';
import { Pressable, View, type ViewStyle } from 'react-native';
import { color, radius } from '@/theme/tokens';
import { Text } from './Text';

interface Props<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
  style?: ViewStyle;
}

export function Segmented<T extends string>({ options, value, onChange, labels, style }: Props<T>) {
  return (
    <View
      accessibilityRole="tablist"
      style={[{ flexDirection: 'row', backgroundColor: color.sunken, borderRadius: radius.control, padding: 3, borderWidth: 1, borderColor: color.line }, style]}
    >
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) Haptics.selectionAsync();
              onChange(o);
            }}
            style={{
              flex: 1,
              paddingVertical: 7,
              borderRadius: radius.control - 3,
              alignItems: 'center',
              backgroundColor: active ? color.surface : 'transparent',
              borderWidth: 1,
              borderColor: active ? color.line : 'transparent',
            }}
          >
            <Text variant="secondary" weight={active ? 'semibold' : 'regular'} tone={active ? 'ink' : 'inkMuted'}>
              {labels?.[o] ?? o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
