import { Pressable } from 'react-native';
import { color } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';

export function IconButton({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: pressed ? color.sunken : color.surface,
        borderWidth: 1,
        borderColor: color.line,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Icon name={icon} size={20} />
    </Pressable>
  );
}
