import React, { useState, useEffect, useCallback, useMemo, createContext, useContext, useRef } from 'react';

declare const __APP_VERSION__: string;
import { HashRouter, Routes, Route, useNavigate, useParams, Outlet, useLocation } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { Loader2, LogOut, ArrowLeft, Save, ExternalLink, BarChart2, ShieldCheck, Key, ChevronRight, Download, Activity, BookOpen, FileText, Monitor, Server, Edit3, Globe, Wallet, DollarSign, Archive, Lock, EyeOff, Info, Heart, Clock, Users, Trash2, Moon, Sun, Smartphone, UserPlus, Search, X, Check, ChevronDown, Bell, AlertTriangle, Image as ImageIcon, Upload, Package, Calendar, File as FileIcon, Layers, MousePointerClick, CheckCheck, RefreshCw, MoreVertical } from 'lucide-react';
import { fetchCurrentUser, fetchUserProjects, fetchProject, updateProject, fetchProjectMembers, deleteTeamMember, updateTeamMember, searchUser, addTeamMember, modifyUser, fetchNotifications, deleteNotification, markNotificationRead, markMultipleNotificationsRead, changeProjectIcon, deleteProjectIcon, addGalleryImage, deleteGalleryImage, fetchProjectDependencies, fetchProjectVersions, fetchGameVersionTags, fetchLoaderTags, modifyVersion, deleteVersionById, fetchUserPayoutHistoryWithStatus, fetchUserByIdWithStatus, fetchPayoutBalanceV3WithStatus, joinTeam, transferTeamOwnership, searchProjects } from './services/modrinthService';
import { AuthState, ModrinthUser, ModrinthProject, NavTab, ProjectMember, SettingsContextType, ThemeMode, Language, UserSearchResult, ModifyUserPayload, ModrinthNotification, ProjectDependency, ModrinthVersion, ModrinthPayoutHistory } from './types';
import ProjectCard from './components/ProjectCard';
import BottomNav from './components/BottomNav';
import ModpackCreator from './components/ModpackCreator';
import { DEFAULT_LANGUAGE, isSupportedLanguage, LANGUAGE_OPTIONS, TRANSLATIONS } from './locales';
const MarkdownRenderer = React.lazy(() => import('./components/MarkdownRenderer'));

// --- Back Button Handler for Android ---
const BackButtonHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [lastBackPress, setLastBackPress] = useState(0);
  const { t, theme, language } = useSettings();

  useEffect(() => {
    if (!CapApp || typeof (CapApp as any).addListener !== 'function') return;

    const handleBackButton = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (location.pathname !== '/') {
        navigate(-1);
      } else {
        const now = Date.now();
        if (now - lastBackPress < 2000) {
          CapApp.exitApp();
        } else {
          setLastBackPress(now);
          const toast = document.createElement('div');
          toast.innerText = t('press_back_again');
          toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-modrinth-card/85 backdrop-blur-xl text-modrinth-text px-6 py-3 rounded-full shadow-[0_12px_30px_rgba(0,0,0,0.35)] z-[200] font-medium text-sm';
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 2000);
        }
      }
    });

    return () => {
      handleBackButton.then(h => h.remove()).catch(() => {});
    };
  }, [navigate, location, lastBackPress, t]);

  return null;
};

// --- App Version ---
const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '1.0.0';
const GITHUB_REPO = 'imsawiq/Rinthy';

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  assets: { name: string; browser_download_url: string }[];
}

const MODRINTH_OAUTH_BASE_URL = 'https://rinthy-auth-backend-pgae.vercel.app';
const MODRINTH_OAUTH_STATE_KEY = 'modrinth_oauth_state';
const DISCORD_INVITE_URL = 'https://discord.gg/frd5Cw7xPj';

const generateOAuthState = () => {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
};

const getStoredLanguage = (): Language => {
  const raw = localStorage.getItem('language');
  return raw && isSupportedLanguage(raw) ? raw : DEFAULT_LANGUAGE;
};

const getAuthMessage = (key: 'oauth_missing_token' | 'oauth_cancelled' | 'oauth_state_error' | 'oauth_backend_unavailable'): string => {
  const lang = getStoredLanguage();
  const messages = {
    ru: {
      oauth_missing_token: 'OAuth не вернул токен.',
      oauth_cancelled: 'Вход через Modrinth был отменён.',
      oauth_state_error: 'Ошибка входа: state не совпадает.',
      oauth_backend_unavailable: 'Сервер авторизации недоступен. Попробуй позже или войди через PAT.'
    },
    en: {
      oauth_missing_token: 'OAuth did not return a token.',
      oauth_cancelled: 'Modrinth sign-in was cancelled.',
      oauth_state_error: 'Sign-in failed: state mismatch.',
      oauth_backend_unavailable: 'The auth backend is unavailable. Try again later or sign in with a PAT.'
    }
  };

  return messages[lang][key];
};

const readOAuthCallback = (url: string) => {
  if (!url || !url.startsWith('rinthy://auth/callback')) return null;

  try {
    const parsed = new URL(url);
    return {
      token: parsed.searchParams.get('token'),
      state: parsed.searchParams.get('state'),
      error: parsed.searchParams.get('error')
    };
  } catch {
    return {
      token: null,
      state: null,
      error: 'parse_error'
    };
  }
};

const checkForUpdates = async (): Promise<GitHubRelease | null> => {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    if (!res.ok) return null;
    const release: GitHubRelease = await res.json();
    const latestVersion = release.tag_name.replace(/^v/, '');
    if (latestVersion !== APP_VERSION && compareVersions(latestVersion, APP_VERSION) > 0) {
      return release;
    }
  } catch (e) {
    console.error('Update check failed:', e);
  }
  return null;
};

const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
};

// --- Icons ---
const ModrinthLogo = ({ className }: { className?: string }) => (
  <img
    src="/logo.png"
    alt="App logo"
    className={className}
  />
);

type ResolvedNotification = ModrinthNotification & {
  displayTitle: string;
  displayText: string;
  projectKey: string;
  projectTitle: string | null;
  projectIconUrl: string | null;
  versionLabel: string | null;
};

type NotificationEntityRef = {
  id: string;
  kind: 'project' | 'version' | 'unknown';
  projectSlug?: string;
};

type ProjectSortMode = 'popularity' | 'updated' | 'followers' | 'title';

type NotificationGroup = {
  key: string;
  projectTitle: string | null;
  projectIconUrl: string | null;
  items: ResolvedNotification[];
};

const MODRINTH_ID_RE = /\b[A-Za-z0-9]{8}\b/g;
const PROJECT_SORT_KEY = 'project_sort_mode';

const PROJECT_SORT_OPTIONS: ProjectSortMode[] = ['popularity', 'updated', 'title'];

const replaceResolvedIds = (value: string, replacements: Record<string, string>) =>
  value.replace(MODRINTH_ID_RE, (match) => replacements[match] || match);

const getStoredProjectSortMode = (): ProjectSortMode => {
  const raw = localStorage.getItem(PROJECT_SORT_KEY);
  return raw === 'updated' || raw === 'followers' || raw === 'title' ? raw : 'popularity';
};

const sortProjectsByMode = (projects: ModrinthProject[], mode: ProjectSortMode) => {
  const next = [...projects];
  switch (mode) {
    case 'updated':
      return next.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
    case 'followers':
      return next.sort((a, b) => b.followers - a.followers || b.downloads - a.downloads);
    case 'title':
      return next.sort((a, b) => a.title.localeCompare(b.title));
    case 'popularity':
    default:
      return next.sort((a, b) => b.downloads - a.downloads || b.followers - a.followers);
  }
};

const formatNotificationRelativeTime = (value: string, locale: string) => {
  const timestamp = new Date(value).getTime();
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return locale === 'ru' ? `${diffMinutes} мин назад` : `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return locale === 'ru' ? `${diffHours} ч назад` : `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return locale === 'ru' ? `${diffDays} дн назад` : `${diffDays}d ago`;
};

const formatProjectsCountLabel = (count: number, language: Language, t: (key: string) => string) => {
  if (language !== 'ru') {
    return `${count} ${t('projects_label')}`;
  }

  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} проект`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} проекта`;
  }

  return `${count} проектов`;
};

const getNotificationEntityRefs = (notif: ModrinthNotification): NotificationEntityRef[] => {
  const refs = new Map<string, NotificationEntityRef>();
  const raw = `${notif.title} ${notif.text} ${notif.link || ''}`;
  for (const match of raw.matchAll(MODRINTH_ID_RE)) {
    refs.set(match[0], { id: match[0], kind: 'unknown' });
  }

  const link = notif.link || '';
  const projectMatch = link.match(/\/project\/([^/?#]+)/);
  const versionMatch = link.match(/\/version\/([^/?#]+)/);
  const projectSlug = projectMatch?.[1];
  if (projectSlug) refs.set(projectSlug, { id: projectSlug, kind: 'project' });
  if (versionMatch) {
    refs.set(versionMatch[1], { id: versionMatch[1], kind: 'version', projectSlug });
  }

  return Array.from(refs.values());
};

// --- Settings Context ---
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('theme');
    return stored === 'light' ? 'light' : 'dark';
  });
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('language');
    return stored && isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  });
  const [accentColor, setAccentColorState] = useState<string>(() => localStorage.getItem('accentColor') || '#30B27C');

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

  useEffect(() => {
    document.documentElement.className = `theme-${theme}`;
    document.documentElement.style.setProperty('--accent-color', accentColor);
  }, []);

  const t = (key: string) => {
    return (TRANSLATIONS[language] as Record<string, string>)[key] || key;
  };

  return (
    <SettingsContext.Provider value={{ theme, setTheme, language, setLanguage, t, accentColor, setAccentColor }}>
      {children}
    </SettingsContext.Provider>
  );
};

const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};

const LanguageSelect: React.FC<{
  value: Language;
  onChange: (language: Language) => void;
  compact?: boolean;
}> = ({ value, onChange, compact = false }) => {
  const { theme, t } = useSettings();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const current = LANGUAGE_OPTIONS.find((option) => option.code === value) || LANGUAGE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative z-30" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
          theme === 'light'
            ? 'bg-black/[0.05] hover:bg-black/[0.08]'
            : 'bg-modrinth-card hover:bg-modrinth-cardHover'
        } ${compact ? 'py-3' : 'py-3.5'}`}
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-modrinth-text">{current.nativeLabel}</div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-modrinth-muted">{current.label}</div>
        </div>
        <ChevronDown size={16} className={`shrink-0 text-modrinth-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className={`absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[80] rounded-2xl p-2 shadow-[0_14px_34px_rgba(0,0,0,0.34)] ${
            theme === 'light'
              ? 'bg-white'
              : 'bg-modrinth-card'
          } animate-fade-in-up`}
        >
          {LANGUAGE_OPTIONS.map((option) => {
            const active = option.code === value;
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => {
                  onChange(option.code);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  active
                    ? 'bg-modrinth-green/14 text-modrinth-green'
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
      )}
    </div>
  );
};

// --- Components ---

const WelcomeSetup: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { t, language, setLanguage } = useSettings();
  return (
    <div className="fixed inset-0 z-[200] bg-modrinth-bg flex flex-col items-center justify-center p-6 text-center animate-fade-in">
      <div className="w-full max-w-sm flex-1 flex flex-col items-center justify-center">
        <div className="bg-modrinth-card/75 backdrop-blur-xl w-32 h-32 rounded-3xl flex items-center justify-center mb-10 shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
          <ModrinthLogo className="w-16 h-16" />
        </div>

        <h2 className="text-3xl font-bold text-modrinth-text mb-3 animate-fade-in-up">{t('welcome_title')}</h2>
        <p className="text-modrinth-muted mb-10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>{t('welcome_subtitle')}</p>

        <div className="w-full bg-modrinth-card/75 backdrop-blur-xl p-4 rounded-3xl shadow-[0_10px_26px_rgba(0,0,0,0.22)] overflow-visible">
          <div className="text-modrinth-green font-bold text-sm uppercase mb-3">{t('choose_language')}</div>
          <LanguageSelect value={language} onChange={setLanguage} />
        </div>
      </div>

      <button
        type="button"
        onClick={onComplete}
        className="w-full max-w-sm bg-modrinth-green text-white font-bold py-4 rounded-2xl active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-modrinth-green/20"
      >
        {t('continue')} <ChevronRight size={20} />
      </button>
    </div>
  );
};

const Onboarding: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const { t, theme, language } = useSettings();
  const steps = [
    {
      icon: <ModrinthLogo className="w-16 h-16 text-modrinth-green" />,
      title: t('onboarding_title'),
      desc: t('onboarding_desc')
    },
    {
      icon: <ShieldCheck size={56} className="text-modrinth-green" />,
      title: t('onboarding_secure_title'),
      desc: t('onboarding_secure_desc')
    },
    {
      icon: <Key size={56} className="text-modrinth-green" />,
      title: t('onboarding_access_title'),
      desc: t('onboarding_access_desc')
    }
  ];

  return (
    <div className="fixed inset-0 z-[200] bg-modrinth-bg flex flex-col items-center justify-center p-6 text-center animate-fade-in">
      <div className="w-full max-w-sm flex-1 flex flex-col items-center justify-center">
        <div className="bg-modrinth-card/75 backdrop-blur-xl w-32 h-32 rounded-3xl flex items-center justify-center mb-10 shadow-[0_12px_30px_rgba(0,0,0,0.3)] animate-pulse-slow">
          {steps[step].icon}
        </div>
        <h2 className="text-3xl font-bold text-modrinth-text mb-4 animate-fade-in-up">{steps[step].title}</h2>
        <p className="text-modrinth-muted mb-10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>{steps[step].desc}</p>
        <div className="flex gap-3 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`h-2 rounded-full transition-all duration-500 ${i === step ? 'w-10 bg-modrinth-green' : 'w-2 bg-zinc-700'}`} />
          ))}
        </div>
      </div>
      <button onClick={() => step < steps.length - 1 ? setStep(step + 1) : onComplete()} className="w-full max-w-sm bg-modrinth-green text-white font-bold py-4 rounded-2xl active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-modrinth-green/20">
        {step === steps.length - 1 ? t('start') : t('next')} <ChevronRight size={20} />
      </button>
    </div>
  );
};

const LoginScreen: React.FC<{ onLogin: (token: string) => void; onStartOAuth: () => void; isLoading: boolean; error: string | null; onShowHelp: () => void; savedToken?: string | null }> = ({ onLogin, onStartOAuth, isLoading, error, onShowHelp, savedToken }) => {
  const [tokenInput, setTokenInput] = useState(savedToken || '');
  const [showPatLogin, setShowPatLogin] = useState(false);

  useEffect(() => {
    if (!tokenInput && savedToken) {
      setTokenInput(savedToken);
    }
  }, [savedToken, tokenInput]);
  const { t, theme, language } = useSettings();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-modrinth-bg p-6 relative overflow-hidden">
      <div className="w-full max-w-xs animate-fade-in-up relative z-10">
        <div className="flex justify-center mb-8">
           <div className="bg-modrinth-card/75 backdrop-blur-xl p-5 rounded-3xl shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
              <ModrinthLogo className="w-16 h-16 text-modrinth-green" />
           </div>
        </div>
        <h1 className="text-3xl font-bold text-center text-modrinth-text mb-2">{t('login_title')}</h1>
        <p className="text-modrinth-muted text-center text-sm mb-8">{t('login_subtitle')}</p>
        <div className="space-y-4">
          {error && <div className="text-red-400 text-sm text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</div>}
          <button onClick={onStartOAuth} disabled={isLoading} className="w-full bg-modrinth-green text-white font-bold py-4 rounded-2xl active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-modrinth-green/20">
            {isLoading ? <Loader2 className="animate-spin" /> : <Globe size={18} />}
            {isLoading ? t('oauth_loading') : t('oauth_continue')}
          </button>
          <button
            onClick={() => setShowPatLogin(prev => !prev)}
            className="w-full text-xs text-center text-modrinth-muted hover:text-modrinth-green underline decoration-dotted"
          >
            {showPatLogin ? t('hide_pat') : t('use_pat_instead')}
          </button>
          {showPatLogin && (
            <div className="space-y-3 pt-2">
              <div className="bg-modrinth-card/75 backdrop-blur-xl p-1 rounded-2xl shadow-[0_10px_26px_rgba(0,0,0,0.25)]">
                <input type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="mrp_..." className="w-full bg-transparent text-modrinth-text p-4 outline-none text-center font-mono" />
              </div>
              <button onClick={() => onLogin(tokenInput)} disabled={isLoading || !tokenInput} className="w-full bg-modrinth-card text-modrinth-text font-bold py-4 rounded-2xl active:scale-[0.98] flex items-center justify-center border border-modrinth-border">
                {isLoading ? <Loader2 className="animate-spin" /> : t('authorize')}
              </button>
              <button onClick={onShowHelp} className="w-full text-xs text-center text-modrinth-muted hover:text-modrinth-green underline decoration-dotted">{t('how_to_get_token')}</button>
            </div>
          )}
        </div>
      </div>
      <div className="absolute bottom-6 text-[10px] text-modrinth-muted text-center w-full">
        Unofficial app for Modrinth. Not affiliated with or endorsed by Modrinth. by <a href="https://modrinth.com/user/imsawiq" className="font-bold text-modrinth-green">imsawiq</a>
      </div>
    </div>
  );
};

const TokenHelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t, theme } = useSettings();

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={onClose}>
      <div className="bg-modrinth-card p-6 rounded-2xl max-w-md w-full border border-modrinth-border" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-modrinth-text mb-4">{t('token_help_title')}</h3>
        <ol className="list-decimal list-inside space-y-2 text-modrinth-muted text-sm mb-6">
          <li>{t('token_help_open')} <a className="text-modrinth-green hover:underline font-bold" href="https://modrinth.com/settings/pats" target="_blank" rel="noreferrer">https://modrinth.com/settings/pats</a></li>
          <li>{t('token_help_create')}</li>
          <li>{t('token_help_scopes')}</li>
          <li>{t('token_help_paste')}</li>
          <li>{t('token_help_local')}</li>
        </ol>
        <button onClick={onClose} className="w-full bg-modrinth-green text-white font-bold py-3 rounded-xl">{t('got_it')}</button>
      </div>
    </div>
  );
};

// --- Update Modal ---
const UpdateModal: React.FC<{ release: GitHubRelease; onClose: () => void }> = ({ release, onClose }) => {
  const { t, theme } = useSettings();
  const version = release.tag_name.replace(/^v/, '');
  const apkAsset = release.assets.find(a => a.name.endsWith('.apk'));

  const overlayClass = theme === 'light' ? 'bg-black/40' : 'bg-black/60';
  const modalClass = theme === 'light'
    ? 'bg-white/95 border border-black/10 shadow-[0_14px_36px_rgba(0,0,0,0.2)]'
    : 'bg-modrinth-card/95 shadow-[0_14px_36px_rgba(0,0,0,0.5)]';

  return (
    <div className={`fixed inset-0 z-[250] ${overlayClass} backdrop-blur-md flex items-center justify-center p-6 animate-fade-in`} onClick={onClose}>
      <div className={`${modalClass} backdrop-blur-xl w-full max-w-sm rounded-3xl overflow-hidden animate-scale-in`} onClick={e => e.stopPropagation()}>
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-modrinth-green/20 via-modrinth-green/10 to-transparent p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-modrinth-green/20 rounded-2xl flex items-center justify-center">
            <Download size={32} className="text-modrinth-green" />
          </div>
          <h3 className="text-xl font-bold text-modrinth-text mb-1">{t('update_available')}</h3>
          <div className="flex items-center justify-center gap-3 text-sm">
            <span className="text-modrinth-muted">{APP_VERSION}</span>
            <ChevronRight size={16} className="text-modrinth-green" />
            <span className="text-modrinth-green font-bold">{version}</span>
          </div>
        </div>

        {/* Release notes */}
        {release.body && (
          <div className="px-6 py-4 border-t border-modrinth-border/50">
            <h4 className="text-xs font-bold text-modrinth-muted uppercase mb-2">{t('update_whats_new')}</h4>
            <div className="text-sm text-modrinth-text/80 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {release.body.slice(0, 500)}{release.body.length > 500 ? '...' : ''}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-4 flex gap-3">
          <button
            onClick={onClose}
            className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-colors ${
              theme === 'light' 
                ? 'bg-black/5 text-black/70 hover:bg-black/10' 
                : 'bg-modrinth-bg text-modrinth-muted hover:text-modrinth-text'
            }`}
          >
            {t('update_later')}
          </button>
          <a
            href={apkAsset?.browser_download_url || release.html_url}
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-3 rounded-2xl font-bold text-sm bg-modrinth-green text-white text-center flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <Download size={16} /> {t('update_download')}
          </a>
        </div>
      </div>
    </div>
  );
};

const NotificationsModal: React.FC<{ isOpen: boolean; onClose: () => void; user: ModrinthUser; token: string; onUnreadCountChange?: (count: number) => void }> = ({ isOpen, onClose, user, token, onUnreadCountChange }) => {
    const [notifs, setNotifs] = useState<ModrinthNotification[]>([]);
    const [resolvedNotifs, setResolvedNotifs] = useState<ResolvedNotification[]>([]);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [pendingReadIds, setPendingReadIds] = useState<Set<string>>(() => new Set());
    const { t, theme, language } = useSettings();

    useEffect(() => {
        if(isOpen) {
            setLoading(true);
            // Explicitly fetch unread and force filter on client side to avoid ghosts from cache
            fetchNotifications(user.id, token, 'unread')
                .then(data => {
                  const unread = data.filter(n => !n.read);
                  setNotifs(unread);
                  onUnreadCountChange?.(unread.length);
                })
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [isOpen, user.id, token, onUnreadCountChange]);

    useEffect(() => {
        let cancelled = false;

        const resolveNotifications = async () => {
            if (notifs.length === 0) {
                setResolvedNotifs([]);
                return;
            }

            const replacements: Record<string, string> = {};
            const projectCache = new Map<string, ModrinthProject>();
            const versionReplacements: Record<string, string> = {};
            const entityRefs = Array.from(
                new Map(
                    notifs
                        .flatMap(getNotificationEntityRefs)
                        .map((ref) => [ref.id, ref] as const)
                ).values()
            );

            await Promise.all(entityRefs.map(async ({ id, kind, projectSlug }) => {
                if (kind === 'version') {
                    if (!projectSlug) {
                        return;
                    }

                    try {
                        const versions = await fetchProjectVersions(projectSlug, token);
                        const version = versions.find((item) => item.id === id);
                        if (version) {
                            const label = version.name || version.version_number || id;
                            replacements[id] = label;
                            versionReplacements[id] = label;
                        }
                    } catch {
                        // Leave unresolved version IDs untouched.
                    }
                    return;
                }

                if (kind === 'project' || kind === 'unknown') {
                    try {
                        const project = await fetchProject(id, token);
                        projectCache.set(project.id, project);
                        projectCache.set(project.slug, project);
                        replacements[id] = project.title || id;
                        replacements[project.id] = project.title || project.id;
                        replacements[project.slug] = project.title || project.slug;
                    } catch {
                        // Leave unknown IDs untouched.
                    }
                }
            }));

            if (cancelled) return;

            setResolvedNotifs(
                notifs.map((notif) => {
                    const link = notif.link || '';
                    const projectSlug = link.match(/\/project\/([^/?#]+)/)?.[1] || null;
                    const projectIdFromText = (notif.title + ' ' + notif.text).match(MODRINTH_ID_RE)?.find((id) => projectCache.has(id)) || null;
                    const project = (projectSlug && projectCache.get(projectSlug)) || (projectIdFromText && projectCache.get(projectIdFromText)) || null;
                    const versionId = link.match(/\/version\/([^/?#]+)/)?.[1] || (notif.text.match(MODRINTH_ID_RE)?.find((id) => versionReplacements[id]) ?? null);

                    return {
                        ...notif,
                        displayTitle: replaceResolvedIds(notif.title, replacements),
                        displayText: replaceResolvedIds(notif.text, replacements),
                        projectKey: project?.id || project?.slug || notif.id,
                        projectTitle: project?.title || null,
                        projectIconUrl: project?.icon_url || null,
                        versionLabel: versionId ? versionReplacements[versionId] || null : null
                    };
                })
            );
        };

        resolveNotifications().catch(console.error);

        return () => {
            cancelled = true;
        };
    }, [notifs, token]);

    const groupedNotifs = useMemo<NotificationGroup[]>(() => {
        const groups = new Map<string, NotificationGroup>();

        resolvedNotifs.forEach((notif) => {
            const existing = groups.get(notif.projectKey);
            if (existing) {
                existing.items.push(notif);
                if (!existing.projectTitle && notif.projectTitle) existing.projectTitle = notif.projectTitle;
                if (!existing.projectIconUrl && notif.projectIconUrl) existing.projectIconUrl = notif.projectIconUrl;
                return;
            }

            groups.set(notif.projectKey, {
                key: notif.projectKey,
                projectTitle: notif.projectTitle,
                projectIconUrl: notif.projectIconUrl,
                items: [notif]
            });
        });

        return Array.from(groups.values()).map((group) => ({
            ...group,
            items: [...group.items].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
        }));
    }, [resolvedNotifs]);

    useEffect(() => {
        setExpandedGroups((prev) => {
            const next: Record<string, boolean> = {};
            groupedNotifs.forEach((group) => {
                next[group.key] = prev[group.key] ?? group.items.length <= 1;
            });
            return next;
        });
    }, [groupedNotifs]);

    const removeUnreadNotifications = (ids: string[]) => {
        const idSet = new Set(ids);
        setNotifs((prev) => {
            const next = prev.filter((notif) => !idSet.has(notif.id));
            onUnreadCountChange?.(next.length);
            return next;
        });
    };

    const restoreUnreadNotifications = (items: ModrinthNotification[]) => {
        if (items.length === 0) return;
        setNotifs((prev) => {
            const existingIds = new Set(prev.map((notif) => notif.id));
            const next = [...prev, ...items.filter((notif) => !existingIds.has(notif.id))]
                .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
            onUnreadCountChange?.(next.length);
            return next;
        });
    };

    const handleRead = async (id: string) => {
        if (pendingReadIds.has(id)) return;
        const removed = notifs.filter((notif) => notif.id === id);
        try {
            setPendingReadIds((prev) => new Set(prev).add(id));
            removeUnreadNotifications([id]);
            await markNotificationRead(id, token);
        } catch (e) {
            restoreUnreadNotifications(removed);
            console.error(e);
        } finally {
            setPendingReadIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleReadAll = async () => {
        const ids = notifs.map(n => n.id);
        if (ids.length === 0) return;
        const removed = [...notifs];
        try {
            setLoading(true);
            setPendingReadIds(new Set(ids));
            removeUnreadNotifications(ids);
            await markMultipleNotificationsRead(ids, token);
        } catch(e) {
            restoreUnreadNotifications(removed);
            console.error(e);
        } finally {
            setPendingReadIds(new Set());
            setLoading(false);
        }
    };

    const handleReadGroup = async (ids: string[]) => {
        if (ids.length === 0) return;
        if (ids.some((id) => pendingReadIds.has(id))) return;
        const idSet = new Set(ids);
        const removed = notifs.filter((notif) => idSet.has(notif.id));
        try {
            setPendingReadIds((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.add(id));
                return next;
            });
            removeUnreadNotifications(ids);
            if (ids.length === 1) {
                await markNotificationRead(ids[0], token);
            } else {
                await markMultipleNotificationsRead(ids, token);
            }
        } catch (e) {
            restoreUnreadNotifications(removed);
            console.error(e);
        } finally {
            setPendingReadIds((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.delete(id));
                return next;
            });
        }
    };

    if (!isOpen) return null;

    const overlayClass = theme === 'light' ? 'bg-black/40' : 'bg-black/60';
    const modalClass = theme === 'light'
      ? 'bg-white/95 border border-black/10 shadow-[0_14px_36px_rgba(0,0,0,0.2)]'
      : 'bg-modrinth-card/90 shadow-[0_14px_36px_rgba(0,0,0,0.4)]';
    const cardClass = theme === 'light'
      ? 'bg-black/[0.04] border border-black/10'
      : 'bg-modrinth-bg/60';
    const readAllClass = theme === 'light'
      ? 'bg-black/[0.06] hover:bg-black/10 text-modrinth-green border border-black/10'
      : 'bg-modrinth-bg hover:bg-modrinth-cardHover text-modrinth-green';

    return (
        <div className={`fixed inset-0 z-[200] ${overlayClass} backdrop-blur-sm flex items-center justify-center px-4 sm:p-4 animate-fade-in pt-safe`}>
			<div className={`${modalClass} backdrop-blur-xl w-full max-w-md rounded-3xl animate-scale-in max-h-[75vh] sm:max-h-[80vh] flex flex-col overflow-hidden relative`}>
                <div className="p-5 flex justify-between items-center bg-transparent rounded-t-3xl relative">
                    <h3 className="text-lg font-bold text-modrinth-text flex items-center gap-2">
                        <Bell className="text-modrinth-green" size={20} /> {t('notifications')}
                    </h3>
                    <div className="flex items-center gap-2">
                        {notifs.length > 0 && (
                            <button onClick={handleReadAll} className={`${readAllClass} text-xs font-bold px-3 py-1.5 rounded-full transition-colors flex items-center gap-1`}>
                                <CheckCheck size={14}/> {t('read_all')}
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-modrinth-cardHover text-modrinth-muted hover:text-modrinth-text transition-colors">
                        <X size={18} /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
                    {loading && <div className="flex justify-center p-10"><Loader2 className="animate-spin text-modrinth-green" /></div>}
                    {!loading && notifs.length === 0 && (
                        <div className="text-center py-20 text-modrinth-muted flex flex-col items-center">
                            <div className={`${cardClass} p-4 rounded-full mb-3 opacity-50`}><Bell size={32} /></div>
                            <p>{t('no_notifications')}</p>
                        </div>
                    )}
                    {groupedNotifs.map(group => {
                        const primary = group.items[0];
                        const expanded = expandedGroups[group.key] ?? group.items.length <= 1;
                        const receivedLabel = formatNotificationRelativeTime(primary.created, language);
                        const groupActionIds = group.items.map((item) => item.id);

                        return (
                            <div key={group.key} className={`${cardClass} p-4 rounded-3xl relative overflow-hidden`}>
                                <div className="flex gap-3">
                                    {group.projectIconUrl ? (
                                        <img src={group.projectIconUrl} alt={group.projectTitle || 'Project'} className="w-11 h-11 rounded-2xl object-cover shadow-[0_8px_20px_rgba(0,0,0,0.25)]" />
                                    ) : (
                                        <div className="w-11 h-11 rounded-2xl bg-modrinth-cardHover text-modrinth-green flex items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
                                            <Package size={18} />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-[11px] uppercase tracking-[0.14em] text-modrinth-muted/80 mb-1">{t('notifications')}</p>
                                                <h4 className="text-sm font-semibold text-modrinth-text leading-snug">
                                                    {group.projectTitle ? (
                                                        <>
                                                            {t('project_updated_group')}: <span className="font-bold">{group.projectTitle}</span>
                                                        </>
                                                    ) : primary.displayTitle}
                                                </h4>
                                            </div>
                                            {group.items.length > 1 && (
                                                <button
                                                    onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.key]: !expanded }))}
                                                    className="text-modrinth-muted hover:text-modrinth-text transition-colors p-1 rounded-full hover:bg-modrinth-cardHover"
                                                >
                                                    <ChevronDown size={18} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                                </button>
                                            )}
                                        </div>
                                        {!group.projectTitle && (
                                            <p className="text-xs text-modrinth-muted leading-relaxed mt-2">{primary.displayText}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-3 space-y-2">
                                    {(expanded ? group.items : group.items.slice(0, 1)).map((item) => (
                                        <div key={item.id} className={`rounded-2xl px-3 py-2.5 ${theme === 'light' ? 'bg-white/70 border border-black/[0.08]' : 'bg-modrinth-card/70'}`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm text-modrinth-text leading-snug break-words">
                                                        <span className="font-medium text-modrinth-green">{item.versionLabel || item.displayTitle}</span>
                                                        {item.versionLabel && item.displayText ? <span className="text-modrinth-muted"> {item.displayText}</span> : null}
                                                    </div>
                                                    <div className="mt-1 flex items-center gap-3 text-[11px] text-modrinth-muted/80">
                                                        <span>{formatNotificationRelativeTime(item.created, language)}</span>
                                                        {item.link && (
                                                            <a href={`https://modrinth.com${item.link}`} target="_blank" rel="noreferrer" className="text-modrinth-green hover:underline flex items-center gap-1 truncate">
                                                                View <ExternalLink size={10}/>
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                                {group.items.length === 1 && (
                                                    <button
                                                        onClick={() => handleRead(item.id)}
                                                        disabled={pendingReadIds.has(item.id)}
                                                        className="relative text-modrinth-green hover:bg-modrinth-green/10 self-start p-1.5 rounded-full transition-colors disabled:opacity-50 disabled:pointer-events-none"
                                                    >
                                                        <Check size={16}/>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {group.items.length > 1 && (
                                    <button
                                        onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.key]: !expanded }))}
                                        className={`mt-3 text-xs font-bold px-3 py-2 rounded-full transition-colors ${
                                          theme === 'light'
                                            ? 'bg-black/[0.05] text-black/70 hover:bg-black/10'
                                            : 'bg-modrinth-cardHover text-modrinth-muted hover:text-modrinth-text'
                                        }`}
                                    >
                                        {expanded ? t('hide_versions') : `${t('show_more_versions')} (${group.items.length})`}
                                    </button>
                                )}

                                <div className="mt-3 flex items-center justify-between gap-3">
                                    <button
                                        onClick={() => handleReadGroup(groupActionIds)}
                                        disabled={groupActionIds.some((id) => pendingReadIds.has(id))}
                                        className={`text-xs font-bold px-3.5 py-2 rounded-full transition-colors flex items-center gap-1.5 ${
                                          theme === 'light'
                                            ? 'bg-black/[0.05] text-black/70 hover:bg-black/10'
                                            : 'bg-modrinth-cardHover text-modrinth-text hover:bg-modrinth-border/70'
                                        } disabled:opacity-50 disabled:pointer-events-none`}
                                    >
                                        <Check size={14} /> {t('mark_group_as_read')}
                                    </button>
                                    <span className="text-[11px] text-modrinth-muted/80">
                                        {t('received_label')} {receivedLabel}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const Dashboard: React.FC<{ user: ModrinthUser; token: string }> = ({ user, token }) => {
  const [projects, setProjects] = useState<ModrinthProject[]>([]);
  const [sortMode, setSortMode] = useState<ProjectSortMode>(() => getStoredProjectSortMode());
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const { t, theme, language } = useSettings();

  const sortedProjects = useMemo(() => sortProjectsByMode(projects, sortMode), [projects, sortMode]);

  const loadProjects = useCallback(() => {
    let mounted = true;
    setLoading(true);
    fetchUserProjects(user.id, token)
      .then(data => {
        if (mounted) {
          setProjects(data);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [user.id, token]);

  useEffect(() => {
    const cleanup = loadProjects();
    return cleanup;
  }, [loadProjects]);

  const refreshUnread = useCallback(() => {
    fetchNotifications(user.id, token, 'unread')
      .then(data => setUnreadCount(data.filter(n => !n.read).length))
      .catch(() => {});
  }, [user.id, token]);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread]);

  const handleChangeSortMode = (mode: ProjectSortMode) => {
    setSortMode(mode);
    setShowSortMenu(false);
    localStorage.setItem(PROJECT_SORT_KEY, mode);
  };

  useEffect(() => {
    if (!showSortMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showSortMenu]);

  const getSortModeLabel = (mode: ProjectSortMode) =>
    t(mode === 'updated' ? 'recently_updated' : mode === 'followers' ? 'follows_sort' : mode === 'title' ? 'alphabetical' : 'popularity');

  return (
    <div className="pb-4 px-4 animate-fade-in">
      <header className="flex justify-between items-center mb-6 sticky top-0 z-50 backdrop-blur-xl pt-[calc(env(safe-area-inset-top)+0.85rem)] pb-3 -mx-4 px-4 min-h-[84px] shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden relative transition-colors duration-300" style={{ backgroundColor: 'rgba(var(--card-rgb), 0.7)' }}>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-modrinth-text leading-none">{t('dashboard')}</h1>
          <p className="text-modrinth-muted text-xs font-medium">{t('dev_panel')}</p>
        </div>
        <div className="flex items-center gap-2">
           <a
             href={DISCORD_INVITE_URL}
             target="_blank"
             rel="noreferrer"
             className="p-2 text-modrinth-muted hover:text-modrinth-green transition-colors"
             aria-label="Open Discord server"
           >
             <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current opacity-90" aria-hidden="true">
               <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.078.037 13.709 13.709 0 0 0-.608 1.249 18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.249.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.13 14.13 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.04.107 15.228 15.228 0 0 0 1.225 1.993.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.211 0 2.176 1.094 2.157 2.418 0 1.334-.955 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.211 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419Z"/>
             </svg>
           </a>
           <button
             onClick={() => loadProjects()}
             className="p-2 text-modrinth-muted hover:text-modrinth-green transition-colors"
             aria-label="Refresh projects"
           >
             <RefreshCw size={20} />
           </button>
           <button onClick={()=>setShowNotifs(true)} className="relative p-2 text-modrinth-muted hover:text-modrinth-green transition-colors">
              <Bell size={24} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
           </button>
           <img src={user.avatar_url} alt="User" className="w-9 h-9 rounded-full shadow-[0_6px_18px_rgba(0,0,0,0.28)]" />
        </div>
      </header>
      {loading ? <div className="flex justify-center pt-40"><Loader2 className="animate-spin text-modrinth-green w-10 h-10" /></div> : (
        <div className="space-y-1 pb-20">
          <div className="mb-1 flex items-center justify-between px-1" ref={sortMenuRef}>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-modrinth-muted/75">
              {formatProjectsCountLabel(sortedProjects.length, language, t)}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSortMenu((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                  theme === 'light'
                    ? 'bg-white/80 border border-black/10 text-black/70 hover:bg-white'
                    : 'bg-modrinth-card/80 text-modrinth-muted hover:text-modrinth-text hover:bg-modrinth-cardHover'
                }`}
              >
                <Layers size={13} className="text-modrinth-green" />
                <span>{getSortModeLabel(sortMode)}</span>
                <ChevronDown size={14} className={`transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
              </button>
              {showSortMenu && (
                <div
                  className={`absolute right-0 top-[calc(100%+0.35rem)] z-40 min-w-[220px] rounded-2xl p-2 shadow-[0_14px_34px_rgba(0,0,0,0.34)] ${
                    theme === 'light'
                      ? 'bg-white/95'
                      : 'bg-modrinth-card/95'
                  } backdrop-blur-xl animate-fade-in-up`}
                >
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-modrinth-muted">
                    {t('sort_by')}
                  </div>
                  <div className="mt-1 space-y-1">
                    {PROJECT_SORT_OPTIONS.map((mode) => {
                      const active = sortMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => handleChangeSortMode(mode)}
                          className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm leading-5 transition-colors ${
                            active
                              ? 'bg-modrinth-green/14 text-modrinth-green'
                              : theme === 'light'
                                ? 'text-black/70 hover:bg-black/[0.05]'
                                : 'text-modrinth-text hover:bg-modrinth-cardHover'
                          }`}
                        >
                          <span className="font-medium">{getSortModeLabel(mode)}</span>
                          {active ? <Check size={14} /> : <span className="w-[14px]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          {sortedProjects.map((p, idx) => (
             <div key={p.id} style={{ animationDelay: `${idx * 0.05}s` }} className="animate-fade-in-up">
                <ProjectCard project={p} onClick={(id) => navigate(`/project/${id}`)} />
             </div>
          ))}
          {sortedProjects.length === 0 && (
            <div className="text-center text-modrinth-muted py-40">
              <div className="bg-modrinth-card/75 backdrop-blur-xl inline-block p-6 rounded-full mb-4 shadow-[0_10px_26px_rgba(0,0,0,0.25)]"><FileText size={48} className="opacity-50"/></div>
              <p className="text-lg font-medium">{t('no_projects')}</p>
              <p className="text-sm mt-2">{t('create_project')}</p>
            </div>
          )}
        </div>
      )}
      <NotificationsModal
        isOpen={showNotifs}
        onClose={() => { setShowNotifs(false); refreshUnread(); }}
        user={user}
        token={token}
        onUnreadCountChange={setUnreadCount}
      />
    </div>
  );
};

const InviteMemberModal: React.FC<{ isOpen: boolean; onClose: () => void; onInvite: (userId: string) => Promise<void> }> = ({ isOpen, onClose, onInvite }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const { t, theme } = useSettings();

  useEffect(() => {
    if (!query) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const hits = await searchUser(query);
        setResults(hits || []); 
      } catch (e) { 
        setResults([]); 
      }
      setSearching(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const overlayClass = theme === 'light' ? 'bg-black/30' : 'bg-black/60';
  const modalClass = theme === 'light'
    ? 'bg-white/95 border border-black/10 shadow-[0_14px_36px_rgba(0,0,0,0.2)]'
    : 'bg-modrinth-card/85 shadow-[0_14px_36px_rgba(0,0,0,0.4)]';
  const closeButtonClass = theme === 'light'
    ? 'p-2 rounded-full hover:bg-black/5 text-black/60 hover:text-black transition-colors'
    : 'p-2 rounded-full hover:bg-modrinth-cardHover text-modrinth-muted hover:text-modrinth-text transition-colors';
  const rowHoverClass = theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-modrinth-bg/60';

  return (
    <div className={`fixed inset-0 z-[150] ${overlayClass} backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in`}>
      <div className={`${modalClass} backdrop-blur-xl w-full max-w-sm rounded-3xl p-5 animate-fade-in-up relative overflow-hidden`}>
        <div className="relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-modrinth-text">{t('invite')}</h3>
          <button onClick={onClose} className={closeButtonClass}>
          <X size={18}/></button>
        </div>
        <div className="relative mb-4">
           <Search className={`absolute left-3 top-3 ${theme === 'light' ? 'text-black/40' : 'text-modrinth-muted'}`} size={16}/>
           <input
             autoFocus
             type="text"
             placeholder={t('search_user')}
             className={`w-full rounded-2xl pl-10 pr-4 py-3 text-sm outline-none border transition-colors ${
               theme === 'light'
                 ? 'bg-white text-black border-black/10 placeholder:text-black/40 focus:border-modrinth-green'
                 : 'bg-modrinth-bg text-modrinth-text border-modrinth-border/70 placeholder:text-modrinth-muted focus:border-modrinth-green'
             }`}
             value={query}
             onChange={e=>setQuery(e.target.value)}
           />
        </div>
        <div className="max-h-60 overflow-y-auto space-y-2">
           {searching && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-modrinth-green"/></div>}
           {!searching && results.map(user => (
             <div key={user.user_id} className={`flex items-center justify-between p-2 rounded-2xl group cursor-pointer ${rowHoverClass}`} onClick={() => { onInvite(user.user_id); onClose(); }}>
                <div className="flex items-center gap-3">
                  <img src={user.avatar_url} className="w-8 h-8 rounded-full" alt=""/>
                  <span className="text-sm font-bold text-modrinth-text">{user.username}</span>
                </div>
                <button className="bg-modrinth-green/16 text-modrinth-green px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-modrinth-green hover:text-white transition-colors active:scale-[0.98]">{t('add')}</button>
             </div>
           ))}
           {!searching && query && results.length === 0 && <p className="text-center text-xs text-modrinth-muted py-4">{t('user_not_found')}</p>}
        </div>
        </div>
      </div>
    </div>
  );
};

const ProfileEditModal: React.FC<{ isOpen: boolean; onClose: () => void; user: ModrinthUser; token: string; onUpdate: () => void }> = ({ isOpen, onClose, user, token, onUpdate }) => {
  const [data, setData] = useState({ username: user.username, bio: user.bio || '', avatar_url: user.avatar_url });
  const [saving, setSaving] = useState(false);
  const { t, theme } = useSettings();

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await modifyUser(user.id, data, token);
      onUpdate();
      onClose();
    } catch (e) { alert('Error updating profile'); }
    setSaving(false);
  };

  const overlayClass = theme === 'light' ? 'bg-black/40' : 'bg-black/60';
  const modalClass = theme === 'light'
    ? 'bg-white/95 border border-black/10 shadow-[0_14px_36px_rgba(0,0,0,0.2)]'
    : 'bg-modrinth-card/90 shadow-[0_18px_44px_rgba(0,0,0,0.48)]';
  const inputClass = theme === 'light'
    ? 'bg-black/[0.04] text-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] focus:shadow-[inset_0_0_0_1px_rgba(48,178,124,0.55)]'
    : 'bg-modrinth-bg text-modrinth-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)] focus:shadow-[inset_0_0_0_1px_rgba(74,222,128,0.35),inset_0_0_0_2px_rgba(0,0,0,0.22)]';
  const mutedLabelClass = theme === 'light' ? 'text-black/60' : 'text-modrinth-muted';
  const closeButtonClass = theme === 'light'
    ? 'p-2 rounded-full hover:bg-black/5 text-black/60 hover:text-black transition-colors'
    : 'p-2 rounded-full hover:bg-modrinth-bg text-modrinth-muted hover:text-modrinth-text transition-colors';
  const cancelButtonClass = theme === 'light'
    ? 'flex-1 py-3 rounded-2xl font-bold text-sm bg-black/5 text-black/70 hover:text-black hover:bg-black/10 transition-colors active:scale-[0.98]'
    : 'flex-1 py-3 rounded-2xl font-bold text-sm bg-modrinth-bg text-modrinth-muted hover:text-modrinth-text hover:bg-modrinth-cardHover transition-colors active:scale-[0.98] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)]';

  return (
    <div className={`fixed inset-0 z-[150] ${overlayClass} backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in`}>
      <div className={`${modalClass} backdrop-blur-xl w-full max-w-sm rounded-3xl p-5 animate-fade-in-up relative overflow-hidden`}>
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-modrinth-text">{t('edit_profile')}</h3>
            <button onClick={onClose} className={closeButtonClass}>
              <X size={18} />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className={`text-xs font-bold uppercase mb-1 block ${mutedLabelClass}`}>{t('username')}</label>
              <input className={`w-full rounded-2xl p-3 text-sm outline-none ${inputClass}`} value={data.username} onChange={e=>setData({...data, username:e.target.value})} />
            </div>
            <div>
              <label className={`text-xs font-bold uppercase mb-1 block ${mutedLabelClass}`}>{t('bio')}</label>
              <textarea className={`w-full rounded-2xl p-3 text-sm h-24 resize-none outline-none ${inputClass}`} value={data.bio} onChange={e=>setData({...data, bio:e.target.value})} />
            </div>
            <div>
              <label className={`text-xs font-bold uppercase mb-1 block ${mutedLabelClass}`}>{t('avatar_url')}</label>
              <input className={`w-full rounded-2xl p-3 text-sm outline-none ${inputClass}`} value={data.avatar_url} onChange={e=>setData({...data, avatar_url:e.target.value})} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className={cancelButtonClass}>{t('cancel')}</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-modrinth-green text-white flex justify-center items-center active:scale-[0.98] shadow-[0_12px_30px_rgba(48,178,124,0.25)]">
                {saving ? <Loader2 className="animate-spin" size={18}/> : t('save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProjectDetail: React.FC<{ token: string; currentUserId?: string | null }> = ({ token, currentUserId }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ModrinthProject | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [versions, setVersions] = useState<ModrinthVersion[]>([]);
  const [deps, setDeps] = useState<ProjectDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'members' | 'versions'>('overview');
  const [tabDirection, setTabDirection] = useState<'left' | 'right'>('right');
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<ModrinthProject>>({});
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingVersion, setEditingVersion] = useState<ModrinthVersion | null>(null);
  const [editingVersionName, setEditingVersionName] = useState('');
  const [editingVersionType, setEditingVersionType] = useState<'release' | 'beta' | 'alpha'>('release');
  const [editingVersionChangelog, setEditingVersionChangelog] = useState('');
  const [editingVersionGameVersions, setEditingVersionGameVersions] = useState<string[]>([]);
  const [editingVersionLoaders, setEditingVersionLoaders] = useState<string[]>([]);
  const [editingVersionDependencies, setEditingVersionDependencies] = useState<ProjectDependency[]>([]);
  const [savingVersion, setSavingVersion] = useState(false);
  const [versionMenuId, setVersionMenuId] = useState<string | null>(null);
  const versionMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ModrinthVersion | null>(null);
  const [selectedVersionDeps, setSelectedVersionDeps] = useState<ProjectDependency[]>([]);
  const [selectedVersionDepsLoading, setSelectedVersionDepsLoading] = useState(false);
  const { t, theme } = useSettings();

  const [showBodyPreview, setShowBodyPreview] = useState(false);
  const [galleryPreviewUrl, setGalleryPreviewUrl] = useState<string | null>(null);
  const [memberEdits, setMemberEdits] = useState<Record<string, { role: string; permissions: string; payouts_split: string; ordering: string }>>({});
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [transferCandidate, setTransferCandidate] = useState<{ id: string; name: string } | null>(null);

  const permissionDefs = useMemo(() => ([
    { bit: 0, label: t('perm_upload_version') },
    { bit: 1, label: t('perm_delete_version') },
    { bit: 2, label: t('perm_edit_details') },
    { bit: 3, label: t('perm_edit_body') },
    { bit: 4, label: t('perm_manage_invites') },
    { bit: 5, label: t('perm_remove_member') },
    { bit: 6, label: t('perm_edit_member') },
    { bit: 7, label: t('perm_delete_project') },
    { bit: 8, label: t('perm_view_analytics') },
    { bit: 9, label: t('perm_view_payouts') }
  ]), [t]);

  const [gameVersionTags, setGameVersionTags] = useState<string[]>([]);
  const [loaderTags, setLoaderTags] = useState<string[]>([]);

  useEffect(() => {
    if (!versionMenuId) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!versionMenuRef.current?.contains(event.target as Node)) {
        setVersionMenuId(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [versionMenuId]);
  const [newDepType, setNewDepType] = useState<'required' | 'optional' | 'incompatible' | 'embedded'>('required');

  const allGameVersions = useMemo(() => {
    const fromTags = gameVersionTags;
    if (fromTags.length > 0) return fromTags;
    return Array.from(new Set(versions.flatMap(v => v.game_versions))).sort();
  }, [gameVersionTags, versions]);

  const allLoaders = useMemo(() => {
    const fromTags = loaderTags;
    if (fromTags.length > 0) return fromTags;
    return Array.from(new Set(versions.flatMap(v => v.loaders))).sort();
  }, [loaderTags, versions]);

  const tabsOrder: Array<'overview' | 'versions' | 'edit' | 'members'> = ['overview', 'versions', 'edit', 'members'];
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const depInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadVersionDependencies = async () => {
      if (!selectedVersion) {
        setSelectedVersionDeps([]);
        setSelectedVersionDepsLoading(false);
        return;
      }

      const rawDeps = selectedVersion.dependencies || [];
      if (rawDeps.length === 0) {
        setSelectedVersionDeps([]);
        setSelectedVersionDepsLoading(false);
        return;
      }

      const projectIds = Array.from(new Set(rawDeps.map((dep) => dep.project_id).filter(Boolean))) as string[];
      if (projectIds.length === 0) {
        setSelectedVersionDeps(rawDeps);
        setSelectedVersionDepsLoading(false);
        return;
      }

      setSelectedVersionDepsLoading(true);
      try {
        const projects = await Promise.all(
          projectIds.map(async (projectId) => {
            try {
              return await fetchProject(projectId, token);
            } catch {
              return null;
            }
          })
        );

        if (cancelled) return;

        const byId = new Map(projects.filter(Boolean).map((item) => [item!.id, item!] as const));
        setSelectedVersionDeps(
          rawDeps.map((dep) => {
            const meta = dep.project_id ? byId.get(dep.project_id) : null;
            return meta ? { ...dep, title: dep.title || meta.title, icon_url: dep.icon_url || meta.icon_url } : dep;
          })
        );
      } finally {
        if (!cancelled) setSelectedVersionDepsLoading(false);
      }
    };

    loadVersionDependencies().catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [selectedVersion, token]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;

    touchStartX.current = null;
    touchStartY.current = null;

    // Ignore mostly vertical gestures or very short swipes
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;

    const currentIndex = tabsOrder.indexOf(activeTab as any);
    if (currentIndex === -1) return;

    // Left swipe -> next tab, right swipe -> previous tab
    if (dx < 0 && currentIndex < tabsOrder.length - 1) {
      // двигаемся вперёд, контент заезжает справа
      setTabDirection('right');
      setActiveTab(tabsOrder[currentIndex + 1]);
    } else if (dx > 0 && currentIndex > 0) {
      // двигаемся назад, контент заезжает слева
      setTabDirection('left');
      setActiveTab(tabsOrder[currentIndex - 1]);
    }
  };

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [pData, mData, dData, vData, gvTags, ldTags] = await Promise.all([
        fetchProject(id, token),
        fetchProjectMembers(id, token),
        fetchProjectDependencies(id, token),
        fetchProjectVersions(id, token),
        fetchGameVersionTags(),
        fetchLoaderTags()
      ]);
      setProject(pData);
      setMembers(mData);
      setDeps(dData);
      setVersions(vData);
      setGameVersionTags(gvTags);
      setLoaderTags(ldTags);
      setFormData({
        title: pData.title,
        description: pData.description,
        body: pData.body,
        client_side: pData.client_side,
        server_side: pData.server_side,
        source_url: pData.source_url || '',
        issues_url: pData.issues_url || '',
        wiki_url: pData.wiki_url || '',
        discord_url: pData.discord_url || '',
        license: pData.license,
        status: pData.status 
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  const handleAddDependency = useCallback(async (rawIdOrSlug: string) => {
    const value = rawIdOrSlug.trim();
    if (!value) return;
    try {
      // Resolve slug or id to internal project id so DB foreign key passes
      const proj = await fetchProject(value, token);
      const projectId = proj.id;
      setEditingVersionDependencies(prev => [
        ...prev,
        { project_id: projectId, version_id: null, file_name: null, dependency_type: newDepType }
      ]);
    } catch (e: any) {
      alert(e.message || 'Failed to resolve project id for dependency');
    }
  }, [token, newDepType]);

  const openEditVersion = (v: ModrinthVersion) => {
    setEditingVersion(v);
    setEditingVersionName(v.name || '');
    setEditingVersionType(v.version_type as any);
    setEditingVersionChangelog((v.changelog as any) || '');
    setEditingVersionGameVersions([...v.game_versions]);
    setEditingVersionLoaders([...v.loaders]);
    setEditingVersionDependencies(v.dependencies ? [...v.dependencies] : []);
  };

  const handleSaveVersion = async () => {
    if (!editingVersion) return;
    try {
      setSavingVersion(true);
      await modifyVersion(
        editingVersion.id,
        {
          name: editingVersionName,
          version_type: editingVersionType,
          changelog: editingVersionChangelog,
          game_versions: editingVersionGameVersions,
          loaders: editingVersionLoaders,
          dependencies: editingVersionDependencies,
        },
        token
      );
      await loadData();
      setEditingVersion(null);
    } catch (e: any) {
      alert(e.message || 'Failed to update version');
    } finally {
      setSavingVersion(false);
    }
  };

  const handleDeleteVersion = async (v: ModrinthVersion) => {
    if (!window.confirm('Delete this version?')) return;
    try {
      await deleteVersionById(v.id, token);
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to delete version');
    }
  };

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (members.length === 0) return;
    setMemberEdits(prev => {
      const next = { ...prev };
      members.forEach(m => {
        if (!next[m.user.id]) {
          next[m.user.id] = {
            role: m.role || '',
            permissions: m.permissions !== undefined && m.permissions !== null ? String(m.permissions) : '',
            payouts_split: (m as any).payouts_split !== undefined && (m as any).payouts_split !== null ? String((m as any).payouts_split) : '',
            ordering: (m as any).ordering !== undefined && (m as any).ordering !== null ? String((m as any).ordering) : ''
          };
        }
      });
      return next;
    });
  }, [members]);

  const handleInputChange = (field: keyof ModrinthProject | string, value: any) => {
    setFormData(prev => field === 'license_id' ? { ...prev, license: { ...prev.license!, id: value, name: prev.license?.name || '' } } : { ...prev, [field]: value });
  };

  const handleSave = async () => {
    if (!project || !id) return;
    setIsSaving(true);
    try {
      await updateProject(id, formData, token);
      await loadData();
      const notif = document.createElement('div');
      notif.innerText = t('saved');
      notif.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 bg-modrinth-green text-white px-6 py-3 rounded-full shadow-xl z-[200] animate-fade-in-up font-bold text-sm';
      document.body.appendChild(notif);
      setTimeout(() => notif.remove(), 2000);
      setActiveTab('overview');
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };


  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if(!e.target.files?.[0] || !id) return;
      try {
          await changeProjectIcon(id, e.target.files[0], token);
          await loadData();
      } catch(err:any) { alert(err.message); }
  };

  const handleDeleteIcon = async () => {
      if(!id || !confirm('Delete icon?')) return;
      try { await deleteProjectIcon(id, token); await loadData(); } catch(err:any) { alert(err.message); }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if(!e.target.files?.[0] || !id) return;
      try {
          await addGalleryImage(id, e.target.files[0], false, 'Gallery Image', '', token);
          await loadData();
      } catch(err:any) { alert(err.message); }
  };

  const handleDeleteGallery = async (url: string) => {
      if(!id || !confirm('Delete image?')) return;
      try { await deleteGalleryImage(id, url, token); await loadData(); } catch(err:any) { alert(err.message); }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!project || !confirm(t('member_remove_confirm'))) return;
    try {
      await deleteTeamMember(project.team, userId, token);
      await loadData();
    } catch(e) { alert('Failed to remove member'); }
  };

  const handleRoleSave = async (userId: string) => {
     if(!project) return;
     const edit = memberEdits[userId];
     if (!edit) return;
     const payload: any = {};
     if (edit.role.trim() !== '') payload.role = edit.role.trim();
     const permissionsNum = edit.permissions !== '' ? Number(edit.permissions) : null;
     const payoutsSplitNum = edit.payouts_split !== '' ? Number(edit.payouts_split) : null;
     const orderingNum = edit.ordering !== '' ? Number(edit.ordering) : null;
     if (permissionsNum !== null && !Number.isNaN(permissionsNum)) payload.permissions = permissionsNum;
     if (payoutsSplitNum !== null && !Number.isNaN(payoutsSplitNum)) payload.payouts_split = payoutsSplitNum;
     if (orderingNum !== null && !Number.isNaN(orderingNum)) payload.ordering = orderingNum;
     try {
        setSavingMemberId(userId);
        await updateTeamMember(project.team, userId, payload, token);
        await loadData();
     } catch(e) { alert('Failed to update member'); }
     finally { setSavingMemberId(null); }
  };

  const handleJoinTeam = async () => {
    if (!project) return;
    try {
      await joinTeam(project.team, token);
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to join team');
    }
  };

  const openTransferOwnership = (userId: string, name: string) => {
    setTransferCandidate({ id: userId, name });
  };

  const handleTransferOwnership = async () => {
    if (!project || !transferCandidate) return;
    try {
      await transferTeamOwnership(project.team, transferCandidate.id, token);
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to transfer ownership');
    }
    setTransferCandidate(null);
  };

  const handleInvite = async (userId: string) => {
    if (!project) return;
    try {
      await addTeamMember(project.team, userId, token);
      await loadData();
      setShowInviteModal(false);
    } catch(e: any) { alert(e.message || 'Failed to invite'); }
  };

  if (loading && !project) return <div className="h-screen flex items-center justify-center bg-modrinth-bg"><Loader2 className="animate-spin text-modrinth-green w-10 h-10" /></div>;
  if (!project) return <div className="h-screen flex items-center justify-center bg-modrinth-bg text-modrinth-text">Not Found</div>;

  const projectSummary = (project.description || '').trim();

  return (
    <div
      className="min-h-screen bg-modrinth-bg pb-10 relative z-0 animate-fade-in"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="sticky top-0 z-50 bg-modrinth-bg/90 backdrop-blur-xl border-b border-modrinth-border pt-[env(safe-area-inset-top)] transition-colors duration-300">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full text-modrinth-text hover:bg-white/10 active:scale-90"><ArrowLeft size={24} /></button>
          <h1 className="text-lg font-bold text-modrinth-text truncate max-w-[180px]">{project.title}</h1>
          {activeTab === 'edit' ? (
            <button onClick={handleSave} disabled={isSaving} className="bg-modrinth-green text-white px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 active:scale-95">
              {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16} />} {t('save')}
            </button>
          ) : <div className="w-16"></div>}
        </div>
        <div className="flex px-4 gap-6 justify-center mt-1 overflow-x-auto no-scrollbar">
          {['overview', 'versions', 'edit', 'members'].map((tab, index) => (
            <button
              key={tab}
              onClick={() => {
                const currentIndex = tabsOrder.indexOf(activeTab as any);
                if (currentIndex !== -1 && currentIndex !== index) {
                  setTabDirection(index > currentIndex ? 'right' : 'left');
                }
                setActiveTab(tab as any);
              }}
              className={`pb-3 text-sm font-bold whitespace-nowrap relative ${activeTab === tab ? 'text-modrinth-text' : 'text-modrinth-muted'}`}
            >
              {t(tab)}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-modrinth-green rounded-t-full" />}
            </button>
          ))}
        </div>
      </div>

      {/** Direction-based animation class for tab content */}
      {(() => {
        const animClass = tabDirection === 'left' ? 'animate-slide-in-left' : 'animate-slide-in-right';
        return (
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6">
        {activeTab === 'overview' && (
          <div className={`space-y-6 ${animClass}`}>
             <div className="grid grid-cols-2 gap-3">
                <div className="bg-modrinth-card/75 backdrop-blur-xl p-5 rounded-3xl relative overflow-hidden shadow-[0_10px_26px_rgba(0,0,0,0.25)]">
                   <div className="absolute top-0 right-0 p-3 opacity-10 text-modrinth-text"><Download size={40} /></div>
                   <p className="text-modrinth-muted text-xs uppercase font-bold mb-1">{t('downloads')}</p>
                   <p className="text-2xl font-bold text-modrinth-text">{project.downloads.toLocaleString()}</p>
                </div>
                <div className="bg-modrinth-card/75 backdrop-blur-xl p-5 rounded-3xl relative overflow-hidden shadow-[0_10px_26px_rgba(0,0,0,0.25)]">
                   <div className="absolute top-0 right-0 p-3 opacity-10 text-modrinth-text"><Heart size={40} /></div>
                   <p className="text-modrinth-muted text-xs uppercase font-bold mb-1">{t('likes')}</p>
                   <p className="text-2xl font-bold text-modrinth-text">{project.followers.toLocaleString()}</p>
                </div>
             </div>
             <div className="bg-modrinth-card/75 backdrop-blur-xl rounded-3xl p-5 shadow-[0_10px_26px_rgba(0,0,0,0.22)] relative overflow-hidden">
                <h3 className="text-modrinth-text font-bold mb-2 text-sm flex items-center gap-2"><Info size={16} className="text-modrinth-green"/> {t('summary')}</h3>
                <p className="text-modrinth-text/80 leading-relaxed text-sm">{projectSummary || t('no_summary')}</p>
             </div>
             <div className="bg-modrinth-card/75 backdrop-blur-xl rounded-3xl p-5 shadow-[0_10px_26px_rgba(0,0,0,0.22)] relative overflow-hidden">
                <h3 className="text-modrinth-text font-bold mb-2 text-sm flex items-center gap-2"><FileText size={16} className="text-modrinth-green"/> {t('description')}</h3>
                {project.body?.trim() ? (
                  <React.Suspense fallback={<div className="text-modrinth-muted text-sm py-2">Loading description...</div>}>
                    <MarkdownRenderer
                      content={project.body}
                      className="text-modrinth-text/80 leading-relaxed text-sm markdown-preview"
                    />
                  </React.Suspense>
                ) : (
                  <p className="text-modrinth-text/80 leading-relaxed text-sm">{t('no_description')}</p>
                )}
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="bg-modrinth-card/75 backdrop-blur-xl p-4 rounded-3xl shadow-[0_10px_26px_rgba(0,0,0,0.2)] relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-3 text-modrinth-muted text-xs font-bold uppercase"><Monitor size={14} /> {t('client')}</div>
                  <div className={`text-center py-2 rounded-lg font-bold text-sm border ${project.client_side === 'required' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-modrinth-cardHover text-modrinth-muted border-modrinth-border'}`}>{project.client_side}</div>
               </div>
               <div className="bg-modrinth-card/75 backdrop-blur-xl p-4 rounded-3xl shadow-[0_10px_26px_rgba(0,0,0,0.2)] relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-3 text-modrinth-muted text-xs font-bold uppercase"><Server size={14} /> {t('server')}</div>
                  <div className={`text-center py-2 rounded-lg font-bold text-sm border ${project.server_side === 'required' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-modrinth-cardHover text-modrinth-muted border-modrinth-border'}`}>{project.server_side}</div>
               </div>
             </div>
             
             {/* Dependencies */}
             <div className="bg-modrinth-card/75 backdrop-blur-xl rounded-3xl p-5 shadow-[0_10px_26px_rgba(0,0,0,0.22)] relative overflow-hidden">
                 <h3 className="text-modrinth-text font-bold mb-3 text-sm flex items-center gap-2"><Package size={16} className="text-modrinth-green"/> {t('dependencies')}</h3>
                 <div className="space-y-3">
                     {deps.length === 0 && <p className="text-xs text-modrinth-muted italic">{t('no_dependencies')}</p>}
                     {deps.map((d, i) => (
                         <div key={i} className="flex items-center gap-3 bg-modrinth-bg p-3 rounded-2xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
                             <div className="w-10 h-10 rounded-lg bg-modrinth-card shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden flex-shrink-0 flex items-center justify-center">
                                {d.icon_url ? (
                                  <img src={d.icon_url} className="w-full h-full object-cover"/>
                                ) : (
                                  <Package size={20} className="text-modrinth-muted opacity-50"/>
                                )}
                             </div>
                             <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                   <span className="text-sm font-bold text-modrinth-text truncate pr-2">{d.title || d.project_id}</span>
                                   <span className="text-[10px] text-modrinth-muted bg-modrinth-bg px-2 py-0.5 rounded-full uppercase tracking-wider">{d.dependency_type}</span>
                                </div>
                                <p className="text-[10px] text-modrinth-muted font-mono mt-0.5">{d.project_id || d.file_name}</p>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>

             <div className="space-y-2 pt-2">
               <h3 className="text-modrinth-muted font-bold text-xs uppercase px-1 mb-1">{t('resources')}</h3>
               {project.source_url && <a href={project.source_url} target="_blank" className="flex items-center gap-3 p-4 rounded-3xl bg-modrinth-card/75 backdrop-blur-xl text-modrinth-text active:scale-[0.99] shadow-[0_10px_26px_rgba(0,0,0,0.2)]"><Globe size={18} /><span className="text-sm font-medium">{t('source')}</span><ExternalLink size={14} className="ml-auto opacity-30"/></a>}
               {project.issues_url && <a href={project.issues_url} target="_blank" className="flex items-center gap-3 p-4 rounded-3xl bg-modrinth-card/75 backdrop-blur-xl text-modrinth-text active:scale-[0.99] shadow-[0_10px_26px_rgba(0,0,0,0.2)]"><Info size={18} /><span className="text-sm font-medium">{t('issues')}</span><ExternalLink size={14} className="ml-auto opacity-30"/></a>}
             </div>
          </div>
        )}
        {activeTab === 'versions' && (
            <div className={`space-y-4 pb-24 ${animClass}`}>
                {versions.length === 0 ? (
                    <div className="text-center py-10 text-modrinth-muted">
                        <Layers size={48} className="mx-auto mb-4 opacity-50"/>
                        <p>{t('no_versions')}</p>
                    </div>
                ) : (
                    versions.map(v => (
                        <div
                          key={v.id}
                          onClick={() => setSelectedVersion(v)}
                          className="bg-modrinth-card/75 backdrop-blur-xl p-4 rounded-3xl relative shadow-[0_10px_26px_rgba(0,0,0,0.22)] overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-modrinth-text font-bold text-base">{v.version_number}</span>
                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                                            v.version_type === 'release' ? 'text-green-400 border-green-400/30 bg-green-400/10' :
                                            v.version_type === 'beta' ? 'text-blue-400 border-blue-400/30 bg-blue-400/10' :
                                            'text-orange-400 border-orange-400/30 bg-orange-400/10'
                                        }`}>
                                            {t(v.version_type)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-modrinth-muted truncate w-40">{v.name}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2" ref={versionMenuId === v.id ? versionMenuRef : null}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setVersionMenuId(prev => prev === v.id ? null : v.id); }}
                                    className={`p-3 rounded-full transition-colors ${
                                      theme === 'light'
                                        ? 'text-black/80 hover:text-black hover:bg-black/5'
                                        : 'text-zinc-300 hover:text-modrinth-green hover:bg-modrinth-bg'
                                    }`}
                                  >
                                    <MoreVertical size={20} strokeWidth={3} />
                                  </button>
                                  {versionMenuId === v.id && (
                                    <div
                                      className={`absolute top-10 right-2 z-30 rounded-2xl text-[11px] overflow-hidden animate-fade-in-up min-w-[140px] ${
                                        theme === 'light'
                                          ? 'bg-white/95 border border-black/10 shadow-[0_12px_30px_rgba(0,0,0,0.2)] backdrop-blur-xl'
                                          : 'bg-modrinth-card shadow-[0_12px_30px_rgba(0,0,0,0.6)]'
                                      }`}
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <button
                                        className={`relative w-full px-3 py-2 text-left flex items-center gap-1.5 ${
                                          theme === 'light' ? 'text-black hover:bg-black/5' : 'text-modrinth-text hover:bg-modrinth-bg'
                                        }`}
                                        onClick={() => { setVersionMenuId(null); openEditVersion(v); }}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        className={`relative w-full px-3 py-2 text-left text-red-400 hover:bg-red-500/10 ${theme === 'light' ? 'border-t border-black/10' : 'border-t border-modrinth-border/20'}`}
                                        onClick={() => { setVersionMenuId(null); handleDeleteVersion(v); }}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                  <span className="flex items-center gap-1 text-xs font-medium text-modrinth-text"><Download size={12} className="text-modrinth-green"/> {v.downloads.toLocaleString()}</span>
                                  <span className="flex items-center gap-1 text-[10px] text-modrinth-muted"><Calendar size={10}/> {new Date(v.date_published).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                    {v.game_versions.map(gv => (
                                        <span key={gv} className="text-[10px] bg-modrinth-bg px-2 py-1 rounded-full text-modrinth-muted whitespace-nowrap">{gv}</span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    {v.loaders.map(l => (
                                        <span key={l} className="text-[10px] font-bold uppercase text-modrinth-text/70 bg-modrinth-bg px-2 py-0.5 rounded-full">{l}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}
        {activeTab === 'edit' && (
          <div className={`space-y-8 pb-20 ${animClass}`}>
            {/* Icon Management */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-modrinth-green mb-2 px-1"><ImageIcon size={18} /><h3 className="font-bold uppercase tracking-wider text-sm">{t('icon')}</h3></div>
                <div className="bg-modrinth-card/75 backdrop-blur-xl p-5 rounded-3xl flex items-center gap-4 shadow-[0_10px_26px_rgba(0,0,0,0.22)] relative overflow-hidden">
                    <div className="w-16 h-16 rounded-2xl bg-modrinth-bg/60 border border-modrinth-border/30 overflow-hidden flex items-center justify-center relative">
                        {project.icon_url ? <img src={project.icon_url} className="w-full h-full object-cover" /> : <ImageIcon className="text-modrinth-muted"/>}
                    </div>
                    <div className="flex-1 space-y-2 relative">
                        <label className="flex items-center justify-center gap-2 bg-modrinth-bg/60 border border-modrinth-border/30 text-modrinth-text text-xs font-bold py-2 rounded-2xl cursor-pointer hover:bg-modrinth-bg transition-colors">
                            <Upload size={14}/> {t('upload')}
                            <input type="file" className="hidden" accept="image/png,image/jpeg" onChange={handleIconUpload} />
                        </label>
                        {project.icon_url && (
                            <button onClick={handleDeleteIcon} className="w-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold py-2 rounded-xl hover:bg-red-500/20 flex items-center justify-center gap-2">
                                <Trash2 size={14}/> {t('remove')}
                            </button>
                        )}
                    </div>
                </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-modrinth-green mb-2 px-1"><Edit3 size={18} /><h3 className="font-bold uppercase tracking-wider text-sm">{t('main_info')}</h3></div>
              <div className="space-y-4 bg-modrinth-card/75 backdrop-blur-xl p-5 rounded-3xl shadow-[0_10px_26px_rgba(0,0,0,0.22)] relative overflow-hidden">
                <div><label className="block text-xs font-bold text-modrinth-muted uppercase mb-1.5">{t('title')}</label><input type="text" value={formData.title || ''} onChange={e => handleInputChange('title', e.target.value)} className="w-full bg-modrinth-bg border border-modrinth-border rounded-xl p-3.5 text-modrinth-text text-sm focus:border-modrinth-green outline-none"/></div>
                <div>
                    <label className="block text-xs font-bold text-modrinth-muted uppercase mb-1.5">{t('short_desc')}</label>
                    <textarea value={formData.description || ''} onChange={e => handleInputChange('description', e.target.value)} className="w-full bg-modrinth-bg border border-modrinth-border rounded-xl p-3.5 text-modrinth-text text-sm focus:border-modrinth-green outline-none h-24 resize-none"/>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-modrinth-muted uppercase">{t('body_desc')}</label>
                    <button
                      type="button"
                      onClick={() => setShowBodyPreview(v => !v)}
                      className="text-[10px] px-2 py-1 rounded-full border border-modrinth-border bg-modrinth-bg text-modrinth-muted hover:text-modrinth-text hover:border-modrinth-green transition-colors"
                    >
                      {showBodyPreview ? t('hide_preview') : t('show_preview')}
                    </button>
                  </div>
                  <textarea
                    value={formData.body || ''}
                    onChange={e => handleInputChange('body', e.target.value)}
                    className="w-full bg-modrinth-bg border border-modrinth-border rounded-xl p-3.5 text-modrinth-text text-sm focus:border-modrinth-green outline-none h-40 font-mono text-xs"
                  />
                  {showBodyPreview && (
                  <div className="mt-1 bg-modrinth-bg border border-dashed border-modrinth-border rounded-xl p-3.5 text-sm text-modrinth-text prose prose-invert max-w-none markdown-preview no-scrollbar overflow-x-auto">
                      <React.Suspense fallback={<div className="text-modrinth-muted text-xs">Loading preview...</div>}>
                        <MarkdownRenderer content={formData.body || ''} />
                      </React.Suspense>
                  </div>
                  )}
                </div>
              </div>
            </section>

            {/* Gallery Management */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-modrinth-green mb-2 px-1"><ImageIcon size={18} /><h3 className="font-bold uppercase tracking-wider text-sm">{t('gallery')}</h3></div>
                <div className="bg-modrinth-card/75 backdrop-blur-xl p-5 rounded-3xl shadow-[0_10px_26px_rgba(0,0,0,0.22)] relative overflow-hidden">
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {project.gallery?.map((img, idx) => (
                            <div
                              key={idx}
                              className="relative aspect-square rounded-lg overflow-hidden group bg-modrinth-bg cursor-zoom-in"
                              onClick={() => setGalleryPreviewUrl(img.url)}
                            >
                                <img src={img.url} className="w-full h-full object-cover" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteGallery(img.url);
                                  }}
                                  className="absolute top-1 right-1 bg-black/50 p-1 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X size={12}/>
                                </button>
                            </div>
                        ))}
                    </div>
                    <label className="flex items-center justify-center gap-2 w-full bg-modrinth-bg border-2 border-dashed border-modrinth-border text-modrinth-muted text-sm font-bold py-4 rounded-xl cursor-pointer hover:border-modrinth-green hover:text-modrinth-green transition-colors">
                        <Upload size={18}/> {t('add')} Image
                        <input type="file" className="hidden" accept="image/*" onChange={handleGalleryUpload} />
                    </label>
                </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-modrinth-green mb-2 px-1"><ShieldCheck size={18} /><h3 className="font-bold uppercase tracking-wider text-sm">{t('status_license')}</h3></div>
              <div className="bg-modrinth-card/75 backdrop-blur-xl p-5 rounded-3xl shadow-[0_10px_26px_rgba(0,0,0,0.22)] relative overflow-hidden space-y-4">
                 {/* Read-only current status */}
                 <div>
                    <label className="block text-xs font-bold text-modrinth-muted uppercase mb-1.5">{t('status')}</label>
                    <div className="w-full bg-modrinth-bg/50 border border-modrinth-border rounded-xl p-3.5 text-modrinth-muted text-sm cursor-not-allowed flex items-center gap-2">
                       <Lock size={14}/> {formData.status}
                    </div>
                 </div>
                 {/* Action Status */}
                 <div>
                    <label className="block text-xs font-bold text-modrinth-muted uppercase mb-1.5">{t('change_status')}</label>
                    <select 
                      value={['approved', 'processing', 'rejected', 'unknown'].includes(formData.status || '') ? 'keep' : formData.status} 
                      onChange={e => {
                        const val = e.target.value;
                        if (val !== 'keep') handleInputChange('status', val);
                      }} 
                      className="w-full bg-modrinth-bg border border-modrinth-border rounded-xl p-3.5 text-modrinth-text text-sm"
                    >
                      <option value="keep">{t('keep_current')}</option>
                      <option value="draft">Draft</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="archived">Archived</option>
                    </select>
                 </div>
                 <div><label className="block text-xs font-bold text-modrinth-muted uppercase mb-1.5">{t('license_id')}</label><input type="text" value={formData.license?.id || ''} onChange={e => handleInputChange('license_id', e.target.value)} className="w-full bg-modrinth-bg border border-modrinth-border rounded-xl p-3.5 text-modrinth-text text-sm font-mono"/></div>
              </div>
            </section>
            <section className="space-y-4">
               <div className="flex items-center gap-2 text-modrinth-green mb-2 px-1"><Globe size={18} /><h3 className="font-bold uppercase tracking-wider text-sm">{t('links')}</h3></div>
               <div className="bg-modrinth-card/75 backdrop-blur-xl p-5 rounded-3xl shadow-[0_10px_26px_rgba(0,0,0,0.22)] relative overflow-hidden space-y-4">
                 {['source_url', 'issues_url', 'wiki_url', 'discord_url'].map((field) => (
                   <div key={field}><label className="block text-xs font-bold text-modrinth-muted uppercase">{field.replace('_url', '')}</label><input type="url" value={formData[field as keyof ModrinthProject] as string || ''} onChange={e => handleInputChange(field, e.target.value)} className="w-full bg-modrinth-bg border border-modrinth-border rounded-xl p-3.5 text-modrinth-text text-sm" placeholder="https://..."/></div>
                 ))}
               </div>
            </section>
          </div>
        )}
        {activeTab === 'members' && (
          <div className={`space-y-4 pb-24 ${animClass}`}>
            <div className="flex justify-between items-center mb-2 px-1">
              <div className="flex items-center gap-2 text-modrinth-green"><Users size={18} /><h3 className="font-bold uppercase tracking-wider text-sm">{t('manage_members')}</h3></div>
              <button onClick={()=>setShowInviteModal(true)} className="bg-modrinth-green text-white p-2 rounded-lg active:scale-90"><UserPlus size={18}/></button>
            </div>
            {members.map(member => (
              <div key={member.user.id} className="bg-modrinth-card/75 backdrop-blur-xl p-4 rounded-3xl flex flex-col gap-3 shadow-[0_10px_26px_rgba(0,0,0,0.22)] relative overflow-hidden">
                 <div className="flex items-center gap-3 relative">
                   <img src={member.user.avatar_url} className="w-10 h-10 rounded-lg bg-modrinth-bg" alt=""/>
                   <div className="flex-1">
                      <div className="text-modrinth-text font-bold">{member.user.username}</div>
                   </div>
                   {member.role !== 'Owner' && (
                     <button onClick={() => handleRemoveMember(member.user.id)} className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"><Trash2 size={16}/></button>
                   )}
                 </div>
                 
                 <div className="flex items-center gap-2 pl-13 relative">
                    <span className="text-xs text-modrinth-muted font-bold uppercase">{t('role')}:</span>
                    {member.role === 'Owner' ? (
                       <span className="text-xs text-modrinth-green font-bold px-2 py-1 bg-modrinth-bg rounded-lg">Owner</span>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <input
                            value={memberEdits[member.user.id]?.role || ''}
                            onChange={(e) => setMemberEdits(prev => ({ ...prev, [member.user.id]: { ...(prev[member.user.id] || { role: '' }), role: e.target.value, permissions: prev[member.user.id]?.permissions || '', payouts_split: prev[member.user.id]?.payouts_split || '', ordering: prev[member.user.id]?.ordering || '' } }))}
                            className="bg-modrinth-bg text-modrinth-text text-xs font-bold px-2 py-1 rounded-lg border border-modrinth-border outline-none focus:border-modrinth-green w-36"
                            placeholder={t('custom_role_placeholder')}
                          />
                          <button
                            onClick={() => handleRoleSave(member.user.id)}
                            className="text-xs font-bold px-2 py-1 rounded-lg bg-modrinth-green/20 text-modrinth-green hover:bg-modrinth-green hover:text-white transition-colors"
                            disabled={savingMemberId === member.user.id}
                          >
                            {savingMemberId === member.user.id ? '...' : t('save')}
                          </button>
                        </div>
                      </>
                    )}
                 </div>

                 {member.role !== 'Owner' && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold uppercase text-modrinth-muted mb-1">{t('permissions_label')}</label>
                      <div className="bg-modrinth-bg/60 border border-modrinth-border rounded-xl p-2">
                        <div className="grid grid-cols-2 gap-2">
                          {permissionDefs.map(p => {
                            const currentRaw = memberEdits[member.user.id]?.permissions;
                            const currentVal = currentRaw !== '' && currentRaw !== undefined ? Number(currentRaw) : (member.permissions || 0);
                            const isOn = !!(currentVal & (1 << p.bit));
                            return (
                              <button
                                key={p.bit}
                                type="button"
                                onClick={() => {
                                  const nextVal = isOn ? (currentVal & ~(1 << p.bit)) : (currentVal | (1 << p.bit));
                                  setMemberEdits(prev => ({
                                    ...prev,
                                    [member.user.id]: {
                                      ...(prev[member.user.id] || { role: member.role || '' }),
                                      permissions: String(nextVal),
                                      payouts_split: prev[member.user.id]?.payouts_split || '',
                                      ordering: prev[member.user.id]?.ordering || ''
                                    }
                                  }));
                                }}
                                className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${isOn ? 'bg-modrinth-green/20 text-modrinth-text border-modrinth-green/60' : 'bg-modrinth-bg text-modrinth-muted border-modrinth-border hover:border-modrinth-green'}`}
                              >
                                {isOn ? <Check size={12} /> : <span className="inline-block w-3" />}
                                <span className="truncate">{p.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-modrinth-muted mb-1">{t('payouts_split_label')}</label>
                      <input
                        value={memberEdits[member.user.id]?.payouts_split || ''}
                        onChange={(e) => setMemberEdits(prev => ({ ...prev, [member.user.id]: { ...(prev[member.user.id] || { role: member.role || '' }), payouts_split: e.target.value, permissions: prev[member.user.id]?.permissions || '', ordering: prev[member.user.id]?.ordering || '' } }))}
                        className="w-full bg-modrinth-bg text-modrinth-text text-xs px-2 py-1.5 rounded-lg border border-modrinth-border outline-none focus:border-modrinth-green"
                        placeholder="e.g. 50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-modrinth-muted mb-1">{t('ordering_label')}</label>
                      <input
                        value={memberEdits[member.user.id]?.ordering || ''}
                        onChange={(e) => setMemberEdits(prev => ({ ...prev, [member.user.id]: { ...(prev[member.user.id] || { role: member.role || '' }), ordering: e.target.value, permissions: prev[member.user.id]?.permissions || '', payouts_split: prev[member.user.id]?.payouts_split || '' } }))}
                        className="w-full bg-modrinth-bg text-modrinth-text text-xs px-2 py-1.5 rounded-lg border border-modrinth-border outline-none focus:border-modrinth-green"
                        placeholder="e.g. 0"
                      />
                    </div>
                    <div className="flex items-end col-span-2">
                      <button
                        onClick={() => openTransferOwnership(member.user.id, member.user.username)}
                        className="w-full text-xs font-bold px-2 py-2 rounded-lg bg-modrinth-bg text-modrinth-muted hover:text-modrinth-text hover:border-modrinth-green border border-modrinth-border"
                      >
                        {t('transfer_owner')}
                      </button>
                    </div>
                  </div>
                 )}

                 {member.user.id === currentUserId && member.accepted === false && (
                   <button
                     onClick={handleJoinTeam}
                     className="text-xs font-bold px-3 py-2 rounded-xl bg-modrinth-green text-white"
                   >
                     {t('accept_invite')}
                   </button>
                 )}
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
        );
      })()}
      <InviteMemberModal isOpen={showInviteModal} onClose={()=>setShowInviteModal(false)} onInvite={handleInvite} />

      {transferCandidate && (
        <div className="fixed inset-0 z-[190] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-modrinth-card/90 backdrop-blur-xl w-full max-w-sm rounded-3xl p-5 shadow-[0_14px_36px_rgba(0,0,0,0.45)] border border-modrinth-border">
            <h3 className="text-lg font-bold text-modrinth-text mb-2">{t('transfer_owner_title')}</h3>
            <p className="text-sm text-modrinth-muted mb-4">
              {t('transfer_owner_desc')} <span className="text-modrinth-text font-bold">{transferCandidate.name}</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setTransferCandidate(null)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-modrinth-bg/60 text-modrinth-muted hover:text-modrinth-text"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleTransferOwnership}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-modrinth-green text-white"
              >
                {t('transfer_owner_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {galleryPreviewUrl && (
        <div
          className="fixed inset-0 z-[190] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setGalleryPreviewUrl(null)}
        >
          <div
            className="relative w-full max-w-[95vw] max-h-[85vh] bg-modrinth-card/90 border border-modrinth-border rounded-2xl p-3 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setGalleryPreviewUrl(null)}
              className="absolute -top-3 -right-3 bg-black/70 text-white p-2 rounded-full shadow-lg"
              aria-label="Close preview"
            >
              <X size={16}/>
            </button>
            <img
              src={galleryPreviewUrl}
              alt="Gallery preview"
              className="w-full h-full max-h-[75vh] object-contain rounded-xl bg-modrinth-bg"
            />
          </div>
        </div>
      )}

      {selectedVersion && (
        <div className={`fixed inset-0 z-[185] ${theme === 'light' ? 'bg-black/30' : 'bg-black/70'} backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in`}>
          <div className={`${theme === 'light' ? 'bg-white/95 shadow-[0_14px_36px_rgba(0,0,0,0.2)]' : 'bg-modrinth-card/95 shadow-[0_18px_46px_rgba(0,0,0,0.48)]'} backdrop-blur-xl w-full max-w-2xl rounded-3xl max-h-[85vh] overflow-hidden`}>
            <div className="p-5 border-b border-zinc-700/40 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-modrinth-muted mb-2">{t('version_details')}</div>
                <h3 className="text-2xl font-bold text-modrinth-text break-words">{selectedVersion.name || selectedVersion.version_number}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-modrinth-muted">
                  <span className="px-2.5 py-1 rounded-full bg-modrinth-bg text-modrinth-text font-semibold">{selectedVersion.version_number}</span>
                  <span className={`px-2.5 py-1 rounded-full border font-bold uppercase ${
                    selectedVersion.version_type === 'release' ? 'text-green-400 border-green-400/30 bg-green-400/10' :
                    selectedVersion.version_type === 'beta' ? 'text-blue-400 border-blue-400/30 bg-blue-400/10' :
                    'text-orange-400 border-orange-400/30 bg-orange-400/10'
                  }`}>
                    {t(selectedVersion.version_type)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedVersion(null)}
                className={theme === 'light' ? 'p-2 rounded-full hover:bg-black/5 text-black/60 hover:text-black transition-colors' : 'p-2 rounded-full hover:bg-modrinth-bg text-modrinth-muted hover:text-modrinth-text transition-colors'}
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(85vh-6rem)] p-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-modrinth-bg/70 rounded-2xl p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-modrinth-muted mb-1">{t('downloads')}</div>
                  <div className="text-lg font-bold text-modrinth-text">{selectedVersion.downloads.toLocaleString()}</div>
                </div>
                <div className="bg-modrinth-bg/70 rounded-2xl p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-modrinth-muted mb-1">{t('published_on')}</div>
                  <div className="text-lg font-bold text-modrinth-text">{new Date(selectedVersion.date_published).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-modrinth-muted">{t('game_versions')}</div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {selectedVersion.game_versions.map((gameVersion) => (
                    <span key={gameVersion} className="text-[11px] bg-modrinth-bg px-2.5 py-1.5 rounded-full text-modrinth-text whitespace-nowrap">
                      {gameVersion}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-modrinth-muted">{t('loaders')}</div>
                <div className="flex gap-2 flex-wrap">
                  {selectedVersion.loaders.map((loader) => (
                    <span key={loader} className="text-[11px] font-bold uppercase text-modrinth-text/80 bg-modrinth-bg px-2.5 py-1.5 rounded-full">
                      {loader}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-modrinth-bg/50 rounded-3xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h4 className="text-lg font-bold text-modrinth-text">{t('changelog')}</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVersion(null);
                      openEditVersion(selectedVersion);
                    }}
                    className="text-xs font-bold px-3 py-2 rounded-2xl bg-modrinth-cardHover text-modrinth-text hover:bg-modrinth-border/60 transition-colors"
                  >
                    {t('edit')}
                  </button>
                </div>
                {selectedVersion.changelog?.trim() ? (
                  <React.Suspense fallback={<div className="text-modrinth-muted text-sm py-2">Loading changelog...</div>}>
                    <MarkdownRenderer content={selectedVersion.changelog} className="markdown-preview text-sm text-modrinth-text/85" />
                  </React.Suspense>
                ) : (
                  <p className="text-sm text-modrinth-muted">{t('no_changelog')}</p>
                )}
              </div>

              <div className="bg-modrinth-bg/50 rounded-3xl p-4">
                <h4 className="text-lg font-bold text-modrinth-text mb-3">{t('dependencies')}</h4>
                {selectedVersionDepsLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="animate-spin text-modrinth-green" /></div>
                ) : selectedVersionDeps.length === 0 ? (
                  <p className="text-sm text-modrinth-muted">{t('no_dependencies')}</p>
                ) : (
                  <div className="space-y-3">
                    {selectedVersionDeps.map((dep, index) => (
                      <div key={`${dep.project_id || dep.file_name || dep.version_id || index}`} className="flex items-center gap-3 bg-modrinth-card/80 rounded-2xl p-3">
                        <div className="w-12 h-12 rounded-xl bg-modrinth-bg overflow-hidden flex items-center justify-center flex-shrink-0">
                          {dep.icon_url ? (
                            <img src={dep.icon_url} alt={dep.title || dep.project_id || 'Dependency'} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={18} className="text-modrinth-muted opacity-70" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-modrinth-text truncate">{dep.title || dep.project_id || dep.file_name || dep.version_id}</div>
                            <span className="text-[10px] uppercase tracking-[0.12em] text-modrinth-muted bg-modrinth-bg px-2 py-1 rounded-full">
                              {dep.dependency_type}
                            </span>
                          </div>
                          <div className="text-xs text-modrinth-muted mt-1 break-words">
                            {dep.version_id || dep.project_id || dep.file_name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedVersion(null)}
                className="w-full py-3 rounded-2xl font-bold text-sm bg-modrinth-cardHover text-modrinth-text hover:bg-modrinth-border/60 transition-colors"
              >
                {t('close_details')}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingVersion && (
        <div className={`fixed inset-0 z-[180] ${theme === 'light' ? 'bg-black/30' : 'bg-black/60'} backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in`}>
          <div className={`${theme === 'light' ? 'bg-white/95 border border-black/10 shadow-[0_14px_36px_rgba(0,0,0,0.2)]' : 'bg-modrinth-card/85 shadow-[0_14px_36px_rgba(0,0,0,0.45)]'} backdrop-blur-xl w-full max-w-sm rounded-3xl p-5 animate-fade-in-up relative overflow-hidden`}>
            <div className="relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-modrinth-text">Edit version</h3>
              <button
                onClick={() => setEditingVersion(null)}
                className={theme === 'light' ? 'p-2 rounded-full hover:bg-black/5 text-black/60 hover:text-black transition-colors' : 'p-2 rounded-full hover:bg-modrinth-bg text-modrinth-muted hover:text-modrinth-text'}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-modrinth-muted uppercase mb-1">Name</label>
                <input
                  className={`w-full rounded-2xl p-3 text-sm outline-none ${theme === 'light' ? 'bg-black/[0.04] text-black border border-black/10 focus:border-modrinth-green' : 'bg-modrinth-bg text-modrinth-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] focus:shadow-[inset_0_0_0_1px_rgba(74,222,128,0.45)]'}`}
                  value={editingVersionName}
                  onChange={e => setEditingVersionName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-modrinth-muted uppercase mb-1">Type</label>
                <select
                  className={`w-full rounded-2xl p-3 text-sm outline-none ${theme === 'light' ? 'bg-black/[0.04] text-black border border-black/10 focus:border-modrinth-green' : 'bg-modrinth-bg text-modrinth-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] focus:shadow-[inset_0_0_0_1px_rgba(74,222,128,0.45)]'}`}
                  value={editingVersionType}
                  onChange={e => setEditingVersionType(e.target.value as any)}
                >
                  <option value="release">Release</option>
                  <option value="beta">Beta</option>
                  <option value="alpha">Alpha</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-modrinth-muted uppercase mb-1">Changelog</label>
                <textarea
                  className={`w-full rounded-2xl p-3 text-xs outline-none h-24 resize-none ${theme === 'light' ? 'bg-black/[0.04] text-black border border-black/10 focus:border-modrinth-green' : 'bg-modrinth-bg text-modrinth-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)] focus:shadow-[inset_0_0_0_1px_rgba(74,222,128,0.35),inset_0_0_0_2px_rgba(0,0,0,0.22)]'}`}
                  value={editingVersionChangelog}
                  onChange={e => setEditingVersionChangelog(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-modrinth-muted uppercase mb-1">Game Versions</label>
                <div className="flex flex-wrap gap-1.5">
                  {allGameVersions.map(gv => {
                    const active = editingVersionGameVersions.includes(gv);
                    return (
                      <button
                        key={gv}
                        type="button"
                        onClick={() => setEditingVersionGameVersions(prev => prev.includes(gv) ? prev.filter(x => x !== gv) : [...prev, gv])}
                        className={`px-2 py-1 rounded-full text-[10px] ${active ? 'bg-modrinth-green/20 text-modrinth-text shadow-[inset_0_0_0_1px_rgba(74,222,128,0.45),inset_0_0_0_2px_rgba(0,0,0,0.22)]' : theme === 'light' ? 'bg-black/5 text-black/60 border border-black/10' : 'bg-modrinth-bg text-modrinth-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)]'}`}
                      >
                        {gv}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-modrinth-muted uppercase mb-1">Dependencies</label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {editingVersionDependencies.map((dep, idx) => {
                    const meta = deps.find(d => d.project_id && d.project_id === dep.project_id);
                    return (
                      <div key={idx} className={`flex items-center justify-between rounded-2xl px-3 py-1.5 text-[11px] ${theme === 'light' ? 'bg-black/5 border border-black/10' : 'bg-modrinth-bg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)]'}`}>
                        <div className="flex items-center gap-2 mr-2 min-w-0">
                          <div className={`w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center ${theme === 'light' ? 'bg-white border border-black/10' : 'bg-modrinth-card shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)]'}`}>
                            {meta?.icon_url ? (
                              <img src={meta.icon_url} className="w-full h-full object-cover" />
                            ) : (
                              <Package size={14} className="text-modrinth-muted" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-modrinth-text truncate text-xs">{meta?.title || dep.project_id || dep.file_name || dep.version_id || 'unknown'}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] text-modrinth-muted uppercase">Type:</span>
                              <select
                                className={`rounded-lg px-2 py-0.5 text-[10px] outline-none ${theme === 'light' ? 'bg-white text-black border border-black/10' : 'bg-modrinth-bg text-modrinth-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)]'}`}
                                value={dep.dependency_type}
                                onChange={e => {
                                  const val = e.target.value as 'required' | 'optional' | 'incompatible' | 'embedded';
                                  setEditingVersionDependencies(prev => prev.map((d, i) => i === idx ? { ...d, dependency_type: val } : d));
                                }}
                              >
                                <option value="required">required</option>
                                <option value="optional">optional</option>
                                <option value="incompatible">incompatible</option>
                                <option value="embedded">embedded</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="text-red-400 text-[10px] px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20"
                          onClick={() => setEditingVersionDependencies(prev => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                  {editingVersionDependencies.length === 0 && (
                    <p className="text-[11px] text-modrinth-muted">No dependencies</p>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="project id or slug"
                    className="flex-1 bg-modrinth-bg rounded-xl px-3 py-2 text-[11px] text-modrinth-text outline-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)] focus:shadow-[inset_0_0_0_1px_rgba(74,222,128,0.35),inset_0_0_0_2px_rgba(0,0,0,0.22)]"
                    ref={depInputRef}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const value = e.currentTarget.value.trim();
                        if (!value) return;
                        void handleAddDependency(value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <select
                    className="bg-modrinth-bg rounded-xl px-2 py-2 text-[11px] text-modrinth-text outline-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)]"
                    value={newDepType}
                    onChange={e => setNewDepType(e.target.value as any)}
                  >
                    <option value="required">required</option>
                    <option value="optional">optional</option>
                    <option value="incompatible">incompatible</option>
                    <option value="embedded">embedded</option>
                  </select>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl bg-modrinth-bg text-[11px] text-modrinth-muted hover:text-modrinth-text shrink-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)]"
                    onClick={() => {
                      const input = depInputRef.current;
                      if (!input || !input.value) return;
                      const value = input.value.trim();
                      if (!value) return;
                      void handleAddDependency(value);
                      input.value = '';
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-modrinth-muted uppercase mb-1">Loaders</label>
                <div className="flex flex-wrap gap-1.5">
                  {allLoaders.map(ld => {
                    const active = editingVersionLoaders.includes(ld);
                    return (
                      <button
                        key={ld}
                        type="button"
                        onClick={() => setEditingVersionLoaders(prev => prev.includes(ld) ? prev.filter(x => x !== ld) : [...prev, ld])}
                        className={`px-2 py-1 rounded-full text-[10px] uppercase ${active ? 'bg-modrinth-green/20 text-modrinth-text shadow-[inset_0_0_0_1px_rgba(74,222,128,0.45),inset_0_0_0_2px_rgba(0,0,0,0.22)]' : 'bg-modrinth-bg text-modrinth-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)]'}`}
                      >
                        {ld}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditingVersion(null)}
                className="flex-1 py-3 rounded-xl text-sm font-bold bg-modrinth-bg text-modrinth-muted hover:text-modrinth-text hover:bg-modrinth-cardHover"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVersion}
                disabled={savingVersion}
                className="flex-1 py-3 rounded-xl text-sm font-bold bg-modrinth-green text-white flex items-center justify-center active:scale-95"
              >
                {savingVersion ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AnalyticsPage: React.FC<{ user: ModrinthUser; token: string }> = ({ user, token }) => {
  const [projects, setProjects] = useState<ModrinthProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<'downloads' | 'followers'>('downloads');
  const [profileUser, setProfileUser] = useState<ModrinthUser>(user);
  const [profileStatus, setProfileStatus] = useState<number | null>(null);
  const [payoutHistory, setPayoutHistory] = useState<ModrinthPayoutHistory | null>(null);
  const [payoutStatus, setPayoutStatus] = useState<number | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [payoutBalanceV3, setPayoutBalanceV3] = useState<any | null>(null);
  const [payoutBalanceV3Status, setPayoutBalanceV3Status] = useState<number | null>(null);
  const { t, theme } = useSettings();

  const isDebugEnabled = useMemo(() => {
    try {
      const isDev = !!(import.meta as any)?.env?.DEV;
      return isDev && localStorage.getItem('modrinth_debug') === 'true';
    } catch {
      return false;
    }
  }, []);

  const debugRawBalance = useMemo(() => {
    const raw = profileUser.payout_data?.balance ??
      (profileUser.payout_data as any)?.payout_balance ??
      (profileUser.payout_data as any)?.payoutBalance ??
      (profileUser as any)?.payout_balance ??
      (profileUser as any)?.payoutBalance;
    if (raw === null || raw === undefined) return 0;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
    if (typeof raw === 'string') {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }, [profileUser]);

  const debugWalletBalance = useMemo(() => {
    const raw = debugRawBalance;
    if (raw === null || raw === undefined) return 0;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
    if (typeof raw === 'string') {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }, [debugRawBalance]);

  const loadAnalytics = useCallback(() => {
    setLoading(true);
    fetchUserProjects(user.id, token)
      .then((p) => setProjects(p))
      .finally(() => setLoading(false));
  }, [user.id, token]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    let mounted = true;
    fetchUserByIdWithStatus(user.id, token)
      .then(({ user: fullUser, status }) => {
        if (!mounted) return;
        setProfileStatus(status);
        if (fullUser) {
          setProfileUser((prev) => {
            const nextPayoutData = (fullUser as any)?.payout_data;
            const prevPayoutData = (prev as any)?.payout_data;

            // /user/{id} may omit private fields (or return payout_data: null).
            // Preserve payout_data from the authenticated /user response when missing.
            const mergedPayoutData =
              nextPayoutData === undefined || nextPayoutData === null ? prevPayoutData : nextPayoutData;

            return {
              ...prev,
              ...fullUser,
              payout_data: mergedPayoutData
            } as ModrinthUser;
          });
        }
      })
      .catch(() => {
        if (!mounted) return;
        setProfileStatus(0);
      });
    return () => {
      mounted = false;
    };
  }, [user.id, token]);

  useEffect(() => {
    let mounted = true;
    setPayoutLoading(true);
    (async () => {
      // Modrinth's v2 /user/{id}/payouts route is missing ("route does not exist") on api.modrinth.com.
      // Do not call it to avoid 404 spam; rely on v3 /payout/balance for revenue numbers.
      if (!mounted) return;
      setPayoutHistory(null);
      setPayoutStatus(-2);
    })()
      .finally(() => {
        if (!mounted) return;
        setPayoutLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [user.id, token]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const result = await fetchPayoutBalanceV3WithStatus(token);
      if (!mounted) return;

      // status === -1 is an internal sentinel meaning "request skipped due to in-flight guard".
      if (result.status !== -1) {
        setPayoutBalanceV3(result.data);
        setPayoutBalanceV3Status(result.status);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  const payoutBalanceFromV3 = useMemo(() => {
    const data: any = payoutBalanceV3;
    if (!data || typeof data !== 'object') return null;

    const candidates = [
      data.available_now,
      data.availableNow,
      data.available,
      data.balance_available,
      data.balanceAvailable
    ];

    for (const v of candidates) {
      if (v === null || v === undefined) continue;
      const n = typeof v === 'number' ? v : Number(v);
      if (Number.isFinite(n)) return n;
    }

    return null;
  }, [payoutBalanceV3]);

  const payoutPendingFromV3 = useMemo(() => {
    const data: any = payoutBalanceV3;
    if (!data || typeof data !== 'object') return null;

    const v = data.pending;
    if (v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }, [payoutBalanceV3]);

  const payoutWithdrawnLifetimeFromV3 = useMemo(() => {
    const data: any = payoutBalanceV3;
    if (!data || typeof data !== 'object') return null;

    const v = data.withdrawn_lifetime ?? data.withdrawnLifetime;
    if (v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }, [payoutBalanceV3]);

  const payoutBalanceTotalFromV3 = useMemo(() => {
    const a = payoutBalanceFromV3;
    const p = payoutPendingFromV3;
    if (a === null && p === null) return null;
    return (a ?? 0) + (p ?? 0);
  }, [payoutBalanceFromV3, payoutPendingFromV3]);

  const payoutLifetimeFromV3 = useMemo(() => {
    const total = payoutBalanceTotalFromV3;
    const w = payoutWithdrawnLifetimeFromV3;
    if (total === null && w === null) return null;
    return (total ?? 0) + (w ?? 0);
  }, [payoutBalanceTotalFromV3, payoutWithdrawnLifetimeFromV3]);

  const payoutTotalFromV3 = useMemo(() => {
    const data: any = payoutBalanceV3;
    if (!data || typeof data !== 'object') return null;

    const candidates = [
      data.balance,
      data.total_balance,
      data.totalBalance
    ];

    for (const v of candidates) {
      if (v === null || v === undefined) continue;
      const n = typeof v === 'number' ? v : Number(v);
      if (Number.isFinite(n)) return n;
    }

    return null;
  }, [payoutBalanceV3]);

  const stats = useMemo(() => {
    const totalDownloads = projects.reduce((acc, p) => acc + p.downloads, 0);
    const totalLikes = projects.reduce((acc, p) => acc + p.followers, 0);

    // Revenue page “Balance” corresponds to available + pending.
    const walletBalance = payoutBalanceTotalFromV3 ?? payoutBalanceFromV3 ?? debugWalletBalance;
    // “Total revenue” = current balance + already withdrawn lifetime.
    const lifetimeEarnings = payoutLifetimeFromV3 ?? payoutTotalFromV3 ?? walletBalance;
    const last30Days = 0;
    
    const categories: Record<string, number> = {};
    projects.forEach(p => p.categories.forEach(c => categories[c] = (categories[c] || 0) + 1));
    const sortedCats = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const avgDownloads = projects.length > 0 ? totalDownloads / projects.length : 0;
    return { totalDownloads, totalLikes, lifetimeEarnings, last30Days, walletBalance, sortedCats, avgDownloads };
  }, [projects, debugWalletBalance, payoutBalanceFromV3, payoutBalanceTotalFromV3, payoutLifetimeFromV3, payoutTotalFromV3]);

  const sortedProjects = useMemo(() => {
      return [...projects].sort((a, b) => b[metric] - a[metric]).slice(0, 10);
  }, [projects, metric]);

  const maxVal = sortedProjects[0]?.[metric] || 1;

  const payoutDataVisible = profileUser.payout_data !== undefined && profileUser.payout_data !== null;

  const hasPayoutBalanceV3 =
    payoutBalanceV3 !== null &&
    typeof payoutBalanceV3 === 'object' &&
    ((payoutBalanceV3 as any).available !== undefined ||
      (payoutBalanceV3 as any).pending !== undefined ||
      (payoutBalanceV3 as any).withdrawn_lifetime !== undefined ||
      (payoutBalanceV3 as any).withdrawnLifetime !== undefined ||
      payoutBalanceFromV3 !== null ||
      payoutPendingFromV3 !== null ||
      payoutWithdrawnLifetimeFromV3 !== null);

  const walletConfigured = useMemo(() => {
    const pd: any = (profileUser as any)?.payout_data;
    if (!pd) return false;

    // Consider the wallet configured if any payout method field is set.
    // Exclude known non-method fields.
    const excludedKeys = new Set(['balance', 'currency']);
    return Object.entries(pd).some(([key, value]) => {
      if (excludedKeys.has(key)) return false;
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      return !!value;
    });
  }, [profileUser]);

  const showWalletWarning =
    !hasPayoutBalanceV3 &&
    (profileStatus === 401 ||
      profileStatus === 403 ||
      !payoutDataVisible ||
      !walletConfigured);

  const weeklySnapshotStorageKey = useMemo(() => `rinthy_analytics_snapshots_${user.id}`, [user.id]);
  const [weeklyResetTick, setWeeklyResetTick] = useState(0);

  type AnalyticsSnapshot = {
    capturedAt: number;
    projects: Record<string, { downloads: number; followers: number }>;
  };

  const weeklySummary = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const currentSnapshot: AnalyticsSnapshot = {
      capturedAt: now,
      projects: projects.reduce<AnalyticsSnapshot['projects']>((acc, project) => {
        acc[project.id] = {
          downloads: project.downloads,
          followers: project.followers
        };
        return acc;
      }, {})
    };

    const readSnapshots = (): AnalyticsSnapshot[] => {
      try {
        const raw = localStorage.getItem(weeklySnapshotStorageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((snapshot): snapshot is AnalyticsSnapshot => {
          return Boolean(
            snapshot &&
            typeof snapshot.capturedAt === 'number' &&
            snapshot.projects &&
            typeof snapshot.projects === 'object'
          );
        });
      } catch {
        return [];
      }
    };

    const snapshots = readSnapshots();
    const oldestAllowed = now - 35 * 24 * 60 * 60 * 1000;
    const retainedSnapshots = snapshots
      .filter(snapshot => snapshot.capturedAt >= oldestAllowed)
      .sort((a, b) => a.capturedAt - b.capturedAt);
    const baseline =
      retainedSnapshots
        .filter(snapshot => snapshot.capturedAt <= now - weekMs)
        .sort((a, b) => b.capturedAt - a.capturedAt)[0] ??
      retainedSnapshots[0] ??
      currentSnapshot;

    try {
      const latest = retainedSnapshots[retainedSnapshots.length - 1];
      const hasMetricChange = projects.some(project => {
        const previous = latest?.projects[project.id];
        return previous?.downloads !== project.downloads || previous?.followers !== project.followers;
      });
      const shouldStoreCurrent = !latest || now - latest.capturedAt > 60 * 60 * 1000 || hasMetricChange;
      const nextSnapshots = shouldStoreCurrent ? [...retainedSnapshots, currentSnapshot] : retainedSnapshots;
      localStorage.setItem(weeklySnapshotStorageKey, JSON.stringify(nextSnapshots));
    } catch {
      // Local analytics can work without persistence; it will just reset on next launch.
    }

    const projectDeltas = projects.map(project => {
      const previous = baseline.projects[project.id];
      return {
        id: project.id,
        title: project.title,
        icon_url: project.icon_url,
        downloads: Math.max(0, project.downloads - (previous?.downloads ?? project.downloads)),
        followers: Math.max(0, project.followers - (previous?.followers ?? project.followers))
      };
    });

    const downloads = projectDeltas.reduce((acc, project) => acc + project.downloads, 0);
    const followers = projectDeltas.reduce((acc, project) => acc + project.followers, 0);
    const activeProjects = projectDeltas.filter(project => project.downloads > 0 || project.followers > 0).length;
    const topProject = [...projectDeltas].sort((a, b) => (b.downloads + b.followers) - (a.downloads + a.followers))[0] ?? null;
    const daysTracked = Math.max(1, Math.round((now - baseline.capturedAt) / (24 * 60 * 60 * 1000)));

    return {
      downloads,
      followers,
      activeProjects,
      topProject,
      daysTracked,
      isBaselineReady: baseline !== currentSnapshot && now - baseline.capturedAt >= weekMs
    };
  }, [projects, weeklySnapshotStorageKey, weeklyResetTick]);

  const resetWeeklySummary = useCallback(() => {
    const snapshot: AnalyticsSnapshot = {
      capturedAt: Date.now(),
      projects: projects.reduce<AnalyticsSnapshot['projects']>((acc, project) => {
        acc[project.id] = {
          downloads: project.downloads,
          followers: project.followers
        };
        return acc;
      }, {})
    };

    try {
      localStorage.setItem(weeklySnapshotStorageKey, JSON.stringify([snapshot]));
    } catch {
      // Ignore storage errors; the next analytics load will rebuild the baseline.
    }

    setWeeklyResetTick((value) => value + 1);
  }, [projects, weeklySnapshotStorageKey]);

  if (loading) return <div className="flex justify-center pt-40 animate-fade-in"><Loader2 className="animate-spin text-modrinth-green" /></div>;

  return (
    <div className="px-4 pb-32 animate-fade-in">
      <header className="flex items-center justify-between mb-6 sticky top-0 z-50 backdrop-blur-xl pt-[calc(env(safe-area-inset-top)+0.85rem)] pb-3 -mx-4 px-4 min-h-[84px] shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden relative transition-colors duration-300" style={{ backgroundColor: 'rgba(var(--card-rgb), 0.7)' }}>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-modrinth-text leading-none">{t('analytics')}</h1>
          <p className="text-modrinth-muted text-xs font-medium">{t('dev_panel')}</p>
        </div>
        <button
          onClick={() => loadAnalytics()}
          className="p-2 text-modrinth-muted hover:text-modrinth-green transition-colors"
          aria-label="Refresh analytics"
        >
          <RefreshCw size={20} />
        </button>
      </header>

      {isDebugEnabled && (
        <div className="bg-modrinth-card/70 backdrop-blur-xl p-4 rounded-2xl border border-modrinth-border mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-modrinth-muted mb-2">Debug: payouts/balance</div>
          <pre className="text-[11px] leading-snug text-modrinth-text whitespace-pre-wrap break-words select-text">
            {JSON.stringify(
              {
                profileStatus,
                payoutStatus,
                payoutBalanceV3Status,
                user: {
                  id: (profileUser as any)?.id,
                  username: (profileUser as any)?.username
                },
                payout_balance_v3: payoutBalanceV3,
                payout_data: profileUser.payout_data ?? null,
                payout_data_keys: profileUser.payout_data ? Object.keys(profileUser.payout_data as any) : null,
                candidate_fields: {
                  payout_data_balance: profileUser.payout_data?.balance,
                  payout_data_payout_balance: (profileUser.payout_data as any)?.payout_balance,
                  payout_data_payoutBalance: (profileUser.payout_data as any)?.payoutBalance,
                  user_payout_balance: (profileUser as any)?.payout_balance,
                  user_payoutBalance: (profileUser as any)?.payoutBalance
                },
                rawBalance: debugRawBalance,
                rawBalanceType: typeof debugRawBalance,
                walletBalance: debugWalletBalance,
                walletBalanceFromV3: payoutBalanceFromV3,
                pendingFromV3: payoutPendingFromV3,
                withdrawnLifetimeFromV3: payoutWithdrawnLifetimeFromV3,
                balanceTotalFromV3: payoutBalanceTotalFromV3,
                lifetimeFromV3: payoutTotalFromV3,
                lifetimeComputedFromV3: payoutLifetimeFromV3,
                currency:
                  profileUser.payout_data?.currency ??
                  (profileUser.payout_data as any)?.payout_currency ??
                  (profileUser.payout_data as any)?.payoutCurrency ??
                  (profileUser as any)?.payout_currency ??
                  (profileUser as any)?.payoutCurrency ??
                  null
              },
              null,
              2
            )}
          </pre>
          <div className="text-[11px] text-modrinth-muted mt-2">
            modrinth_debug is enabled via <span className="font-mono">localStorage.modrinth_debug=true</span>
          </div>
        </div>
      )}

      {showWalletWarning && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl mb-6 flex gap-3 animate-fade-in-up">
          <div className="p-2 bg-yellow-500/20 rounded-full h-fit text-yellow-500"><AlertTriangle size={20} /></div>
          <div>
            <h3 className="font-bold text-yellow-500 text-sm mb-1">{t('wallet_error')}</h3>
            <p className="text-xs text-modrinth-muted mb-2">
              {(profileStatus === 401 || profileStatus === 403)
                ? t('token_no_payouts_access')
                : (!payoutDataVisible ? t('payout_data_unavailable') : t('create_wallet_msg'))}
            </p>
            <a href="https://modrinth.com/settings/payouts" target="_blank" rel="noreferrer" className="text-xs font-bold text-modrinth-text bg-modrinth-card border border-modrinth-border px-3 py-1.5 rounded-lg inline-flex items-center gap-1">
              {t('open_payout_settings')} <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}

      <div className={`p-6 rounded-3xl border mb-6 relative overflow-hidden shadow-lg animate-fade-in-up ${theme === 'light' ? 'bg-modrinth-green border-modrinth-green text-white' : 'bg-gradient-to-br from-emerald-900/40 to-modrinth-card border-emerald-500/20 text-modrinth-text shadow-emerald-900/20'}`}>
        <div className={`absolute top-0 right-0 p-6 ${theme === 'light' ? 'opacity-20 text-emerald-900' : 'opacity-20 text-emerald-400'}`}><Wallet size={80} /></div>
        <div className="relative z-10">
          <div className={`flex items-center gap-2 mb-1 ${theme === 'light' ? 'text-white/90' : 'text-emerald-400'}`}><DollarSign size={16} /><span className="text-xs font-bold uppercase tracking-wider">{t('total_revenue')}</span></div>
          <div className="text-4xl font-bold mb-4">${Number((payoutLifetimeFromV3 ?? stats.lifetimeEarnings) || 0).toFixed(2)}</div>
          <div className="flex gap-3 flex-wrap">
            <div className={`px-3 py-1.5 rounded-lg border backdrop-blur-sm ${theme === 'light' ? 'bg-black/10 border-white/20' : 'bg-modrinth-bg/50 border-modrinth-border'}`}>
              <span className={`text-[10px] uppercase block ${theme === 'light' ? 'text-white/70' : 'text-emerald-200'}`}>{t('wallet')}</span>
              <span className="text-sm font-mono">{profileUser.payout_data?.currency || 'USD'}</span>
            </div>
            <div className={`px-3 py-1.5 rounded-lg border backdrop-blur-sm ${theme === 'light' ? 'bg-black/10 border-white/20' : 'bg-modrinth-bg/50 border-modrinth-border'}`}>
              <span className={`text-[10px] uppercase block ${theme === 'light' ? 'text-white/70' : 'text-emerald-200'}`}>{t('balance')}</span>
              <span className="text-sm font-mono">${Number((payoutBalanceTotalFromV3 ?? stats.walletBalance) || 0).toFixed(2)}</span>
            </div>
            {payoutBalanceFromV3 !== null && (
              <div className={`px-3 py-1.5 rounded-lg border backdrop-blur-sm ${theme === 'light' ? 'bg-black/10 border-white/20' : 'bg-modrinth-bg/50 border-modrinth-border'}`}>
                <span className={`text-[10px] uppercase block ${theme === 'light' ? 'text-white/70' : 'text-emerald-200'}`}>{t('available')}</span>
                <span className="text-sm font-mono">${Number(payoutBalanceFromV3 || 0).toFixed(2)}</span>
              </div>
            )}
            {payoutPendingFromV3 !== null && (
              <div className={`px-3 py-1.5 rounded-lg border backdrop-blur-sm ${theme === 'light' ? 'bg-black/10 border-white/20' : 'bg-modrinth-bg/50 border-modrinth-border'}`}>
                <span className={`text-[10px] uppercase block ${theme === 'light' ? 'text-white/70' : 'text-emerald-200'}`}>{t('pending')}</span>
                <span className="text-sm font-mono">${Number(payoutPendingFromV3 || 0).toFixed(2)}</span>
              </div>
            )}
            {payoutWithdrawnLifetimeFromV3 !== null && (
              <div className={`px-3 py-1.5 rounded-lg border backdrop-blur-sm ${theme === 'light' ? 'bg-black/10 border-white/20' : 'bg-modrinth-bg/50 border-modrinth-border'}`}>
                <span className={`text-[10px] uppercase block ${theme === 'light' ? 'text-white/70' : 'text-emerald-200'}`}>{t('withdrawn')}</span>
                <span className="text-sm font-mono">${Number(payoutWithdrawnLifetimeFromV3 || 0).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <a
          href="https://modrinth.com/dashboard/revenue"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-bold text-modrinth-text bg-modrinth-card border border-modrinth-border px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
        >
          {t('open_revenue_page')} <ExternalLink size={14} />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="bg-modrinth-card/75 backdrop-blur-xl p-5 rounded-3xl shadow-[0_10px_26px_rgba(0,0,0,0.22)] relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="text-modrinth-green"><FileText /></div>
            <div className="text-[10px] uppercase text-modrinth-muted font-bold">{t('projects_label')}</div>
          </div>
          <div className="text-2xl font-bold text-modrinth-text">{projects.length.toLocaleString()}</div>
          <div className="text-xs text-modrinth-muted">{t('total_label')}</div>
        </div>
        <div className="bg-modrinth-card/75 backdrop-blur-xl p-5 rounded-3xl shadow-[0_10px_26px_rgba(0,0,0,0.22)] relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="text-modrinth-green"><Download /></div>
            <div className="text-[10px] uppercase text-modrinth-muted font-bold">{t('downloads_label')}</div>
          </div>
          <div className="text-2xl font-bold text-modrinth-text">{stats.totalDownloads.toLocaleString()}</div>
          <div className="text-xs text-modrinth-muted">{t('total_downloads')}</div>
        </div>
        <div className="bg-modrinth-card/75 backdrop-blur-xl p-5 rounded-3xl shadow-[0_10px_26px_rgba(0,0,0,0.22)] relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="text-red-400"><Heart /></div>
            <div className="text-[10px] uppercase text-modrinth-muted font-bold">{t('follows_label')}</div>
          </div>
          <div className="text-2xl font-bold text-modrinth-text">{stats.totalLikes.toLocaleString()}</div>
          <div className="text-xs text-modrinth-muted">{t('total_likes')}</div>
        </div>
        <div className="bg-modrinth-card/75 backdrop-blur-xl p-5 rounded-3xl shadow-[0_10px_26px_rgba(0,0,0,0.22)] relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="text-modrinth-green"><Activity /></div>
            <div className="text-[10px] uppercase text-modrinth-muted font-bold">{t('avg_label')}</div>
          </div>
          <div className="text-2xl font-bold text-modrinth-text">{Math.round(stats.avgDownloads).toLocaleString()}</div>
          <div className="text-xs text-modrinth-muted">{t('downloads_per_project')}</div>
        </div>
      </div>

      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: '0.12s' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-modrinth-muted uppercase">{t('weekly_summary')}</h3>
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-modrinth-muted">{t('last_7_days')}</div>
            <button
              onClick={resetWeeklySummary}
              className="px-2.5 py-1 rounded-lg bg-modrinth-card border border-modrinth-border text-[10px] font-bold uppercase text-modrinth-muted hover:text-modrinth-text hover:border-modrinth-green/40 active:scale-95 transition-all"
            >
              {t('reset')}
            </button>
          </div>
        </div>
        <div className="bg-modrinth-card/75 backdrop-blur-xl p-5 rounded-3xl shadow-[0_10px_26px_rgba(0,0,0,0.22)] relative overflow-hidden">
          <div className="grid grid-cols-2 gap-3 relative">
            <div className="bg-modrinth-bg/40 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <Download size={18} className="text-modrinth-green" />
                <span className="text-[10px] uppercase text-modrinth-muted font-bold">{t('downloads_label')}</span>
              </div>
              <div className="text-2xl font-bold text-modrinth-text">+{weeklySummary.downloads.toLocaleString()}</div>
              <div className="text-xs text-modrinth-muted">{t('weekly_downloads')}</div>
            </div>
            <div className="bg-modrinth-bg/40 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <Heart size={18} className="text-red-400" />
                <span className="text-[10px] uppercase text-modrinth-muted font-bold">{t('follows_label')}</span>
              </div>
              <div className="text-2xl font-bold text-modrinth-text">+{weeklySummary.followers.toLocaleString()}</div>
              <div className="text-xs text-modrinth-muted">{t('weekly_follows')}</div>
            </div>
            <div className="bg-modrinth-bg/40 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <Activity size={18} className="text-modrinth-green" />
                <span className="text-[10px] uppercase text-modrinth-muted font-bold">{t('active_label')}</span>
              </div>
              <div className="text-2xl font-bold text-modrinth-text">{weeklySummary.activeProjects.toLocaleString()}</div>
              <div className="text-xs text-modrinth-muted">{t('active_projects_week')}</div>
            </div>
            <div className="bg-modrinth-bg/40 rounded-2xl p-4 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <Calendar size={18} className="text-modrinth-green" />
                <span className="text-[10px] uppercase text-modrinth-muted font-bold">{t('tracked_label')}</span>
              </div>
              <div className="text-2xl font-bold text-modrinth-text">{weeklySummary.daysTracked}</div>
              <div className="text-xs text-modrinth-muted">{t('days_tracked')}</div>
            </div>
          </div>
          {weeklySummary.topProject && (weeklySummary.topProject.downloads > 0 || weeklySummary.topProject.followers > 0) && (
            <div className="mt-3 bg-modrinth-bg/40 rounded-2xl p-3 flex items-center gap-3 relative">
              {weeklySummary.topProject.icon_url ? (
                <img src={weeklySummary.topProject.icon_url} alt={weeklySummary.topProject.title} className="w-9 h-9 rounded-xl bg-modrinth-bg" />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-modrinth-bg flex items-center justify-center text-modrinth-muted">
                  <Package size={16} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs text-modrinth-muted">{t('weekly_top_project')}</div>
                <div className="text-sm font-bold text-modrinth-text truncate">{weeklySummary.topProject.title}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-mono font-bold text-modrinth-green">+{weeklySummary.topProject.downloads.toLocaleString()}</div>
                <div className="text-[10px] text-modrinth-muted">{t('downloads')}</div>
              </div>
            </div>
          )}
          {!weeklySummary.isBaselineReady && (
            <p className="mt-3 text-[11px] leading-relaxed text-modrinth-muted relative">{t('weekly_baseline_note')}</p>
          )}
        </div>
      </div>

      {/* Improved Top Projects Chart */}
      <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-modrinth-muted uppercase">{t('top_projects')}</h3>
          <div className="flex bg-modrinth-bg rounded-lg p-1 border border-modrinth-border">
            <button onClick={() => setMetric('downloads')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${metric === 'downloads' ? 'bg-modrinth-card text-modrinth-text shadow' : 'text-modrinth-muted'}`}>{t('downloads')}</button>
            <button onClick={() => setMetric('followers')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${metric === 'followers' ? 'bg-modrinth-card text-modrinth-text shadow' : 'text-modrinth-muted'}`}>{t('likes')}</button>
          </div>
      </div>
      
      <div className="bg-modrinth-card/75 backdrop-blur-xl p-5 rounded-3xl mb-8 animate-fade-in-up shadow-[0_10px_26px_rgba(0,0,0,0.22)] relative overflow-hidden" style={{ animationDelay: '0.15s' }}>
        {projects.length > 0 ? (
            <div className="space-y-2">
              {sortedProjects.map((p, idx) => {
                const val = p[metric];
                const percent = (val / maxVal) * 100;
                return (
                  <div key={p.id} className="bg-modrinth-bg/40 rounded-2xl p-3 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-modrinth-green/15 flex items-center justify-center text-xs font-bold text-modrinth-green">{idx + 1}</div>
                    {p.icon_url ? (
                      <img src={p.icon_url} alt={p.title} className="w-10 h-10 rounded-xl bg-modrinth-bg" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-modrinth-bg flex items-center justify-center text-modrinth-muted">
                        <Package size={18} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-bold text-modrinth-text truncate">{p.title}</div>
                        <div className="text-sm font-mono font-bold text-modrinth-green">{val.toLocaleString()}</div>
                      </div>
                      <div className="mt-2 h-1.5 w-full bg-modrinth-bg/80 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-modrinth-green to-modrinth-green/70 rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
        ) : <p className="text-sm text-modrinth-muted text-center">{t('no_top_projects')}</p>}
      </div>

      <h3 className="text-sm font-bold text-modrinth-muted uppercase mb-3">{t('categories_overview')}</h3>
      <div className="grid grid-cols-2 gap-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        {stats.sortedCats.map(([cat, count]) => (
          <div key={cat} className="bg-modrinth-card/75 backdrop-blur-xl p-3 rounded-2xl shadow-[0_10px_26px_rgba(0,0,0,0.2)] relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-2 relative">
              <div className="text-sm font-bold text-modrinth-text truncate capitalize">{cat}</div>
              <div className="text-xs font-mono font-bold text-modrinth-muted">{count}</div>
            </div>
            <div className="h-1.5 bg-modrinth-bg/80 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-modrinth-green to-modrinth-green/70 rounded-full" style={{ width: `${projects.length ? (count / projects.length) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
        {stats.sortedCats.length === 0 && (
          <div className="col-span-2 text-sm text-modrinth-muted text-center py-4">No category data available</div>
        )}
      </div>

    </div>
  );
};

const SettingsPage: React.FC<{ user: ModrinthUser; onLogout: () => void; token: string; updateInfo?: GitHubRelease | null }> = ({ user, onLogout, token, updateInfo }) => {
  const { theme, setTheme, language, setLanguage, t, accentColor, setAccentColor } = useSettings();
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [currUser, setCurrUser] = useState(user);
  const [colorInput, setColorInput] = useState(accentColor);
  const [settingsRelease, setSettingsRelease] = useState<GitHubRelease | null>(updateInfo ?? null);
  const latestVersion = settingsRelease?.tag_name.replace(/^v/, '') || null;
  const isOutdated = latestVersion ? compareVersions(latestVersion, APP_VERSION) > 0 : false;

  const reloadUser = () => {
    fetchCurrentUser(token).then(setCurrUser).catch(console.error);
  };

  useEffect(() => {
    if (settingsRelease) return;
    checkForUpdates().then(release => {
      if (release) setSettingsRelease(release);
    });
  }, [settingsRelease]);

  return (
    <div className="px-4 pb-20 animate-fade-in">
      <header className="flex items-center justify-between mb-6 sticky top-0 z-50 backdrop-blur-xl pt-[calc(env(safe-area-inset-top)+0.85rem)] pb-3 -mx-4 px-4 min-h-[84px] shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden relative transition-colors duration-300" style={{ backgroundColor: 'rgba(var(--card-rgb), 0.7)' }}>
        <div className="flex flex-col gap-1 relative">
          <h1 className="text-2xl font-bold text-modrinth-text leading-none">{t('settings')}</h1>
          <p className="text-modrinth-muted text-xs font-medium">{t('dev_panel')}</p>
        </div>
      </header>
      <div className="bg-modrinth-card/75 backdrop-blur-xl p-5 rounded-3xl flex items-center gap-4 mb-6 animate-fade-in-up relative shadow-[0_10px_26px_rgba(0,0,0,0.22)] overflow-hidden">
        <img src={currUser.avatar_url} alt={currUser.username} className="w-16 h-16 rounded-full bg-modrinth-bg border-2 border-modrinth-border" />
        <div>
          <div className="relative">
            <h2 className="text-xl font-bold text-modrinth-text">{currUser.username}</h2>
            <p className="text-modrinth-green text-sm font-medium capitalize">{currUser.role}</p>
          </div>
          <button onClick={()=>setShowProfileEdit(true)} className="absolute right-4 top-4 p-2 text-modrinth-muted hover:text-modrinth-green"><Edit3 size={18}/></button>
        </div>
      </div>

      {isOutdated && settingsRelease && (
        <div className="bg-modrinth-card/75 backdrop-blur-xl p-4 rounded-3xl shadow-[0_10px_26px_rgba(0,0,0,0.22)] overflow-hidden mb-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-modrinth-green/15 text-modrinth-green"><AlertTriangle size={18} /></div>
            <div className="flex-1">
              <div className="text-sm font-bold text-modrinth-text mb-1">{t('update_outdated')}</div>
              <div className="text-xs text-modrinth-muted mb-3">
                {t('update_current')}: {APP_VERSION} · {t('update_new_version')}: {latestVersion}
              </div>
              <a
                href={settingsRelease.assets.find(a => a.name.endsWith('.apk'))?.browser_download_url || settingsRelease.html_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold text-modrinth-green bg-modrinth-bg px-3 py-1.5 rounded-lg"
              >
                <ExternalLink size={12} /> {t('update_view_release')}
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
         <div className="bg-modrinth-card/75 backdrop-blur-xl p-4 rounded-3xl shadow-[0_10px_26px_rgba(0,0,0,0.22)] overflow-visible relative z-20">
           <div className="flex items-center gap-2 mb-3 text-modrinth-green font-bold text-sm uppercase"><Globe size={16} /> {t('language')}</div>
           <LanguageSelect value={language} onChange={setLanguage} compact />
         </div>

         <div className="bg-modrinth-card/75 backdrop-blur-xl p-4 rounded-3xl shadow-[0_10px_26px_rgba(0,0,0,0.22)] overflow-hidden relative z-0">
           <div className="flex items-center gap-2 mb-3 text-modrinth-green font-bold text-sm uppercase"><Moon size={16} /> {t('theme')}</div>
           <div className="flex bg-modrinth-bg rounded-xl p-1 border border-modrinth-border">
            {(['dark', 'light'] as ThemeMode[]).map(m => (
               <button key={m} onClick={() => setTheme(m)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${theme === m ? 'bg-modrinth-card text-modrinth-text shadow-sm' : 'text-modrinth-muted hover:text-modrinth-text'}`}>
                 {t(m)}
               </button>
             ))}
           </div>
         </div>

         <div className="bg-modrinth-card/75 backdrop-blur-xl p-4 rounded-3xl shadow-[0_10px_26px_rgba(0,0,0,0.22)] overflow-hidden">
           <div className="flex items-center justify-between mb-3">
             <div className="flex items-center gap-2 text-modrinth-green font-bold text-sm uppercase"><Smartphone size={16} /> {t('accent_color')}</div>
             <button 
               onClick={() => {
                 setColorInput('#30B27C');
                 setAccentColor('#30B27C');
               }}
               className="text-xs text-modrinth-muted hover:text-modrinth-green font-medium px-3 py-1 rounded-lg bg-modrinth-bg border border-modrinth-border hover:border-modrinth-green transition-all"
             >
               {t('reset')}
             </button>
           </div>
           <div className="flex items-center gap-3">
             <div className="relative w-16 h-16">
               <input 
                 type="color" 
                 value={colorInput} 
                 onChange={(e) => {
                   setColorInput(e.target.value);
                   setAccentColor(e.target.value);
                 }}
                 className="absolute inset-0 w-full h-full rounded-full border-4 border-modrinth-border cursor-pointer overflow-hidden"
                 style={{ 
                   WebkitAppearance: 'none',
                   MozAppearance: 'none',
                   appearance: 'none',
                   padding: 0,
                   border: '4px solid var(--border)'
                 }}
               />
             </div>
             <div className="flex-1">
               <input 
                 type="text" 
                 value={colorInput} 
                 onChange={(e) => {
                   setColorInput(e.target.value);
                   if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                     setAccentColor(e.target.value);
                   }
                 }}
                 placeholder="#30B27C"
                 className="w-full bg-modrinth-bg border border-modrinth-border rounded-xl px-4 py-3 text-modrinth-text text-sm font-mono uppercase focus:border-modrinth-green outline-none"
               />
               <p className="text-xs text-modrinth-muted mt-2">{t('hex_format_hint')}</p>
             </div>
           </div>
         </div>

         <button onClick={onLogout} className="w-full bg-modrinth-bg hover:bg-red-500/10 border border-modrinth-border hover:border-red-500/30 p-4 rounded-2xl flex items-center gap-3 text-modrinth-muted hover:text-red-400 transition-all group shadow-sm">
            <div className="p-2 rounded-lg bg-modrinth-card group-hover:bg-red-500/20"><LogOut size={20} /></div>
            <span className="font-medium">{t('logout')}</span>
         </button>
      </div>

      <div className="mt-12 text-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
         <p className="text-modrinth-muted text-sm font-medium">Rinthy v{APP_VERSION}</p>
         <p className="text-modrinth-muted text-xs mt-4">
           {t('unofficial')} <a href="https://modrinth.com/user/imsawiq" className="text-modrinth-green hover:underline">imsawiq</a>
         </p>
      </div>
      <ProfileEditModal isOpen={showProfileEdit} onClose={()=>setShowProfileEdit(false)} user={currUser} token={token} onUpdate={reloadUser} />
    </div>
  );
};

// --- Main Application Component ---

const MainLayout: React.FC<{ user: ModrinthUser; token: string; onLogout: () => void; updateInfo?: GitHubRelease | null }> = ({ user, token, onLogout, updateInfo }) => {
  const [activeTab, setActiveTab] = useState<NavTab>(NavTab.PROJECTS);
  const { t, theme } = useSettings();

  const handleTabChange = useCallback((nextTab: NavTab) => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }

    window.setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 0);
  }, [activeTab]);
  
  return (
    <>
      <div className="pb-20">
        {activeTab === NavTab.PROJECTS && <Dashboard user={user} token={token} />}
        {activeTab === NavTab.MODPACK && <ModpackCreator theme={theme} t={t} token={token} />}
        {activeTab === NavTab.ANALYTICS && <AnalyticsPage user={user} token={token} />}
        {activeTab === NavTab.SETTINGS && <SettingsPage user={user} onLogout={onLogout} token={token} updateInfo={updateInfo} />}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} t={t} theme={theme} />
    </>
  );
};

const App: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>({
    token: localStorage.getItem('modrinth_token'),
    user: null,
    isLoading: !!localStorage.getItem('modrinth_token'),
    error: null,
    hasSeenOnboarding: localStorage.getItem('has_seen_onboarding') === 'true'
  });
  const [hasSeenWelcome, setHasSeenWelcome] = useState(localStorage.getItem('has_seen_welcome') === 'true');
  const [showHelp, setShowHelp] = useState(false);
  const [updateRelease, setUpdateRelease] = useState<GitHubRelease | null>(null);
  const [latestRelease, setLatestRelease] = useState<GitHubRelease | null>(null);

  // Check for updates on app start
  useEffect(() => {
    const now = Date.now();
    const launchCount = parseInt(localStorage.getItem('launch_count') || '0', 10) + 1;
    localStorage.setItem('launch_count', launchCount.toString());

    const cachedRelease = localStorage.getItem('latest_release');
    if (cachedRelease) {
      try {
        setLatestRelease(JSON.parse(cachedRelease));
      } catch (e) {
        localStorage.removeItem('latest_release');
      }
    }

    checkForUpdates().then(release => {
      if (release) {
        setLatestRelease(release);
        localStorage.setItem('latest_release', JSON.stringify(release));
        const dismissed = localStorage.getItem('dismissed_version');
        const dismissedAt = parseInt(localStorage.getItem('dismissed_at_launch') || '0', 10);
        const shouldRemind = dismissed !== release.tag_name || (launchCount - dismissedAt) >= 5;

        if (shouldRemind) {
          setUpdateRelease(release);
        }
      }
      localStorage.setItem('last_update_check', now.toString());
    });
  }, []);

  useEffect(() => {
    const initAuth = async () => {
       if (authState.token && !authState.user) {
        try {
          const user = await fetchCurrentUser(authState.token);
          setAuthState(prev => ({ ...prev, user, isLoading: false, error: null }));
        } catch (err) {
          console.error(err);
          const status = (err as any)?.status;
          if (status === 401 || status === 403) {
            setAuthState(prev => ({ ...prev, isLoading: false, error: 'Invalid Token', token: null }));
            localStorage.removeItem('modrinth_token');
          } else {
            setAuthState(prev => ({ ...prev, isLoading: false, error: 'Network error. Try again.' }));
          }
        }
       }
    };
    initAuth();
  }, [authState.token]);

  useEffect(() => {
    if (!CapApp || typeof (CapApp as any).addListener !== 'function') return;

    const processOAuthCallback = (url: string) => {
      const payload = readOAuthCallback(url);
      if (!payload) return;

      if (payload.error === 'parse_error') {
        setAuthState(prev => ({ ...prev, isLoading: false, error: getAuthMessage('oauth_missing_token') }));
        return;
      }

      const { token, state, error } = payload;
      const expectedState = localStorage.getItem(MODRINTH_OAUTH_STATE_KEY);

      if (error) {
        localStorage.removeItem(MODRINTH_OAUTH_STATE_KEY);
        setAuthState(prev => ({ ...prev, isLoading: false, error: getAuthMessage('oauth_cancelled') }));
        return;
      }

      if (!state || !expectedState || state !== expectedState) {
        localStorage.removeItem(MODRINTH_OAUTH_STATE_KEY);
        setAuthState(prev => ({ ...prev, isLoading: false, error: getAuthMessage('oauth_state_error') }));
        return;
      }

      localStorage.removeItem(MODRINTH_OAUTH_STATE_KEY);

      if (!token) {
        setAuthState(prev => ({ ...prev, isLoading: false, error: getAuthMessage('oauth_missing_token') }));
        return;
      }

      handleLogin(token);
    };

    CapApp.getLaunchUrl?.()
      .then((result) => {
        if (result?.url) {
          processOAuthCallback(result.url);
        }
      })
      .catch(() => {});

    const handleAppUrlOpen = CapApp.addListener('appUrlOpen', ({ url }) => {
      processOAuthCallback(url);
    });

    return () => {
      handleAppUrlOpen.then(listener => listener.remove()).catch(() => {});
    };
  }, []);

  const handleLogin = async (token: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const user = await fetchCurrentUser(token);
      localStorage.setItem('modrinth_token', token);
      localStorage.setItem('has_seen_onboarding', 'true');
      localStorage.setItem('has_seen_welcome', 'true');
      setHasSeenWelcome(true);
      setAuthState(prev => ({
        ...prev,
        token,
        user,
        isLoading: false,
        error: null,
        hasSeenOnboarding: true
      }));
    } catch (err) {
      const status = (err as any)?.status;
      if (status === 401 || status === 403) {
        setAuthState(prev => ({ ...prev, isLoading: false, error: 'Invalid Token' }));
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false, error: 'Network error. Try again.' }));
      }
    }
  };

  const handleStartOAuth = async () => {
    try {
      const healthResponse = await fetch(`${MODRINTH_OAUTH_BASE_URL}/api/health`, {
        method: 'GET',
        cache: 'no-store'
      });

      if (!healthResponse.ok) {
        setAuthState(prev => ({ ...prev, isLoading: false, error: getAuthMessage('oauth_backend_unavailable') }));
        return;
      }

      const health = await healthResponse.json().catch(() => null);
      if (!health?.ok) {
        setAuthState(prev => ({ ...prev, isLoading: false, error: getAuthMessage('oauth_backend_unavailable') }));
        return;
      }
    } catch {
      setAuthState(prev => ({ ...prev, isLoading: false, error: getAuthMessage('oauth_backend_unavailable') }));
      return;
    }

    const state = generateOAuthState();
    localStorage.setItem(MODRINTH_OAUTH_STATE_KEY, state);
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    window.location.href = `${MODRINTH_OAUTH_BASE_URL}/api/modrinth/start?state=${encodeURIComponent(state)}`;
  };

  const handleLogout = () => {
    localStorage.removeItem('modrinth_token');
    localStorage.removeItem(MODRINTH_OAUTH_STATE_KEY);
    setAuthState(prev => ({ ...prev, token: null, user: null }));
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem('has_seen_onboarding', 'true');
    setAuthState(prev => ({ ...prev, hasSeenOnboarding: true }));
  };

  const handleWelcomeComplete = () => {
    localStorage.setItem('has_seen_welcome', 'true');
    setHasSeenWelcome(true);
  };

  // Render logic
  const renderContent = () => {
    if (!hasSeenWelcome) {
       return <WelcomeSetup onComplete={handleWelcomeComplete} />;
    }

    if (!authState.hasSeenOnboarding) {
       return <Onboarding onComplete={handleOnboardingComplete} />;
    }

    if (!authState.token || !authState.user) {
       return (
         <>
           <LoginScreen 
              onLogin={handleLogin} 
              onStartOAuth={handleStartOAuth}
              isLoading={authState.isLoading} 
              error={authState.error} 
              onShowHelp={() => setShowHelp(true)}
              savedToken={authState.token}
           />
           {showHelp && <TokenHelpModal onClose={() => setShowHelp(false)} />}
         </>
       );
    }

    return (
      <HashRouter>
        <BackButtonHandler />
        <div className="min-h-screen bg-modrinth-bg text-modrinth-text font-sans selection:bg-modrinth-green/30">
           <Routes>
              <Route path="/" element={<MainLayout user={authState.user} token={authState.token} onLogout={handleLogout} updateInfo={latestRelease} />} />
              <Route path="/project/:id" element={<ProjectDetail token={authState.token} currentUserId={authState.user?.id} />} />
           </Routes>
        </div>
      </HashRouter>
    );
  };

  const handleDismissUpdate = () => {
    if (updateRelease) {
      const launchCount = parseInt(localStorage.getItem('launch_count') || '0', 10);
      localStorage.setItem('dismissed_version', updateRelease.tag_name);
      localStorage.setItem('dismissed_at_launch', launchCount.toString());
    }
    setUpdateRelease(null);
  };

  return (
    <SettingsProvider>
      {renderContent()}
      {updateRelease && <UpdateModal release={updateRelease} onClose={handleDismissUpdate} />}
    </SettingsProvider>
  );
};

export default App;
