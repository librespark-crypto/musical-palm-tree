'use client';

/**
 * Theme handling.
 *
 * The class is applied before first paint by a tiny inline script in the
 * document head (see `layout.tsx`), so there is never a flash of the wrong
 * theme. This provider owns the *preference*: it reads it through
 * `useSyncExternalStore` (localStorage + the OS media query are the external
 * stores) and writes the class back to <html> in an effect.
 *
 * Only the theme choice lives in localStorage - all tracker data is in IndexedDB.
 */
import * as React from 'react';
import type { ThemePreference } from '@/lib/types';

export const THEME_STORAGE_KEY = 'jee-tracker.theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const listeners = new Set<() => void>();

function isTheme(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(raw)) return raw;
  } catch {
    /* private mode: fall back to the system preference */
  }
  return 'system';
}

function prefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(DARK_QUERY).matches
    : false;
}

function resolve(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return prefersDark() ? 'dark' : 'light';
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  const media = window.matchMedia?.(DARK_QUERY);
  media?.addEventListener('change', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
    media?.removeEventListener('change', onChange);
  };
}

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

interface ThemeContextValue {
  theme: ThemePreference;
  resolved: 'light' | 'dark';
  setTheme(theme: ThemePreference): void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const theme = React.useSyncExternalStore(subscribe, readPreference, () => 'system' as ThemePreference);
  const resolved = React.useSyncExternalStore(
    subscribe,
    () => resolve(readPreference()),
    () => 'light' as const,
  );

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
  }, [resolved]);

  const setTheme = React.useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* the theme simply will not persist */
    }
    notifyListeners();
  }, []);

  const value = React.useMemo<ThemeContextValue>(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}

/** Inline script that sets the theme class before first paint. */
export const themeBootstrapScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
