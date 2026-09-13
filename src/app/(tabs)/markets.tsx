import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrokerAccounts, useMarkets } from '@/api/queries';
import type { AssetClass, Broker, BrokerId, MarketRow } from '@/api/types';
import { InstrumentAvatar } from '@/components/Avatar';
import { BrokerDisc } from '@/components/BrokerDisc';
import { Icon } from '@/components/Icon';
import { FormPill } from '@/components/Pill';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented } from '@/components/Segmented';
import { LoadError, Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { percent, price } from '@/lib/format';
import { color, font, radius, space } from '@/theme/tokens';

const classes: { id: AssetClass; label: string }[] = [
  { id: 'index', label: 'Indexes' },
  { id: 'stock', label: 'Stocks' },
  { id: 'etf', label: 'ETFs' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'forex', label: 'Forex' },
  { id: 'commodity', label: 'Commodities' },
  { id: 'bond', label: 'Bonds' },
];

type BrokerFilter = 'all' | BrokerId;

export default function Markets() {
  const insets = useSafeAreaInsets();
  const markets = useMarkets();
  const accounts = useBrokerAccounts();
  const [assetClass, setAssetClass] = useState<AssetClass>('index');
  const [brokerFilter, setBrokerFilter] = useState<BrokerFilter>('all');
  const [query, setQuery] = useState('');

  const brokers = useMemo(() => accounts.data?.map((a) => a.broker) ?? [], [accounts.data]);
  const shownBrokers = useMemo(() => (brokerFilter === 'all' ? brokers : brokers.filter((b) => b.id === brokerFilter)), [brokers, brokerFilter]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (markets.data ?? []).filter(
      (r) =>
        (q ? r.instrument.name.toLowerCase().includes(q) || r.instrument.symbol.toLowerCase().includes(q) : r.instrument.assetClass === assetClass) &&
        (brokerFilter === 'all' || r.availability.some((a) => a.brokerId === brokerFilter)),
    );
  }, [markets.data, assetClass, brokerFilter, query]);

  const brokerOptions = ['all', ...brokers.map((b) => b.id)] as BrokerFilter[];
  const brokerLabels = Object.fromEntries([['all', 'All brokers'], ...brokers.map((b) => [b.id, b.shortName])]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.instrument.id}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: 32, gap: space.m }}
      keyboardDismissMode="on-drag"
      ListHeaderComponent={
        <View style={{ gap: space.l, marginBottom: space.xs }}>
          <ScreenHeader title="Markets" />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: color.surface,
              borderRadius: radius.row,
              borderWidth: 1,
              borderColor: color.line,
              paddingHorizontal: 12,
            }}
          >
            <Icon name="search" size={18} tint={color.inkMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search all markets"
              placeholderTextColor={color.inkMuted}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search all markets"
              style={{ flex: 1, height: 44, fontFamily: font.regular, fontSize: 16, color: color.ink }}
            />
          </View>

          {!query && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.gutter }} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8 }}>
              {classes.map((c) => {
                const active = c.id === assetClass;
                return (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setAssetClass(c.id)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: radius.round,
                      backgroundColor: active ? color.ink : color.surface,
                      borderWidth: 1,
                      borderColor: active ? color.ink : color.line,
                    }}
                  >
                    <Text variant="secondary" weight="medium" tone={active ? '#FFFFFF' : 'ink'}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {brokers.length > 0 && <Segmented options={brokerOptions} value={brokerFilter} onChange={setBrokerFilter} labels={brokerLabels} />}
          {(markets.isPending || accounts.isPending) && <Loading />}
          {markets.isError && <LoadError what="markets" onRetry={() => markets.refetch()} />}
        </View>
      }
      ListEmptyComponent={
        markets.data ? (
          <Text variant="secondary" tone="inkMuted" align="center" style={{ paddingVertical: 32 }}>
            {query
              ? `Nothing matches "${query}"${brokerFilter === 'all' ? '' : ` at ${brokerLabels[brokerFilter]}`}. Try a ticker like AAPL or a name like Gold.`
              : brokerFilter === 'all'
                ? 'None of your brokers offer this yet.'
                : `${brokerLabels[brokerFilter]} doesn't offer any of these.`}
          </Text>
        ) : null
      }
      extraData={shownBrokers}
      renderItem={({ item }) => <MarketItem row={item} brokers={shownBrokers} />}
    />
  );
}

function MarketItem({ row, brokers }: { row: MarketRow; brokers: Broker[] }) {
  const { instrument, availability } = row;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/instrument/[id]', params: { id: instrument.id } })}
      style={({ pressed }) => ({
        backgroundColor: color.surface,
        borderRadius: radius.row,
        borderWidth: 1,
        borderColor: color.line,
        padding: 14,
        gap: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <InstrumentAvatar instrument={instrument} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="body" numberOfLines={1}>
            {instrument.name}
          </Text>
          <Text variant="small" tone="inkMuted">
            {instrument.symbol}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text variant="body">{price(instrument.price, instrument.currency)}</Text>
          <Text variant="small" tone={instrument.change1D >= 0 ? 'gain' : 'loss'}>
            {percent(instrument.change1D, 2)}
          </Text>
        </View>
      </View>

      <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: color.line, paddingTop: 12 }}>
        {brokers.map((b) => {
          const forms = availability.filter((a) => a.brokerId === b.id);
          return (
            <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <BrokerDisc broker={b} size={20} dimmed={!forms.length} />
              <Text variant="small" tone={forms.length ? 'ink' : 'inkMuted'} style={{ width: 40 }}>
                {b.shortName}
              </Text>
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                {forms.length ? (
                  forms.map((a) => <FormPill key={`${a.form}${a.via ?? ''}`} form={a.form} via={a.via} />)
                ) : (
                  <Text variant="small" tone="inkMuted">
                    Not offered
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}
