import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useDeferredValue, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTradePreview } from '@/api/queries';
import type { Side, TradeRoute } from '@/api/types';
import { InstrumentAvatar } from '@/components/Avatar';
import { BrokerDisc } from '@/components/BrokerDisc';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { FormPill } from '@/components/Pill';
import { Segmented } from '@/components/Segmented';
import { Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { formLabel, money, quantity } from '@/lib/format';
import { useSettings } from '@/state/settings';
import { color, font, radius, space } from '@/theme/tokens';

const sides = ['buy', 'sell'] as const;

export default function TradePreviewSheet() {
  const params = useLocalSearchParams<{ id: string; side?: Side }>();
  const insets = useSafeAreaInsets();
  const { currency } = useSettings();
  const [side, setSide] = useState<Side>(params.side === 'sell' ? 'sell' : 'buy');
  const [amountText, setAmountText] = useState('1000');
  const [picked, setPicked] = useState<number | null>(null);

  const amount = Number(amountText.replace(/,/g, '')) || 0;
  const preview = useTradePreview(params.id, side, useDeferredValue(amount));
  const p = preview.data;

  const index = picked !== null && p?.routes[picked]?.status === 'ok' ? picked : (p?.bestIndex ?? -1);
  const route: TradeRoute | undefined = p && index >= 0 ? p.routes[index] : undefined;

  // Switching side changes which routes work, so fall back to the cheapest one
  const changeSide = (s: Side) => {
    setSide(s);
    setPicked(null);
  };
  const flip = () => {
    Haptics.selectionAsync();
    changeSide(side === 'buy' ? 'sell' : 'buy');
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: space.gutter, paddingTop: 28, paddingBottom: insets.bottom + 24, gap: space.l }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text variant="title" accessibilityRole="header">
            Preview order
          </Text>
          <Text variant="secondary" tone="inkMuted">
            {p?.instrument.name ?? ' '}
          </Text>
        </View>
      </View>

      <Segmented options={sides} value={side} onChange={changeSide} labels={{ buy: 'Buy', sell: 'Sell' }} />

      {/* Two stacked cards with a swap disc between them, as in the reference */}
      <View>
        <View style={cardStyle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {p && <InstrumentAvatar instrument={p.instrument} size={32} />}
            <Text variant="body" weight="semibold" style={{ flex: 1 }}>
              {p?.instrument.symbol}
            </Text>
            <Text variant="secondary" tone="inkMuted">
              {side === 'buy' ? 'You buy' : 'You sell'}
            </Text>
          </View>
          <Text variant="value" numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 18 }}>
            {route ? quantity(route.quantity, route.availability.unitLabel) : '–'}
          </Text>
          {side === 'sell' && route && (
            <Text variant="small" tone="inkMuted">
              You hold {money(route.heldValue, currency)} here
            </Text>
          )}
        </View>

        <View style={{ height: 8 }} />

        <View style={cardStyle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="small" weight="semibold" tone="#FFFFFF">
                {currency}
              </Text>
            </View>
            <Text variant="body" weight="semibold" style={{ flex: 1 }}>
              {currency}
            </Text>
            <Text variant="secondary" tone="inkMuted">
              {side === 'buy' ? 'You spend' : 'Amount to sell'}
            </Text>
          </View>
          <TextInput
            value={amountText}
            onChangeText={(t) => setAmountText(t.replace(/[^0-9.,]/g, ''))}
            keyboardType="decimal-pad"
            accessibilityLabel={side === 'buy' ? `Amount to spend in ${currency}` : `Amount to sell in ${currency}`}
            selectionColor={color.accent}
            style={{ fontFamily: font.light, fontSize: 30, letterSpacing: -0.8, color: color.ink, marginTop: 14, padding: 0 }}
          />
          {side === 'buy' && route && (
            <Text variant="small" tone={amount > route.cashAvailable ? 'loss' : 'inkMuted'}>
              {amount > route.cashAvailable
                ? `More than the ${money(route.cashAvailable, currency)} cash at ${route.broker.shortName}`
                : `${money(route.cashAvailable, currency)} cash at ${route.broker.shortName}`}
            </Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={side === 'buy' ? 'Switch to sell' : 'Switch to buy'}
          onPress={flip}
          style={{
            position: 'absolute',
            alignSelf: 'center',
            top: '50%',
            marginTop: -20,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: color.surface,
            borderWidth: 4,
            borderColor: color.canvas,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="swap" size={18} />
        </Pressable>
      </View>

      <View style={{ gap: space.s }}>
        <Text variant="body" weight="semibold" accessibilityRole="header">
          Route
        </Text>
        {preview.isPending && amount > 0 && <Loading />}
        {amount <= 0 && (
          <Text variant="secondary" tone="inkMuted">
            Enter an amount to compare brokers.
          </Text>
        )}
        {p?.routes.map((r, i) => (
          <RouteRow key={`${r.broker.id}${r.availability.form}${r.availability.via ?? ''}`} route={r} selected={i === index} best={i === p.bestIndex} onPress={() => setPicked(i)} />
        ))}
      </View>

      {route && (
        <LinearGradient
          colors={['#F3F2FF', '#DCD5FB', '#A7B1F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: radius.panel, padding: 18, gap: 18, borderWidth: 1, borderColor: color.line }}
        >
          <View>
            <Text variant="secondary" tone="#4A4D5A">
              You will receive
            </Text>
            <Text variant="value" style={{ fontSize: 34, lineHeight: 40 }} numberOfLines={1} adjustsFontSizeToFit>
              {side === 'buy' ? quantity(route.receive, route.availability.unitLabel) : money(route.receive, currency)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: radius.row, padding: 12, gap: 8 }}>
            <Figure label="Estimated fee" value={money(route.fee, currency)} />
            <Figure label="Spread" value={`${(route.spreadPct * 100).toFixed(route.spreadPct < 0.001 ? 3 : 2)}%`} />
            <Figure label="Via" value={`${route.broker.shortName} ${formLabel[route.availability.form]}`} />
          </View>
        </LinearGradient>
      )}

      <Text variant="small" tone="inkMuted" align="center">
        Preview only. This version doesn’t send orders to your brokers.
      </Text>
      <Button label="Done" kind="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}

const cardStyle = {
  backgroundColor: color.surface,
  borderRadius: radius.panel,
  borderWidth: 1,
  borderColor: color.line,
  padding: 18,
  gap: 4,
} as const;

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="small" tone="#5B5E68">
        {label}
      </Text>
      <Text variant="secondary" weight="medium" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function RouteRow({ route, selected, best, onPress }: { route: TradeRoute; selected: boolean; best: boolean; onPress: () => void }) {
  const { currency } = useSettings();
  const usable = route.status === 'ok';
  const detail =
    route.status === 'ok'
      ? `Fee ${money(route.fee, currency)}`
      : route.status === 'belowMinimum'
        ? `Needs ${money(route.minimumAmount ?? 0, currency, { decimals: 0 })}`
        : route.status === 'notHeld'
          ? 'Not held here'
          : 'Not in preview';

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: !usable }}
      disabled={!usable}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: radius.row,
        backgroundColor: color.surface,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? color.accent : color.line,
        opacity: usable ? 1 : 0.55,
      }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: selected ? 5 : 1.5,
          borderColor: selected ? color.accent : color.line,
        }}
      />
      <BrokerDisc broker={route.broker} size={22} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="secondary" weight="medium">
            {route.broker.shortName}
          </Text>
          <FormPill form={route.availability.form} via={route.availability.via} />
        </View>
        {best && (
          <Text variant="small" tone="accent">
            Lowest cost
          </Text>
        )}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text variant="small">{detail}</Text>
        {usable && (
          <Text variant="small" tone="inkMuted">
            Spread {(route.spreadPct * 100).toFixed(route.spreadPct < 0.001 ? 3 : 2)}%
          </Text>
        )}
      </View>
    </Pressable>
  );
}
