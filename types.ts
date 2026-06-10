
import type { Language as AppLanguage } from './locales';

export interface ModrinthUser {
  id: string;
  username: string;
  avatar_url: string;
  bio?: string;
  role: string;
  payout_data?: {
    balance?: number | string;      // available balance to withdraw (USD)
    payout_balance?: number | string; // some API variants use this naming
    currency?: string;     // e.g. "USD"
    payout_wallet?: string;
    payout_wallet_type?: string;
    payout_address?: string;
    // other fields (wallet, address, etc.) exist in API but are not used here
  } | null; // Can be null if no wallet
}

// Single payout transaction from history
export interface ModrinthPayoutTransaction {
  created: string; // ISO-8601 date
  amount: number;  // amount in USD
  status: string;  // e.g. "success", "pending", etc.
}

// Response from "Get user's payout history" endpoint
export interface ModrinthPayoutHistory {
  balance_all_time: number; // all-time earnings in USD
  last_30_days: number;     // earnings in the last 30 days in USD
  payouts: ModrinthPayoutTransaction[]; // full transaction history
}

export type ModrinthAnalyticsMetric = 'downloads' | 'views' | 'playtime' | 'revenue';
export type ModrinthAnalyticsResolution = 'hour' | 'day' | 'month';

export interface ModrinthAnalyticsPoint {
  start_time?: string;
  startTime?: string;
  downloads?: number;
  views?: number;
  playtime?: number;
  revenue?: number;
  projects?: Record<string, {
    downloads?: number;
    views?: number;
    playtime?: number;
    revenue?: number;
  }>;
}

export interface ModrinthAnalyticsRequest {
  time_range: {
    start: string;
    end: string;
    resolution: { slices: number } | { minutes: number };
  };
  return_metrics: {
    project_views?: { bucket_by?: string[]; filter_by?: Record<string, unknown> };
    project_downloads?: { bucket_by?: string[]; filter_by?: Record<string, unknown> };
    project_playtime?: { bucket_by?: string[]; filter_by?: Record<string, unknown> };
    project_revenue?: { bucket_by?: string[]; filter_by?: Record<string, unknown> };
  };
  project_ids?: string[];
}

export interface ModrinthPayout {
  id: string;
  amount: number;
  status: 'paid' | 'pending' | 'processing' | 'failed';
  created: string;
  payout_wallet: string;
}

export interface ModrinthNotification {
  id: string;
  user_id: string;
  type: 'project_update' | 'team_invite' | 'status_change' | 'moderation' | string;
  title: string;
  text: string;
  link: string;
  read: boolean;
  created: string;
  actions?: Array<{
    title?: string;
    action_route?: [string, string] | string[];
  }>;
}

export interface GalleryImage {
  url: string;
  raw_url?: string;
  featured: boolean;
  title?: string;
  description?: string;
  created: string;
  ordering: number;
}

export interface ProjectDependency {
  version_id: string | null;
  project_id: string | null;
  file_name: string | null;
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
  title?: string;
  icon_url?: string;
}

export interface ModrinthVersionFile {
  hashes: {
    sha1: string;
    sha512: string;
  };
  url: string;
  filename: string;
  primary: boolean;
  size: number;
}

export interface ModrinthVersion {
  id: string;
  project_id: string;
  author_id: string;
  name: string;
  version_number: string;
  version_type: 'release' | 'beta' | 'alpha';
  changelog: string;
  dependencies: ProjectDependency[];
  game_versions: string[];
  loaders: string[];
  featured: boolean;
  status: 'listed' | 'archived' | 'draft' | 'unlisted' | 'scheduled' | 'unknown';
  date_published: string;
  downloads: number;
  files: ModrinthVersionFile[];
}

export interface CreateModrinthVersionPayload {
  project_id: string;
  name: string;
  version_number: string;
  changelog?: string;
  dependencies: ProjectDependency[];
  game_versions: string[];
  version_type: 'release' | 'beta' | 'alpha';
  loaders: string[];
  featured: boolean;
  file_parts: string[];
  primary_file: string;
  files: Array<{ part: string; file: File }>;
}

export interface ModrinthProject {
  id: string;
  slug: string;
  team: string; 
  organization?: string | null;
  organization_id?: string | null;
  name?: string;
  title: string;
  description: string;
  categories: string[];
  client_side: 'required' | 'optional' | 'unsupported';
  server_side: 'required' | 'optional' | 'unsupported';
  body: string;
  downloads: number;
  followers: number;
  icon_url?: string;
  status: 'approved' | 'rejected' | 'draft' | 'unlisted' | 'archived' | 'processing' | 'unknown';
  requested_status?: 'approved' | 'archived' | 'unlisted' | 'draft';
  license?: {
    id: string;
    name: string;
    url?: string;
  };
  source_url?: string;
  issues_url?: string;
  wiki_url?: string;
  discord_url?: string;
  published: string;
  updated: string;
  gallery?: GalleryImage[];
}

export interface ModrinthOrganization {
  id: string;
  slug: string;
  name: string;
  team_id: string;
  description?: string;
  icon_url?: string | null;
  color?: number | null;
}

export interface ModrinthOrganizationPayload {
  slug: string;
  name: string;
  description?: string;
}

export interface CreateModrinthProjectPayload {
  slug: string;
  title: string;
  description: string;
  body: string;
  project_type: string;
  categories: string[];
  client_side: 'required' | 'optional' | 'unsupported';
  server_side: 'required' | 'optional' | 'unsupported';
  license_id: string;
  organization_id?: string;
  icon?: File | null;
}

export interface ProjectMember {
  user: ModrinthUser;
  team_id: string;
  role: string;
  is_owner?: boolean;
  permissions?: number;
  organization_permissions?: number;
  payouts_split?: number;
  ordering?: number;
  accepted: boolean;
}

export interface UserSearchResult {
  user_id: string;
  username: string;
  avatar_url: string;
  role: string;
}

export interface ModifyUserPayload {
  username?: string;
  bio?: string;
  avatar_url?: string;
}

export enum NavTab {
  PROJECTS = 'projects',
  TEAMS = 'teams',
  ANALYTICS = 'analytics',
  SETTINGS = 'settings'
}

export interface AuthState {
  token: string | null;
  user: ModrinthUser | null;
  isLoading: boolean;
  error: string | null;
  hasSeenOnboarding: boolean;
}

export type ThemeMode = 'dark' | 'light' | 'glass';
export type Language = AppLanguage;

export interface SettingsContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  accentColor: string;
  setAccentColor: (color: string) => void;
  showFavoriteProjects: boolean;
  setShowFavoriteProjects: (enabled: boolean) => void;
}
