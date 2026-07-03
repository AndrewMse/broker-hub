import { ActivityIndicator, View } from 'react-native';
import { color } from '@/theme/tokens';
import { Button } from './Button';
import { Text } from './Text';

export function Loading() {
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center' }}>
      <ActivityIndicator color={color.accent} />
    </View>
  );
}

export function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <View style={{ paddingVertical: 40, gap: 16, alignItems: 'center' }}>
      <Text variant="body" align="center">
        Couldn’t load {what}.
      </Text>
      <Text variant="secondary" tone="inkMuted" align="center">
        Check your connection, then try again.
      </Text>
      <Button label="Try again" kind="secondary" onPress={onRetry} style={{ paddingHorizontal: 28 }} />
    </View>
  );
}
