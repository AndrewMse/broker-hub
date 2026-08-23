import { View } from 'react-native';
import type { Broker, Currency, Holding } from '@/api/types';
import { money, optionLabel, quantity } from '@/lib/format';
import { BrokerDisc } from './BrokerDisc';
import { FormPill } from './Pill';
import { Text } from './Text';

/** One broker's slice of a position: broker, amount, form, value. */
export function HoldingLine({ holding, broker, currency }: { holding: Holding; broker: Broker; currency: Currency }) {
  const pnl = holding.valueBase - holding.costBase;
  const o = holding.option;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 }}>
      <BrokerDisc broker={broker} size={22} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="secondary" weight="medium">
          {broker.shortName}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="small" tone="inkMuted">
            {o
              ? `${holding.quantity < 0 ? 'Short' : 'Long'} ${Math.abs(holding.quantity)} × ${optionLabel(o, o.currency)}`
              : quantity(Math.abs(holding.quantity), holding.unitLabel)}
          </Text>
          <FormPill form={holding.form} via={holding.via} />
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text variant="secondary" weight="medium">
          {money(holding.valueBase, currency)}
        </Text>
        <Text variant="small" tone={pnl >= 0 ? 'gain' : 'loss'}>
          {money(pnl, currency, { sign: true })}
        </Text>
      </View>
    </View>
  );
}
