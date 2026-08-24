import { router } from 'expo-router';
import { useState } from 'react';
import { LayoutAnimation, Pressable, View } from 'react-native';
import type { Broker, BrokerId, Currency, PositionGroup } from '@/api/types';
import { money, percent } from '@/lib/format';
import { color, radius } from '@/theme/tokens';
import { InstrumentAvatar } from './Avatar';
import { BrokerDisc } from './BrokerDisc';
import { HoldingLine } from './HoldingLine';
import { Icon } from './Icon';
import { FormPill } from './Pill';
import { Text } from './Text';

interface Props {
  group: PositionGroup;
  brokers: Map<BrokerId, Broker>;
  currency: Currency;
}

/**
 * One row per instrument. Held at several brokers → the chevron expands the per-broker split.
 * Tapping the rest of the row opens the instrument.
 */
export function PositionGroupRow({ group, brokers, currency }: Props) {
  const [open, setOpen] = useState(false);
  const { instrument, holdings } = group;
  const brokerIds = [...new Set(holdings.map((h) => h.brokerId))];
  const multi = holdings.length > 1;
  const single = holdings[0];

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setOpen((o) => !o);
  };

  return (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.row, borderWidth: 1, borderColor: color.line, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${instrument.name}, ${money(group.valueBase, currency)}`}
          onPress={() => router.push({ pathname: '/instrument/[id]', params: { id: instrument.id } })}
          style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingRight: multi ? 4 : 14, opacity: pressed ? 0.7 : 1 })}
        >
          <InstrumentAvatar instrument={instrument} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text variant="body" numberOfLines={1}>
              {instrument.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ flexDirection: 'row' }}>
                {brokerIds.map((id, i) => (
                  <View key={id} style={{ marginLeft: i ? -5 : 0 }}>
                    <BrokerDisc broker={brokers.get(id)!} />
                  </View>
                ))}
              </View>
              {multi ? (
                <Text variant="small" tone="inkMuted">
                  {brokerIds.length > 1 ? `${brokerIds.length} brokers` : `${holdings.length} holdings`}
                </Text>
              ) : (
                <FormPill form={single.form} via={single.via} />
              )}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 5 }}>
            <Text variant="body">{money(group.valueBase, currency)}</Text>
            <Text variant="small" tone={group.returnPct >= 0 ? 'gain' : 'loss'}>
              {percent(group.returnPct)}
            </Text>
          </View>
        </Pressable>
        {multi && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={open ? 'Hide broker split' : 'Show broker split'}
            accessibilityState={{ expanded: open }}
            onPress={toggle}
            hitSlop={8}
            style={{ paddingHorizontal: 12, alignSelf: 'stretch', justifyContent: 'center' }}
          >
            <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
              <Icon name="chevron-down" size={18} tint={color.inkMuted} />
            </View>
          </Pressable>
        )}
      </View>

      {multi && open && (
        <View style={{ backgroundColor: color.sunken, borderTopWidth: 1, borderTopColor: color.line, paddingHorizontal: 14, paddingVertical: 4 }}>
          {holdings.map((h) => (
            <HoldingLine key={h.id} holding={h} broker={brokers.get(h.brokerId)!} currency={currency} />
          ))}
        </View>
      )}
    </View>
  );
}
