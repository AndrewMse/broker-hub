import { View } from 'react-native';
import type { Form } from '@/api/types';
import { formLabel } from '@/lib/format';
import { formPalette, radius } from '@/theme/tokens';
import { Text } from './Text';

/** Shows how exposure is held: Share, ETF, CFD, Future… Optional `via` names the traded product. */
export function FormPill({ form, via }: { form: Form; via?: string }) {
  const c = formPalette[form];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: radius.round, paddingHorizontal: 9, paddingVertical: 3 }}>
      <Text variant="small" tone={c.fg}>
        {via ? `${formLabel[form]} ${via}` : formLabel[form]}
      </Text>
    </View>
  );
}
