import { ModrinthProject, ModrinthUser, ModrinthPayoutHistory, ProjectMember, UserSearchResult, ModifyUserPayload, ModrinthNotification, ProjectDependency, ModrinthVersion } from '../types';

const BASE_URL = 'https://api.modrinth.com/v2';
const BASE_URL_V3 = 'https://api.modrinth.com/v3';
const USER_AGENT = 'Rinthy/1.0.0';

const isDebugEnabled = () => {
  try {
    return import.meta.env.DEV && localStorage.getItem('modrinth_debug') === 'true';
  } catch {
    return false;
  }
};

const debugLog = (...args: any[]) => {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log('[modrinthService]', ...args);
};

const debugGroup = (title: string, fn: () => void) => {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.groupCollapsed(`[modrinthService] ${title}`);
  try {
    fn();
  } finally {
    // eslint-disable-next-line no-console
    console.groupEnd();
  }
};

const normalizeAuthorization = (token: string) => {
  const trimmed = (token || '').trim();
  if (!trimmed) return trimmed;

  // If caller already provided a scheme (e.g. "Bearer ..."), keep as-is.
  if (trimmed.includes(' ')) return trimmed;

  // Heuristic: OAuth access tokens are often JWT-like (three dot-separated parts).
  // PATs are typically opaque strings; Modrinth accepts them as-is.
  if (trimmed.split('.').length === 3) return `Bearer ${trimmed}`;

  return trimmed;
};

const getHeaders = (token: string) => ({
  'Authorization': normalizeAuthorization(token),
  'User-Agent': USER_AGENT,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
});

const PAYOUTS_ROUTE_MISSING_GLOBAL_KEY = 'modrinth_payouts_route_missing_v2';

const isPayoutsRouteMissingGlobal = () => {
  try {
    return sessionStorage.getItem(PAYOUTS_ROUTE_MISSING_GLOBAL_KEY) === 'true';
  } catch {
    return false;
  }
};

const setPayoutsRouteMissingGlobal = () => {
  try {
    sessionStorage.setItem(PAYOUTS_ROUTE_MISSING_GLOBAL_KEY, 'true');
  } catch {
    // ignore
  }
};

const PAYOUT_BALANCE_ROUTE_MISSING_GLOBAL_KEY = 'modrinth_payout_balance_route_missing_v3';

const isPayoutBalanceRouteMissingGlobal = () => {
  try {
    return sessionStorage.getItem(PAYOUT_BALANCE_ROUTE_MISSING_GLOBAL_KEY) === 'true';
  } catch {
    return false;
  }
};

const setPayoutBalanceRouteMissingGlobal = () => {
  try {
    sessionStorage.setItem(PAYOUT_BALANCE_ROUTE_MISSING_GLOBAL_KEY, 'true');
  } catch {
    // ignore
  }
};

// Avoid spamming the payouts endpoint in React StrictMode; keep this cache in-memory so
// switching tokens or reloading the app re-tries automatically.
const payoutsUnavailableCache = new Set<string>();
const payoutsInFlight = new Set<string>();
const payoutsRouteMissing = new Set<string>();

const payoutBalanceInFlight = new Map<string, Promise<{ data: any | null; status: number }>>();
const payoutBalanceUnavailableCache = new Set<string>();

const CORE_FETCH_TTL_MS = 5000;

const currentUserInFlight = new Map<string, Promise<ModrinthUser>>();
const currentUserCache = new Map<string, { ts: number; value: ModrinthUser }>();

const userByIdInFlight = new Map<string, Promise<{ user: ModrinthUser | null; status: number }>>();
const userByIdCache = new Map<string, { ts: number; value: { user: ModrinthUser | null; status: number } }>();

const userProjectsInFlight = new Map<string, Promise<ModrinthProject[]>>();
const userProjectsCache = new Map<string, { ts: number; value: ModrinthProject[] }>();

export const fetchPayoutBalanceV3WithStatus = async (
  token: string
): Promise<{ data: any | null; status: number }> => {
  const cacheKey = 'me';

  try {
    if (isPayoutBalanceRouteMissingGlobal()) {
      return { data: null, status: -2 };
    }

    if (payoutBalanceUnavailableCache.has(cacheKey)) {
      return { data: null, status: 404 };
    }

    const existing = payoutBalanceInFlight.get(cacheKey);
    if (existing) {
      return await existing;
    }

    const requestPromise = (async () => {
      const response = await fetch(`${BASE_URL_V3}/payout/balance`, {
        headers: getHeaders(token)
      });

      if (!response.ok) {
        try {
          const clone = response.clone();
          const text = await clone.text();
          debugGroup('GET /v3/payout/balance (non-OK)', () => {
            debugLog('status', response.status);
            debugLog('body', text.slice(0, 400));
          });

          if (
            response.status === 404 &&
            text.includes('"error":"not_found"') &&
            text.includes('the requested route does not exist')
          ) {
            setPayoutBalanceRouteMissingGlobal();
            return { data: null, status: -2 };
          }
        } catch {
          // ignore
        }

        if (response.status === 404) payoutBalanceUnavailableCache.add(cacheKey);
        return { data: null, status: response.status };
      }

      const data = await response.json();
      debugGroup('GET /v3/payout/balance', () => {
        debugLog('status', response.status);
        debugLog('keys', data && typeof data === 'object' ? Object.keys(data) : null);
        try {
          const preview =
            data && typeof data === 'object'
              ? JSON.stringify(data).slice(0, 400)
              : String(data).slice(0, 400);
          debugLog('data_preview', preview);
        } catch {
          debugLog('data_preview', '[unserializable]');
        }
      });
      return { data, status: response.status };
    })();

    payoutBalanceInFlight.set(cacheKey, requestPromise);

    try {
      return await requestPromise;
    } finally {
      payoutBalanceInFlight.delete(cacheKey);
    }
  } catch {
    payoutBalanceInFlight.delete(cacheKey);
    return { data: null, status: 0 };
  }
};

export const fetchCurrentUser = async (token: string): Promise<ModrinthUser> => {
  const cacheKey = normalizeAuthorization(token) || 'anonymous';
  const cached = currentUserCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CORE_FETCH_TTL_MS) return cached.value;

  const existing = currentUserInFlight.get(cacheKey);
  if (existing) return await existing;

  const requestPromise = (async () => {
  const response = await fetch(`${BASE_URL}/user`, {
    headers: getHeaders(token)
  });
  if (!response.ok) throw new Error('Failed to fetch user');
  const me = await response.json();

  debugGroup('GET /user', () => {
    debugLog('status', response.status);
    debugLog('id', (me as any)?.id, 'username', (me as any)?.username);
    debugLog('has payout_data', (me as any)?.payout_data !== undefined);
    debugLog('payout_data keys', (me as any)?.payout_data ? Object.keys((me as any).payout_data) : null);
    debugLog('payout_data', (me as any)?.payout_data ?? null);
  });

  const fullResponse = await fetch(`${BASE_URL}/user/${me.id}`, {
    headers: getHeaders(token)
  });
  // If this fails for any reason, fall back to the minimal /user response.
  if (!fullResponse.ok) return me;

  const fullUser = await fullResponse.json();

  debugGroup('GET /user/{id}', () => {
    debugLog('status', fullResponse.status);
    debugLog('id', (fullUser as any)?.id, 'username', (fullUser as any)?.username);
    debugLog('has payout_data', (fullUser as any)?.payout_data !== undefined);
    debugLog('payout_data keys', (fullUser as any)?.payout_data ? Object.keys((fullUser as any).payout_data) : null);
    debugLog('payout_data', (fullUser as any)?.payout_data ?? null);
  });

  const mergedUser = {
    ...fullUser,
    // /user already returns private fields for the token owner (including payout_data).
    // Some /user/{id} responses may omit them, so preserve them from /user when missing.
    payout_data: fullUser.payout_data ?? me.payout_data
  };

  debugGroup('Merged user payout_data', () => {
    debugLog('has payout_data', (mergedUser as any)?.payout_data !== undefined);
    debugLog('payout_data keys', (mergedUser as any)?.payout_data ? Object.keys((mergedUser as any).payout_data) : null);
    debugLog('payout_data', (mergedUser as any)?.payout_data ?? null);
  });

    return mergedUser;
  })();

  currentUserInFlight.set(cacheKey, requestPromise);

  try {
    const value = await requestPromise;
    currentUserCache.set(cacheKey, { ts: Date.now(), value });
    return value;
  } finally {
    currentUserInFlight.delete(cacheKey);
  }
};

export const fetchUserByIdWithStatus = async (
  userId: string,
  token: string
): Promise<{ user: ModrinthUser | null; status: number }> => {
  const cacheKey = `${userId}::${normalizeAuthorization(token) || 'anonymous'}`;
  const cached = userByIdCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CORE_FETCH_TTL_MS) return cached.value;

  const existing = userByIdInFlight.get(cacheKey);
  if (existing) return await existing;

  const requestPromise = (async () => {
  try {
    const response = await fetch(`${BASE_URL}/user/${userId}`, {
      headers: getHeaders(token)
    });

    if (!response.ok) {
      return { user: null, status: response.status };
    }

    const user = await response.json();
    return { user, status: response.status };
  } catch {
    return { user: null, status: 0 };
  }
  })();

  userByIdInFlight.set(cacheKey, requestPromise);

  try {
    const value = await requestPromise;
    userByIdCache.set(cacheKey, { ts: Date.now(), value });
    return value;
  } finally {
    userByIdInFlight.delete(cacheKey);
  }
};

export const fetchUserProjects = async (userId: string, token: string): Promise<ModrinthProject[]> => {
  const cacheKey = `${userId}::${normalizeAuthorization(token) || 'anonymous'}`;
  const cached = userProjectsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CORE_FETCH_TTL_MS) return cached.value;

  const existing = userProjectsInFlight.get(cacheKey);
  if (existing) return await existing;

  const requestPromise = (async () => {
    const response = await fetch(`${BASE_URL}/user/${userId}/projects`, {
      headers: getHeaders(token)
    });
    if (!response.ok) throw new Error('Failed to fetch projects');
    return response.json();
  })();

  userProjectsInFlight.set(cacheKey, requestPromise);

  try {
    const value = await requestPromise;
    userProjectsCache.set(cacheKey, { ts: Date.now(), value });
    return value;
  } finally {
    userProjectsInFlight.delete(cacheKey);
  }
};

// New payout history endpoint (see "Get user's payout history")
// Returns overall all-time earnings, last 30 days, and full transaction list.
export const fetchUserPayoutHistory = async (userId: string, token: string): Promise<ModrinthPayoutHistory | null> => {
  try {
    if (payoutsUnavailableCache.has(userId)) return null;

    // Per "Get user's payout history" docs, the path is /user/{id}/payouts
    const response = await fetch(`${BASE_URL}/user/${userId}/payouts`, {
      headers: getHeaders(token)
    });

    if (!response.ok) {
      if (response.status === 404) payoutsUnavailableCache.add(userId);
      // For this app we treat any non-OK as "no payout history available".
      // This covers both "no payouts" and missing PAYOUTS_READ scope.
      return null;
    }

    return await response.json();
  } catch {
    // Network or other error: just behave as if there is no payout history.
    return null;
  }
};

export const fetchUserPayoutHistoryWithStatus = async (
  userId: string,
  token: string
): Promise<{ history: ModrinthPayoutHistory | null; status: number }> => {
  try {
    if (isPayoutsRouteMissingGlobal()) {
      return { history: null, status: -2 };
    }

    if (payoutsRouteMissing.has(userId)) {
      // Internal sentinel: the /payouts route does not exist on this API deployment.
      return { history: null, status: -2 };
    }

    if (payoutsUnavailableCache.has(userId)) {
      return { history: null, status: 404 };
    }

    // Prevent duplicate network calls in React StrictMode / rapid re-mounts.
    if (payoutsInFlight.has(userId)) {
      // Internal sentinel: request was skipped because another request is already in-flight.
      return { history: null, status: -1 };
    }

    payoutsInFlight.add(userId);

    try {
      const response = await fetch(`${BASE_URL}/user/${userId}/payouts`, {
        headers: getHeaders(token)
      });

      if (!response.ok) {
        try {
          const clone = response.clone();
          const text = await clone.text();
          debugGroup(`GET /user/${userId}/payouts (non-OK)`, () => {
            debugLog('status', response.status);
            debugLog('body', text.slice(0, 400));
          });

          // Some deployments return 404 with an explicit "route does not exist" body.
          // Treat this as a missing API route and stop retrying for this identifier.
          if (
            response.status === 404 &&
            text.includes('"error":"not_found"') &&
            text.includes('the requested route does not exist')
          ) {
            payoutsRouteMissing.add(userId);
            setPayoutsRouteMissingGlobal();
            return { history: null, status: -2 };
          }
        } catch {
          // ignore
        }

        if (response.status === 404) payoutsUnavailableCache.add(userId);
        return { history: null, status: response.status };
      }

      const history = await response.json();
      return { history, status: response.status };
    } finally {
      payoutsInFlight.delete(userId);
    }
  } catch {
    payoutsInFlight.delete(userId);
    return { history: null, status: 0 };
  }
};

export const fetchProject = async (projectId: string, token: string): Promise<ModrinthProject> => {
  const response = await fetch(`${BASE_URL}/project/${projectId}`, {
    headers: getHeaders(token)
  });
  if (!response.ok) throw new Error('Failed to fetch project');
  return response.json();
};

export const getProjects = async (ids: string[]): Promise<ModrinthProject[]> => {
  if (ids.length === 0) return [];
  // Modrinth allows fetching multiple projects via ?ids=["id1","id2"]
  const idsParam = JSON.stringify(ids);
  const response = await fetch(`${BASE_URL}/projects?ids=${encodeURIComponent(idsParam)}`);
  if (!response.ok) return [];
  return response.json();
};

export const updateProject = async (projectId: string, data: Partial<ModrinthProject>, token: string): Promise<void> => {
  const payload: any = {};

  // Whitelist basic fields
  if (data.title !== undefined) payload.title = data.title;
  if (data.description !== undefined) payload.description = data.description;
  if (data.body !== undefined) payload.body = data.body;
  if (data.client_side !== undefined) payload.client_side = data.client_side;
  if (data.server_side !== undefined) payload.server_side = data.server_side;
  
  // Handle license specifically
  if (data.license?.id) {
    payload.license_id = data.license.id;
    payload.license_url = data.license.url || null; 
  }
  
  // Handle URLs: map empty strings to null
  const urlFields = ['issues_url', 'source_url', 'wiki_url', 'discord_url'];
  urlFields.forEach(key => {
    // @ts-ignore
    const val = data[key];
    if (val !== undefined) {
      payload[key] = val === '' ? null : val;
    }
  });

  // CRITICAL FIX: Status Logic
  // Only include status if it is strictly one of the allowed transition states.
  // Never send "approved", "rejected", "processing", or "unknown".
  const allowedStatuses = ['draft', 'archived', 'unlisted'];
  
  if (data.status && allowedStatuses.includes(data.status)) {
    payload.status = data.status;
  }

  const response = await fetch(`${BASE_URL}/project/${projectId}`, {
    method: 'PATCH',
    headers: getHeaders(token),
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Update failed:", errorText);
    throw new Error(`Failed to update project: ${errorText}`);
  }
};

// --- Icon & Gallery Management ---

export const changeProjectIcon = async (projectId: string, file: File, token: string) => {
    const ext = file.name.split('.').pop();
    const response = await fetch(`${BASE_URL}/project/${projectId}/icon?ext=${ext}`, {
        method: 'PATCH',
        headers: {
            'Authorization': token,
            'User-Agent': USER_AGENT,
            // Fetch automatically sets Content-Type for binary/blob if we don't set it to json
        },
        body: file
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Failed to upload icon: ${err}`);
    }
};

export const deleteProjectIcon = async (projectId: string, token: string) => {
    const response = await fetch(`${BASE_URL}/project/${projectId}/icon`, {
        method: 'DELETE',
        headers: getHeaders(token)
    });
    if (!response.ok) throw new Error('Failed to delete icon');
};

export const addGalleryImage = async (projectId: string, file: File, featured: boolean, title: string, desc: string, token: string) => {
    const ext = file.name.split('.').pop();
    const url = new URL(`${BASE_URL}/project/${projectId}/gallery`);
    url.searchParams.append('ext', ext || 'png');
    url.searchParams.append('featured', String(featured));
    if (title) url.searchParams.append('title', title);
    if (desc) url.searchParams.append('description', desc);

    const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
            'Authorization': token,
            'User-Agent': USER_AGENT
        },
        body: file
    });
    
    if (!response.ok) {
         const err = await response.text();
         throw new Error(`Failed to upload gallery image: ${err}`);
    }
};

export const deleteGalleryImage = async (projectId: string, imageUrl: string, token: string) => {
    const urlParam = encodeURIComponent(imageUrl);
    const response = await fetch(`${BASE_URL}/project/${projectId}/gallery?url=${urlParam}`, {
        method: 'DELETE',
        headers: getHeaders(token)
    });
    if (!response.ok) throw new Error('Failed to delete image');
};

export const fetchProjectDependencies = async (projectId: string, token: string): Promise<ProjectDependency[]> => {
    // Fetch versions to get dependencies of the latest version
    const response = await fetch(`${BASE_URL}/project/${projectId}/version`, {
        headers: getHeaders(token)
    });
    if (!response.ok) return [];
    
    const versions = await response.json();
    if (!Array.isArray(versions) || versions.length === 0) return [];
    
    // Get dependencies of the most recent version
    const dependencies = versions[0].dependencies || [];
    if (dependencies.length === 0) return [];

    // Extract project IDs to fetch names/icons
    const projectIds = dependencies
      .map((d: ProjectDependency) => d.project_id)
      .filter((id: string | null): id is string => !!id);

    if (projectIds.length === 0) return dependencies;

    try {
      const projects = await getProjects(projectIds);
      // Enrich dependencies
      return dependencies.map((dep: ProjectDependency) => {
        const proj = projects.find(p => p.id === dep.project_id);
        return {
          ...dep,
          title: proj?.title,
          icon_url: proj?.icon_url
        };
      });
    } catch (e) {
      console.error("Failed to fetch dependency details", e);
      return dependencies;
    }
};

export const fetchProjectVersions = async (projectIdOrSlug: string, token: string): Promise<ModrinthVersion[]> => {
  const response = await fetch(`${BASE_URL}/project/${projectIdOrSlug}/version`, {
    headers: getHeaders(token)
  });
  if (!response.ok) throw new Error('Failed to fetch versions');
  return response.json();
};

// Tags: game versions and loaders
// NOTE: Docs mention /tag endpoints, but they currently return 404 from the browser.
// To avoid noisy errors we simply return an empty list here and let the UI
// fall back to versions-derived lists (unique values from existing versions).
export const fetchGameVersionTags = async (): Promise<string[]> => {
  return [];
};

export const fetchLoaderTags = async (): Promise<string[]> => {
  return [];
};

// --- Version Management ---

export const modifyVersion = async (
  versionId: string,
  data: { name?: string; version_type?: string; changelog?: string; game_versions?: string[]; loaders?: string[]; dependencies?: ProjectDependency[] },
  token: string
) => {
  const payload: any = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.version_type !== undefined) payload.version_type = data.version_type;
  if (data.changelog !== undefined) payload.changelog = data.changelog;
   if (data.game_versions !== undefined) payload.game_versions = data.game_versions;
   if (data.loaders !== undefined) payload.loaders = data.loaders;
   if (data.dependencies !== undefined) payload.dependencies = data.dependencies;

  const response = await fetch(`${BASE_URL}/version/${versionId}`, {
    method: 'PATCH',
    headers: getHeaders(token),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to modify version: ${err}`);
  }
};

export const deleteVersionById = async (versionId: string, token: string) => {
  const response = await fetch(`${BASE_URL}/version/${versionId}`, {
    method: 'DELETE',
    headers: getHeaders(token)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to delete version: ${err}`);
  }
};

// --- User Management ---

export const modifyUser = async (userId: string, data: ModifyUserPayload, token: string) => {
  const response = await fetch(`${BASE_URL}/user/${userId}`, {
    method: 'PATCH',
    headers: getHeaders(token),
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update profile');
};

export const searchUser = async (username: string): Promise<UserSearchResult[]> => {
  if (!username) return [];
  try {
    const response = await fetch(`${BASE_URL}/user/${username}`);
    if (response.status === 404) return [];
    if (!response.ok) return [];
    
    const user = await response.json();
    return [{
      user_id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      role: user.role
    }];
  } catch (e) {
    console.error("Search error", e);
    return [];
  }
};

// --- Team Members API ---

export const fetchProjectMembers = async (slug: string, token: string): Promise<ProjectMember[]> => {
  // Using project slug for GET usually works to get members
  const response = await fetch(`${BASE_URL}/project/${slug}/members`, {
    headers: getHeaders(token)
  });
  if (!response.ok) throw new Error('Failed to fetch members');
  return response.json();
};

export const addTeamMember = async (teamId: string, userId: string, token: string) => {
  const response = await fetch(`${BASE_URL}/team/${teamId}/members`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ user_id: userId, role: 'Contributor' }) 
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to invite member: ${err}`);
  }
};

export const updateTeamMember = async (teamId: string, userId: string, role: string, token: string) => {
  const response = await fetch(`${BASE_URL}/team/${teamId}/members/${userId}`, {
    method: 'PATCH',
    headers: getHeaders(token),
    body: JSON.stringify({ role })
  });
  if (!response.ok) throw new Error('Failed to update member');
};

export const deleteTeamMember = async (teamId: string, userId: string, token: string) => {
  const response = await fetch(`${BASE_URL}/team/${teamId}/members/${userId}`, {
    method: 'DELETE',
    headers: getHeaders(token)
  });
  if (!response.ok) throw new Error('Failed to remove member');
};

// --- Notifications API ---

export const fetchNotifications = async (userId: string, token: string, status: 'read' | 'unread' | 'all' = 'unread'): Promise<ModrinthNotification[]> => {
  // Add timestamp to prevent caching
  const response = await fetch(`${BASE_URL}/user/${userId}/notifications?status=${status}&_t=${Date.now()}`, {
    headers: getHeaders(token)
  });
  if (!response.ok) throw new Error('Failed to fetch notifications');
  return response.json();
};

export const markNotificationRead = async (notifId: string, token: string) => {
  // Using PATCH to update the 'read' status on the notification object
  const response = await fetch(`${BASE_URL}/notification/${notifId}`, {
    method: 'PATCH',
    headers: getHeaders(token),
    body: JSON.stringify({ read: true })
  });
  if (!response.ok) throw new Error('Failed to read notification');
};

export const markMultipleNotificationsRead = async (notifIds: string[], token: string) => {
  if (notifIds.length === 0) return;
  // Fallback to parallel single requests since the bulk endpoint is flaky or non-standard
  await Promise.all(notifIds.map(id => markNotificationRead(id, token)));
};

export const deleteNotification = async (notifId: string, token: string) => {
    const response = await fetch(`${BASE_URL}/notification/${notifId}`, {
        method: 'DELETE',
        headers: getHeaders(token)
    });
    // If 404, it's already deleted, which is fine
    if (!response.ok && response.status !== 404) throw new Error('Failed to delete notification');
};
