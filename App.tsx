import React, { useState, useEffect, useCallback, useMemo, createContext, useContext, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, Outlet, useLocation } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { Loader2, LogOut, ArrowLeft, Save, ExternalLink, BarChart2, ShieldCheck, Key, ChevronRight, Download, Activity, BookOpen, FileText, Monitor, Server, Edit3, Globe, Wallet, DollarSign, TrendingUp, Archive, Lock, EyeOff, Info, Heart, Clock, Users, Trash2, Moon, Sun, Smartphone, UserPlus, Search, X, Check, ChevronDown, Bell, AlertTriangle, Image as ImageIcon, Upload, Package, Calendar, File as FileIcon, Layers, MousePointerClick, CheckCheck, RefreshCw, MoreVertical } from 'lucide-react';
import { fetchCurrentUser, fetchUserProjects, fetchProject, updateProject, fetchProjectMembers, deleteTeamMember, updateTeamMember, searchUser, addTeamMember, modifyUser, fetchNotifications, deleteNotification, markNotificationRead, markMultipleNotificationsRead, changeProjectIcon, deleteProjectIcon, addGalleryImage, deleteGalleryImage, fetchProjectDependencies, fetchProjectVersions, fetchGameVersionTags, fetchLoaderTags, modifyVersion, deleteVersionById, fetchUserPayoutHistoryWithStatus, fetchUserByIdWithStatus, fetchPayoutBalanceV3WithStatus } from './services/modrinthService';
import { AuthState, ModrinthUser, ModrinthProject, NavTab, ProjectMember, SettingsContextType, ThemeMode, Language, UserSearchResult, ModifyUserPayload, ModrinthNotification, ProjectDependency, ModrinthVersion, ModrinthPayoutHistory } from './types';
import ProjectCard from './components/ProjectCard';
import BottomNav from './components/BottomNav';

// --- Back Button Handler for Android ---
const BackButtonHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [lastBackPress, setLastBackPress] = useState(0);
  const { t } = useSettings();

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
          toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-modrinth-card/75 backdrop-blur-2xl text-modrinth-text px-6 py-3 rounded-full shadow-[0_18px_50px_rgba(0,0,0,0.45)] z-[200] font-medium text-sm';
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

// --- Icons ---
const ModrinthLogo = ({ className }: { className?: string }) => (
  <img
    src="/logo.png"
    alt="App logo"
    className={className}
  />
);

// --- Translations ---
const TRANSLATIONS = {
  ru: {
    welcome_title: 'Добро пожаловать в Rinthy',
    welcome_subtitle: 'Выбери язык интерфейса, затем авторизуйся с помощью PAT.',
    choose_language: 'Язык',
    continue: 'Продолжить',
    onboarding_title: 'Rinthy',
    onboarding_desc: 'Неофициальное приложение для Modrinth для разработчиков.\nУправляй проектами, смотри аналитику и выплаты.',
    onboarding_secure_title: 'Безопасно',
    onboarding_secure_desc: 'Токен хранится локально на устройстве.\nПрямое подключение к Modrinth API.',
    onboarding_access_title: 'Доступ',
    onboarding_access_desc: 'Нужен PAT токен со всеми галочками (scopes).',
    next: 'Далее',
    start: 'Начать',
    login_title: 'Вход',
    login_subtitle: 'Вставь PAT токен',
    authorize: 'Авторизоваться',
    how_to_get_token: 'Как получить токен?',
    token_help_title: 'Как получить токен?',
    token_help_open: 'Открой',
    token_help_create: 'Создай новый Personal Access Token (PAT).',
    token_help_scopes: 'Поставь все галочки (all scopes).',
    token_help_paste: 'Скопируй токен и вставь сюда.',
    token_help_local: 'Безопасность: токен хранится локально на устройстве.',
    got_it: 'Понял',
    dashboard: 'Проекты',
    analytics: 'Аналитика',
    settings: 'Настройки',
    dev_panel: 'Панель разработчика',
    no_projects: 'Нет активных проектов',
    create_project: 'Создайте проект на сайте Modrinth',
    overview: 'Обзор',
    editor: 'Редактор',
    edit: 'Редактирование',
    members: 'Команда',
    versions: 'Версии',
    downloads: 'Загрузки',
    likes: 'Лайки',
    description: 'Описание',
    client: 'Клиент',
    server: 'Сервер',
    resources: 'Ресурсы',
    source: 'Исходный код',
    issues: 'Баг-трекер',
    save: 'Сохранить',
    saved: 'Сохранено успешно!',
    main_info: 'Основное',
    title: 'Название',
    short_desc: 'Краткое описание',
    body_desc: 'Тело описания (Markdown)',
    status_license: 'Статус и Лицензия',
    status: 'Текущий статус',
    change_status: 'Изменить статус',
    license_id: 'License ID',
    links: 'Ссылки',
    total_revenue: 'Всего заработано',
    wallet: 'Кошелек',
    balance: 'Баланс',
    total_downloads: 'Всего загрузок',
    total_likes: 'Всего лайков',
    categories: 'Категории проектов',
    top_projects: 'Топ проектов',
    logout: 'Выйти из аккаунта',
    web_settings: 'Настройки на сайте',
    unofficial: 'Неофициальное приложение для Modrinth. Не связано с Modrinth и не поддерживается ими. Автор',
    theme: 'Тема оформления',
    language: 'Язык',
    dark: 'Темная',
    light: 'Светлая',
    role: 'Роль',
    remove: 'Удалить',
    manage_members: 'Управление участниками',
    member_remove_confirm: 'Удалить участника?',
    invite: 'Пригласить',
    search_user: 'Введите точный никнейм...',
    edit_profile: 'Редактировать профиль',
    cancel: 'Отмена',
    bio: 'О себе',
    avatar_url: 'Ссылка на аватар',
    username: 'Никнейм',
    profile_updated: 'Профиль обновлен!',
    add: 'Добавить',
    keep_current: 'Оставить текущий',
    updating_role: 'Обновление роли...',
    notifications: 'Уведомления',
    no_notifications: 'Нет новых уведомлений',
    create_wallet_msg: 'Создайте кошелек на Modrinth, чтобы получать выплаты.',
    wallet_error: 'Кошелек не найден',
    go_to_settings: 'Перейти в настройки',
    gallery: 'Галерея',
    icon: 'Иконка',
    upload: 'Загрузить',
    dependencies: 'Зависимости',
    no_dependencies: 'Нет зависимостей',
    release: 'Релиз',
    beta: 'Бета',
    alpha: 'Альфа',
    no_versions: 'Версий пока нет',
    game_versions: 'Версии игры',
    loaders: 'Загрузчики',
    popularity: 'Популярность',
    read_all: 'Прочитать все',
    press_back_again: 'Нажмите назад ещё раз для выхода',
    accent_color: 'Основной цвет',
    reset: 'Сбросить',
    show_preview: 'Показать превью',
    hide_preview: 'Скрыть превью',
    payouts: 'Выплаты',
    available: 'Доступно сейчас',
    last_30_days: 'Последние 30 дней',
    all_time: 'За всё время',
    recent_transactions: 'Последние транзакции',
    no_payout_transactions: 'Нет транзакций по выплатам',
    token_no_payouts_access: 'У токена нет доступа к выплатам. Создай новый с правом payouts.',
    payouts_endpoint_unavailable: 'История выплат недоступна (404). Это может означать отсутствие доступа (нужен scope PAYOUTS_READ) или недоступность ресурса. Баланс кошелька может отображаться отдельно.',
    payouts_api_unavailable: 'История выплат недоступна: этот endpoint отсутствует в публичном API (route does not exist). Открой Revenue на сайте Modrinth для просмотра транзакций.',
    open_revenue_page: 'Открыть Revenue',
    open_payout_settings: 'Настройки выплат',
    pending: 'В ожидании',
    withdrawn: 'Выведено',
    payout_data_unavailable: 'Данные о выплатах недоступны для этого токена/аккаунта.',
    projects_label: 'Проекты',
    total_label: 'Всего',
    downloads_label: 'Загрузки',
    follows_label: 'Подписки',
    avg_label: 'Среднее',
    downloads_per_project: 'Загрузок / проект',
    no_top_projects: 'Нет данных по топ-проектам',
    categories_overview: 'Категории'
  },
  en: {
    welcome_title: 'Welcome to Rinthy',
    welcome_subtitle: 'Choose a language first, then sign in using a PAT.',
    choose_language: 'Language',
    continue: 'Continue',
    onboarding_title: 'Rinthy',
    onboarding_desc: 'Unofficial app for Modrinth developers.\nManage projects, view analytics and payouts.',
    onboarding_secure_title: 'Secure',
    onboarding_secure_desc: 'The token is stored locally on your device.\nDirect connection to the Modrinth API.',
    onboarding_access_title: 'Access',
    onboarding_access_desc: 'Create a PAT and enable all permission checkboxes (all scopes).',
    next: 'Next',
    start: 'Start',
    login_title: 'Login',
    login_subtitle: 'Enter PAT Token',
    authorize: 'Authorize',
    how_to_get_token: 'How to get a token?',
    token_help_title: 'How to get a token?',
    token_help_open: 'Open',
    token_help_create: 'Create a new Personal Access Token (PAT).',
    token_help_scopes: 'Enable all permission checkboxes (all scopes).',
    token_help_paste: 'Copy the token and paste it here.',
    token_help_local: 'Security: the token is stored locally on your device.',
    got_it: 'Got it',
    dashboard: 'Projects',
    analytics: 'Analytics',
    settings: 'Settings',
    dev_panel: 'Developer Panel',
    no_projects: 'No active projects',
    create_project: 'Create a project on Modrinth',
    overview: 'Overview',
    editor: 'Editor',
    edit: 'Edit',
    members: 'Team',
    versions: 'Versions',
    downloads: 'Downloads',
    likes: 'Follows',
    description: 'Description',
    client: 'Client',
    server: 'Server',
    resources: 'Resources',
    source: 'Source Code',
    issues: 'Issue Tracker',
    save: 'Save',
    saved: 'Saved successfully!',
    main_info: 'Main Info',
    title: 'Title',
    short_desc: 'Summary',
    body_desc: 'Body (Markdown)',
    status_license: 'Status & License',
    status: 'Current Status',
    change_status: 'Change Status',
    license_id: 'License ID',
    links: 'Links',
    total_revenue: 'Lifetime Payouts',
    wallet: 'Wallet',
    balance: 'Balance',
    total_downloads: 'Total Downloads',
    total_likes: 'Total Follows',
    categories: 'Project Categories',
    top_projects: 'Top Projects',
    logout: 'Log Out',
    web_settings: 'Web Settings',
    unofficial: 'Unofficial app for Modrinth. Not affiliated with or endorsed by Modrinth. by',
    theme: 'Theme',
    language: 'Language',
    dark: 'Dark',
    light: 'Light',
    role: 'Role',
    remove: 'Remove',
    manage_members: 'Manage Members',
    member_remove_confirm: 'Remove member?',
    invite: 'Invite',
    search_user: 'Enter exact username...',
    edit_profile: 'Edit Profile',
    cancel: 'Cancel',
    bio: 'Bio',
    avatar_url: 'Avatar URL',
    username: 'Username',
    profile_updated: 'Profile Updated!',
    add: 'Add',
    keep_current: 'Keep Current',
    updating_role: 'Updating role...',
    notifications: 'Notifications',
    no_notifications: 'No new notifications',
    create_wallet_msg: 'Create a wallet on Modrinth to receive payouts.',
    wallet_error: 'Wallet Not Found',
    go_to_settings: 'Go to Settings',
    gallery: 'Gallery',
    icon: 'Icon',
    upload: 'Upload',
    dependencies: 'Dependencies',
    no_dependencies: 'No dependencies',
    release: 'Release',
    beta: 'Beta',
    alpha: 'Alpha',
    no_versions: 'No versions yet',
    game_versions: 'Game Versions',
    loaders: 'Loaders',
    popularity: 'Popularity',
    read_all: 'Read All',
    press_back_again: 'Press back again to exit',
    accent_color: 'Accent Color',
    reset: 'Reset',
    show_preview: 'Show preview',
    hide_preview: 'Hide preview',
    payouts: 'Payouts',
    available: 'Available now',
    last_30_days: 'Last 30 days',
    all_time: 'All time',
    recent_transactions: 'Recent transactions',
    no_payout_transactions: 'No payout transactions available',
    token_no_payouts_access: 'Token has no payouts access. Recreate it with payouts scope.',
    payouts_endpoint_unavailable: 'Payout history is unavailable (404). This can mean missing access (needs PAYOUTS_READ scope) or the resource is unavailable. Wallet balance may still be shown separately.',
    payouts_api_unavailable: 'Payout history is unavailable: this endpoint is missing from the public API (route does not exist). Open Revenue on the Modrinth website to view transactions.',
    open_revenue_page: 'Open Revenue',
    open_payout_settings: 'Payout settings',
    pending: 'Pending',
    withdrawn: 'Withdrawn',
    payout_data_unavailable: 'Payout data is not available for this account/token.',
    projects_label: 'Projects',
    total_label: 'Total',
    downloads_label: 'Downloads',
    follows_label: 'Follows',
    avg_label: 'Avg',
    downloads_per_project: 'Downloads / project',
    no_top_projects: 'No top projects data',
    categories_overview: 'Categories'
  }
};

// --- Settings Context ---
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('theme');
    return stored === 'light' ? 'light' : 'dark';
  });
  const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'en');
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
    return (TRANSLATIONS[language] as any)[key] || key;
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

// --- Components ---

const WelcomeSetup: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { t, language, setLanguage } = useSettings();
  return (
    <div className="fixed inset-0 z-[200] bg-modrinth-bg flex flex-col items-center justify-center p-6 text-center animate-fade-in">
      <div className="w-full max-w-sm flex-1 flex flex-col items-center justify-center">
        <div className="bg-modrinth-card/70 backdrop-blur-xl w-32 h-32 rounded-3xl flex items-center justify-center mb-10 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
          <ModrinthLogo className="w-16 h-16" />
        </div>

        <h2 className="text-3xl font-bold text-modrinth-text mb-3 animate-fade-in-up">{t('welcome_title')}</h2>
        <p className="text-modrinth-muted mb-10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>{t('welcome_subtitle')}</p>

        <div className="w-full bg-modrinth-card/70 backdrop-blur-xl p-4 rounded-3xl shadow-[0_12px_38px_rgba(0,0,0,0.24)] overflow-hidden">
          <div className="text-modrinth-green font-bold text-sm uppercase mb-3">{t('choose_language')}</div>
          <div className="flex bg-modrinth-bg rounded-xl p-1 border border-modrinth-border">
            {(['en', 'ru'] as Language[]).map(l => (
              <button
                key={l}
                type="button"
                onClick={() => setLanguage(l)}
                className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${language === l ? 'bg-modrinth-card text-modrinth-text shadow-sm' : 'text-modrinth-muted hover:text-modrinth-text'}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
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
  const { t } = useSettings();
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
        <div className="bg-modrinth-card/70 backdrop-blur-xl w-32 h-32 rounded-3xl flex items-center justify-center mb-10 shadow-[0_18px_50px_rgba(0,0,0,0.35)] animate-pulse-slow">
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

const LoginScreen: React.FC<{ onLogin: (token: string) => void; isLoading: boolean; error: string | null; onShowHelp: () => void }> = ({ onLogin, isLoading, error, onShowHelp }) => {
  const [tokenInput, setTokenInput] = useState('');
  const { t } = useSettings();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-modrinth-bg p-6 relative overflow-hidden">
      <div className="w-full max-w-xs animate-fade-in-up relative z-10">
        <div className="flex justify-center mb-8">
           <div className="bg-modrinth-card/70 backdrop-blur-xl p-5 rounded-3xl shadow-[0_18px_50px_rgba(0,0,0,0.40)] relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.03] via-transparent to-black/10" />
              <div className="absolute inset-0 pointer-events-none rounded-3xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035),inset_0_0_0_2px_rgba(0,0,0,0.25)]" />
              <ModrinthLogo className="w-16 h-16 text-modrinth-green" />
           </div>
        </div>
        <h1 className="text-3xl font-bold text-center text-modrinth-text mb-2">{t('login_title')}</h1>
        <p className="text-modrinth-muted text-center text-sm mb-8">{t('login_subtitle')}</p>
        <div className="space-y-4">
          <div className="bg-modrinth-card/70 backdrop-blur-xl p-1 rounded-2xl shadow-[0_12px_38px_rgba(0,0,0,0.30)]">
            <input type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="mrp_..." className="w-full bg-transparent text-modrinth-text p-4 outline-none text-center font-mono" />
          </div>
          {error && <div className="text-red-400 text-sm text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</div>}
          <button onClick={() => onLogin(tokenInput)} disabled={isLoading || !tokenInput} className="w-full bg-modrinth-green text-white font-bold py-4 rounded-2xl active:scale-[0.98] flex items-center justify-center shadow-lg shadow-modrinth-green/20">
            {isLoading ? <Loader2 className="animate-spin" /> : t('authorize')}
          </button>
          <button onClick={onShowHelp} className="w-full text-xs text-center text-modrinth-muted mt-4 hover:text-modrinth-green underline decoration-dotted">{t('how_to_get_token')}</button>
        </div>
      </div>
      <div className="absolute bottom-6 text-[10px] text-modrinth-muted text-center w-full">
        Unofficial app for Modrinth. Not affiliated with or endorsed by Modrinth. by <a href="https://modrinth.com/user/imsawiq" className="font-bold text-modrinth-green">imsawiq</a>
      </div>
    </div>
  );
};

const TokenHelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useSettings();

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

const NotificationsModal: React.FC<{ isOpen: boolean; onClose: () => void; user: ModrinthUser; token: string }> = ({ isOpen, onClose, user, token }) => {
    const [notifs, setNotifs] = useState<ModrinthNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const { t } = useSettings();

    useEffect(() => {
        if(isOpen) {
            setLoading(true);
            // Explicitly fetch unread and force filter on client side to avoid ghosts from cache
            fetchNotifications(user.id, token, 'unread')
                .then(data => setNotifs(data.filter(n => !n.read)))
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [isOpen, user.id, token]);

    const handleRead = async (id: string) => {
        try {
            await markNotificationRead(id, token);
            // Remove immediately from UI
            setNotifs(prev => prev.filter(n => n.id !== id));
        } catch (e) { console.error(e); }
    };

    const handleReadAll = async () => {
        const ids = notifs.map(n => n.id);
        if (ids.length === 0) return;
        try {
            setLoading(true);
            await markMultipleNotificationsRead(ids, token);
            setNotifs([]);
        } catch(e) { console.error(e); }
        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 sm:p-4 animate-fade-in pt-safe">
			<div className="bg-modrinth-card backdrop-blur-2xl w-full max-w-md rounded-3xl animate-scale-in max-h-[75vh] sm:max-h-[80vh] flex flex-col shadow-[0_24px_60px_rgba(0,0,0,0.55)] overflow-hidden relative">
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.03] via-transparent to-black/10" />
                <div className="absolute inset-0 pointer-events-none rounded-3xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.28)]" />
                <div className="p-5 flex justify-between items-center bg-transparent rounded-t-3xl relative">
                    <h3 className="text-lg font-bold text-modrinth-text flex items-center gap-2">
                        <Bell className="text-modrinth-green" size={20} /> {t('notifications')}
                    </h3>
                    <div className="flex items-center gap-2">
                        {notifs.length > 0 && (
                            <button onClick={handleReadAll} className="bg-modrinth-bg hover:bg-modrinth-cardHover text-modrinth-green text-xs font-bold px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)]">
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
                            <div className="bg-modrinth-bg p-4 rounded-full mb-3 opacity-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)]"><Bell size={32} /></div>
                            <p>{t('no_notifications')}</p>
                        </div>
                    )}
                    {notifs.map(n => (
                        <div key={n.id} className="bg-modrinth-bg p-4 rounded-3xl flex gap-3 relative group shadow-[0_12px_38px_rgba(0,0,0,0.28)] overflow-hidden">
                            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
                            <div className="absolute inset-0 pointer-events-none rounded-3xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)]" />
                            <div className="flex-1 relative min-w-0">
                                <h4 className="text-sm font-bold text-modrinth-text mb-1">{n.title}</h4>
                                <p className="text-xs text-modrinth-muted leading-relaxed mb-2">{n.text}</p>
                                <div className="flex items-center gap-3 text-[10px] text-modrinth-muted/70">
                                    <span>{new Date(n.created).toLocaleDateString()}</span>
                                    {n.link && <a href={`https://modrinth.com${n.link}`} target="_blank" rel="noreferrer" className="text-modrinth-green hover:underline flex items-center gap-1 truncate">View <ExternalLink size={8}/></a>}
                                </div>
                            </div>
                            <button onClick={() => handleRead(n.id)} className="relative text-modrinth-green hover:bg-modrinth-green/10 self-start p-1.5 rounded-full transition-colors"><Check size={16}/></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const Dashboard: React.FC<{ user: ModrinthUser; token: string }> = ({ user, token }) => {
  const [projects, setProjects] = useState<ModrinthProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotifs, setShowNotifs] = useState(false);
  const navigate = useNavigate();
  const { t } = useSettings();

  const loadProjects = useCallback(() => {
    let mounted = true;
    setLoading(true);
    fetchUserProjects(user.id, token)
      .then(data => {
        if (mounted) {
          setProjects(data.sort((a, b) => b.downloads - a.downloads));
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

  return (
    <div className="pb-4 px-4 animate-fade-in">
      <header className="flex justify-between items-center mb-6 sticky top-0 z-50 backdrop-blur-2xl pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 -mx-4 px-4 min-h-[92px] shadow-[0_14px_50px_rgba(0,0,0,0.55)] overflow-hidden relative transition-colors duration-300" style={{ backgroundColor: 'rgba(var(--card-rgb), 0.55)' }}>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.045] via-transparent to-black/10" />
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),inset_0_0_0_2px_rgba(0,0,0,0.35)]" />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-modrinth-text leading-none">{t('dashboard')}</h1>
          <p className="text-modrinth-muted text-xs font-medium">{t('dev_panel')}</p>
        </div>
        <div className="flex items-center gap-3">
           <button
             onClick={() => loadProjects()}
             className="p-2 text-modrinth-muted hover:text-modrinth-green transition-colors"
             aria-label="Refresh projects"
           >
             <RefreshCw size={20} />
           </button>
           <button onClick={()=>setShowNotifs(true)} className="relative p-2 text-modrinth-muted hover:text-modrinth-green transition-colors">
              <Bell size={24} />
              {/* TODO: Add dynamic unread badge based on API */}
           </button>
           <img src={user.avatar_url} alt="User" className="w-10 h-10 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035),0_8px_24px_rgba(0,0,0,0.25)]" />
        </div>
      </header>
      {loading ? <div className="flex justify-center pt-40"><Loader2 className="animate-spin text-modrinth-green w-10 h-10" /></div> : (
        <div className="space-y-1 pb-20">
          {projects.map((p, idx) => (
             <div key={p.id} style={{ animationDelay: `${idx * 0.05}s` }} className="animate-fade-in-up">
                <ProjectCard project={p} onClick={(id) => navigate(`/project/${id}`)} />
             </div>
          ))}
          {projects.length === 0 && (
            <div className="text-center text-modrinth-muted py-40">
              <div className="bg-modrinth-card/70 backdrop-blur-xl inline-block p-6 rounded-full mb-4 shadow-[0_12px_38px_rgba(0,0,0,0.30)]"><FileText size={48} className="opacity-50"/></div>
              <p className="text-lg font-medium">{t('no_projects')}</p>
              <p className="text-sm mt-2">{t('create_project')}</p>
            </div>
          )}
        </div>
      )}
      <NotificationsModal isOpen={showNotifs} onClose={()=>setShowNotifs(false)} user={user} token={token} />
    </div>
  );
};

const InviteMemberModal: React.FC<{ isOpen: boolean; onClose: () => void; onInvite: (userId: string) => Promise<void> }> = ({ isOpen, onClose, onInvite }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const { t } = useSettings();

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

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-modrinth-card/75 backdrop-blur-2xl w-full max-w-sm rounded-3xl p-5 animate-fade-in-up shadow-[0_24px_60px_rgba(0,0,0,0.55)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.035] via-transparent to-black/10" />
        <div className="absolute inset-0 pointer-events-none rounded-3xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035),inset_0_0_0_2px_rgba(0,0,0,0.25)]" />
        <div className="relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-modrinth-text">{t('invite')}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-modrinth-cardHover text-modrinth-muted hover:text-modrinth-text transition-colors">
          <X size={18}/></button>
        </div>
        <div className="relative mb-4">
           <Search className="absolute left-3 top-3 text-modrinth-muted" size={16}/>
           <input autoFocus type="text" placeholder={t('search_user')} className="w-full bg-modrinth-bg/60 border border-modrinth-border/70 rounded-2xl pl-10 pr-4 py-3 text-sm text-modrinth-text focus:border-modrinth-green outline-none" value={query} onChange={e=>setQuery(e.target.value)} />
        </div>
        <div className="max-h-60 overflow-y-auto space-y-2">
           {searching && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-modrinth-green"/></div>}
           {!searching && results.map(user => (
             <div key={user.user_id} className="flex items-center justify-between p-2 hover:bg-modrinth-bg/60 rounded-2xl group cursor-pointer" onClick={() => { onInvite(user.user_id); onClose(); }}>
                <div className="flex items-center gap-3">
                  <img src={user.avatar_url} className="w-8 h-8 rounded-full" alt=""/>
                  <span className="text-sm font-bold text-modrinth-text">{user.username}</span>
                </div>
                <button className="bg-modrinth-green/16 text-modrinth-green px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-modrinth-green hover:text-white transition-colors active:scale-[0.98]">{t('add')}</button>
             </div>
           ))}
           {!searching && query && results.length === 0 && <p className="text-center text-xs text-modrinth-muted py-4">User not found. Enter exact username.</p>}
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
    ? 'bg-white/95 border border-black/10 shadow-[0_24px_60px_rgba(0,0,0,0.25)]'
    : 'bg-modrinth-card/75 shadow-[0_24px_60px_rgba(0,0,0,0.55)]';
  const inputClass = theme === 'light'
    ? 'bg-black/[0.04] border border-black/10 text-black focus:border-modrinth-green'
    : 'bg-modrinth-bg/60 border border-modrinth-border/70 text-modrinth-text focus:border-modrinth-green';
  const mutedLabelClass = theme === 'light' ? 'text-black/60' : 'text-modrinth-muted';
  const closeButtonClass = theme === 'light'
    ? 'p-2 rounded-full hover:bg-black/5 text-black/60 hover:text-black transition-colors'
    : 'p-2 rounded-full hover:bg-modrinth-cardHover text-modrinth-muted hover:text-modrinth-text transition-colors';
  const cancelButtonClass = theme === 'light'
    ? 'flex-1 py-3 rounded-2xl font-bold text-sm bg-black/5 text-black/70 hover:text-black hover:bg-black/10 transition-colors active:scale-[0.98]'
    : 'flex-1 py-3 rounded-2xl font-bold text-sm bg-modrinth-bg/60 text-modrinth-muted hover:text-modrinth-text hover:bg-modrinth-bg transition-colors active:scale-[0.98]';

  return (
    <div className={`fixed inset-0 z-[150] ${overlayClass} backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in`}>
      <div className={`${modalClass} backdrop-blur-2xl w-full max-w-sm rounded-3xl p-5 animate-fade-in-up relative overflow-hidden`}>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.035] via-transparent to-black/10" />
        <div className="absolute inset-0 pointer-events-none rounded-3xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035),inset_0_0_0_2px_rgba(0,0,0,0.25)]" />
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

const ProjectDetail: React.FC<{ token: string }> = ({ token }) => {
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
  const { t } = useSettings();

  const [showBodyPreview, setShowBodyPreview] = useState(false);

  const [gameVersionTags, setGameVersionTags] = useState<string[]>([]);
  const [loaderTags, setLoaderTags] = useState<string[]>([]);
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

  const handleInputChange = (field: keyof ModrinthProject | string, value: any) => {
    setFormData(prev => field === 'license_id' ? { ...prev, license: { ...prev.license!, id: value, name: prev.license?.name || '' } } : { ...prev, [field]: value });
  };

  const renderMarkdown = (text: string) => {
    if (!text) return { __html: '' };

    let safe = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const formatInline = (value: string) => {
      let v = value;
      // Links
      v = v.replace(/\[(.+?)\]\((https?:[^\s)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1<\/a>');
      // Code
      v = v.replace(/`([^`]+)`/gim, '<code>$1<\/code>');
      // Bold
      v = v.replace(/\*\*(.*?)\*\*/gim, '<strong>$1<\/strong>');
      v = v.replace(/__(.*?)__/gim, '<strong>$1<\/strong>');
      // Strikethrough
      v = v.replace(/~~(.*?)~~/gim, '<del>$1<\/del>');
      // Italic
      v = v.replace(/_(.*?)_/gim, '<em>$1<\/em>');
      v = v.replace(/\*(.*?)\*/gim, '<em>$1<\/em>');
      return v;
    };

    const lines = safe.split(/\n/);
    const htmlParts: string[] = [];
    let inList = false;
    let lastWasH1 = false;

    for (let raw of lines) {
      const line = raw.trimEnd();
      const content = line.trimStart();

      if (!line.trim()) {
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        lastWasH1 = false;
        continue;
      }

      // Headings
      const h3 = /^###\s+(.*)/.exec(content);
      if (h3) {
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        htmlParts.push(`<h3>${formatInline(h3[1])}<\/h3>`);
        lastWasH1 = false;
        continue;
      }
      const h2 = /^##\s+(.*)/.exec(content);
      if (h2) {
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        htmlParts.push(`<h2>${formatInline(h2[1])}<\/h2>`);
        lastWasH1 = false;
        continue;
      }
      const h1 = /^#\s+(.*)/.exec(content);
      if (h1) {
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        htmlParts.push(`<h1>${formatInline(h1[1])}<\/h1>`);
        lastWasH1 = true;
        continue;
      }

      // Horizontal rule (---)
      if (/^-{3,}\s*$/.test(content)) {
        if (lastWasH1) {
          // Skip extra hr right after a level-1 heading to avoid double line
          lastWasH1 = false;
          continue;
        }
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        htmlParts.push('<hr/>');
        lastWasH1 = false;
        continue;
      }

      // Unordered list item
      const li = /^-\s+(.*)/.exec(content);
      if (li) {
        if (!inList) {
          htmlParts.push('<ul>');
          inList = true;
        }
        htmlParts.push(`<li>${formatInline(li[1])}<\/li>`);
        lastWasH1 = false;
        continue;
      }

      // Blockquote
      const bq = /^>\s?(.*)/.exec(content);
      if (bq) {
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        htmlParts.push(`<blockquote>${formatInline(bq[1])}<\/blockquote>`);
        lastWasH1 = false;
        continue;
      }

      if (inList) {
        htmlParts.push('</ul>');
      }

      htmlParts.push(`<p>${formatInline(line)}<\/p>`);
      lastWasH1 = false;
    }

    if (inList) {
      htmlParts.push('</ul>');
    }

    return { __html: htmlParts.join('') };
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

  const handleRoleChange = async (userId: string, newRole: string) => {
     if(!project) return;
     try {
        await updateTeamMember(project.team, userId, newRole, token);
        await loadData();
     } catch(e) { alert('Failed to update role'); }
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
                <div className="bg-modrinth-card/70 backdrop-blur-xl p-5 rounded-3xl relative overflow-hidden shadow-[0_12px_38px_rgba(0,0,0,0.28)]">
                   <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
                   <div className="absolute top-0 right-0 p-3 opacity-10 text-modrinth-text"><Download size={40} /></div>
                   <p className="text-modrinth-muted text-xs uppercase font-bold mb-1">{t('downloads')}</p>
                   <p className="text-2xl font-bold text-modrinth-text">{project.downloads.toLocaleString()}</p>
                </div>
                <div className="bg-modrinth-card/70 backdrop-blur-xl p-5 rounded-3xl relative overflow-hidden shadow-[0_12px_38px_rgba(0,0,0,0.28)]">
                   <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
                   <div className="absolute top-0 right-0 p-3 opacity-10 text-modrinth-text"><Heart size={40} /></div>
                   <p className="text-modrinth-muted text-xs uppercase font-bold mb-1">{t('likes')}</p>
                   <p className="text-2xl font-bold text-modrinth-text">{project.followers.toLocaleString()}</p>
                </div>
             </div>
             <div className="bg-modrinth-card/70 backdrop-blur-xl rounded-3xl p-5 shadow-[0_12px_38px_rgba(0,0,0,0.24)] relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
                <h3 className="text-modrinth-text font-bold mb-2 text-sm flex items-center gap-2"><Info size={16} className="text-modrinth-green"/> {t('description')}</h3>
                <p className="text-modrinth-text/80 leading-relaxed text-sm">{project.description}</p>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="bg-modrinth-card/70 backdrop-blur-xl p-4 rounded-3xl shadow-[0_12px_38px_rgba(0,0,0,0.22)] relative overflow-hidden">
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
                  <div className="flex items-center gap-2 mb-3 text-modrinth-muted text-xs font-bold uppercase"><Monitor size={14} /> {t('client')}</div>
                  <div className={`text-center py-2 rounded-lg font-bold text-sm border ${project.client_side === 'required' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-modrinth-cardHover text-modrinth-muted border-modrinth-border'}`}>{project.client_side}</div>
               </div>
               <div className="bg-modrinth-card/70 backdrop-blur-xl p-4 rounded-3xl shadow-[0_12px_38px_rgba(0,0,0,0.22)] relative overflow-hidden">
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
                  <div className="flex items-center gap-2 mb-3 text-modrinth-muted text-xs font-bold uppercase"><Server size={14} /> {t('server')}</div>
                  <div className={`text-center py-2 rounded-lg font-bold text-sm border ${project.server_side === 'required' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-modrinth-cardHover text-modrinth-muted border-modrinth-border'}`}>{project.server_side}</div>
               </div>
             </div>
             
             {/* Dependencies */}
             <div className="bg-modrinth-card/70 backdrop-blur-xl rounded-3xl p-5 shadow-[0_12px_38px_rgba(0,0,0,0.24)] relative overflow-hidden">
                 <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
                 <h3 className="text-modrinth-text font-bold mb-3 text-sm flex items-center gap-2"><Package size={16} className="text-modrinth-green"/> {t('dependencies')}</h3>
                 <div className="space-y-3">
                     {deps.length === 0 && <p className="text-xs text-modrinth-muted italic">{t('no_dependencies')}</p>}
                     {deps.map((d, i) => (
                         <div key={i} className="flex items-center gap-3 bg-modrinth-bg p-3 rounded-2xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02),inset_0_0_0_2px_rgba(0,0,0,0.22)]">
                             <div className="w-10 h-10 rounded-lg bg-modrinth-card shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)] overflow-hidden flex-shrink-0 flex items-center justify-center">
                                {d.icon_url ? (
                                  <img src={d.icon_url} className="w-full h-full object-cover"/>
                                ) : (
                                  <Package size={20} className="text-modrinth-muted opacity-50"/>
                                )}
                             </div>
                             <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                   <span className="text-sm font-bold text-modrinth-text truncate pr-2">{d.title || d.project_id}</span>
                                   <span className="text-[10px] text-modrinth-muted bg-modrinth-bg px-2 py-0.5 rounded-full uppercase tracking-wider shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02),inset_0_0_0_2px_rgba(0,0,0,0.18)]">{d.dependency_type}</span>
                                </div>
                                <p className="text-[10px] text-modrinth-muted font-mono mt-0.5">{d.project_id || d.file_name}</p>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>

             <div className="space-y-2 pt-2">
               <h3 className="text-modrinth-muted font-bold text-xs uppercase px-1 mb-1">{t('resources')}</h3>
               {project.source_url && <a href={project.source_url} target="_blank" className="flex items-center gap-3 p-4 rounded-3xl bg-modrinth-card/70 backdrop-blur-xl text-modrinth-text active:scale-[0.99] shadow-[0_12px_38px_rgba(0,0,0,0.22)] relative overflow-hidden"><div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" /><Globe size={18} /><span className="text-sm font-medium relative">{t('source')}</span><ExternalLink size={14} className="ml-auto opacity-30 relative"/></a>}
               {project.issues_url && <a href={project.issues_url} target="_blank" className="flex items-center gap-3 p-4 rounded-3xl bg-modrinth-card/70 backdrop-blur-xl text-modrinth-text active:scale-[0.99] shadow-[0_12px_38px_rgba(0,0,0,0.22)] relative overflow-hidden"><div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" /><Info size={18} /><span className="text-sm font-medium relative">{t('issues')}</span><ExternalLink size={14} className="ml-auto opacity-30 relative"/></a>}
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
                        <div key={v.id} className="bg-modrinth-card backdrop-blur-xl p-4 rounded-3xl relative shadow-[0_12px_38px_rgba(0,0,0,0.24)] overflow-hidden">
                            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
                            <div className="absolute inset-0 pointer-events-none rounded-3xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)]" />
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
                                <div className="flex flex-col items-end gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setVersionMenuId(prev => prev === v.id ? null : v.id); }}
                                    className="p-1.5 rounded-full text-zinc-500 hover:text-modrinth-green hover:bg-modrinth-bg transition-colors"
                                  >
                                    <MoreVertical size={14} />
                                  </button>
                                  {versionMenuId === v.id && (
                                    <div
                                      className="absolute top-10 right-2 z-30 bg-modrinth-card backdrop-blur-2xl rounded-2xl shadow-[0_18px_50px_rgba(0,0,0,0.55)] text-[11px] overflow-hidden animate-fade-in-up min-w-[140px]"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.03] via-transparent to-black/10" />
                                      <div className="absolute inset-0 pointer-events-none rounded-2xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.28)]" />
                                      <button
                                        className="relative w-full px-3 py-2 text-left text-modrinth-text hover:bg-modrinth-bg flex items-center gap-1.5"
                                        onClick={() => { setVersionMenuId(null); openEditVersion(v); }}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        className="relative w-full px-3 py-2 text-left text-red-400 hover:bg-red-500/10 border-t border-modrinth-border/20"
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
                                        <span key={gv} className="text-[10px] bg-modrinth-bg px-2 py-1 rounded-full text-modrinth-muted whitespace-nowrap shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)]">{gv}</span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    {v.loaders.map(l => (
                                        <span key={l} className="text-[10px] font-bold uppercase text-modrinth-text/70 bg-modrinth-bg px-2 py-0.5 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02),inset_0_0_0_2px_rgba(0,0,0,0.20)]">{l}</span>
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
                <div className="bg-modrinth-card/70 backdrop-blur-xl p-5 rounded-3xl flex items-center gap-4 shadow-[0_12px_38px_rgba(0,0,0,0.24)] relative overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
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
              <div className="space-y-4 bg-modrinth-card/70 backdrop-blur-xl p-5 rounded-3xl shadow-[0_12px_38px_rgba(0,0,0,0.24)] relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
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
                      <div dangerouslySetInnerHTML={renderMarkdown(formData.body || '')} />
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Gallery Management */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-modrinth-green mb-2 px-1"><ImageIcon size={18} /><h3 className="font-bold uppercase tracking-wider text-sm">{t('gallery')}</h3></div>
                <div className="bg-modrinth-card/70 backdrop-blur-xl p-5 rounded-3xl shadow-[0_12px_38px_rgba(0,0,0,0.24)] relative overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {project.gallery?.map((img, idx) => (
                            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden group bg-modrinth-bg">
                                <img src={img.url} className="w-full h-full object-cover" />
                                <button onClick={()=>handleDeleteGallery(img.url)} className="absolute top-1 right-1 bg-black/50 p-1 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
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
              <div className="bg-modrinth-card/70 backdrop-blur-xl p-5 rounded-3xl shadow-[0_12px_38px_rgba(0,0,0,0.24)] relative overflow-hidden space-y-4">
                 <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
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
               <div className="bg-modrinth-card/70 backdrop-blur-xl p-5 rounded-3xl shadow-[0_12px_38px_rgba(0,0,0,0.24)] relative overflow-hidden space-y-4">
                 <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
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
              <div key={member.user.id} className="bg-modrinth-card/70 backdrop-blur-xl p-4 rounded-3xl flex flex-col gap-3 shadow-[0_12px_38px_rgba(0,0,0,0.24)] relative overflow-hidden">
                 <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
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
                       <select 
                          value={member.role} 
                          onChange={(e) => handleRoleChange(member.user.id, e.target.value)}
                          className="bg-modrinth-bg text-modrinth-text text-xs font-bold px-2 py-1 rounded-lg border border-modrinth-border outline-none focus:border-modrinth-green"
                       >
                         <option value="Maintainer">Maintainer</option>
                         <option value="Contributor">Contributor</option>
                       </select>
                    )}
                 </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
        );
      })()}
      <InviteMemberModal isOpen={showInviteModal} onClose={()=>setShowInviteModal(false)} onInvite={handleInvite} />

      {editingVersion && (
        <div className="fixed inset-0 z-[180] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-modrinth-card backdrop-blur-2xl w-full max-w-sm rounded-3xl p-5 animate-fade-in-up shadow-[0_24px_60px_rgba(0,0,0,0.55)] relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.03] via-transparent to-black/10" />
            <div className="absolute inset-0 pointer-events-none rounded-3xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.25)]" />
            <div className="relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-modrinth-text">Edit version</h3>
              <button
                onClick={() => setEditingVersion(null)}
                className="p-2 rounded-full hover:bg-modrinth-bg text-modrinth-muted hover:text-modrinth-text"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-modrinth-muted uppercase mb-1">Name</label>
                <input
                  className="w-full bg-modrinth-bg rounded-2xl p-3 text-sm text-modrinth-text outline-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)] focus:shadow-[inset_0_0_0_1px_rgba(74,222,128,0.35),inset_0_0_0_2px_rgba(0,0,0,0.22)]"
                  value={editingVersionName}
                  onChange={e => setEditingVersionName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-modrinth-muted uppercase mb-1">Type</label>
                <select
                  className="w-full bg-modrinth-bg rounded-2xl p-3 text-sm text-modrinth-text outline-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)] focus:shadow-[inset_0_0_0_1px_rgba(74,222,128,0.35),inset_0_0_0_2px_rgba(0,0,0,0.22)]"
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
                  className="w-full bg-modrinth-bg rounded-2xl p-3 text-xs text-modrinth-text outline-none h-24 resize-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)] focus:shadow-[inset_0_0_0_1px_rgba(74,222,128,0.35),inset_0_0_0_2px_rgba(0,0,0,0.22)]"
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
                        className={`px-2 py-1 rounded-full text-[10px] ${active ? 'bg-modrinth-green/20 text-modrinth-text shadow-[inset_0_0_0_1px_rgba(74,222,128,0.45),inset_0_0_0_2px_rgba(0,0,0,0.22)]' : 'bg-modrinth-bg text-modrinth-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)]'}`}
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
                      <div key={idx} className="flex items-center justify-between bg-modrinth-bg rounded-2xl px-3 py-1.5 text-[11px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)]">
                        <div className="flex items-center gap-2 mr-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-modrinth-card overflow-hidden flex-shrink-0 flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)]">
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
                                className="bg-modrinth-bg rounded-lg px-2 py-0.5 text-[10px] text-modrinth-text outline-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.22)]"
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

  if (loading) return <div className="flex justify-center pt-40 animate-fade-in"><Loader2 className="animate-spin text-modrinth-green" /></div>;

  return (
    <div className="px-4 pb-32 animate-fade-in">
      <header className="flex items-center justify-between mb-6 sticky top-0 z-50 backdrop-blur-2xl pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 -mx-4 px-4 min-h-[92px] shadow-[0_14px_50px_rgba(0,0,0,0.55)] overflow-hidden relative transition-colors duration-300" style={{ backgroundColor: 'rgba(var(--card-rgb), 0.55)' }}>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.045] via-transparent to-black/10" />
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),inset_0_0_0_2px_rgba(0,0,0,0.35)]" />
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
        <div className="bg-modrinth-card/70 backdrop-blur-xl p-5 rounded-3xl shadow-[0_12px_38px_rgba(0,0,0,0.24)] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
          <div className="flex items-center justify-between mb-2">
            <div className="text-modrinth-green"><FileText /></div>
            <div className="text-[10px] uppercase text-modrinth-muted font-bold">{t('projects_label')}</div>
          </div>
          <div className="text-2xl font-bold text-modrinth-text">{projects.length.toLocaleString()}</div>
          <div className="text-xs text-modrinth-muted">{t('total_label')}</div>
        </div>
        <div className="bg-modrinth-card/70 backdrop-blur-xl p-5 rounded-3xl shadow-[0_12px_38px_rgba(0,0,0,0.24)] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
          <div className="flex items-center justify-between mb-2">
            <div className="text-modrinth-green"><Download /></div>
            <div className="text-[10px] uppercase text-modrinth-muted font-bold">{t('downloads_label')}</div>
          </div>
          <div className="text-2xl font-bold text-modrinth-text">{stats.totalDownloads.toLocaleString()}</div>
          <div className="text-xs text-modrinth-muted">{t('total_downloads')}</div>
        </div>
        <div className="bg-modrinth-card/70 backdrop-blur-xl p-5 rounded-3xl shadow-[0_12px_38px_rgba(0,0,0,0.24)] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
          <div className="flex items-center justify-between mb-2">
            <div className="text-red-400"><Heart /></div>
            <div className="text-[10px] uppercase text-modrinth-muted font-bold">{t('follows_label')}</div>
          </div>
          <div className="text-2xl font-bold text-modrinth-text">{stats.totalLikes.toLocaleString()}</div>
          <div className="text-xs text-modrinth-muted">{t('total_likes')}</div>
        </div>
        <div className="bg-modrinth-card/70 backdrop-blur-xl p-5 rounded-3xl shadow-[0_12px_38px_rgba(0,0,0,0.24)] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
          <div className="flex items-center justify-between mb-2">
            <div className="text-modrinth-green"><Activity /></div>
            <div className="text-[10px] uppercase text-modrinth-muted font-bold">{t('avg_label')}</div>
          </div>
          <div className="text-2xl font-bold text-modrinth-text">{Math.round(stats.avgDownloads).toLocaleString()}</div>
          <div className="text-xs text-modrinth-muted">{t('downloads_per_project')}</div>
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
      
      <div className="bg-modrinth-card/70 backdrop-blur-xl p-5 rounded-3xl mb-8 animate-fade-in-up shadow-[0_12px_38px_rgba(0,0,0,0.24)] relative overflow-hidden" style={{ animationDelay: '0.15s' }}>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
        {projects.length > 0 ? (
            <div className="space-y-2">
              {sortedProjects.map((p, idx) => {
                const val = p[metric];
                const percent = (val / maxVal) * 100;
                return (
                  <div key={p.id} className="bg-modrinth-bg/50 border border-modrinth-border rounded-2xl p-3 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-modrinth-card flex items-center justify-center text-xs font-bold text-modrinth-muted">{idx + 1}</div>
                    {p.icon_url ? (
                      <img src={p.icon_url} alt={p.title} className="w-10 h-10 rounded-xl bg-modrinth-bg border border-modrinth-border" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-modrinth-bg border border-modrinth-border flex items-center justify-center text-modrinth-muted">
                        <Package size={18} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-bold text-modrinth-text truncate">{p.title}</div>
                        <div className="text-sm font-mono font-bold text-modrinth-text">{val.toLocaleString()}</div>
                      </div>
                      <div className="mt-2 h-2 w-full bg-modrinth-bg rounded-full overflow-hidden border border-modrinth-border/50">
                        <div className="h-full bg-modrinth-green rounded-full" style={{ width: `${percent}%` }} />
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
          <div key={cat} className="bg-modrinth-card/70 backdrop-blur-xl p-3 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.22)] relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
            <div className="flex items-center justify-between gap-2 mb-2 relative">
              <div className="text-sm font-bold text-modrinth-text truncate capitalize">{cat}</div>
              <div className="text-xs font-mono font-bold text-modrinth-muted">{count}</div>
            </div>
            <div className="h-2 bg-modrinth-bg rounded-full overflow-hidden border border-modrinth-border/50 relative">
              <div className="h-full bg-modrinth-green rounded-full" style={{ width: `${projects.length ? (count / projects.length) * 100 : 0}%` }} />
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

const SettingsPage: React.FC<{ user: ModrinthUser; onLogout: () => void; token: string }> = ({ user, onLogout, token }) => {
  const { theme, setTheme, language, setLanguage, t, accentColor, setAccentColor } = useSettings();
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [currUser, setCurrUser] = useState(user);
  const [colorInput, setColorInput] = useState(accentColor);

  const reloadUser = () => {
    fetchCurrentUser(token).then(setCurrUser).catch(console.error);
  };

  return (
    <div className="px-4 pb-20 animate-fade-in">
      <header className="flex items-center justify-between mb-6 sticky top-0 z-50 backdrop-blur-2xl pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 -mx-4 px-4 min-h-[92px] shadow-[0_14px_50px_rgba(0,0,0,0.55)] overflow-hidden relative transition-colors duration-300" style={{ backgroundColor: 'rgba(var(--card-rgb), 0.55)' }}>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.045] via-transparent to-black/10" />
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),inset_0_0_0_2px_rgba(0,0,0,0.35)]" />
        <div className="flex flex-col gap-1 relative">
          <h1 className="text-2xl font-bold text-modrinth-text leading-none">{t('settings')}</h1>
          <p className="text-modrinth-muted text-xs font-medium">{t('dev_panel')}</p>
        </div>
      </header>
      <div className="bg-modrinth-card/70 backdrop-blur-xl p-5 rounded-3xl flex items-center gap-4 mb-6 animate-fade-in-up relative shadow-[0_12px_38px_rgba(0,0,0,0.28)] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.03] via-transparent to-black/10" />
        <img src={currUser.avatar_url} alt={currUser.username} className="w-16 h-16 rounded-full bg-modrinth-bg border-2 border-modrinth-border" />
        <div>
          <div className="relative">
            <h2 className="text-xl font-bold text-modrinth-text">{currUser.username}</h2>
            <p className="text-modrinth-green text-sm font-medium capitalize">{currUser.role}</p>
          </div>
          <button onClick={()=>setShowProfileEdit(true)} className="absolute right-4 top-4 p-2 text-modrinth-muted hover:text-modrinth-green"><Edit3 size={18}/></button>
        </div>
      </div>

      <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
         <div className="bg-modrinth-card/70 backdrop-blur-xl p-4 rounded-3xl shadow-[0_12px_38px_rgba(0,0,0,0.24)] overflow-hidden">
           <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
           <div className="flex items-center gap-2 mb-3 text-modrinth-green font-bold text-sm uppercase"><Globe size={16} /> {t('language')}</div>
           <div className="flex bg-modrinth-bg rounded-xl p-1 border border-modrinth-border">
             {/* Swapped order: EN first */}
             {(['en', 'ru'] as Language[]).map(l => (
               <button key={l} onClick={() => setLanguage(l)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${language === l ? 'bg-modrinth-card text-modrinth-text shadow-sm' : 'text-modrinth-muted hover:text-modrinth-text'}`}>
                 {l.toUpperCase()}
               </button>
             ))}
           </div>
         </div>

         <div className="bg-modrinth-card/70 backdrop-blur-xl p-4 rounded-3xl shadow-[0_12px_38px_rgba(0,0,0,0.24)] overflow-hidden">
           <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
           <div className="flex items-center gap-2 mb-3 text-modrinth-green font-bold text-sm uppercase"><Moon size={16} /> {t('theme')}</div>
           <div className="flex bg-modrinth-bg rounded-xl p-1 border border-modrinth-border">
            {(['dark', 'light'] as ThemeMode[]).map(m => (
               <button key={m} onClick={() => setTheme(m)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${theme === m ? 'bg-modrinth-card text-modrinth-text shadow-sm' : 'text-modrinth-muted hover:text-modrinth-text'}`}>
                 {t(m)}
               </button>
             ))}
           </div>
         </div>

         <div className="bg-modrinth-card/70 backdrop-blur-xl p-4 rounded-3xl shadow-[0_12px_38px_rgba(0,0,0,0.24)] overflow-hidden">
           <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.02] via-transparent to-black/10" />
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
               <p className="text-xs text-modrinth-muted mt-2">Hex формат: #RRGGBB</p>
             </div>
           </div>
         </div>

         <button onClick={onLogout} className="w-full bg-modrinth-bg hover:bg-red-500/10 border border-modrinth-border hover:border-red-500/30 p-4 rounded-2xl flex items-center gap-3 text-modrinth-muted hover:text-red-400 transition-all group shadow-sm">
            <div className="p-2 rounded-lg bg-modrinth-card group-hover:bg-red-500/20"><LogOut size={20} /></div>
            <span className="font-medium">{t('logout')}</span>
         </button>
      </div>

      <div className="mt-12 text-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
         <p className="text-modrinth-muted text-sm font-medium">Rinthy v1.0.0</p>
         <p className="text-modrinth-muted text-xs mt-4">
           {t('unofficial')} <a href="https://modrinth.com/user/imsawiq" className="text-modrinth-green hover:underline">imsawiq</a>
         </p>
      </div>
      <ProfileEditModal isOpen={showProfileEdit} onClose={()=>setShowProfileEdit(false)} user={currUser} token={token} onUpdate={reloadUser} />
    </div>
  );
};

// --- Main Application Component ---

const MainLayout: React.FC<{ user: ModrinthUser; token: string; onLogout: () => void }> = ({ user, token, onLogout }) => {
  const [activeTab, setActiveTab] = useState<NavTab>(NavTab.PROJECTS);
  const { t } = useSettings();
  
  return (
    <>
      <div className="pb-28">
        {activeTab === NavTab.PROJECTS && <Dashboard user={user} token={token} />}
        {activeTab === NavTab.ANALYTICS && <AnalyticsPage user={user} token={token} />}
        {activeTab === NavTab.SETTINGS && <SettingsPage user={user} onLogout={onLogout} token={token} />}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} t={t} />
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

  useEffect(() => {
    const initAuth = async () => {
       if (authState.token && !authState.user) {
        try {
          const user = await fetchCurrentUser(authState.token);
          setAuthState(prev => ({ ...prev, user, isLoading: false, error: null }));
        } catch (err) {
          console.error(err);
          setAuthState(prev => ({ ...prev, isLoading: false, error: 'Invalid Token', token: null }));
          localStorage.removeItem('modrinth_token');
        }
       }
    };
    initAuth();
  }, [authState.token]);

  const handleLogin = async (token: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const user = await fetchCurrentUser(token);
      localStorage.setItem('modrinth_token', token);
      setAuthState({ ...authState, token, user, isLoading: false, error: null });
    } catch (err) {
      setAuthState(prev => ({ ...prev, isLoading: false, error: 'Invalid Token or Network Error' }));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('modrinth_token');
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
              isLoading={authState.isLoading} 
              error={authState.error} 
              onShowHelp={() => setShowHelp(true)}
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
              <Route path="/" element={<MainLayout user={authState.user} token={authState.token} onLogout={handleLogout} />} />
              <Route path="/project/:id" element={<ProjectDetail token={authState.token} />} />
           </Routes>
        </div>
      </HashRouter>
    );
  };

  return (
    <SettingsProvider>
      {renderContent()}
    </SettingsProvider>
  );
};

export default App;
