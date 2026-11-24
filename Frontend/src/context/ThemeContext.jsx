import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  isDark: false,
  setTheme: () => {},
  toggle: () => {},
});

const THEME_KEY = 'theme';
const THEME_COLOR = { light: '#162661', dark: '#0b1020' };

const readStoredTheme = () => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // localStorage can be unavailable (private mode / blocked storage)
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

const hasStoredTheme = () => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'dark' || stored === 'light';
  } catch {
    return false;
  }
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(readStoredTheme);
  // True once the visitor has picked a theme explicitly. Until then we follow the OS.
  const chosenRef = useRef(hasStoredTheme());

  const apply = useCallback((next) => {
    const root = document.documentElement;
    root.dataset.theme = next;
    root.style.colorScheme = next;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[next]);
  }, []);

  const persist = useCallback((next) => {
    chosenRef.current = true;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    apply(theme);
  }, [theme, apply]);

  // Follow the OS preference until the user picks a theme explicitly.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event) => {
      if (chosenRef.current) return;
      setThemeState(event.matches ? 'dark' : 'light');
    };
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  const setTheme = useCallback(
    (next) => {
      const value = next === 'dark' ? 'dark' : 'light';
      persist(value);
      setThemeState(value);
    },
    [persist]
  );

  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    persist(next);
    setThemeState(next);
  }, [theme, persist]);

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
