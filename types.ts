
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
  actions?: any[];
}

export interface GalleryImage {
  url: string;
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

export interface ModrinthProject {
  id: string;
  slug: string;
  team: string; 
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

export interface ProjectMember {
  user: ModrinthUser;
  team_id: string;
  role: 'Owner' | 'Maintainer' | 'Contributor' | 'Translator';
  permissions?: number;
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

export type ThemeMode = 'dark' | 'light';
export type Language = 'ru' | 'en';

export interface SettingsContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  accentColor: string;
  setAccentColor: (color: string) => void;
}
