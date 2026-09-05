import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrokerAccounts } from '@/api/queries';
import type { Broker } from '@/api/types';
import { BrokerDisc } from '@/components/BrokerDisc';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LoadError, Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { money } from '@/lib/format';
import { useSettings } from '@/state/settings';
import { color, radius, space } from '@/theme/tokens';

const matrix: { label: string; has: (b: Broker) => boolean }[] = [
  { label: 'Shares', has: (b) => b.forms.includes('share') },
  { label: 'ETFs', has: (b) => b.forms.includes('etf') },
  { label: 'CFDs', has: (b) => b.forms.includes('cfd') },
  { label: 'Options', has: (b) => b.forms.includes('option') },
  { label: 'Futures', has: (b) => b.forms.includes('future') },
  { label: 'Forex spot', has: (b) => b.forms.includes('spot') },
  { label: 'Crypto', has: (b) => b.forms.includes('crypto') },
  { label: 'Bonds', has: (b) => b.forms.includes('bond') },
  { label: 'Fractional shares', has: (b) => b.features.includes('fractional') },
  { label: 'Short selling', has: (b) => b.features.includes('shorting') },
  { label: 'Margin', has: (b) => b.features.includes('margin') },
  { label: 'Copy trading', has: (b) => b.features.includes('copyTrading') },
];

export default function Brokers() {
  const insets = useSafeAreaInsets();
  const { currency } = useSettings();
  const accounts = useBrokerAccounts();
  const list = accounts.data ?? [];

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: 32, gap: space.xl }}
      refreshControl={<RefreshControl refreshing={accounts.isRefetching} onRefresh={() => accounts.refetch()} tintColor={color.accent} />}
    >
      <ScreenHeader title="Brokers" />
      {accounts.isPending && <Loading />}
      {accounts.isError && <LoadError what="your brokers" onRetry={() => accounts.refetch()} />}

      <View style={{ gap: space.m }}>
        {list.map((a) => (
          <View key={a.broker.id} style={{ backgroundColor: color.surface, borderRadius: radius.panel, borderWidth: 1, borderColor: color.line, padding: 18, gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <BrokerDisc broker={a.broker} size={40} />
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="semibold">
                  {a.broker.name}
                </Text>
                <Text variant="small" tone="gain">
                  Connected
                </Text>
              </View>
            </View>
            <View>
              <Text variant="value">{money(a.value, a.currency)}</Text>
              {a.currency !== currency && (
                <Text variant="secondary" tone="inkMuted">
                  About {money(a.valueBase, currency)}
                </Text>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Stat label="Holdings" value={String(a.holdingsCount)} />
              <Stat label="Cash" value={money(a.cash, a.currency, { decimals: 0 })} />
              <Stat label="Only here" value={`${a.onlyHere} markets`} />
            </View>
          </View>
        ))}
      </View>

      {list.length > 0 && (
        <View style={{ gap: space.m }}>
          <Text variant="title" accessibilityRole="header">
            What each broker offers
          </Text>
          <View style={{ backgroundColor: color.surface, borderRadius: radius.panel, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, paddingVertical: 6 }}>
            <View style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: color.line }}>
              <View style={{ flex: 1 }} />
              {list.map((a) => (
                <View key={a.broker.id} style={{ width: 64, alignItems: 'center', gap: 4 }}>
                  <BrokerDisc broker={a.broker} size={24} />
                  <Text variant="small" tone="inkMuted">
                    {a.broker.shortName}
                  </Text>
                </View>
              ))}
            </View>
            {matrix.map((row, i) => (
              <View
                key={row.label}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: i < matrix.length - 1 ? 1 : 0, borderBottomColor: color.line }}
              >
                <Text variant="secondary" style={{ flex: 1 }}>
                  {row.label}
                </Text>
                {list.map((a) => {
                  const yes = row.has(a.broker);
                  return (
                    <View
                      key={a.broker.id}
                      style={{ width: 64, alignItems: 'center' }}
                      accessibilityLabel={`${row.label} at ${a.broker.name}: ${yes ? 'yes' : 'no'}`}
                    >
                      {yes ? (
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="check" size={14} tint={color.accent} strokeWidth={2.4} />
                        </View>
                      ) : (
                        <Text variant="secondary" tone="inkMuted">
                          –
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: color.sunken, borderRadius: radius.control, padding: 10, gap: 2 }}>
      <Text variant="small" tone="inkMuted">
        {label}
      </Text>
      <Text variant="secondary" weight="medium" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}
