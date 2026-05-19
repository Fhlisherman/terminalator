import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type AccentColor = 'indigo' | 'blue' | 'teal' | 'green' | 'orange' | 'rose';
export type AppTheme = 'dark' | 'darker' | 'graphite' | 'night-owl' | 'cyberpunk';

export interface Settings {
  accentColor: AccentColor;
  termFontSize: number;
  sidebarWidth: number;
  appTheme: AppTheme;
  showHiddenFiles: boolean;
  terminalPadding: number;
}

// ── Accent Palette ────────────────────────────────────────────────────────────
export const ACCENT_PALETTE: Record<AccentColor, { h: number; s: number; l: number }> = {
  indigo:  { h: 239, s: 84, l: 67 },
  blue:    { h: 211, s: 100, l: 56 },
  teal:    { h: 174, s: 72, l: 44 },
  green:   { h: 152, s: 69, l: 44 },
  orange:  { h: 25,  s: 95, l: 53 },
  rose:    { h: 330, s: 78, l: 60 },
};

// ── UI Theme Palette ──────────────────────────────────────────────────────────
interface ThemeEntry {
  bg: string; bgSec: string; bgTer: string; bgEl: string;
  sep: string;
  labelPrimary: string; labelSec: string; labelTer: string;
}

const THEME_PALETTE: Record<AppTheme, ThemeEntry> = {
  dark: {
    bg: '#0a0a0e', bgSec: '#1c1c1e', bgTer: '#2c2c2e', bgEl: '#3a3a3c',
    sep: 'rgba(84,84,88,0.55)',
    labelPrimary: '#ffffff', labelSec: 'rgba(235,235,245,0.60)', labelTer: 'rgba(235,235,245,0.30)',
  },
  darker: {
    bg: '#000000', bgSec: '#161618', bgTer: '#242426', bgEl: '#323234',
    sep: 'rgba(84,84,88,0.45)',
    labelPrimary: '#ffffff', labelSec: 'rgba(235,235,245,0.58)', labelTer: 'rgba(235,235,245,0.28)',
  },
  graphite: {
    bg: '#1a1a1f', bgSec: '#232329', bgTer: '#2d2d35', bgEl: '#38383f',
    sep: 'rgba(100,100,110,0.50)',
    labelPrimary: '#f5f5f7', labelSec: 'rgba(245,245,247,0.60)', labelTer: 'rgba(245,245,247,0.30)',
  },
  'night-owl': {
    bg: '#011627', bgSec: '#01223a', bgTer: '#0e3550', bgEl: '#1d4d71',
    sep: 'rgba(92,148,188,0.35)',
    labelPrimary: '#d6deeb', labelSec: 'rgba(214,222,235,0.70)', labelTer: 'rgba(214,222,235,0.38)',
  },
  'cyberpunk': {
    bg: '#0a0015', bgSec: '#130025', bgTer: '#1c0035', bgEl: '#2a0050',
    sep: 'rgba(255,0,255,0.22)',
    labelPrimary: '#f0e0ff', labelSec: 'rgba(240,224,255,0.65)', labelTer: 'rgba(240,224,255,0.32)',
  },
};

// ── xterm.js Terminal Themes ──────────────────────────────────────────────────
export interface XTermTheme {
  background: string; foreground: string; cursor: string;
  selectionBackground: string;
  black: string; red: string; green: string; yellow: string;
  blue: string; magenta: string; cyan: string; white: string;
  brightBlack: string; brightRed: string; brightGreen: string; brightYellow: string;
  brightBlue: string; brightMagenta: string; brightCyan: string; brightWhite: string;
}

export const TERMINAL_THEMES: Record<AppTheme, XTermTheme> = {
  dark: {
    background: '#050507', foreground: '#f0f0f5',
    cursor: '#6366f1', selectionBackground: 'rgba(99,102,241,0.35)',
    black: '#1a1a24', red: '#ff453a', green: '#30d158', yellow: '#ffd60a',
    blue: '#0a84ff', magenta: '#bf5af2', cyan: '#32ade6', white: '#f0f0f5',
    brightBlack: '#48484e', brightRed: '#ff6b6b', brightGreen: '#57e389', brightYellow: '#ffe066',
    brightBlue: '#5ac8fa', brightMagenta: '#da8fff', brightCyan: '#5de6ff', brightWhite: '#ffffff',
  },
  darker: {
    background: '#000000', foreground: '#f0f0f5',
    cursor: '#6366f1', selectionBackground: 'rgba(99,102,241,0.35)',
    black: '#111118', red: '#ff453a', green: '#30d158', yellow: '#ffd60a',
    blue: '#0a84ff', magenta: '#bf5af2', cyan: '#32ade6', white: '#f0f0f5',
    brightBlack: '#40404a', brightRed: '#ff6b6b', brightGreen: '#57e389', brightYellow: '#ffe066',
    brightBlue: '#5ac8fa', brightMagenta: '#da8fff', brightCyan: '#5de6ff', brightWhite: '#ffffff',
  },
  graphite: {
    background: '#151518', foreground: '#f0f0f5',
    cursor: '#a0a0b0', selectionBackground: 'rgba(160,160,176,0.3)',
    black: '#1e1e22', red: '#e05555', green: '#4ec94e', yellow: '#e5c543',
    blue: '#5080d0', magenta: '#9060c0', cyan: '#50a0b8', white: '#c8c8d0',
    brightBlack: '#505060', brightRed: '#ff7070', brightGreen: '#70dc70', brightYellow: '#f0d858',
    brightBlue: '#70a0f0', brightMagenta: '#b080e0', brightCyan: '#70c8e0', brightWhite: '#ffffff',
  },
  'night-owl': {
    background: '#011627', foreground: '#d6deeb',
    cursor: '#7fdbca', selectionBackground: 'rgba(127,219,202,0.25)',
    black: '#011627', red: '#ef5350', green: '#22da6e', yellow: '#addb67',
    blue: '#82aaff', magenta: '#c792ea', cyan: '#7fdbca', white: '#d6deeb',
    brightBlack: '#637777', brightRed: '#ff6363', brightGreen: '#22da6e', brightYellow: '#ffeb95',
    brightBlue: '#82aaff', brightMagenta: '#e792ea', brightCyan: '#7fdbca', brightWhite: '#ffffff',
  },
  cyberpunk: {
    background: '#0a0015', foreground: '#e0d0ff',
    cursor: '#ff00ff', selectionBackground: 'rgba(255,0,255,0.25)',
    black: '#1a002e', red: '#ff2d6b', green: '#00ff9f', yellow: '#ffe900',
    blue: '#0088ff', magenta: '#ff00ff', cyan: '#00e5ff', white: '#e0d0ff',
    brightBlack: '#4a0070', brightRed: '#ff6090', brightGreen: '#00ffcc', brightYellow: '#ffff66',
    brightBlue: '#44aaff', brightMagenta: '#ff66ff', brightCyan: '#66ffff', brightWhite: '#ffffff',
  },
};

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: Settings = {
  accentColor: 'indigo',
  termFontSize: 14,
  sidebarWidth: 260,
  appTheme: 'dark',
  showHiddenFiles: false,
  terminalPadding: 8,
};

function loadSettings(): Settings {
  try {
    const s = localStorage.getItem('terminalator_settings');
    if (s) return { ...DEFAULT_SETTINGS, ...JSON.parse(s) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export function applyCssVars(settings: Settings) {
  const root = document.documentElement;
  const accent = ACCENT_PALETTE[settings.accentColor];
  const theme  = THEME_PALETTE[settings.appTheme];

  // Accent
  root.style.setProperty('--accent-h',       String(accent.h));
  root.style.setProperty('--accent-s',       `${accent.s}%`);
  root.style.setProperty('--accent-l',       `${accent.l}%`);
  root.style.setProperty('--accent-primary', `hsl(${accent.h},${accent.s}%,${accent.l}%)`);
  root.style.setProperty('--accent-dim',     `hsl(${accent.h},${accent.s}%,${accent.l - 8}%)`);
  root.style.setProperty('--accent-glow',    `hsla(${accent.h},${accent.s}%,${accent.l}%,0.22)`);

  // Backgrounds
  root.style.setProperty('--bg-app',       theme.bg);
  root.style.setProperty('--bg-primary',   theme.bgSec);
  root.style.setProperty('--bg-secondary', theme.bgSec);
  root.style.setProperty('--bg-tertiary',  theme.bgTer);
  root.style.setProperty('--bg-elevated',  theme.bgEl);
  root.style.setProperty('--separator',    theme.sep);

  // Labels — critical for Night Owl / Cyberpunk where text isn't pure white
  root.style.setProperty('--label-primary',   theme.labelPrimary);
  root.style.setProperty('--label-secondary', theme.labelSec);
  root.style.setProperty('--label-tertiary',  theme.labelTer);

  // Typography
  root.style.setProperty('--term-font',      "'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace");
  root.style.setProperty('--term-font-size', `${settings.termFontSize}px`);
  root.style.setProperty('--sidebar-width',  `${settings.sidebarWidth}px`);
  root.style.setProperty('--term-padding',   `${settings.terminalPadding}px`);

  // Body text color inherits from label-primary
  root.style.setProperty('color', theme.labelPrimary);
}

// ── Context ───────────────────────────────────────────────────────────────────
interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    const s = loadSettings();
    applyCssVars(s);
    return s;
  });

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem('terminalator_settings', JSON.stringify(next));
      applyCssVars(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem('terminalator_settings');
    applyCssVars(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, update, reset }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be inside SettingsProvider');
  return ctx;
}
