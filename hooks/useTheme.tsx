import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { setColorTheme, type ColorTheme } from '@/constants/Colors';

const THEME_STORAGE_KEY = 'myshifts_theme_mode_v1';

type ThemeContextType = {
  theme: ColorTheme;
  toggleTheme: () => Promise<void>;
  setTheme: (theme: ColorTheme) => Promise<void>;
  initialized: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ColorTheme>('light');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        const nextTheme: ColorTheme = stored === 'dark' ? 'dark' : 'light';
        setColorTheme(nextTheme);
        setThemeState(nextTheme);
      } catch {
        setColorTheme('light');
        setThemeState('light');
      } finally {
        setInitialized(true);
      }
    };

    loadTheme();
  }, []);

  const setTheme = async (nextTheme: ColorTheme) => {
    setColorTheme(nextTheme);
    setThemeState(nextTheme);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  const toggleTheme = async () => {
    const nextTheme: ColorTheme = theme === 'light' ? 'dark' : 'light';
    await setTheme(nextTheme);
  };

  const value = useMemo(() => ({ theme, toggleTheme, setTheme, initialized }), [theme, initialized]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}
