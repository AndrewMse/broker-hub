import { Pressable, type ViewStyle } from 'react-native';
import { color, radius } from '@/theme/tokens';
import { Text } from './Text';

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: 54,
          borderRadius: radius.round,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primary ? color.accent : color.surface,
          borderWidth: primary ? 0 : 1,
          borderColor: color.line,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text variant="body" weight="semibold" tone={primary ? '#FFFFFF' : 'ink'}>
        {label}
      </Text>
    </Pressable>
  );
}
