import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import type { Language, SettingsContextType, ThemeMode } from '../types';
import { DEFAULT_LANGUAGE, isSupportedLanguage, LANGUAGE_OPTIONS, TRANSLATIONS } from '../locales';

const SHOW_FAVORITE_PROJECTS_KEY = 'show_favorite_projects';
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('theme');
    return stored === 'light' || stored === 'glass' ? stored : 'dark';
  });
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('language');
    return stored && isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  });
  const [accentColor, setAccentColorState] = useState<string>(() => localStorage.getItem('accentColor') || '#38C172');
  const [showFavoriteProjects, setShowFavoriteProjectsState] = useState<boolean>(() => localStorage.getItem(SHOW_FAVORITE_PROJECTS_KEY) !== 'false');

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.className = `theme-${newTheme}`;
  };

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
    localStorage.setItem('language', newLang);
  };

  const setAccentColor = (color: string) => {
    setAccentColorState(color);
    localStorage.setItem('accentColor', color);
    document.documentElement.style.setProperty('--accent-color', color);
  };

  const setShowFavoriteProjects = (enabled: boolean) => {
    setShowFavoriteProjectsState(enabled);
    localStorage.setItem(SHOW_FAVORITE_PROJECTS_KEY, enabled ? 'true' : 'false');
  };

  useEffect(() => {
    document.documentElement.className = `theme-${theme}`;
    document.documentElement.style.setProperty('--accent-color', accentColor);
  }, []);

  const t = (key: string) => {
    const current = TRANSLATIONS[language] as Record<string, string>;
    const fallback = TRANSLATIONS[DEFAULT_LANGUAGE] as Record<string, string>;
    return current[key] || fallback[key] || key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  };

  return (
    <SettingsContext.Provider value={{ theme, setTheme, language, setLanguage, t, accentColor, setAccentColor, showFavoriteProjects, setShowFavoriteProjects }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};

export const LanguageSelect: React.FC<{
  value: Language;
  onChange: (language: Language) => void;
  compact?: boolean;
}> = ({ value, onChange, compact = false }) => {
  const { theme } = useSettings();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const current = LANGUAGE_OPTIONS.find((option) => option.code === value) || LANGUAGE_OPTIONS[0];

  const requestClose = () => {
    if (closing) return;
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
      setClosing(false);
    }, 180);
  };

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  const menu = open ? (
    <div
      data-closing={closing ? 'true' : undefined}
      className="app-overlay fixed inset-0 flex items-end bg-black/55 p-4 pt-safe sm:items-center sm:justify-center"
      style={{ zIndex: 2147483647 }}
      onClick={requestClose}
    >
      <div
        className={`app-responsive-sheet app-glass-menu app-glass-list w-full max-w-sm overflow-y-auto border p-2 shadow-[0_18px_44px_rgba(0,0,0,0.42)] ${
          theme === 'light'
            ? 'border-black/10 text-zinc-950'
            : 'bg-modrinth-card border-modrinth-border'
        } animate-slide-up`}
        style={theme === 'light' ? { backgroundColor: '#ffffff' } : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        {LANGUAGE_OPTIONS.map((option) => {
          const active = option.code === value;
          return (
            <button
              key={option.code}
              type="button"
              data-active={active ? 'true' : undefined}
              onClick={() => {
                onChange(option.code);
                requestClose();
              }}
              className={`app-glass-menu-item w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                active
                  ? 'text-modrinth-green'
                  : theme === 'light'
                    ? 'text-black/70 hover:bg-black/[0.05]'
                    : 'text-modrinth-text hover:bg-modrinth-cardHover'
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{option.nativeLabel}</div>
                <div className="text-[11px] uppercase tracking-[0.12em] opacity-70">{option.label}</div>
              </div>
              {active ? <Check size={14} /> : <span className="w-[14px]" />}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div className="relative z-30">
      <button
        type="button"
        onClick={() => {
          setClosing(false);
          setOpen(true);
        }}
        className={`app-glass-button w-full flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
          theme === 'light'
            ? 'bg-black/[0.04] border-black/10 hover:bg-black/[0.06]'
            : 'bg-modrinth-bg border-modrinth-border hover:bg-modrinth-cardHover'
        } ${compact ? 'py-3' : 'py-3.5'}`}
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-modrinth-text">{current.nativeLabel}</div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-modrinth-muted">{current.label}</div>
        </div>
        <ChevronDown size={16} className={`shrink-0 text-modrinth-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
};
