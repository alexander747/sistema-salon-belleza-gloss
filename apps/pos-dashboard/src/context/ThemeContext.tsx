import React, { createContext, useContext, useState, useMemo, useEffect, ReactNode } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { PaletteMode } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import baseTheme from '../theme';

interface ThemeContextType {
  mode: PaletteMode;
  toggleColorMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  toggleColorMode: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<PaletteMode>(() => {
    const stored = localStorage.getItem('luxe-theme-mode');
    return (stored === 'light' || stored === 'dark') ? stored : 'dark';
  });

  useEffect(() => {
    localStorage.setItem('luxe-theme-mode', mode);
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  const toggleColorMode = () => {
    setMode(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const theme = useMemo(() => createTheme({
    ...baseTheme,
    palette: {
      mode,
      primary: { main: '#D4A853' },
      secondary: { main: '#E8C879' },
      ...(mode === 'dark'
        ? {
            background: { default: '#121212', paper: '#1E1E2E' },
            text: { primary: '#E0E0E0', secondary: '#9E9E9E' },
            divider: 'rgba(255,255,255,0.08)',
          }
        : {
            background: { default: '#F5F0EB', paper: '#FFFFFF' },
            text: { primary: '#1A1A2E', secondary: '#555555' },
            divider: 'rgba(0,0,0,0.08)',
          }),
      error: { main: '#E0556A' },
      success: { main: '#5CBA7B' },
      warning: { main: '#D4A853' },
    },
  }), [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleColorMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
