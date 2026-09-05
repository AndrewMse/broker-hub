import { Platform } from 'react-native';
import type { CalendarEvent, OptionsBook } from '@/api/types';
import type { AlertPrefs } from '@/state/settings';
import { days, optionLabel, shortDate } from './format';
import { storage } from './storage';

/**
 * Local notifications built from the same flags the Options screen shows.
 * There is no server: the app schedules them whenever it has fresh data, and cancels the stale ones.
 * Web has no notification support in expo-notifications, so every call is a no-op there.
 */
const supported = Platform.OS !== 'web';
const prefix = 'bh:';
const sentKey = 'alerts.sent';

type Notifications = typeof import('expo-notifications');
let mod: Notifications | undefined;
function lib(): Notifications | undefined {
  if (!supported) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded lazily so the web bundle never evaluates it
  if (!mod) mod = require('expo-notifications') as Notifications;
  return mod;
}

export function configureNotifications() {
  lib()?.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}

export async function ensurePermission(): Promise<boolean> {
  const n = lib();
  if (!n) return false;
  const current = await n.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await n.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
  return asked.granted;
}

export async function sendTest() {
  await lib()?.scheduleNotificationAsync({
    content: { title: 'Broker Hub alerts are on', body: 'You will hear about assignment risk, earnings and dividend dates, and expiries.' },
    trigger: null,
  });
}

interface Alert {
  id: string;
  title: string;
  body: string;
  /** When to deliver. Missing means as soon as it is detected, once. */
  at?: Date;
}

const localDate = (iso: string, hour: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0);
};

function buildAlerts(book: OptionsBook, calendar: CalendarEvent[], prefs: AlertPrefs): Alert[] {
  const out: Alert[] = [];
  for (const s of book.strategies) {
    const o = s.leg.option;
    const name = `${s.instrument.symbol} ${optionLabel(o, o.currency)}`;
    if (prefs.assignment) {
      for (const f of s.flags) {
        if (f.severity === 'info' || f.kind === 'earnings') continue;
        out.push({ id: `flag:${s.id}:${f.kind}`, title: `${name}: ${f.title}`, body: f.detail });
      }
    }
    if (prefs.expiry && o.daysToExpiry > 0) {
      const at = new Date(localDate(o.expiry, 9).getTime() - 2 * 86_400_000);
      out.push({
        id: `expiry:${s.id}`,
        title: `${name} expires ${shortDate(o.expiry)}`,
        body: `${Math.round(o.probItm * 100)}% chance of assignment right now. Roll or let it go?`,
        at: at > new Date() ? at : undefined,
      });
    }
  }
  if (prefs.events) {
    for (const e of calendar) {
      if (!e.affects.length || e.daysAway <= 0) continue;
      const what = e.kind === 'earnings' ? 'reports earnings' : 'goes ex-dividend';
      const at = new Date(localDate(e.date, 18).getTime() - 86_400_000);
      out.push({
        id: `event:${e.id}`,
        title: `${e.instrument.name} ${what} ${e.daysAway === 1 ? 'tomorrow' : `in ${days(e.daysAway)}`}`,
        body: e.affects.map((a) => `Your short ${a.label} is open that day.`).join(' '),
        at: at > new Date() ? at : undefined,
      });
    }
  }
  return out;
}

/** Bring scheduled notifications in line with the current data and preferences. */
export async function syncAlerts(book: OptionsBook, calendar: CalendarEvent[], prefs: AlertPrefs) {
  const n = lib();
  if (!n) return;
  const scheduled = (await n.getAllScheduledNotificationsAsync()).filter((r) => r.identifier.startsWith(prefix));

  if (!prefs.enabled) {
    await Promise.all(scheduled.map((r) => n.cancelScheduledNotificationAsync(r.identifier)));
    return;
  }
  if (!(await ensurePermission())) return;

  const wanted = buildAlerts(book, calendar, prefs);
  const wantedIds = new Set(wanted.filter((a) => a.at).map((a) => prefix + a.id));
  await Promise.all(scheduled.filter((r) => !wantedIds.has(r.identifier)).map((r) => n.cancelScheduledNotificationAsync(r.identifier)));
  const have = new Set(scheduled.map((r) => r.identifier));

  let sent: string[] = [];
  try {
    sent = JSON.parse(storage.get(sentKey) ?? '[]');
  } catch {
    sent = [];
  }
  const sentSet = new Set(sent);

  for (const a of wanted) {
    const identifier = prefix + a.id;
    if (a.at) {
      if (have.has(identifier)) continue;
      await n.scheduleNotificationAsync({ identifier, content: { title: a.title, body: a.body }, trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: a.at } });
    } else {
      if (sentSet.has(identifier)) continue;
      await n.scheduleNotificationAsync({ identifier, content: { title: a.title, body: a.body }, trigger: null });
      sentSet.add(identifier);
    }
  }
  storage.set(sentKey, JSON.stringify([...sentSet].slice(-200)));
}
