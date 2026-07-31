import { Platform } from 'react-native';

/**
 * Small synchronous key-value store: SQLite-backed on the phone, localStorage on the web.
 * Every call is guarded, so a missing store only means settings don't persist.
 */
type Store = { get(key: string): string | null; set(key: string, value: string): void; remove(key: string): void };

function native(): Store {
  // Required lazily so the web bundle never touches SQLite
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded lazily so the web bundle never evaluates it
  const Storage = require('expo-sqlite/kv-store').default as {
    getItemSync(k: string): string | null;
    setItemSync(k: string, v: string): void;
    removeItemSync(k: string): void;
  };
  return { get: (k) => Storage.getItemSync(k), set: (k, v) => Storage.setItemSync(k, v), remove: (k) => Storage.removeItemSync(k) };
}

function web(): Store {
  return {
    get: (k) => globalThis.localStorage?.getItem(k) ?? null,
    set: (k, v) => globalThis.localStorage?.setItem(k, v),
    remove: (k) => globalThis.localStorage?.removeItem(k),
  };
}

function memory(): Store {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) };
}

let store: Store | undefined;
function get(): Store {
  if (!store) {
    try {
      store = Platform.OS === 'web' ? web() : native();
    } catch {
      store = memory();
    }
  }
  return store;
}

export const storage: Store = {
  get: (k) => {
    try {
      return get().get(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      get().set(k, v);
    } catch {
      /* not persisted */
    }
  },
  remove: (k) => {
    try {
      get().remove(k);
    } catch {
      /* nothing to remove */
    }
  },
};
