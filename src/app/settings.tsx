import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { displayCurrencies, type CountryRule } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { ensurePermission, sendTest } from '@/lib/alerts';
import { useSettings, type AlertPrefs } from '@/state/settings';
import { color, radius, space } from '@/theme/tokens';

const names: Record<string, string> = { USD: 'US dollar', EUR: 'Euro', GBP: 'British pound', RON: 'Romanian leu' };

const rules: { id: CountryRule; label: string; detail: string }[] = [
  { id: 'issuer', label: 'The company', detail: 'Apple is US income, ASML is Dutch, wherever you traded it. CFDs stay with the broker.' },
  { id: 'broker', label: 'The broker', detail: 'Everything at IBKR is Irish income, everything at eToro is Cypriot. Dividends still follow the company.' },
];

const alertRows: { key: keyof Omit<AlertPrefs, 'enabled'>; label: string; detail: string }[] = [
  { key: 'assignment', label: 'Assignment risk', detail: 'Uncovered legs, in the money near expiry, early assignment before a dividend' },
  { key: 'events', label: 'Earnings and dividends', detail: 'The evening before, when you have a short option open on that stock' },
  { key: 'expiry', label: 'Expiry reminders', detail: 'Two days before each expiry, with the chance of assignment' },
];

export default function SettingsSheet() {
  const insets = useSafeAreaInsets();
  const { currency, setCurrency, countryRule, setCountryRule, alerts, setAlerts } = useSettings();
  const [denied, setDenied] = useState(false);

  const toggleAlerts = async (on: boolean) => {
    if (on && !(await ensurePermission())) {
      setDenied(true);
      return;
    }
    setDenied(false);
    setAlerts({ ...alerts, enabled: on });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.gutter, paddingTop: 28, paddingBottom: insets.bottom + 24, gap: space.xl }}>
      <Group title="Display currency" detail="Totals from all brokers are converted into this currency.">
        {displayCurrencies.map((c, i) => (
          <Radio key={c} first={!i} active={c === currency} onPress={() => setCurrency(c)} label={c} detail={names[c]} />
        ))}
      </Group>

      <Group title="Tax: country follows" detail="How the tax view decides which country a result belongs to. Ask your accountant which one they file under.">
        {rules.map((r, i) => (
          <Radio key={r.id} first={!i} active={r.id === countryRule} onPress={() => setCountryRule(r.id)} label={r.label} detail={r.detail} stacked />
        ))}
      </Group>

      <Group title="Alerts" detail="Notifications from this phone, built from the same flags the Options screen shows. Nothing leaves the device.">
        <Toggle first label="Send alerts" value={alerts.enabled} onChange={toggleAlerts} />
        {denied && (
          <Text variant="small" weight="regular" tone="loss" style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            Notifications are off for Broker Hub in iOS Settings. Turn them on there, then try again.
          </Text>
        )}
        {alertRows.map((r) => (
          <Toggle key={r.key} label={r.label} detail={r.detail} value={alerts[r.key]} disabled={!alerts.enabled} onChange={(v) => setAlerts({ ...alerts, [r.key]: v })} />
        ))}
        <Pressable
          accessibilityRole="button"
          disabled={!alerts.enabled}
          onPress={() => {
            Haptics.selectionAsync();
            sendTest();
          }}
          style={({ pressed }) => ({ paddingVertical: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: color.line, backgroundColor: pressed ? color.sunken : 'transparent', opacity: alerts.enabled ? 1 : 0.4 })}
        >
          <Text variant="secondary" weight="medium" tone="accent">
            Send a test notification
          </Text>
        </Pressable>
      </Group>
    </ScrollView>
  );
}

function Group({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.m }}>
      <View style={{ gap: 4 }}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        <Text variant="secondary" tone="inkMuted">
          {detail}
        </Text>
      </View>
      <View style={{ backgroundColor: color.surface, borderRadius: radius.panel, borderWidth: 1, borderColor: color.line, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

function Radio({ first, active, onPress, label, detail, stacked }: { first: boolean; active: boolean; onPress: () => void; label: string; detail: string; stacked?: boolean }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: color.line,
        backgroundColor: pressed ? color.sunken : 'transparent',
      })}
    >
      {stacked ? (
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="body">{label}</Text>
          <Text variant="small" weight="regular" tone="inkMuted">
            {detail}
          </Text>
        </View>
      ) : (
        <>
          <Text variant="body" style={{ width: 52 }}>
            {label}
          </Text>
          <Text variant="secondary" tone="inkMuted" style={{ flex: 1 }}>
            {detail}
          </Text>
        </>
      )}
      <View style={{ width: 20 }}>{active && <Icon name="check" size={20} tint={color.accent} strokeWidth={2.2} />}</View>
    </Pressable>
  );
}

function Toggle({ first, label, detail, value, disabled, onChange }: { first?: boolean; label: string; detail?: string; value: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: color.line, opacity: disabled ? 0.45 : 1 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body">{label}</Text>
        {detail && (
          <Text variant="small" weight="regular" tone="inkMuted">
            {detail}
          </Text>
        )}
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: color.accent }} accessibilityLabel={label} />
    </View>
  );
}
