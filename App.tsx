import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

declare const __APP_VERSION__: string;
import { HashRouter, Routes, Route, useNavigate, useParams, Outlet, useLocation } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { Loader2, LogOut, ArrowLeft, Save, ExternalLink, BarChart2, ShieldCheck, Key, ChevronRight, Download, Activity, BookOpen, FileText, Monitor, Server, Edit3, Globe, Wallet, DollarSign, Archive, Lock, EyeOff, Eye, Info, Heart, Clock, Users, Trash2, Moon, Sun, Smartphone, UserPlus, Search, X, Check, ChevronDown, Bell, AlertTriangle, Image as ImageIcon, Upload, Package, File as FileIcon, Layers, MousePointerClick, CheckCheck, RefreshCw, MoreVertical, Star, Plus, Sparkles, Timer, TrendingUp, LineChart } from 'lucide-react';
import { fetchCurrentUser, fetchUserProjects, fetchProject, fetchOrganization, fetchOrganizationProjects, fetchUserOrganizations, createProject, updateProject, fetchProjectMembers, deleteTeamMember, updateTeamMember, searchUser, addTeamMember, modifyUser, fetchNotifications, markNotificationRead, markMultipleNotificationsRead, runNotificationAction, changeProjectIcon, deleteProjectIcon, deleteProject, addGalleryImage, deleteGalleryImage, fetchProjectDependencies, fetchProjectVersions, fetchGameVersionTags, fetchLoaderTags, modifyVersion, deleteVersionById, fetchUserPayoutHistoryWithStatus, fetchUserByIdWithStatus, fetchPayoutBalanceV3WithStatus, fetchAnalyticsV3WithStatus, joinTeam, transferTeamOwnership, changeUserAvatar, deleteUserAvatar } from './services/modrinthService';
import { AuthState, ModrinthUser, ModrinthProject, ModrinthOrganization, NavTab, ProjectMember, ThemeMode, Language, UserSearchResult, ModifyUserPayload, ModrinthNotification, ProjectDependency, ModrinthVersion, ModrinthPayoutHistory, ModrinthAnalyticsMetric, ModrinthAnalyticsPoint } from './types';
import ProjectCard from './components/ProjectCard';
import BottomNav from './components/BottomNav';
import { LoginScreen, Onboarding, TokenHelpModal, WelcomeSetup } from './components/AuthScreens';
import TeamsPage, { CreateProjectSheet } from './pages/TeamsPage';
import { DEFAULT_LANGUAGE, isSupportedLanguage } from './locales';
import { LanguageSelect, SettingsProvider, useSettings } from './contexts/SettingsContext';
import { calculateWeeklySummary, createAnalyticsSnapshot, readAnalyticsSnapshots, saveAnalyticsSnapshot } from './utils/analyticsSnapshots';
import { formatProjectsCountLabel, getStoredProjectSortMode, PROJECT_SORT_OPTIONS, ProjectSortMode, readFavoriteProjectIds, saveFavoriteProjectIds, saveProjectSortMode, sortProjectsByMode } from './utils/projectPrefs';
import { showToast } from './utils/toast';
import { dismissTopBackLayer, useBackDismiss } from './hooks/useBackDismiss';
const MarkdownRenderer = React.lazy(() => import('./components/MarkdownRenderer'));
const ProjectDetail = React.lazy(() => import('./pages/ProjectDetail'));

// --- Back Button Handler for Android ---
const BackButtonHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useSettings();
  const lastBackPressRef = useRef(0);

  useEffect(() => {
    if (!CapApp || typeof (CapApp as any).addListener !== 'function') return;
    let cancelled = false;

    const handleBackButton = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (cancelled) return;
      if (dismissTopBackLayer()) return;
      if (location.pathname !== '/') {
        navigate(-1);
      } else {
        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          CapApp.exitApp();
        } else {
          lastBackPressRef.current = now;
          showToast(t('press_back_again'), 'neutral');
        }
      }
    });

    return () => {
      cancelled = true;
      handleBackButton.then(h => h.remove()).catch(() => {});
    };
  }, [navigate, location, t]);

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

const MODRINTH_OAUTH_BASE_URL = 'https://rinthy-auth.vercel.app';
const MODRINTH_OAUTH_STATE_KEY = 'modrinth_oauth_state';
const DISCORD_INVITE_URL = 'https://discord.gg/frd5Cw7xPj';

const getOAuthStorage = () => {
  try {
    return window.sessionStorage;
  } catch {
    return window.localStorage;
  }
};

const readOAuthState = () => {
  try {
    return getOAuthStorage().getItem(MODRINTH_OAUTH_STATE_KEY);
  } catch {
    return null;
  }
};

const writeOAuthState = (state: string) => {
  try {
    getOAuthStorage().setItem(MODRINTH_OAUTH_STATE_KEY, state);
  } catch {
    localStorage.setItem(MODRINTH_OAUTH_STATE_KEY, state);
  }
};

const clearOAuthState = () => {
  try {
    sessionStorage.removeItem(MODRINTH_OAUTH_STATE_KEY);
  } catch {}
  try {
    localStorage.removeItem(MODRINTH_OAUTH_STATE_KEY);
  } catch {}
};

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
  } catch {
    // GitHub update checks are best-effort. Browser dev can hit CORS/network
    // restrictions, and this should not pollute the app console.
  }
  return null;
};

const findApkAsset = (release: GitHubRelease) =>
  release.assets.find(a => a.name.toLowerCase().endsWith('.apk'));

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
type ResolvedNotification = ModrinthNotification & {
  displayTitle: string;
  displayText: string;
  projectKey: string;
  projectTitle: string | null;
  projectIconUrl: string | null;
  projectRouteId: string | null;
  entityKind: 'project' | 'organization' | 'notification';
  entityTitle: string | null;
  entityIconUrl: string | null;
  versionLabel: string | null;
};

type NotificationEntityRef = {
  id: string;
  kind: 'project' | 'version' | 'organization' | 'unknown';
  projectSlug?: string;
};

type NotificationGroup = {
  key: string;
  projectTitle: string | null;
  projectIconUrl: string | null;
  projectRouteId: string | null;
  entityKind: 'project' | 'organization' | 'notification';
  entityTitle: string | null;
  entityIconUrl: string | null;
  items: ResolvedNotification[];
};

const MODRINTH_ID_RE = /\b[A-Za-z0-9]{8}\b/g;
const isLikelyRawModrinthId = (value: string) => /[A-Z0-9]/.test(value);

const replaceResolvedIds = (value: string, replacements: Record<string, string>) =>
  value.replace(MODRINTH_ID_RE, (match) => replacements[match] || match);

const getModrinthLink = (link?: string | null) => {
  if (!link) return null;
  if (/^https?:\/\//i.test(link)) return link;
  return `https://modrinth.com${link.startsWith('/') ? link : `/${link}`}`;
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

const getNotificationEntityRefs = (notif: ModrinthNotification): NotificationEntityRef[] => {
  const refs = new Map<string, NotificationEntityRef>();
  const raw = `${notif.title} ${notif.text} ${notif.link || ''}`;
  for (const match of raw.matchAll(MODRINTH_ID_RE)) {
    if (isLikelyRawModrinthId(match[0])) {
      refs.set(match[0], { id: match[0], kind: 'unknown' });
    }
  }

  const link = notif.link || '';
  const projectMatch = link.match(/\/project\/([^/?#]+)/);
  const versionMatch = link.match(/\/version\/([^/?#]+)/);
  const organizationMatch = link.match(/\/organizations?\/([^/?#]+)/);
  const projectSlug = projectMatch?.[1];
  if (projectSlug) refs.set(projectSlug, { id: projectSlug, kind: 'project' });
  if (organizationMatch) refs.set(organizationMatch[1], { id: organizationMatch[1], kind: 'organization' });
  if (versionMatch) {
    refs.set(versionMatch[1], { id: versionMatch[1], kind: 'version', projectSlug });
  }

  return Array.from(refs.values());
};

// --- Components ---
const DISMISS_ANIMATION_MS = 180;

const useAnimatedDismiss = (isOpen: boolean, onClose: () => void) => {
  const [visible, setVisible] = useState(isOpen);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setVisible(true);
      setClosing(false);
    } else if (visible) {
      setClosing(true);
      timerRef.current = window.setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, DISMISS_ANIMATION_MS);
    }
  }, [isOpen, visible]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    timerRef.current = window.setTimeout(() => {
      setVisible(false);
      setClosing(false);
      onClose();
    }, DISMISS_ANIMATION_MS);
  }, [closing, onClose]);

  useBackDismiss(visible, requestClose);

  return { visible, closing, requestClose };
};

// --- Update Modal ---
const UpdateModal: React.FC<{ release: GitHubRelease; onClose: () => void }> = ({ release, onClose }) => {
  const { t } = useSettings();
  const { closing, requestClose } = useAnimatedDismiss(true, onClose);
  const version = release.tag_name.replace(/^v/, '');
  const apkAsset = findApkAsset(release);
  const downloadUrl = apkAsset?.browser_download_url || release.html_url;

  return (
    <div data-closing={closing ? 'true' : undefined} className="app-overlay fixed inset-0 z-[250] flex items-end justify-center p-4 sm:items-center sm:p-6" onClick={requestClose}>
      <div className="app-responsive-sheet flex w-full max-w-sm flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="border-b border-modrinth-border px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-modrinth-green/12 text-modrinth-green">
              <Download size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-black text-modrinth-text">{t('update_available')}</h3>
              <div className="mt-1 flex min-w-0 items-center gap-2 text-sm">
                <span className="font-bold text-modrinth-muted">{APP_VERSION}</span>
                <ChevronRight size={15} className="shrink-0 text-modrinth-green" />
                <span className="min-w-0 truncate font-black text-modrinth-green">{version}</span>
              </div>
            </div>
            <button type="button" onClick={requestClose} className="app-close-button h-9 w-9 shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>

        {release.body && (
          <div className="min-h-0 px-5 py-4">
            <h4 className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-modrinth-muted">{t('update_whats_new')}</h4>
            <div className="app-panel-soft max-h-40 overflow-y-auto whitespace-pre-wrap p-3 text-sm leading-relaxed text-modrinth-text">
              {release.body.slice(0, 500)}{release.body.length > 500 ? '...' : ''}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 border-t border-modrinth-border px-5 py-4">
          <button
            type="button"
            onClick={requestClose}
            className="app-command px-3 py-3 text-sm font-extrabold"
          >
            {t('update_later')}
          </button>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="app-primary flex items-center justify-center gap-2 px-3 py-3 text-sm"
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
    const { t, language } = useSettings();
    const { visible, closing, requestClose } = useAnimatedDismiss(isOpen, onClose);
    const navigate = useNavigate();

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        setLoading(true);
        // Explicitly fetch unread and force filter on client side to avoid ghosts from cache.
        fetchNotifications(user.id, token, 'unread')
            .then(data => {
              if (cancelled) return;
              const unread = data.filter(n => !n.read);
              setNotifs(unread);
              onUnreadCountChange?.(unread.length);
            })
            .catch((error) => {
              if (!cancelled) console.error(error);
            })
            .finally(() => {
              if (!cancelled) setLoading(false);
            });
        return () => {
          cancelled = true;
        };
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
            const organizationCache = new Map<string, ModrinthOrganization>();
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

                if (kind === 'organization') {
                    try {
                        const organization = await fetchOrganization(id, token);
                        organizationCache.set(organization.id, organization);
                        organizationCache.set(organization.slug, organization);
                        replacements[id] = organization.name || id;
                        replacements[organization.id] = organization.name || organization.id;
                        replacements[organization.slug] = organization.name || organization.slug;
                    } catch {
                        // Leave unresolved organization IDs untouched.
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
                        if (kind !== 'unknown') return;

                        try {
                            const organization = await fetchOrganization(id, token);
                            organizationCache.set(organization.id, organization);
                            organizationCache.set(organization.slug, organization);
                            replacements[id] = organization.name || id;
                            replacements[organization.id] = organization.name || organization.id;
                            replacements[organization.slug] = organization.name || organization.slug;
                        } catch {
                            // Leave unknown IDs untouched.
                        }
                    }
                }
            }));

            if (cancelled) return;

            setResolvedNotifs(
                notifs.map((notif) => {
                    const link = notif.link || '';
                    const projectSlug = link.match(/\/project\/([^/?#]+)/)?.[1] || null;
                    const organizationSlug = link.match(/\/organizations?\/([^/?#]+)/)?.[1] || null;
                    const rawIdsFromText = ((notif.title + ' ' + notif.text).match(MODRINTH_ID_RE) || []).filter(isLikelyRawModrinthId);
                    const projectIdFromText = rawIdsFromText.find((id) => projectCache.has(id)) || null;
                    const organizationIdFromText = rawIdsFromText.find((id) => organizationCache.has(id)) || null;
                    const project = (projectSlug && projectCache.get(projectSlug)) || (projectIdFromText && projectCache.get(projectIdFromText)) || null;
                    const organization = (organizationSlug && organizationCache.get(organizationSlug)) || (organizationIdFromText && organizationCache.get(organizationIdFromText)) || null;
                    const versionId = link.match(/\/version\/([^/?#]+)/)?.[1] || (rawIdsFromText.find((id) => versionReplacements[id]) ?? null);
                    const entityKind = organization ? 'organization' : project ? 'project' : 'notification';
                    const entityTitle = organization?.name || project?.title || null;
                    const entityIconUrl = organization?.icon_url || project?.icon_url || null;

                    return {
                        ...notif,
                        displayTitle: replaceResolvedIds(notif.title, replacements),
                        displayText: replaceResolvedIds(notif.text, replacements),
                        projectKey: organization?.id || organization?.slug || project?.id || project?.slug || notif.id,
                        projectTitle: project?.title || null,
                        projectIconUrl: project?.icon_url || null,
                        projectRouteId: project?.slug || project?.id || projectSlug,
                        entityKind,
                        entityTitle,
                        entityIconUrl,
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
                if (!existing.projectRouteId && notif.projectRouteId) existing.projectRouteId = notif.projectRouteId;
                if (existing.entityKind === 'notification' && notif.entityKind !== 'notification') existing.entityKind = notif.entityKind;
                if (!existing.entityTitle && notif.entityTitle) existing.entityTitle = notif.entityTitle;
                if (!existing.entityIconUrl && notif.entityIconUrl) existing.entityIconUrl = notif.entityIconUrl;
                return;
            }

            groups.set(notif.projectKey, {
                key: notif.projectKey,
                projectTitle: notif.projectTitle,
                projectIconUrl: notif.projectIconUrl,
                projectRouteId: notif.projectRouteId,
                entityKind: notif.entityKind,
                entityTitle: notif.entityTitle,
                entityIconUrl: notif.entityIconUrl,
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

    const handleNotificationAction = async (notif: ResolvedNotification, actionRoute?: [string, string] | string[]) => {
        if (!actionRoute || pendingReadIds.has(notif.id)) return;
        try {
            setPendingReadIds((prev) => new Set(prev).add(notif.id));
            await runNotificationAction(actionRoute, token);
            removeUnreadNotifications([notif.id]);
            await markNotificationRead(notif.id, token);
        } catch (e: any) {
            alert(e.message || 'Failed to run notification action');
            console.error(e);
        } finally {
            setPendingReadIds((prev) => {
                const next = new Set(prev);
                next.delete(notif.id);
                return next;
            });
        }
    };

    const openProjectFromNotification = (projectRouteId: string | null, ids: string[]) => {
        if (!projectRouteId) return;
        void handleReadGroup(ids);
        requestClose();
        navigate(`/project/${encodeURIComponent(projectRouteId)}`);
    };

    if (!visible) return null;

    return (
        <div data-closing={closing ? 'true' : undefined} className="app-overlay fixed inset-0 z-[220] flex items-end justify-center p-3 pt-safe sm:items-center sm:p-4" onClick={requestClose}>
			<div className="app-responsive-sheet flex h-[min(86dvh,760px)] w-full max-w-md flex-col overflow-hidden sm:h-[min(82dvh,760px)]" onClick={(event) => event.stopPropagation()}>
                <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-modrinth-border px-5 py-4">
                    <div className="min-w-0">
                        <h3 className="flex items-center gap-2 text-lg font-extrabold text-modrinth-text">
                            <Bell className="shrink-0 text-modrinth-green" size={20} />
                            <span className="truncate">{t('notifications')}</span>
                        </h3>
                        <p className="mt-0.5 text-xs text-modrinth-muted">{notifs.length.toLocaleString()} unread</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {notifs.length > 0 && (
                            <button onClick={handleReadAll} disabled={loading} className="app-glass-button flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-extrabold text-modrinth-green transition-colors disabled:opacity-50">
                                <CheckCheck size={14}/> <span>{t('read_all')}</span>
                            </button>
                        )}
                        <button onClick={requestClose} className="app-close-button h-9 w-9">
                          <X size={18} />
                        </button>
                    </div>
                </div>
                <div className="relative min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4">
                    {loading && <div className="flex justify-center p-10"><Loader2 className="animate-spin text-modrinth-green" /></div>}
                    {!loading && notifs.length === 0 && (
                        <div className="text-center py-20 text-modrinth-muted flex flex-col items-center">
                            <div className="mb-3 rounded-lg bg-modrinth-bg p-4 opacity-70"><Bell size={32} /></div>
                            <p>{t('no_notifications')}</p>
                        </div>
                    )}
                    {groupedNotifs.map(group => {
                        const primary = group.items[0];
                        const expanded = expandedGroups[group.key] ?? group.items.length <= 1;
                        const receivedLabel = formatNotificationRelativeTime(primary.created, language);
                        const groupActionIds = group.items.map((item) => item.id);
                        const groupTitle =
                          group.entityKind === 'project' && group.entityTitle
                            ? group.entityTitle
                            : group.entityTitle || primary.displayTitle;
                        const groupSubtitle =
                          group.entityKind === 'project'
                            ? t('project_updated_group')
                            : primary.displayText;

                        return (
                            <div key={group.key} className="app-notification-card app-panel-soft relative overflow-hidden p-3 sm:p-4">
                                <div className="flex gap-3">
                                    {group.entityIconUrl ? (
                                        <img src={group.entityIconUrl} alt={group.entityTitle || 'Notification'} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                                    ) : (
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-modrinth-cardHover text-modrinth-green">
                                            <Package size={18} />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-modrinth-muted/80">{group.entityKind}</p>
                                                <h4 className="break-words text-sm font-extrabold leading-snug text-modrinth-text">{groupTitle}</h4>
                                            </div>
                                            {group.items.length > 1 && (
                                                <button
                                                    onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.key]: !expanded }))}
                                                    className="text-modrinth-muted hover:text-modrinth-text transition-colors p-1 rounded-lg hover:bg-modrinth-cardHover"
                                                >
                                                    <ChevronDown size={18} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                                </button>
                                            )}
                                        </div>
                                        {groupSubtitle && <p className="mt-2 line-clamp-2 break-words text-xs leading-relaxed text-modrinth-muted">{groupSubtitle}</p>}
                                    </div>
                                </div>

                                <div className="mt-3 space-y-2">
                                    {(expanded ? group.items : group.items.slice(0, 1)).map((item) => (
                                        <div
                                            key={item.id}
                                            role={item.projectRouteId ? 'button' : undefined}
                                            tabIndex={item.projectRouteId ? 0 : undefined}
                                            onClick={() => openProjectFromNotification(item.projectRouteId, [item.id])}
                                            onKeyDown={(event) => {
                                                if (!item.projectRouteId || (event.key !== 'Enter' && event.key !== ' ')) return;
                                                event.preventDefault();
                                                openProjectFromNotification(item.projectRouteId, [item.id]);
                                            }}
                                            className={`app-notification-item rounded-lg px-3 py-2.5 ${item.projectRouteId ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-modrinth-green/35' : ''}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm text-modrinth-text leading-snug break-words">
                                                        <span className="font-bold text-modrinth-green">{item.versionLabel || item.displayTitle}</span>
                                                        {item.versionLabel && item.displayText ? <span className="text-modrinth-muted"> {item.displayText}</span> : null}
                                                    </div>
                                                    <div className="mt-1 flex items-center gap-3 text-[11px] text-modrinth-muted/80">
                                                        <span>{formatNotificationRelativeTime(item.created, language)}</span>
                                                        {getModrinthLink(item.link) && (
                                                            <a href={getModrinthLink(item.link) || undefined} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="text-modrinth-green hover:underline flex items-center gap-1 truncate">
                                                                View <ExternalLink size={10}/>
                                                            </a>
                                                        )}
                                                    </div>
                                                    {item.actions && item.actions.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {item.actions.map((action, actionIndex) => (
                                                                <button
                                                                    key={`${item.id}-action-${actionIndex}`}
                                                                    type="button"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        handleNotificationAction(item, action.action_route);
                                                                    }}
                                                                    disabled={!action.action_route || pendingReadIds.has(item.id)}
                                                                    className="app-glass-button rounded-lg px-3 py-1.5 text-[11px] font-extrabold text-modrinth-green transition-colors disabled:opacity-50"
                                                                >
                                                                    {action.title || t('accept_invite')}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {group.items.length === 1 && (
                                                    <button
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleRead(item.id);
                                                        }}
                                                        disabled={pendingReadIds.has(item.id)}
                                                        className="relative text-modrinth-green self-start p-1.5 rounded-lg transition-colors hover:text-modrinth-text disabled:opacity-50 disabled:pointer-events-none"
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
                                        className="app-glass-button mt-3 rounded-lg px-3 py-2 text-xs font-bold text-modrinth-muted transition-colors hover:text-modrinth-text"
                                    >
                                        {expanded ? t('hide_versions') : `${t('show_more_versions')} (${group.items.length})`}
                                    </button>
                                )}

                                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                    <button
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            handleReadGroup(groupActionIds);
                                        }}
                                        disabled={groupActionIds.some((id) => pendingReadIds.has(id))}
                                        className="app-glass-button flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-modrinth-text transition-colors disabled:pointer-events-none disabled:opacity-50"
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
  const [organizations, setOrganizations] = useState<ModrinthOrganization[]>([]);
  const [sortMode, setSortMode] = useState<ProjectSortMode>(() => getStoredProjectSortMode());
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<ModrinthProject | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [favoriteProjectIds, setFavoriteProjectIds] = useState<string[]>(() => readFavoriteProjectIds(user.id));
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const dashboardMountedRef = useRef(true);
  const navigate = useNavigate();
  const { t, theme, language, showFavoriteProjects } = useSettings();

  useEffect(() => {
    setFavoriteProjectIds(readFavoriteProjectIds(user.id));
  }, [user.id]);

  const favoriteProjectIdSet = useMemo(() => new Set(favoriteProjectIds), [favoriteProjectIds]);
  const favoriteCount = useMemo(
    () => showFavoriteProjects ? projects.filter((project) => favoriteProjectIdSet.has(project.id)).length : 0,
    [projects, favoriteProjectIdSet, showFavoriteProjects]
  );
  const organizationNameByKey = useMemo(() => {
    const map = new Map<string, string>();
    organizations.forEach((organization) => {
      map.set(organization.id, organization.name);
      map.set(organization.slug, organization.name);
    });
    return map;
  }, [organizations]);

  const sortedProjects = useMemo(() => {
    const sorted = sortProjectsByMode(projects, sortMode);
    if (!showFavoriteProjects) return sorted;

    return sorted
      .map((project, index) => ({ project, index, favorite: favoriteProjectIdSet.has(project.id) }))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.index - b.index)
      .map(({ project }) => project);
  }, [projects, sortMode, favoriteProjectIdSet, showFavoriteProjects]);

  const loadProjects = useCallback(() => {
    let mounted = true;
    setLoading(true);
    const run = async () => {
      try {
        const userProjects = await fetchUserProjects(user.id, token);
        const userOrganizations = await fetchUserOrganizations(user.id, token);
        const organizationKeys = Array.from(new Set([
          ...userOrganizations.map((organization) => organization.id),
          ...userProjects.map((project) => project.organization_id || project.organization).filter(Boolean),
        ])) as string[];
        const organizationProjectGroups = await Promise.all(
          organizationKeys.map(async (organizationKey) => {
            try {
              return await fetchOrganizationProjects(organizationKey, token);
            } catch {
              return [] as ModrinthProject[];
            }
          })
        );
        const byId = new Map<string, ModrinthProject>();
        [...userProjects, ...organizationProjectGroups.flat()].forEach((project) => byId.set(project.id, project));
        if (mounted) {
          setOrganizations(userOrganizations);
          setProjects(Array.from(byId.values()));
        }
      } catch (error) {
        console.error(error);
        if (mounted) {
          setOrganizations([]);
          setProjects([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [user.id, token]);

  useEffect(() => {
    dashboardMountedRef.current = true;
    return () => {
      dashboardMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const cleanup = loadProjects();
    return cleanup;
  }, [loadProjects]);

  const refreshUnread = useCallback(() => {
    fetchNotifications(user.id, token, 'unread')
      .then(data => {
        if (dashboardMountedRef.current) setUnreadCount(data.filter(n => !n.read).length);
      })
      .catch(() => {});
  }, [user.id, token]);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread]);

  const handleChangeSortMode = (mode: ProjectSortMode) => {
    setSortMode(mode);
    setShowSortMenu(false);
    saveProjectSortMode(mode);
  };

  useBackDismiss(showSortMenu, () => setShowSortMenu(false));

  const handleToggleFavoriteProject = useCallback((projectId: string) => {
    setFavoriteProjectIds((prev) => {
      const next = prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [projectId, ...prev];
      saveFavoriteProjectIds(user.id, next);
      return next;
    });
  }, [user.id]);

  const handleConfirmDeleteProject = async () => {
    if (!deleteCandidate) return;

    setDeletingProjectId(deleteCandidate.id);
    try {
      await deleteProject(deleteCandidate.id, token);
      setProjects((prev) => prev.filter((project) => project.id !== deleteCandidate.id));
      setFavoriteProjectIds((prev) => {
        const next = prev.filter((id) => id !== deleteCandidate.id);
        saveFavoriteProjectIds(user.id, next);
        return next;
      });
      showToast(t('project_deleted'));
      setDeleteCandidate(null);
    } catch (error: any) {
      showToast(error?.message || 'Failed to delete project', 'error');
    } finally {
      setDeletingProjectId(null);
    }
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
      <header className="app-topbar flex justify-between items-center mb-5 sticky top-0 z-50 pt-[calc(env(safe-area-inset-top)+0.85rem)] pb-3 -mx-4 px-4 min-h-[82px] overflow-hidden relative transition-colors duration-300">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-modrinth-text leading-none">{t('dashboard')}</h1>
          <p className="text-modrinth-muted text-xs font-medium">{t('dev_panel')}</p>
        </div>
        <div className="flex items-center gap-2">
           <a
             href={DISCORD_INVITE_URL}
             target="_blank"
             rel="noopener noreferrer"
             className="p-2 text-modrinth-muted hover:text-modrinth-green transition-colors"
             aria-label="Open Discord server"
           >
             <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current opacity-90" aria-hidden="true">
               <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.078.037 13.709 13.709 0 0 0-.608 1.249 18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.249.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.13 14.13 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.04.107 15.228 15.228 0 0 0 1.225 1.993.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.211 0 2.176 1.094 2.157 2.418 0 1.334-.955 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.211 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419Z"/>
             </svg>
           </a>
           <button
             type="button"
             onClick={() => setShowCreateProject(true)}
             className="p-2 text-modrinth-muted hover:text-modrinth-green transition-colors"
             aria-label={t('create_project_action')}
           >
             <Plus size={20} />
           </button>
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
          <div className="mb-3 flex items-center justify-between px-1" ref={sortMenuRef}>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-modrinth-muted/75">
              <span>{formatProjectsCountLabel(sortedProjects.length, language, t)}</span>
              {showFavoriteProjects && favoriteCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/10 px-2 py-1 text-yellow-400 tracking-normal">
                  <Star size={11} className="fill-current" />
                  {favoriteCount}
                </span>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.blur();
                  setShowSortMenu((prev) => !prev);
                }}
                data-active={showSortMenu ? 'true' : undefined}
                 className={`app-sort-trigger inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors ${
                  theme === 'light'
                    ? 'bg-white/80 border-black/10 text-black/70 hover:bg-white'
                    : ''
                }`}
              >
                <Layers size={13} className="text-modrinth-green" />
                <span className="app-sort-trigger-label">{getSortModeLabel(sortMode)}</span>
                <ChevronDown size={14} className={`transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
              </button>
              {showSortMenu && (
                <div
                   className={`app-glass-menu app-sort-menu absolute right-0 top-[calc(100%+0.35rem)] z-40 min-w-[220px] rounded-lg border p-2 shadow-[0_14px_30px_rgba(0,0,0,0.24)] ${
                    theme === 'light'
                      ? 'bg-white/95 border-black/10'
                      : 'bg-modrinth-card border-modrinth-border'
                } app-floating-menu`}
                >
                  <div className="app-sort-menu-title px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-modrinth-muted">
                    {t('sort_by')}
                  </div>
                  <div className="app-glass-list app-sort-list mt-1">
                    {PROJECT_SORT_OPTIONS.map((mode) => {
                      const active = sortMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => handleChangeSortMode(mode)}
                           data-active={active ? 'true' : undefined}
                           className={`app-glass-menu-item app-sort-option w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm leading-5 transition-colors ${
                             active
                              ? 'text-modrinth-green'
                              : theme === 'light'
                                ? 'text-black/70 hover:bg-black/[0.05]'
                                : 'text-modrinth-text hover:bg-modrinth-cardHover'
                          }`}
                        >
                          <span className="app-sort-option-label font-medium">{getSortModeLabel(mode)}</span>
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
                <ProjectCard
                  project={p}
                  onClick={(id) => navigate(`/project/${id}`)}
                  isFavorite={favoriteProjectIdSet.has(p.id)}
                  onToggleFavorite={showFavoriteProjects ? handleToggleFavoriteProject : undefined}
                  showFavoriteAction={showFavoriteProjects}
                  organizationName={organizationNameByKey.get(p.organization_id || p.organization || '') || null}
                  onDeleteProject={setDeleteCandidate}
                  deleteProjectLabel={t('delete_project')}
                />
             </div>
          ))}
          {sortedProjects.length === 0 && (
            <div className="text-center text-modrinth-muted py-40">
              <div className="app-panel inline-block p-6 mb-4"><FileText size={48} className="opacity-50"/></div>
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
      <CreateProjectSheet
        isOpen={showCreateProject}
        organizations={organizations}
        onClose={() => setShowCreateProject(false)}
        onSave={async (data) => {
          await createProject(data, token);
          setShowCreateProject(false);
          loadProjects();
        }}
      />
      <DeleteProjectConfirmSheet
        project={deleteCandidate}
        saving={!!deletingProjectId}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={handleConfirmDeleteProject}
      />
    </div>
  );
};

const DeleteProjectConfirmSheet: React.FC<{
  project: ModrinthProject | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}> = ({ project, saving, onClose, onConfirm }) => {
  const { t } = useSettings();
  const { visible, closing, requestClose } = useAnimatedDismiss(!!project, onClose);
  const [lastProject, setLastProject] = useState<ModrinthProject | null>(project);
  const displayProject = project || lastProject;
  const title = displayProject?.title || displayProject?.name || displayProject?.slug || displayProject?.id || '';

  useEffect(() => {
    if (project) setLastProject(project);
  }, [project]);

  if (!visible || !displayProject) return null;

  return (
    <div
      data-closing={closing ? 'true' : undefined}
      className="app-overlay fixed inset-0 z-[260] flex items-end justify-center bg-black/60 p-4 backdrop-blur-md sm:items-center sm:p-6"
      onClick={saving ? undefined : requestClose}
    >
      <div className="app-responsive-sheet w-full max-w-sm overflow-hidden bg-modrinth-card text-modrinth-text shadow-[0_18px_44px_rgba(0,0,0,0.5)]" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-modrinth-border p-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
            <Trash2 size={20} />
          </div>
          <h3 className="text-lg font-black">{t('delete_project')}</h3>
          <p className="mt-2 text-sm leading-6 text-modrinth-muted">
            {t('delete_project_confirm')}
          </p>
          <div className="mt-3 rounded-lg bg-modrinth-bg px-3 py-2 text-sm font-extrabold text-modrinth-text">
            {title}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 p-4">
          <button type="button" onClick={requestClose} disabled={saving} className="app-command px-3 py-3 text-sm font-extrabold disabled:opacity-60">
            {t('cancel')}
          </button>
          <button type="button" onClick={onConfirm} disabled={saving} className="flex items-center justify-center gap-2 rounded-lg bg-red-500 px-3 py-3 text-sm font-extrabold text-white transition-transform active:scale-95 disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {t('remove')}
          </button>
        </div>
      </div>
    </div>
  );
};

const ProfileEditModal: React.FC<{ isOpen: boolean; onClose: () => void; user: ModrinthUser; token: string; onUpdate: () => void }> = ({ isOpen, onClose, user, token, onUpdate }) => {
  const [data, setData] = useState({ username: user.username, bio: user.bio || '' });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(user.avatar_url);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const { t } = useSettings();
  const { visible, closing, requestClose } = useAnimatedDismiss(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    setData({ username: user.username, bio: user.bio || '' });
    setAvatarFile(null);
    setAvatarPreview(user.avatar_url);
    setRemoveAvatar(false);
    setAvatarError('');
  }, [isOpen, user.avatar_url, user.bio, user.username]);

  useEffect(() => {
    if (!avatarFile) return;
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  if (!visible) return null;

  const handleAvatarFile = (file?: File) => {
    if (!file) return;
    setAvatarError('');

    if (!file.type.startsWith('image/')) {
      setAvatarError(t('avatar_image_error'));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarError(t('avatar_size_error'));
      return;
    }

    setAvatarFile(file);
    setRemoveAvatar(false);
  };

  const handleResetAvatar = () => {
    setAvatarFile(null);
    setRemoveAvatar(false);
    setAvatarPreview(user.avatar_url);
    setAvatarError('');
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setRemoveAvatar(true);
    setAvatarPreview('');
    setAvatarError('');
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await modifyUser(user.id, data, token);
      if (removeAvatar) {
        await deleteUserAvatar(user.id, token);
      } else if (avatarFile) {
        await changeUserAvatar(user.id, avatarFile, token);
      }
      onUpdate();
      requestClose();
    } catch (e: any) {
      alert(e?.message || 'Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-closing={closing ? 'true' : undefined} className="app-overlay fixed inset-0 z-[220] flex items-end justify-center p-4 sm:items-center" onClick={saving ? undefined : requestClose}>
      <div className="app-responsive-sheet relative flex w-full max-w-md flex-col overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-modrinth-border px-5 py-4">
          <h3 className="text-lg font-bold text-modrinth-text">{t('edit_profile')}</h3>
          <button onClick={requestClose} disabled={saving} className="app-close-button h-9 w-9 disabled:opacity-60">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <div className="app-panel-soft p-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-modrinth-border bg-modrinth-bg"
                >
                  {avatarPreview && !removeAvatar ? (
                    <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-modrinth-muted">
                      <ImageIcon size={26} />
                    </div>
                  )}
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/70 px-1.5 py-1 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <Upload size={11} />
                    {t('change')}
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-modrinth-text">{t('avatar')}</p>
                  <p className="mt-1 text-xs leading-relaxed text-modrinth-muted">{t('avatar_file_hint')}</p>
                  {avatarFile && <p className="mt-1 truncate text-xs font-semibold text-modrinth-text">{avatarFile.name}</p>}
                  {removeAvatar && <p className="mt-1 text-xs font-semibold text-red-400">{t('remove_avatar_pending')}</p>}
                </div>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={event => handleAvatarFile(event.target.files?.[0])}
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-lg border border-modrinth-border bg-modrinth-bg px-3 py-2 text-xs font-extrabold text-modrinth-text transition-colors hover:border-modrinth-green"
                >
                  <Upload size={14} />
                  {t('upload')}
                </button>
                <button
                  type="button"
                  onClick={avatarFile || removeAvatar ? handleResetAvatar : handleRemoveAvatar}
                  className="flex items-center justify-center gap-2 rounded-lg border border-modrinth-border bg-modrinth-bg px-3 py-2 text-xs font-extrabold text-modrinth-muted transition-colors hover:border-red-500/50 hover:text-red-400"
                >
                  {avatarFile || removeAvatar ? <RefreshCw size={14} /> : <Trash2 size={14} />}
                  {avatarFile || removeAvatar ? t('reset') : t('remove')}
                </button>
              </div>
              {avatarError && <p className="mt-2 text-xs font-semibold text-red-400">{avatarError}</p>}
            </div>
            <div>
              <label className="app-form-label">{t('username')}</label>
              <input className="app-input" value={data.username} onChange={e=>setData({...data, username:e.target.value})} />
            </div>
            <div>
              <label className="app-form-label">{t('bio')}</label>
              <textarea className="app-input app-textarea min-h-[7rem]" value={data.bio} onChange={e=>setData({...data, bio:e.target.value})} />
            </div>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-modrinth-border px-5 py-4">
          <button type="button" onClick={requestClose} disabled={saving} className="app-command px-3 py-3 text-sm font-extrabold disabled:opacity-60">
            {t('cancel')}
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="app-primary flex items-center justify-center gap-2 px-3 py-3 text-sm disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};

type AnalyticsProjectInsight = {
  project: ModrinthProject;
  downloads: number;
  views: number;
  playtime: number;
  revenue: number;
};

type RankedAnalyticsProjectInsight = AnalyticsProjectInsight & {
  value: number;
};

type AnalyticsMover = {
  id: string;
  title: string;
  icon_url?: string;
  downloads: number;
  followers: number;
};

type AnalyticsSeriesMetric = Extract<ModrinthAnalyticsMetric, 'downloads' | 'views' | 'playtime' | 'revenue'>;

const ANALYTICS_SERIES_METRICS: AnalyticsSeriesMetric[] = ['downloads', 'views', 'playtime', 'revenue'];

const getAnalyticsPointTime = (point: ModrinthAnalyticsPoint) => point.start_time || point.startTime || '';

const getAnalyticsMetricValue = (point: ModrinthAnalyticsPoint, metric: AnalyticsSeriesMetric) => {
  const value = point[metric];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

const sumAnalyticsMetric = (points: ModrinthAnalyticsPoint[], metric: AnalyticsSeriesMetric) =>
  points.reduce((sum, point) => sum + getAnalyticsMetricValue(point, metric), 0);

const sumProjectAnalyticsMetric = (points: ModrinthAnalyticsPoint[], projectId: string, metric: AnalyticsSeriesMetric) =>
  points.reduce((sum, point) => {
    const value = point.projects?.[projectId]?.[metric];
    return sum + (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  }, 0);

const hasAnalyticsMetric = (points: ModrinthAnalyticsPoint[], metric: AnalyticsSeriesMetric) =>
  points.some((point) => getAnalyticsMetricValue(point, metric) > 0 || point[metric] !== undefined);

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat(undefined, { notation: Math.abs(value) >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);

const formatPlaytime = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0m';
  if (value < 3600) return `${Math.round(value / 60).toLocaleString()}m`;
  const hours = value / 3600;
  if (hours >= 1000) return `${formatCompactNumber(hours)}h`;
  if (hours >= 10) return `${Math.round(hours).toLocaleString()}h`;
  return `${hours.toFixed(1)}h`;
};

const formatAnalyticsMetricValue = (metric: AnalyticsSeriesMetric, value: number) => {
  if (metric === 'revenue') return `$${value.toFixed(2)}`;
  if (metric === 'playtime') return formatPlaytime(value);
  return Math.round(value).toLocaleString();
};

const formatAnalyticsChartValue = (metric: AnalyticsSeriesMetric, value: number) => {
  if (metric === 'revenue') return value >= 1000 ? `$${formatCompactNumber(value)}` : `$${value >= 10 ? value.toFixed(0) : value.toFixed(2)}`;
  if (metric === 'playtime') return formatPlaytime(value);
  return formatCompactNumber(Math.round(value));
};

const formatSignedPercent = (value: number) => `${value > 0 ? '+' : ''}${Math.round(value).toLocaleString()}%`;

const APP_DATE_LOCALES: Record<Language, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  de: 'de-DE',
  it: 'it-IT',
  fr: 'fr-FR',
  pl: 'pl-PL'
};

const formatAnalyticsDate = (value: string, language: Language) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString(APP_DATE_LOCALES[language] || APP_DATE_LOCALES.en, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatAnalyticsChartDate = (value: string, language: Language) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value.slice(5, 10) || value.slice(0, 10);
  return date.toLocaleDateString(APP_DATE_LOCALES[language] || APP_DATE_LOCALES.en, { month: 'short', day: 'numeric' });
};

const AnalyticsSparkline: React.FC<{ points: ModrinthAnalyticsPoint[]; metric: AnalyticsSeriesMetric; language: Language; height?: number }> = ({ points, metric, language, height = 132 }) => {
  const values = points.map((point) => getAnalyticsMetricValue(point, metric));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, points.length - 1));
  const width = 320;
  const paddingLeft = 34;
  const paddingRight = 12;
  const paddingTop = 20;
  const paddingBottom = 26;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const lastIndex = Math.max(0, values.length - 1);
  const safeActiveIndex = Math.min(Math.max(activeIndex, 0), lastIndex);
  const activeValue = values[safeActiveIndex] ?? 0;
  const activePointTime = points[safeActiveIndex] ? getAnalyticsPointTime(points[safeActiveIndex]) : '';
  const getX = (index: number) => paddingLeft + (values.length === 1 ? plotWidth : (index / Math.max(1, values.length - 1)) * plotWidth);
  const getY = (value: number) => paddingTop + plotHeight - ((value - min) / range) * plotHeight;
  const activeX = getX(safeActiveIndex);
  const activeY = getY(activeValue);
  const linePoints = values.length > 0
    ? values.map((value, index) => {
        const x = getX(index);
        const y = getY(value);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(' ')
    : `${paddingLeft},${height - paddingBottom} ${width - paddingRight},${height - paddingBottom}`;
  const areaPoints = `${paddingLeft},${height - paddingBottom} ${linePoints} ${width - paddingRight},${height - paddingBottom}`;
  const maxIndex = values.indexOf(max);
  const minIndex = values.indexOf(min);
  const markerEvery = values.length <= 14 ? 1 : Math.ceil(values.length / 10);
  const markerIndexes = new Set<number>();
  values.forEach((_, index) => {
    if (index === 0 || index === lastIndex || index === maxIndex || index === minIndex || index === safeActiveIndex || index % markerEvery === 0) markerIndexes.add(index);
  });
  const axisValues = [max, min + range / 2, min];

  useEffect(() => {
    setActiveIndex(Math.max(0, points.length - 1));
  }, [metric, points.length]);

  return (
    <div>
      {values.length > 0 && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 px-0.5">
          <span className="min-w-0 truncate text-[10px] font-extrabold text-modrinth-muted">
            {formatAnalyticsDate(activePointTime, language)}
          </span>
          <span className="shrink-0 text-xs font-black text-modrinth-text tabular-nums">
            {formatAnalyticsMetricValue(metric, activeValue)}
          </span>
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full overflow-visible" role="img" aria-label={`${metric} trend`}>
        <defs>
          <linearGradient id={`analytics-gradient-${metric}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--accent-color, #38C172)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent-color, #38C172)" stopOpacity="1" />
          </linearGradient>
          <linearGradient id={`analytics-area-${metric}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-color, #38C172)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--accent-color, #38C172)" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {axisValues.map((value, index) => {
          const y = getY(value);
          return (
            <React.Fragment key={`${value}-${index}`}>
              <line x1={paddingLeft} x2={width - paddingRight} y1={y} y2={y} className="stroke-modrinth-border/70" strokeWidth="1" strokeDasharray={index === 2 ? '0' : '4 8'} />
              <text x={paddingLeft - 7} y={y + 3} textAnchor="end" className="fill-modrinth-muted" fontSize="8" fontWeight="700">
                {formatAnalyticsChartValue(metric, value)}
              </text>
            </React.Fragment>
          );
        })}
        <polygon points={areaPoints} fill={`url(#analytics-area-${metric})`} />
        <polyline points={linePoints} fill="none" stroke={`url(#analytics-gradient-${metric})`} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {values.length > 0 && (
          <line x1={activeX} x2={activeX} y1={paddingTop} y2={height - paddingBottom} className="stroke-modrinth-green/55" strokeWidth="1.5" strokeDasharray="4 6" />
        )}
        {values.map((value, index) => {
          if (!markerIndexes.has(index)) return null;
          const x = getX(index);
          const y = getY(value);
          const pointTime = getAnalyticsPointTime(points[index]);
          const title = `${formatAnalyticsDate(pointTime, language)}: ${formatAnalyticsMetricValue(metric, value)}`;
          const isActive = index === safeActiveIndex;
          return (
            <g key={index}>
              <title>{title}</title>
              {isActive && (
                <circle cx={x} cy={y} r="7" className="fill-modrinth-green/18 stroke-modrinth-green/45" strokeWidth="1.5" />
              )}
              <circle cx={x} cy={y} r={isActive ? 4 : 2.5} className={isActive ? 'fill-modrinth-text stroke-modrinth-green' : 'fill-modrinth-green stroke-modrinth-card'} strokeWidth={isActive ? 2 : 1.5} />
            </g>
          );
        })}
        {values.map((_, index) => {
          const hitWidth = values.length <= 1 ? plotWidth : plotWidth / Math.max(1, values.length - 1);
          const x = getX(index);
          const hitX = Math.max(paddingLeft, Math.min(width - paddingRight - hitWidth, x - hitWidth / 2));
          return (
            <rect
              key={`hit-${index}`}
              x={hitX}
              y={paddingTop}
              width={hitWidth}
              height={plotHeight}
              fill="transparent"
              onClick={() => setActiveIndex(index)}
              onPointerEnter={() => setActiveIndex(index)}
              onPointerMove={() => setActiveIndex(index)}
              pointerEvents="all"
              style={{ cursor: 'pointer' }}
            />
          );
        })}
        {[0, values.length - 1].map((index) => (
          values[index] !== undefined && (
            <text key={index} x={getX(index)} y={height - 7} textAnchor={index === 0 ? 'start' : 'end'} className="fill-modrinth-muted" fontSize="8" fontWeight="700">
              {formatAnalyticsChartDate(getAnalyticsPointTime(points[index]), language)}
            </text>
          )
        ))}
      </svg>
    </div>
  );
};

const AnalyticsPage: React.FC<{ user: ModrinthUser; token: string }> = ({ user, token }) => {
  const [projects, setProjects] = useState<ModrinthProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<'downloads' | 'followers'>('downloads');
  const [seriesMetric, setSeriesMetric] = useState<AnalyticsSeriesMetric>('downloads');
  const [projectInsightMetric, setProjectInsightMetric] = useState<AnalyticsSeriesMetric>('downloads');
  const [analyticsRangeDays, setAnalyticsRangeDays] = useState<7 | 30 | 90>(7);
  const [analyticsV3Points, setAnalyticsV3Points] = useState<ModrinthAnalyticsPoint[]>([]);
  const [analyticsV3RevenuePoints, setAnalyticsV3RevenuePoints] = useState<ModrinthAnalyticsPoint[]>([]);
  const [analyticsV3Status, setAnalyticsV3Status] = useState<number | null>(null);
  const [analyticsV3RevenueStatus, setAnalyticsV3RevenueStatus] = useState<number | null>(null);
  const [analyticsV3Loading, setAnalyticsV3Loading] = useState(false);
  const [projectInsights, setProjectInsights] = useState<AnalyticsProjectInsight[]>([]);
  const [weeklyClock, setWeeklyClock] = useState(() => Date.now());
  const [profileUser, setProfileUser] = useState<ModrinthUser>(user);
  const [profileStatus, setProfileStatus] = useState<number | null>(null);
  const [payoutHistory, setPayoutHistory] = useState<ModrinthPayoutHistory | null>(null);
  const [payoutStatus, setPayoutStatus] = useState<number | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [payoutBalanceV3, setPayoutBalanceV3] = useState<any | null>(null);
  const [payoutBalanceV3Status, setPayoutBalanceV3Status] = useState<number | null>(null);
  const { t, theme, language } = useSettings();

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

  const analyticsTimeRange = useMemo(() => {
    const end = new Date(weeklyClock);
    const start = new Date(weeklyClock - analyticsRangeDays * 24 * 60 * 60 * 1000);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      resolution: { slices: analyticsRangeDays }
    };
  }, [analyticsRangeDays, weeklyClock]);

  useEffect(() => {
    if (loading || projects.length === 0) {
      setAnalyticsV3Points([]);
      setAnalyticsV3RevenuePoints([]);
      setProjectInsights([]);
      return;
    }

    let mounted = true;
    const projectIds = projects.map((project) => project.id);

    setAnalyticsV3Loading(true);
    (async () => {
      const [core, revenue] = await Promise.all([
        fetchAnalyticsV3WithStatus(token, {
          time_range: analyticsTimeRange,
          return_metrics: {
            project_downloads: { bucket_by: ['project_id'] },
            project_views: { bucket_by: ['project_id'] },
            project_playtime: { bucket_by: ['project_id'] }
          },
          project_ids: projectIds
        }),
        fetchAnalyticsV3WithStatus(token, {
          time_range: analyticsTimeRange,
          return_metrics: {
            project_revenue: { bucket_by: ['project_id'] }
          },
          project_ids: projectIds
        })
      ]);

      const perProject = projects.map((project) => ({
        project,
        downloads: sumProjectAnalyticsMetric(core.data, project.id, 'downloads'),
        views: sumProjectAnalyticsMetric(core.data, project.id, 'views'),
        playtime: sumProjectAnalyticsMetric(core.data, project.id, 'playtime'),
        revenue: sumProjectAnalyticsMetric(revenue.data, project.id, 'revenue')
      }));

      if (!mounted) return;
      setAnalyticsV3Points(core.data);
      setAnalyticsV3RevenuePoints(revenue.data);
      setAnalyticsV3Status(core.status);
      setAnalyticsV3RevenueStatus(revenue.status);
      setProjectInsights(perProject);
    })().finally(() => {
      if (!mounted) return;
      setAnalyticsV3Loading(false);
    });

    return () => {
      mounted = false;
    };
  }, [analyticsTimeRange, loading, projects, token]);

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

  const weeklyRevenueLifetime =
    hasPayoutBalanceV3 || payoutLifetimeFromV3 !== null || payoutTotalFromV3 !== null
      ? stats.lifetimeEarnings
      : null;

  const weeklySnapshotStorageKey = useMemo(() => `rinthy_analytics_snapshots_${user.id}`, [user.id]);

  const weeklySummary = useMemo(
    () => calculateWeeklySummary(projects, readAnalyticsSnapshots(weeklySnapshotStorageKey), weeklyRevenueLifetime, weeklyClock, analyticsRangeDays),
    [projects, weeklySnapshotStorageKey, weeklyClock, weeklyRevenueLifetime, analyticsRangeDays]
  );

  const analyticsV3Available = analyticsV3Status === 200;
  const analyticsV3RevenueAvailable = analyticsV3RevenueStatus === 200;
  const trendPoints = seriesMetric === 'revenue' ? analyticsV3RevenuePoints : analyticsV3Points;
  const trendSummary = useMemo(() => {
    const values = trendPoints.map((point) => getAnalyticsMetricValue(point, seriesMetric));
    const total = values.reduce((sum, value) => sum + value, 0);
    const peak = Math.max(...values, 0);
    const average = values.length > 0 ? total / values.length : 0;
    const middle = Math.max(1, Math.floor(values.length / 2));
    const previousTotal = values.slice(0, middle).reduce((sum, value) => sum + value, 0);
    const recentTotal = values.slice(middle).reduce((sum, value) => sum + value, 0);
    const changePercent = previousTotal > 0 ? ((recentTotal - previousTotal) / previousTotal) * 100 : null;
    return { average, peak, changePercent };
  }, [seriesMetric, trendPoints]);
  const rangeDownloads = analyticsV3Available ? sumAnalyticsMetric(analyticsV3Points, 'downloads') : weeklySummary.downloads;
  const rangeViews = analyticsV3Available ? sumAnalyticsMetric(analyticsV3Points, 'views') : 0;
  const rangePlaytime = analyticsV3Available ? sumAnalyticsMetric(analyticsV3Points, 'playtime') : 0;
  const rangeRevenue = analyticsV3RevenueAvailable ? sumAnalyticsMetric(analyticsV3RevenuePoints, 'revenue') : weeklySummary.revenue;
  const hasServerProjectInsights = analyticsV3Available && projectInsights.some((item) => item.downloads > 0 || item.views > 0 || item.playtime > 0 || item.revenue > 0);
  const rankedProjectInsights = useMemo<RankedAnalyticsProjectInsight[]>(
    () => projectInsights
      .map((item) => ({
        ...item,
        value: item[projectInsightMetric]
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value),
    [projectInsightMetric, projectInsights]
  );
  const topDownloadProjectInsight = useMemo(
    () => analyticsV3Available
      ? [...projectInsights].sort((a, b) => b.downloads - a.downloads).find((project) => project.downloads > 0) || null
      : null,
    [analyticsV3Available, projectInsights]
  );
  const activeProjectsInRange = hasServerProjectInsights
    ? projectInsights.filter((project) => project.downloads > 0 || project.views > 0 || project.playtime > 0 || project.revenue > 0).length
    : weeklySummary.activeProjects;
  const analyticsSourceLabel = analyticsV3Available ? t('analytics_source_modrinth') : t('analytics_source_local');
  const analyticsRangeLabel = `${formatAnalyticsDate(analyticsTimeRange.start, language)} - ${formatAnalyticsDate(analyticsTimeRange.end, language)}`;

  const topMovers = useMemo<AnalyticsMover[]>(() => {
    const serverMovers = analyticsV3Available
      ? projectInsights
          .filter((item) => item.downloads > 0)
          .sort((a, b) => b.downloads - a.downloads)
          .slice(0, 5)
          .map((item) => ({
            id: item.project.id,
            title: item.project.title,
            icon_url: item.project.icon_url,
            downloads: item.downloads,
            followers: weeklySummary.projectDeltas.find((project) => project.id === item.project.id)?.followers ?? 0
          }))
      : [];

    if (serverMovers.length > 0) return serverMovers;

    return weeklySummary.projectDeltas
      .filter((project) => project.downloads > 0 || project.followers > 0)
      .slice(0, 5);
  }, [analyticsV3Available, projectInsights, weeklySummary.projectDeltas]);

  const projectHealth = useMemo(() => {
    const now = weeklyClock;
    const daysSince = (date: string | undefined) => {
      const timestamp = date ? new Date(date).getTime() : 0;
      if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
      return Math.max(0, Math.floor((now - timestamp) / (24 * 60 * 60 * 1000)));
    };

    const staleProjects = projects
      .map((project) => ({ project, days: daysSince(project.updated) }))
      .filter((item): item is { project: ModrinthProject; days: number } => item.days !== null && item.days >= 60)
      .sort((a, b) => b.days - a.days)
      .slice(0, 3);

    const hiddenProjects = projects.filter((project) => ['draft', 'unlisted', 'archived', 'processing', 'rejected'].includes(project.status));
    const missingIcons = projects.filter((project) => !project.icon_url);
    const missingLinks = projects.filter((project) => !project.source_url && !project.issues_url && !project.wiki_url && !project.discord_url);
    const weakDescriptions = projects.filter((project) => !project.body?.trim() || project.body.trim().length < 160);

    const issues = [
      {
        key: 'stale',
        icon: <Clock size={17} />,
        label: t('health_stale_projects'),
        value: staleProjects.length,
        detail: staleProjects.length > 0 ? staleProjects.map(({ project, days }) => `${project.title} (${days}d)`).join(', ') : t('health_ok')
      },
      {
        key: 'hidden',
        icon: <EyeOff size={17} />,
        label: t('health_hidden_projects'),
        value: hiddenProjects.length,
        detail: hiddenProjects.length > 0 ? hiddenProjects.slice(0, 3).map((project) => `${project.title} · ${project.status}`).join(', ') : t('health_ok')
      },
      {
        key: 'icons',
        icon: <ImageIcon size={17} />,
        label: t('health_missing_icons'),
        value: missingIcons.length,
        detail: missingIcons.length > 0 ? missingIcons.slice(0, 3).map((project) => project.title).join(', ') : t('health_ok')
      },
      {
        key: 'links',
        icon: <ExternalLink size={17} />,
        label: t('health_missing_links'),
        value: missingLinks.length,
        detail: missingLinks.length > 0 ? missingLinks.slice(0, 3).map((project) => project.title).join(', ') : t('health_ok')
      },
      {
        key: 'descriptions',
        icon: <FileText size={17} />,
        label: t('health_weak_descriptions'),
        value: weakDescriptions.length,
        detail: weakDescriptions.length > 0 ? weakDescriptions.slice(0, 3).map((project) => project.title).join(', ') : t('health_ok')
      }
    ];

    const score = projects.length === 0
      ? 100
      : Math.max(0, Math.round(100 - (
          staleProjects.length * 12 +
          hiddenProjects.length * 8 +
          missingIcons.length * 6 +
          missingLinks.length * 4 +
          weakDescriptions.length * 4
        ) / Math.max(1, projects.length)));

    return { score, issues };
  }, [projects, t, weeklyClock]);

  useEffect(() => {
    if (loading || projects.length === 0) return;

    try {
      saveAnalyticsSnapshot(weeklySnapshotStorageKey, createAnalyticsSnapshot(projects, weeklyClock, weeklyRevenueLifetime));
    } catch {
      // Local analytics can work without persistence; it will rebuild from the next visible snapshot.
    }
  }, [loading, projects, weeklyClock, weeklyRevenueLifetime, weeklySnapshotStorageKey]);

  useEffect(() => {
    const refreshVisibleAnalytics = () => {
      if (document.visibilityState === 'hidden') return;
      setWeeklyClock(Date.now());
      loadAnalytics();
    };

    const interval = window.setInterval(() => setWeeklyClock(Date.now()), 15 * 60 * 1000);
    window.addEventListener('focus', refreshVisibleAnalytics);
    document.addEventListener('visibilitychange', refreshVisibleAnalytics);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshVisibleAnalytics);
      document.removeEventListener('visibilitychange', refreshVisibleAnalytics);
    };
  }, [loadAnalytics]);

  if (loading) return <div className="flex justify-center pt-40 animate-fade-in"><Loader2 className="animate-spin text-modrinth-green" /></div>;

  return (
    <div className="px-4 pb-32 animate-fade-in">
      <header className="app-topbar flex items-center justify-between mb-5 sticky top-0 z-50 pt-[calc(env(safe-area-inset-top)+0.85rem)] pb-3 -mx-4 px-4 min-h-[82px] overflow-hidden relative transition-colors duration-300">
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
        <div className="app-panel p-4 mb-6">
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
            <a href="https://modrinth.com/settings/payouts" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-modrinth-text bg-modrinth-card border border-modrinth-border px-3 py-1.5 rounded-lg inline-flex items-center gap-1">
              {t('open_payout_settings')} <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}

      <div className="app-panel p-6 mb-6 relative overflow-hidden animate-fade-in-up">
        <div className="absolute left-0 top-0 h-full w-1 bg-modrinth-green" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1 text-modrinth-green"><DollarSign size={16} /><span className="app-subtle-label text-modrinth-green">{t('total_revenue')}</span></div>
          <div className="text-4xl font-extrabold mb-4 text-modrinth-text">${Number((payoutLifetimeFromV3 ?? stats.lifetimeEarnings) || 0).toFixed(2)}</div>
          <div className="flex gap-3 flex-wrap">
            <div className="app-panel-soft px-3 py-1.5">
              <span className="app-subtle-label block">{t('balance')}</span>
              <span className="text-sm font-mono text-modrinth-text">${Number((payoutBalanceTotalFromV3 ?? stats.walletBalance) || 0).toFixed(2)}</span>
            </div>
            {payoutBalanceFromV3 !== null && (
              <div className="app-panel-soft px-3 py-1.5">
                <span className="app-subtle-label block">{t('available')}</span>
                <span className="text-sm font-mono text-modrinth-text">${Number(payoutBalanceFromV3 || 0).toFixed(2)}</span>
              </div>
            )}
            {payoutPendingFromV3 !== null && (
              <div className="app-panel-soft px-3 py-1.5">
                <span className="app-subtle-label block">{t('pending')}</span>
                <span className="text-sm font-mono text-modrinth-text">${Number(payoutPendingFromV3 || 0).toFixed(2)}</span>
              </div>
            )}
            {payoutWithdrawnLifetimeFromV3 !== null && (
              <div className="app-panel-soft px-3 py-1.5">
                <span className="app-subtle-label block">{t('withdrawn')}</span>
                <span className="text-sm font-mono text-modrinth-text">${Number(payoutWithdrawnLifetimeFromV3 || 0).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <a
          href="https://modrinth.com/dashboard/revenue"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-modrinth-text bg-modrinth-card border border-modrinth-border px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
        >
          {t('open_revenue_page')} <ExternalLink size={14} />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="app-panel p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="text-modrinth-green"><FileText /></div>
            <div className="text-[10px] uppercase text-modrinth-muted font-bold">{t('projects_label')}</div>
          </div>
          <div className="text-2xl font-bold text-modrinth-text">{projects.length.toLocaleString()}</div>
          <div className="text-xs text-modrinth-muted">{t('total_label')}</div>
        </div>
        <div className="app-panel p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="text-modrinth-green"><Download /></div>
            <div className="text-[10px] uppercase text-modrinth-muted font-bold">{t('downloads_label')}</div>
          </div>
          <div className="text-2xl font-bold text-modrinth-text">{stats.totalDownloads.toLocaleString()}</div>
          <div className="text-xs text-modrinth-muted">{t('total_downloads')}</div>
        </div>
        <div className="app-panel p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="text-red-400"><Heart /></div>
            <div className="text-[10px] uppercase text-modrinth-muted font-bold">{t('follows_label')}</div>
          </div>
          <div className="text-2xl font-bold text-modrinth-text">{stats.totalLikes.toLocaleString()}</div>
          <div className="text-xs text-modrinth-muted">{t('total_likes')}</div>
        </div>
        <div className="app-panel p-5 relative overflow-hidden">
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
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-modrinth-muted uppercase">{t('range_summary')}</h3>
            <div className="mt-1 truncate text-[11px] font-semibold text-modrinth-muted">{analyticsRangeLabel}</div>
          </div>
          <div className="app-range-tabs grid grid-cols-3">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setAnalyticsRangeDays(days as 7 | 30 | 90)}
                data-active={analyticsRangeDays === days ? 'true' : undefined}
                className="app-range-tab"
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
        <div className="app-panel p-5 relative overflow-hidden">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-modrinth-muted">
              {analyticsV3Loading ? <Loader2 size={14} className="animate-spin text-modrinth-green" /> : <LineChart size={14} className="text-modrinth-green" />}
              <span>{analyticsSourceLabel}</span>
            </div>
            {!analyticsV3Available && analyticsV3Status !== null && (
              <span className="rounded-md bg-yellow-500/10 px-2 py-1 text-[10px] font-bold text-yellow-400">{t('analytics_limited')}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 relative">
            <div className="app-panel-soft p-4">
              <div className="flex items-center justify-between mb-2">
                <Download size={18} className="text-modrinth-green" />
                <span className="text-[10px] uppercase text-modrinth-muted font-bold">{t('downloads_label')}</span>
              </div>
              <div className="text-2xl font-bold text-modrinth-text">+{Math.round(rangeDownloads).toLocaleString()}</div>
              <div className="text-xs text-modrinth-muted">{analyticsRangeDays}d</div>
            </div>
            <div className="app-panel-soft p-4">
              <div className="flex items-center justify-between mb-2">
                <Eye size={18} className="text-modrinth-green" />
                <span className="text-[10px] uppercase text-modrinth-muted font-bold">{t('views_label')}</span>
              </div>
              <div className="text-2xl font-bold text-modrinth-text">{analyticsV3Available ? `+${Math.round(rangeViews).toLocaleString()}` : '--'}</div>
              <div className="text-xs text-modrinth-muted">{analyticsRangeDays}d</div>
            </div>
            <div className="app-panel-soft p-4">
              <div className="flex items-center justify-between mb-2">
                <Heart size={18} className="text-red-400" />
                <span className="text-[10px] uppercase text-modrinth-muted font-bold">{t('follows_label')}</span>
              </div>
              <div className="text-2xl font-bold text-modrinth-text">+{weeklySummary.followers.toLocaleString()}</div>
              <div className="text-xs text-modrinth-muted">{analyticsRangeDays}d</div>
            </div>
            <div className="app-panel-soft p-4">
              <div className="flex items-center justify-between mb-2">
                <DollarSign size={18} className="text-modrinth-green" />
                <span className="text-[10px] uppercase text-modrinth-muted font-bold">{t('payouts')}</span>
              </div>
              <div className="text-2xl font-bold text-modrinth-text">
                {rangeRevenue === null ? '--' : `+$${rangeRevenue.toFixed(2)}`}
              </div>
              <div className="text-xs text-modrinth-muted">{analyticsRangeDays}d</div>
            </div>
            <div className="app-panel-soft p-4">
              <div className="flex items-center justify-between mb-2">
                <Timer size={18} className="text-modrinth-green" />
                <span className="text-[10px] uppercase text-modrinth-muted font-bold">{t('playtime_label')}</span>
              </div>
              <div className="text-2xl font-bold text-modrinth-text">{analyticsV3Available ? formatPlaytime(rangePlaytime) : '--'}</div>
              <div className="text-xs text-modrinth-muted">{analyticsRangeDays}d</div>
            </div>
            <div className="app-panel-soft p-4">
              <div className="flex items-center justify-between mb-2">
                <Activity size={18} className="text-modrinth-green" />
                <span className="text-[10px] uppercase text-modrinth-muted font-bold">{t('active_label')}</span>
              </div>
              <div className="text-2xl font-bold text-modrinth-text">{activeProjectsInRange.toLocaleString()}</div>
              <div className="text-xs text-modrinth-muted">{t('active_projects_range')}</div>
            </div>
          </div>
          {((topDownloadProjectInsight && topDownloadProjectInsight.downloads > 0) || (!topDownloadProjectInsight && weeklySummary.topProject && weeklySummary.topProject.downloads > 0)) && (
            <div className="app-panel-soft mt-3 p-3 flex items-center gap-3 relative">
              {(topDownloadProjectInsight?.project.icon_url || weeklySummary.topProject?.icon_url) ? (
                <img src={topDownloadProjectInsight?.project.icon_url || weeklySummary.topProject?.icon_url} alt={topDownloadProjectInsight?.project.title || weeklySummary.topProject?.title || ''} className="w-9 h-9 rounded-xl bg-modrinth-bg" />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-modrinth-bg flex items-center justify-center text-modrinth-muted">
                  <Package size={16} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs text-modrinth-muted">{t('range_top_project')}</div>
                <div className="text-sm font-bold text-modrinth-text truncate">{topDownloadProjectInsight?.project.title || weeklySummary.topProject?.title}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-mono font-bold text-modrinth-green">
                  +{Math.round(topDownloadProjectInsight?.downloads ?? weeklySummary.topProject?.downloads ?? 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-modrinth-muted">{t('downloads')}</div>
              </div>
            </div>
          )}
          {!analyticsV3Available && !weeklySummary.isBaselineReady && (
            <p className="mt-3 text-[11px] leading-relaxed text-modrinth-muted relative">{t('weekly_baseline_note')}</p>
          )}
        </div>
      </div>

      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: '0.13s' }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-modrinth-muted uppercase">{t('analytics_trend')}</h3>
          <div className="app-range-tabs app-analytics-icon-tabs grid grid-cols-4">
            {ANALYTICS_SERIES_METRICS.map((item) => {
              const label = item === 'downloads' ? t('downloads') : t(`${item}_label` as any);
              const Icon = item === 'downloads' ? Download : item === 'views' ? Eye : item === 'playtime' ? Timer : DollarSign;
              return (
                <button
                  key={item}
                  onClick={() => setSeriesMetric(item)}
                  data-active={seriesMetric === item ? 'true' : undefined}
                  className="app-range-tab app-analytics-icon-tab"
                  aria-label={label}
                  title={label}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="app-panel overflow-hidden p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-modrinth-muted">
                <TrendingUp size={14} className="text-modrinth-green" />
                <span>{analyticsRangeDays}d</span>
              </div>
              <div className="mt-1 text-2xl font-black text-modrinth-text">
                {formatAnalyticsMetricValue(seriesMetric, sumAnalyticsMetric(trendPoints, seriesMetric))}
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-1 gap-1 text-right text-[10px] font-extrabold uppercase tracking-[0.08em]">
              <span className="text-modrinth-muted">{t('analytics_avg')} {formatAnalyticsMetricValue(seriesMetric, trendSummary.average)}</span>
              <span className="text-modrinth-muted">{t('analytics_peak')} {formatAnalyticsMetricValue(seriesMetric, trendSummary.peak)}</span>
              <span className={trendSummary.changePercent === null ? 'text-modrinth-muted' : trendSummary.changePercent >= 0 ? 'text-modrinth-green' : 'text-red-400'}>
                {t('analytics_change')} {trendSummary.changePercent === null ? t('analytics_new') : formatSignedPercent(trendSummary.changePercent)}
              </span>
            </div>
          </div>
          {trendPoints.length > 0 && (seriesMetric !== 'revenue' || analyticsV3RevenueAvailable) && hasAnalyticsMetric(trendPoints, seriesMetric) ? (
            <AnalyticsSparkline points={trendPoints} metric={seriesMetric} language={language} />
          ) : (
            <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-modrinth-border bg-modrinth-bg/40 px-4 text-center text-sm font-semibold text-modrinth-muted">
              {seriesMetric === 'revenue' && !analyticsV3RevenueAvailable ? t('analytics_revenue_scope_needed') : t('analytics_no_series')}
            </div>
          )}
        </div>
      </div>

      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: '0.135s' }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-modrinth-muted uppercase">{t('project_analytics')}</h3>
            <div className="mt-1 truncate text-[11px] font-semibold text-modrinth-muted">{analyticsRangeLabel}</div>
          </div>
          <div className="app-range-tabs app-analytics-icon-tabs grid grid-cols-4">
            {ANALYTICS_SERIES_METRICS.map((item) => {
              const label = item === 'downloads' ? t('downloads') : t(`${item}_label` as any);
              const Icon = item === 'downloads' ? Download : item === 'views' ? Eye : item === 'playtime' ? Timer : DollarSign;
              return (
                <button
                  key={item}
                  onClick={() => setProjectInsightMetric(item)}
                  data-active={projectInsightMetric === item ? 'true' : undefined}
                  className="app-range-tab app-analytics-icon-tab"
                  aria-label={label}
                  title={label}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="app-panel p-4">
          {rankedProjectInsights.length > 0 && analyticsV3Available ? (
            <div className="space-y-2">
              {rankedProjectInsights.slice(0, 8).map((item, index) => {
                const maxProjectValue = Math.max(1, rankedProjectInsights[0]?.value || 0);
                return (
                  <div key={item.project.id} className="app-panel-soft flex items-center gap-3 p-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-modrinth-green/15 text-xs font-extrabold text-modrinth-green">
                      {index + 1}
                    </div>
                    {item.project.icon_url ? (
                      <img src={item.project.icon_url} alt={item.project.title} className="h-10 w-10 shrink-0 rounded-xl bg-modrinth-bg object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-modrinth-bg text-modrinth-muted">
                        <Package size={18} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <div className="truncate text-sm font-extrabold text-modrinth-text">{item.project.title}</div>
                        <div className="shrink-0 text-sm font-mono font-extrabold text-modrinth-green">{formatAnalyticsMetricValue(projectInsightMetric, item.value)}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-modrinth-muted">
                        <span>{Math.round(item.views).toLocaleString()} {t('views_label').toLowerCase()}</span>
                        <span>{Math.round(item.downloads).toLocaleString()} {t('downloads').toLowerCase()}</span>
                        <span>{formatPlaytime(item.playtime)} {t('playtime_label').toLowerCase()}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-modrinth-bg/80">
                        <div className="h-full rounded-full app-progress-fill transition-all duration-700" style={{ width: `${Math.max(6, (item.value / maxProjectValue) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-3 text-center text-sm text-modrinth-muted">{analyticsV3Loading ? t('loading') : t('analytics_no_project_data')}</p>
          )}
        </div>
      </div>

      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: '0.14s' }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-modrinth-muted uppercase">{t('top_movers')}</h3>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-modrinth-muted">{analyticsRangeDays}d</span>
        </div>
        <div className="app-panel p-4">
          {topMovers.length > 0 ? (
            <div className="space-y-2">
              {topMovers.map((project, index) => {
                const score = Math.max(1, project.downloads + project.followers);
                const maxScore = Math.max(1, topMovers[0].downloads + topMovers[0].followers);
                return (
                  <div key={project.id} className="app-panel-soft flex items-center gap-3 p-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-modrinth-green/15 text-xs font-extrabold text-modrinth-green">
                      {index + 1}
                    </div>
                    {project.icon_url ? (
                      <img src={project.icon_url} alt={project.title} className="h-10 w-10 shrink-0 rounded-xl bg-modrinth-bg object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-modrinth-bg text-modrinth-muted">
                        <Package size={18} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 truncate text-sm font-extrabold text-modrinth-text">{project.title}</div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-modrinth-muted">
                        <span className="text-modrinth-green">+{project.downloads.toLocaleString()} {t('downloads').toLowerCase()}</span>
                        <span>+{project.followers.toLocaleString()} {t('likes').toLowerCase()}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-modrinth-bg/80">
                        <div className="h-full rounded-full app-progress-fill transition-all duration-700" style={{ width: `${Math.max(8, (score / maxScore) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-3 text-center text-sm text-modrinth-muted">{t('no_movers')}</p>
          )}
        </div>
      </div>

      <div className="mb-8 animate-fade-in-up" style={{ animationDelay: '0.16s' }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-modrinth-muted uppercase">{t('project_health')}</h3>
          <div className="rounded-full bg-modrinth-green/10 px-3 py-1 text-xs font-extrabold text-modrinth-green">
            {projectHealth.score}/100
          </div>
        </div>
        <div className="app-panel p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-modrinth-green/12 text-modrinth-green">
              <ShieldCheck size={24} />
            </div>
            <div className="min-w-0">
              <div className="text-base font-extrabold text-modrinth-text">{t('project_health')}</div>
              <p className="text-xs leading-relaxed text-modrinth-muted">{t('project_health_desc')}</p>
            </div>
          </div>
          <div className="space-y-2">
            {projectHealth.issues.map((issue) => (
              <div key={issue.key} className="app-panel-soft flex items-start gap-3 p-3">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${issue.value > 0 ? 'bg-yellow-500/12 text-yellow-400' : 'bg-modrinth-green/12 text-modrinth-green'}`}>
                  {issue.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-extrabold text-modrinth-text">{issue.label}</div>
                    <div className={`text-sm font-mono font-extrabold ${issue.value > 0 ? 'text-yellow-400' : 'text-modrinth-green'}`}>{issue.value}</div>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-modrinth-muted">{issue.detail}</p>
                </div>
              </div>
            ))}
          </div>
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
      
      <div className="app-panel p-5 mb-8 animate-fade-in-up relative overflow-hidden" style={{ animationDelay: '0.15s' }}>
        {projects.length > 0 ? (
            <div className="space-y-2">
              {sortedProjects.map((p, idx) => {
                const val = p[metric];
                const percent = (val / maxVal) * 100;
                return (
                  <div key={p.id} className="app-panel-soft p-3 flex items-center gap-3">
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
                        <div className="h-full app-progress-fill rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
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
          <div key={cat} className="app-panel p-3 relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-2 relative">
              <div className="text-sm font-bold text-modrinth-text truncate capitalize">{cat}</div>
              <div className="text-xs font-mono font-bold text-modrinth-muted">{count}</div>
            </div>
            <div className="h-1.5 bg-modrinth-bg/80 rounded-full overflow-hidden">
              <div className="h-full app-progress-fill rounded-full" style={{ width: `${projects.length ? (count / projects.length) * 100 : 0}%` }} />
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

const SettingsSection: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ icon, title, subtitle, children, className = '' }) => (
  <section className={`app-panel app-reveal overflow-visible p-4 ${className}`}>
    <div className="mb-4 flex items-start gap-3">
      <div className="app-icon-tile flex h-9 w-9 shrink-0 items-center justify-center text-modrinth-green">
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.08em] text-modrinth-text">{title}</h2>
        {subtitle && <p className="mt-1 text-xs leading-relaxed text-modrinth-muted">{subtitle}</p>}
      </div>
    </div>
    {children}
  </section>
);

const SettingsActionButton: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}> = ({ icon, title, subtitle, onClick, href, danger = false }) => {
  const content = (
    <>
      <span className={`app-icon-tile flex h-9 w-9 shrink-0 items-center justify-center ${danger ? 'text-red-400' : 'text-modrinth-green'}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-extrabold text-modrinth-text">{title}</span>
        {subtitle && <span className="mt-0.5 block text-xs leading-relaxed text-modrinth-muted">{subtitle}</span>}
      </span>
      {href && <ExternalLink size={14} className="shrink-0 text-modrinth-muted" />}
    </>
  );

  const className = `app-glass-button flex w-full items-center gap-3 rounded-lg border border-modrinth-border bg-modrinth-bg px-3 py-3 ${
    danger ? 'hover:border-red-500/40 hover:bg-red-500/10' : 'hover:border-modrinth-green/40 hover:bg-modrinth-cardHover'
  }`;

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
};

const ACCENT_PRESETS = [
  '#38C172',
  '#22C55E',
  '#14B8A6',
  '#0EA5E9',
  '#6366F1',
  '#A855F7',
  '#EC4899',
  '#F97316',
  '#EAB308',
  '#EF4444',
] as const;

type HsvColor = {
  h: number;
  s: number;
  v: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeHexColor = (value: string) => {
  const trimmed = value.trim();
  if (/^#[0-9A-F]{6}$/i.test(trimmed)) return trimmed.toUpperCase();
  return null;
};

const hexToRgb = (hex: string) => {
  const valid = normalizeHexColor(hex);
  if (!valid) return null;
  const raw = valid.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
};

const rgbToHex = (r: number, g: number, b: number) => `#${[r, g, b].map(channel => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

const hsvToHex = ({ h, s, v }: HsvColor) => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
};

const hexToHsv = (hex: string): HsvColor => {
  const rgb = hexToRgb(hex) || { r: 56, g: 193, b: 114 };
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }

  return {
    h: h < 0 ? h + 360 : h,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
};

const AppColorPicker: React.FC<{
  value: string;
  inputValue: string;
  onInputValueChange: (value: string) => void;
  onPreview: (value: string) => void;
  onCommit: (value: string) => void;
  t: (key: string) => string;
}> = ({ value, inputValue, onInputValueChange, onPreview, onCommit, t }) => {
  const [hsv, setHsv] = useState<HsvColor>(() => hexToHsv(value));
  const areaRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);
  const areaThumbRef = useRef<HTMLSpanElement | null>(null);
  const hueThumbRef = useRef<HTMLSpanElement | null>(null);
  const previewSwatchRef = useRef<HTMLDivElement | null>(null);
  const hsvRef = useRef<HsvColor>(hexToHsv(value));
  const pickingRef = useRef<'area' | 'hue' | null>(null);
  const latestHexRef = useRef(normalizeHexColor(value) || '#38C172');
  const activeHex = normalizeHexColor(inputValue) || value;
  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  const paintPicker = useCallback((next: HsvColor, hex: string) => {
    const hueHex = hsvToHex({ h: next.h, s: 1, v: 1 });
    if (areaRef.current) areaRef.current.style.backgroundColor = hueHex;
    if (areaThumbRef.current) {
      areaThumbRef.current.style.left = `${next.s * 100}%`;
      areaThumbRef.current.style.top = `${(1 - next.v) * 100}%`;
      areaThumbRef.current.style.backgroundColor = hex;
    }
    if (hueThumbRef.current) {
      hueThumbRef.current.style.left = `${(next.h / 359.999) * 100}%`;
    }
    if (previewSwatchRef.current) {
      previewSwatchRef.current.style.backgroundColor = hex;
    }
  }, []);

  useEffect(() => {
    const valid = normalizeHexColor(value) || '#38C172';
    const nextHsv = hexToHsv(valid);
    latestHexRef.current = valid;
    hsvRef.current = nextHsv;
    setHsv(nextHsv);
    paintPicker(nextHsv, valid);
  }, [paintPicker, value]);

  const preview = (next: HsvColor) => {
    const clean = {
      h: clamp(next.h, 0, 359.999),
      s: clamp(next.s, 0, 1),
      v: clamp(next.v, 0, 1),
    };
    const hex = hsvToHex(clean);
    hsvRef.current = clean;
    latestHexRef.current = hex;
    paintPicker(clean, hex);
    onPreview(hex);
  };

  const finishPicking = () => {
    if (!pickingRef.current) return;
    pickingRef.current = null;
    setHsv(hsvRef.current);
    onInputValueChange(latestHexRef.current);
    onCommit(latestHexRef.current);
  };

  const pickFromArea = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const y = clamp(event.clientY - rect.top, 0, rect.height);
    preview({ ...hsvRef.current, s: rect.width === 0 ? 0 : x / rect.width, v: rect.height === 0 ? 0 : 1 - y / rect.height });
  };

  const pickHue = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    preview({ ...hsvRef.current, h: rect.width === 0 ? 0 : (x / rect.width) * 359.999 });
  };

  const beginAreaPick = (event: React.PointerEvent<HTMLDivElement>) => {
    pickingRef.current = 'area';
    event.currentTarget.setPointerCapture(event.pointerId);
    pickFromArea(event);
  };

  const beginHuePick = (event: React.PointerEvent<HTMLDivElement>) => {
    pickingRef.current = 'hue';
    event.currentTarget.setPointerCapture(event.pointerId);
    pickHue(event);
  };

  return (
    <div className="rounded-lg border border-modrinth-border bg-modrinth-bg p-3">
      <div className="mb-3 flex items-center gap-3">
        <div ref={previewSwatchRef} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-modrinth-border shadow-[0_12px_26px_rgba(0,0,0,0.22)]" style={{ backgroundColor: activeHex }}>
          <Check size={18} className="text-black/70" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-modrinth-text">{t('accent_presets')}</p>
          <p className="mt-1 text-xs leading-relaxed text-modrinth-muted">{t('accent_presets_desc')}</p>
        </div>
      </div>

      <div
        ref={areaRef}
        role="slider"
        aria-label={t('accent_editor')}
        tabIndex={0}
        className="relative mb-3 h-36 touch-none overflow-hidden rounded-lg border border-modrinth-border"
        style={{
          backgroundColor: hueColor,
          backgroundImage: 'linear-gradient(90deg, #fff, rgba(255,255,255,0)), linear-gradient(0deg, #000, rgba(0,0,0,0))',
        }}
        onPointerDown={beginAreaPick}
        onPointerMove={(event) => {
          if (pickingRef.current === 'area') pickFromArea(event);
        }}
        onPointerUp={() => {
          finishPicking();
        }}
        onPointerCancel={() => {
          finishPicking();
        }}
      >
        <span
          ref={areaThumbRef}
          className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-modrinth-border shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: activeHex }}
        />
      </div>

      <div
        ref={hueRef}
        role="slider"
        aria-label={t('accent_hue')}
        tabIndex={0}
        className="relative mb-3 h-8 touch-none rounded-lg border border-modrinth-border"
        style={{ background: 'linear-gradient(90deg, #EF4444, #EAB308, #22C55E, #14B8A6, #0EA5E9, #6366F1, #A855F7, #EC4899, #EF4444)' }}
        onPointerDown={beginHuePick}
        onPointerMove={(event) => {
          if (pickingRef.current === 'hue') pickHue(event);
        }}
        onPointerUp={() => {
          finishPicking();
        }}
        onPointerCancel={() => {
          finishPicking();
        }}
      >
        <span
          ref={hueThumbRef}
          className="absolute top-1/2 h-10 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-modrinth-border bg-modrinth-card shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
          style={{ left: `${(hsv.h / 359.999) * 100}%` }}
        />
      </div>

      <div className="mb-3 grid grid-cols-5 gap-2">
        {ACCENT_PRESETS.map((color) => {
          const active = value.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              aria-label={color}
              onClick={() => {
                const nextHsv = hexToHsv(color);
                latestHexRef.current = color;
                hsvRef.current = nextHsv;
                onInputValueChange(color);
                onPreview(color);
                onCommit(color);
                setHsv(nextHsv);
                paintPicker(nextHsv, color);
              }}
              className={`relative h-10 rounded-lg border bg-modrinth-card p-1 ${active ? 'border-modrinth-green' : 'border-modrinth-border hover:border-modrinth-muted'}`}
            >
              <span className="block h-full w-full rounded-md" style={{ backgroundColor: color }} />
              {active && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Check size={15} className="rounded-full bg-black/45 p-0.5 text-white" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <input
        type="text"
        value={inputValue}
        onChange={(event) => {
          const next = event.target.value.toUpperCase();
          onInputValueChange(next);
          const valid = normalizeHexColor(next);
          if (valid) {
            const nextHsv = hexToHsv(valid);
            latestHexRef.current = valid;
            hsvRef.current = nextHsv;
            onPreview(valid);
            onCommit(valid);
            setHsv(nextHsv);
            paintPicker(nextHsv, valid);
          }
        }}
        placeholder="#38C172"
        className="app-input font-mono uppercase"
      />
      <p className="mt-2 text-xs text-modrinth-muted">{t('hex_format_hint')}</p>
    </div>
  );
};

const SettingsPage: React.FC<{ user: ModrinthUser; onLogout: () => void; token: string; updateInfo?: GitHubRelease | null }> = ({ user, onLogout, token, updateInfo }) => {
  const { theme, setTheme, language, setLanguage, t, accentColor, setAccentColor, showFavoriteProjects, setShowFavoriteProjects } = useSettings();
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [currUser, setCurrUser] = useState(user);
  const [colorInput, setColorInput] = useState(accentColor);
  const [draftAccentColor, setDraftAccentColor] = useState(accentColor);
  const [showAccentEditor, setShowAccentEditor] = useState(false);
  const [settingsRelease, setSettingsRelease] = useState<GitHubRelease | null>(updateInfo ?? null);
  const [settingsNotice, setSettingsNotice] = useState('');
  const importSettingsRef = useRef<HTMLInputElement | null>(null);
  const accentPreviewFrame = useRef<number | null>(null);
  const pendingAccentPreview = useRef(accentColor);
  const settingsNoticeTimer = useRef<number | null>(null);
  const settingsMountedRef = useRef(true);
  const latestVersion = settingsRelease?.tag_name.replace(/^v/, '') || null;
  const isOutdated = latestVersion ? compareVersions(latestVersion, APP_VERSION) > 0 : false;
  useBackDismiss(showAccentEditor, () => setShowAccentEditor(false));

  const reloadUser = () => {
    fetchCurrentUser(token)
      .then((nextUser) => {
        if (settingsMountedRef.current) setCurrUser(nextUser);
      })
      .catch(console.error);
  };

  const showSettingsNotice = (message: string) => {
    if (settingsNoticeTimer.current !== null) window.clearTimeout(settingsNoticeTimer.current);
    setSettingsNotice(message);
    settingsNoticeTimer.current = window.setTimeout(() => {
      settingsNoticeTimer.current = null;
      setSettingsNotice('');
    }, 2200);
  };

  const resetAppearance = () => {
    setTheme('dark');
    setLanguage(DEFAULT_LANGUAGE);
    setAccentColor('#38C172');
    setColorInput('#38C172');
    setDraftAccentColor('#38C172');
    setShowFavoriteProjects(true);
    showSettingsNotice(t('appearance_reset_done'));
  };

  const previewAccentColor = useCallback((color: string) => {
    const valid = normalizeHexColor(color);
    if (!valid) return;
    pendingAccentPreview.current = valid;

    if (accentPreviewFrame.current !== null) return;
    accentPreviewFrame.current = window.requestAnimationFrame(() => {
      accentPreviewFrame.current = null;
      document.documentElement.style.setProperty('--accent-color', pendingAccentPreview.current);
      setDraftAccentColor(pendingAccentPreview.current);
      setColorInput(pendingAccentPreview.current);
    });
  }, []);

  const commitAccentColor = useCallback((color: string) => {
    const valid = normalizeHexColor(color);
    if (!valid) return;
    if (accentPreviewFrame.current !== null) {
      window.cancelAnimationFrame(accentPreviewFrame.current);
      accentPreviewFrame.current = null;
    }
    pendingAccentPreview.current = valid;
    document.documentElement.style.setProperty('--accent-color', valid);
    setDraftAccentColor(valid);
    setColorInput(valid);
    setAccentColor(valid);
  }, [setAccentColor]);

  const exportSettings = () => {
    const payload = {
      app: 'Rinthy',
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      settings: {
        theme,
        language,
        accentColor,
        showFavoriteProjects,
        projectSortMode: localStorage.getItem('project_sort_mode') || 'popularity',
        favoriteProjectIds: readFavoriteProjectIds(currUser.id),
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rinthy-settings-${currUser.username}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showSettingsNotice(t('settings_exported'));
  };

  const importSettings = async (file?: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = parsed?.settings ?? parsed;

      if (imported.theme === 'dark' || imported.theme === 'light' || imported.theme === 'glass') setTheme(imported.theme);
      if (typeof imported.language === 'string' && isSupportedLanguage(imported.language)) setLanguage(imported.language);
      if (typeof imported.accentColor === 'string' && /^#[0-9A-F]{6}$/i.test(imported.accentColor)) {
        const importedAccent = imported.accentColor.toUpperCase();
        setAccentColor(importedAccent);
        setColorInput(importedAccent);
        setDraftAccentColor(importedAccent);
      }
      if (typeof imported.showFavoriteProjects === 'boolean') setShowFavoriteProjects(imported.showFavoriteProjects);
      if (typeof imported.projectSortMode === 'string') saveProjectSortMode(imported.projectSortMode as ProjectSortMode);
      if (Array.isArray(imported.favoriteProjectIds)) {
        saveFavoriteProjectIds(currUser.id, imported.favoriteProjectIds.filter((id: unknown): id is string => typeof id === 'string'));
      }

      showSettingsNotice(t('settings_imported'));
    } catch {
      alert(t('settings_import_failed'));
    } finally {
      if (importSettingsRef.current) importSettingsRef.current.value = '';
    }
  };

  const clearUpdateCache = () => {
    localStorage.removeItem('latest_release');
    localStorage.removeItem('dismissed_version');
    localStorage.removeItem('dismissed_at_launch');
    localStorage.removeItem('last_update_check');
    setSettingsRelease(null);
    showSettingsNotice(t('update_cache_cleared'));
  };

  useEffect(() => {
    if (settingsRelease) return;
    let cancelled = false;
    checkForUpdates().then(release => {
      if (!cancelled && release) setSettingsRelease(release);
    });
    return () => {
      cancelled = true;
    };
  }, [settingsRelease]);

  useEffect(() => {
    const valid = normalizeHexColor(accentColor) || '#38C172';
    setDraftAccentColor(valid);
    setColorInput(valid);
    pendingAccentPreview.current = valid;
  }, [accentColor]);

  useEffect(() => {
    settingsMountedRef.current = true;
    return () => {
      settingsMountedRef.current = false;
      if (accentPreviewFrame.current !== null) {
        window.cancelAnimationFrame(accentPreviewFrame.current);
      }
      if (settingsNoticeTimer.current !== null) {
        window.clearTimeout(settingsNoticeTimer.current);
      }
    };
  }, []);

  return (
    <div className="px-4 pb-24 animate-fade-in">
      <header className="app-topbar flex items-center justify-between mb-5 sticky top-0 z-50 pt-[calc(env(safe-area-inset-top)+0.85rem)] pb-3 -mx-4 px-4 min-h-[82px] overflow-hidden relative transition-colors duration-300">
        <div className="flex flex-col gap-1 relative">
          <h1 className="text-2xl font-bold text-modrinth-text leading-none">{t('settings')}</h1>
          <p className="text-modrinth-muted text-xs font-medium">{t('settings_subtitle')}</p>
        </div>
      </header>

      {settingsNotice && (
        <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.85rem)] z-[300] -translate-x-1/2 rounded-full border border-modrinth-border bg-modrinth-card px-4 py-2 text-xs font-extrabold text-modrinth-text shadow-[0_14px_34px_rgba(0,0,0,0.34)] app-floating-menu">
          {settingsNotice}
        </div>
      )}

      <div className="app-panel app-reveal mb-5 overflow-hidden p-5">
        <div className="flex items-center gap-4">
          <img src={currUser.avatar_url} alt={currUser.username} className="h-16 w-16 shrink-0 rounded-lg border border-modrinth-border bg-modrinth-bg object-cover" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-extrabold text-modrinth-text">{currUser.username}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-modrinth-border bg-modrinth-bg px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-modrinth-muted">{currUser.role}</span>
              <span className="truncate rounded-md border border-modrinth-border bg-modrinth-bg px-2 py-1 text-[10px] font-mono text-modrinth-muted">{currUser.id}</span>
            </div>
          </div>
          <button onClick={()=>setShowProfileEdit(true)} className="app-glass-button flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-modrinth-border bg-modrinth-bg text-modrinth-muted hover:border-modrinth-green/40 hover:text-modrinth-green">
            <Edit3 size={18}/>
          </button>
        </div>
      </div>

      {isOutdated && settingsRelease && (
        <div className="app-panel app-reveal p-4 overflow-hidden mb-5">
          <div className="flex items-start gap-3">
            <div className="app-icon-tile flex h-9 w-9 shrink-0 items-center justify-center text-modrinth-green"><AlertTriangle size={18} /></div>
            <div className="flex-1">
              <div className="text-sm font-bold text-modrinth-text mb-1">{t('update_outdated')}</div>
              <div className="text-xs text-modrinth-muted mb-3">
                {t('update_current')}: {APP_VERSION} · {t('update_new_version')}: {latestVersion}
              </div>
              <a
                href={findApkAsset(settingsRelease)?.browser_download_url || settingsRelease.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold text-modrinth-green bg-modrinth-bg px-3 py-1.5 rounded-lg"
              >
                <ExternalLink size={12} /> {t('update_view_release')}
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <SettingsSection icon={<Smartphone size={17} />} title={t('appearance')} subtitle={t('appearance_desc')} className="relative z-20" >
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.08em] text-modrinth-muted"><Globe size={14} /> {t('language')}</div>
              <LanguageSelect value={language} onChange={setLanguage} compact />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.08em] text-modrinth-muted"><Moon size={14} /> {t('theme')}</div>
              <div className="app-segmented-tabs app-theme-tabs grid grid-cols-3 gap-1 rounded-lg border border-modrinth-border bg-modrinth-bg p-1">
                {(['dark', 'light', 'glass'] as ThemeMode[]).map(m => {
                  const Icon = m === 'light' ? Sun : m === 'glass' ? Sparkles : Moon;
                  return (
                    <button key={m} type="button" onClick={() => setTheme(m)} data-active={theme === m ? 'true' : undefined} className={`app-segmented-tab app-theme-tab flex min-h-10 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-extrabold ${theme === m ? 'text-modrinth-text' : 'text-modrinth-muted hover:text-modrinth-text'}`}>
                      <Icon size={13} />
                      <span className="truncate">{t(m)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.08em] text-modrinth-muted"><Sun size={14} /> {t('accent_color')}</div>
                <button onClick={resetAppearance} className="app-glass-button rounded-lg border border-modrinth-border bg-modrinth-bg px-3 py-1.5 text-xs font-bold text-modrinth-muted hover:border-modrinth-green/40 hover:text-modrinth-text">{t('reset_all')}</button>
              </div>
              <button
                type="button"
                onClick={() => setShowAccentEditor((value) => !value)}
                className="app-glass-button flex w-full items-center gap-3 rounded-lg border border-modrinth-border bg-modrinth-bg p-3 text-left hover:border-modrinth-green/40 hover:bg-modrinth-cardHover"
              >
                <span className="h-11 w-11 shrink-0 rounded-lg border border-modrinth-border shadow-[0_10px_22px_rgba(0,0,0,0.22)]" style={{ backgroundColor: draftAccentColor }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold text-modrinth-text">{t('accent_presets')}</span>
                  <span className="mt-0.5 block font-mono text-xs text-modrinth-muted">{draftAccentColor.toUpperCase()}</span>
                </span>
                <ChevronDown size={16} className={`shrink-0 text-modrinth-muted transition-transform ${showAccentEditor ? 'rotate-180' : ''}`} />
              </button>
              {showAccentEditor && (
                <div className="mt-3 app-reveal">
                  <AppColorPicker
                    value={draftAccentColor}
                    inputValue={colorInput}
                    onInputValueChange={setColorInput}
                    onPreview={previewAccentColor}
                    onCommit={commitAccentColor}
                    t={t}
                  />
                </div>
              )}
            </div>

            <div className="app-glass-button flex items-center justify-between gap-4 rounded-lg border border-modrinth-border bg-modrinth-bg p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-extrabold text-modrinth-text"><Star size={15} className="text-modrinth-green" /> {t('favorite_projects')}</div>
                <p className="mt-1 text-xs leading-relaxed text-modrinth-muted">{t('favorite_projects_desc')}</p>
              </div>
              <button type="button" role="switch" aria-checked={showFavoriteProjects} data-state={showFavoriteProjects ? 'checked' : 'unchecked'} onClick={() => setShowFavoriteProjects(!showFavoriteProjects)} className="app-switch">
                <span className="app-switch__thumb" />
              </button>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection icon={<Archive size={17} />} title={t('local_data')} subtitle={t('local_data_desc')} className="relative z-10">
          <input ref={importSettingsRef} type="file" accept="application/json" className="hidden" onChange={(event) => void importSettings(event.target.files?.[0])} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <SettingsActionButton icon={<Download size={16} />} title={t('export_settings')} subtitle={t('export_settings_desc')} onClick={exportSettings} />
            <SettingsActionButton icon={<Upload size={16} />} title={t('import_settings')} subtitle={t('import_settings_desc')} onClick={() => importSettingsRef.current?.click()} />
            <SettingsActionButton icon={<RefreshCw size={16} />} title={t('clear_update_cache')} subtitle={t('clear_update_cache_desc')} onClick={clearUpdateCache} />
          </div>
        </SettingsSection>

        <SettingsSection icon={<Info size={17} />} title={t('about_app')} subtitle={`Rinthy v${APP_VERSION}`}>
          <div className="grid gap-2">
            <div className="app-glass-button flex items-center justify-between rounded-lg border border-modrinth-border bg-modrinth-bg px-3 py-3">
              <span className="text-sm font-bold text-modrinth-text">{t('update_current')}</span>
              <span className="font-mono text-sm text-modrinth-muted">{APP_VERSION}</span>
            </div>
            <SettingsActionButton icon={<ExternalLink size={16} />} title={t('update_view_release')} subtitle={latestVersion ? `${t('update_new_version')}: ${latestVersion}` : t('check_updates')} href={settingsRelease?.html_url || 'https://github.com/imsawiq/Rinthy/releases'} />
            <SettingsActionButton icon={<LogOut size={16} />} title={t('logout')} subtitle={t('logout_desc')} onClick={onLogout} danger />
          </div>
        </SettingsSection>
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
  const scrollResetTimer = useRef<number | null>(null);

  const resetHorizontalScroll = useCallback(() => {
    window.scrollTo({ top: window.scrollY, left: 0, behavior: 'auto' });
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
  }, []);

  const handleTabChange = useCallback((nextTab: NavTab) => {
    if (scrollResetTimer.current !== null) window.clearTimeout(scrollResetTimer.current);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }

    scrollResetTimer.current = window.setTimeout(() => {
      scrollResetTimer.current = null;
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 0);
  }, [activeTab]);

  useEffect(() => {
    const handleViewportChange = () => resetHorizontalScroll();

    window.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);

    return () => {
      if (scrollResetTimer.current !== null) window.clearTimeout(scrollResetTimer.current);
      window.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, [resetHorizontalScroll]);
  
  return (
    <>
      <div className="pb-20">
        {activeTab === NavTab.PROJECTS && <Dashboard user={user} token={token} />}
        {activeTab === NavTab.TEAMS && <TeamsPage user={user} token={token} />}
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
  const appMountedRef = useRef(true);

  useEffect(() => {
    appMountedRef.current = true;
    return () => {
      appMountedRef.current = false;
    };
  }, []);

  // Check for updates on app start
  useEffect(() => {
    let cancelled = false;
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
      if (cancelled) return;
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
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initAuth = async () => {
       if (authState.token && !authState.user) {
        try {
          const user = await fetchCurrentUser(authState.token);
          if (cancelled) return;
          setAuthState(prev => ({ ...prev, user, isLoading: false, error: null }));
        } catch (err) {
          if (cancelled) return;
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
    return () => {
      cancelled = true;
    };
  }, [authState.token]);

  useEffect(() => {
    if (!CapApp || typeof (CapApp as any).addListener !== 'function') return;
    let cancelled = false;

    const processOAuthCallback = (url: string) => {
      if (cancelled) return;
      const payload = readOAuthCallback(url);
      if (!payload) return;

      if (payload.error === 'parse_error') {
        setAuthState(prev => ({ ...prev, isLoading: false, error: getAuthMessage('oauth_missing_token') }));
        return;
      }

      const { token, state, error } = payload;
      const expectedState = readOAuthState();

      if (error) {
        clearOAuthState();
        setAuthState(prev => ({ ...prev, isLoading: false, error: getAuthMessage('oauth_cancelled') }));
        return;
      }

      if (!state || !expectedState || state !== expectedState) {
        clearOAuthState();
        setAuthState(prev => ({ ...prev, isLoading: false, error: getAuthMessage('oauth_state_error') }));
        return;
      }

      clearOAuthState();

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
      cancelled = true;
      handleAppUrlOpen.then(listener => listener.remove()).catch(() => {});
    };
  }, []);

  const handleLogin = async (token: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const user = await fetchCurrentUser(token);
      if (!appMountedRef.current) return;
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
      if (!appMountedRef.current) return;
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
    writeOAuthState(state);
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    window.location.href = `${MODRINTH_OAUTH_BASE_URL}/api/modrinth/start?state=${encodeURIComponent(state)}`;
  };

  const handleLogout = () => {
    localStorage.removeItem('modrinth_token');
    clearOAuthState();
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
              <Route
                path="/project/:id"
                element={
                  <React.Suspense fallback={<div className="flex justify-center pt-40 animate-fade-in"><Loader2 className="animate-spin text-modrinth-green" /></div>}>
                    <ProjectDetail token={authState.token} currentUserId={authState.user?.id} />
                  </React.Suspense>
                }
              />
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
