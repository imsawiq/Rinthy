 import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Check,
  Download,
  Edit3,
  ExternalLink,
  Heart,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  ChevronDown,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  addTeamMember,
  createOrganization,
  createProject,
  deleteOrganization,
  deleteTeamMember,
  fetchOrganization,
  fetchOrganizationProjects,
  fetchTeamMembers,
  fetchUserOrganizations,
  fetchUserProjects,
  joinTeam,
  removeProjectFromOrganization,
  searchUser,
  transferTeamOwnership,
  transferProjectToOrganization,
  updateOrganization,
  updateTeamMember,
} from '../services/modrinthService';
import type { ModrinthOrganization, ModrinthProject, ModrinthUser, ProjectMember, UserSearchResult } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import type { MemberEdit } from './project-detail/ProjectDetailTabs';
import AppSelect from '../components/AppSelect';
import { showToast } from '../utils/toast';
import { useBackDismiss } from '../hooks/useBackDismiss';

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

type TeamKind = 'organization' | 'project';

interface TeamOverview {
  key: string;
  kind: TeamKind;
  teamId: string;
  title: string;
  subtitle?: string;
  iconUrl?: string | null;
  organization?: ModrinthOrganization;
  projects: ModrinthProject[];
  members: ProjectMember[];
  searchText: string;
}

const getProjectOrganizationKey = (project: ModrinthProject) =>
  project.organization_id || project.organization || null;

const getProjectTitle = (project: ModrinthProject) =>
  project.title || project.name || project.slug || project.id;

const getProjectDescription = (project: ModrinthProject) =>
  project.description || '';

const getActionErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
};

const compareProjectTitle = (a: ModrinthProject, b: ModrinthProject) =>
  getProjectTitle(a).localeCompare(getProjectTitle(b));

const getAcceptedMembers = (members: ProjectMember[]) => members.filter((member) => member.accepted);

const getPendingMembers = (members: ProjectMember[]) => members.filter((member) => !member.accepted);

const isOwnerMember = (member: ProjectMember | undefined) =>
  member?.is_owner || member?.role === 'Owner';

const hasTeamPermission = (member: ProjectMember | undefined, bit: number) =>
  isOwnerMember(member) || !!((member?.permissions || 0) & (1 << bit));

const hasOrganizationPermission = (member: ProjectMember | undefined, bit: number) =>
  isOwnerMember(member) || !!((member?.organization_permissions || 0) & (1 << bit));

const makeEditKey = (teamId: string, userId: string) => `${teamId}:${userId}`;

const slugifyOrganizationName = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

const uniqueByUserId = (members: ProjectMember[]) => {
  const map = new Map<string, ProjectMember>();
  members.forEach((member) => {
    if (!map.has(member.user.id)) map.set(member.user.id, member);
  });
  return Array.from(map.values());
};

const TeamsPage: React.FC<{ user: ModrinthUser; token: string }> = ({ user, token }) => {
  const [teams, setTeams] = useState<TeamOverview[]>([]);
  const [allProjects, setAllProjects] = useState<ModrinthProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [inviteTeam, setInviteTeam] = useState<TeamOverview | null>(null);
  const [organizationSheet, setOrganizationSheet] = useState<{ mode: 'create' } | { mode: 'edit'; team: TeamOverview } | null>(null);
  const [projectSheet, setProjectSheet] = useState<{ organization?: ModrinthOrganization } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ title: string; text: string; actionLabel: string; onConfirm: () => Promise<void> } | null>(null);
  const [expandedTeamKeys, setExpandedTeamKeys] = useState<Set<string>>(new Set());
  const [transferProjectSheet, setTransferProjectSheet] = useState<TeamOverview | null>(null);
  const [memberEdits, setMemberEdits] = useState<Record<string, MemberEdit>>({});
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const { t, theme } = useSettings();
  const navigate = useNavigate();
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

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
    { bit: 9, label: t('perm_view_payouts') },
  ]), [t]);

  const organizationPermissionDefs = useMemo(() => ([
    { bit: 0, label: t('org_perm_edit_details') },
    { bit: 1, label: t('org_perm_manage_invites') },
    { bit: 2, label: t('org_perm_remove_member') },
    { bit: 3, label: t('org_perm_edit_member') },
    { bit: 4, label: t('org_perm_add_project') },
    { bit: 5, label: t('org_perm_remove_project') },
    { bit: 6, label: t('org_perm_delete_organization') },
    { bit: 7, label: t('org_perm_edit_default_permissions') },
  ]), [t]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadTeams = useCallback(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const run = async () => {
      setLoading(true);
      try {
        const projects = await fetchUserProjects(user.id, token);
        const userOrganizations = await fetchUserOrganizations(user.id, token);
        const organizationKeys = Array.from(new Set(projects.map(getProjectOrganizationKey).filter(Boolean))) as string[];
        const organizationResults = await Promise.all(
          organizationKeys.map(async (key) => {
            try {
              return await fetchOrganization(key, token);
            } catch {
              return null;
            }
          })
        );
        const organizationsById = new Map<string, ModrinthOrganization>();
        [...userOrganizations, ...(organizationResults.filter(Boolean) as ModrinthOrganization[])].forEach((organization) => {
          organizationsById.set(organization.id, organization);
        });
        const organizations = Array.from(organizationsById.values());

        const teamIds = new Set<string>();
        projects.forEach((project) => {
          if (project.team) teamIds.add(project.team);
        });
        organizations.forEach((organization) => {
          if (organization.team_id) teamIds.add(organization.team_id);
        });

        const memberEntries = await Promise.all(
          Array.from(teamIds).map(async (teamId) => {
            try {
              const members = await fetchTeamMembers(teamId, token);
              return [teamId, members] as const;
            } catch {
              return [teamId, [] as ProjectMember[]] as const;
            }
          })
        );
        const membersByTeam = new Map<string, ProjectMember[]>(memberEntries);

        const organizationProjectEntries = await Promise.all(
          organizations.map(async (organization) => {
            const localProjects = projects.filter((project) => {
              const organizationKey = getProjectOrganizationKey(project);
              return organizationKey === organization.id || organizationKey === organization.slug;
            });

            try {
              const remoteProjects = await fetchOrganizationProjects(organization.id, token);
              const merged = new Map<string, ModrinthProject>();
              [...localProjects, ...remoteProjects].forEach((project) => merged.set(project.id, project));
              return [organization.id, Array.from(merged.values())] as const;
            } catch {
              return [organization.id, localProjects] as const;
            }
          })
        );
        const projectsByOrganization = new Map<string, ModrinthProject[]>(organizationProjectEntries);

        const organizationTeams = organizations.map((organization): TeamOverview => {
          const organizationProjects = projectsByOrganization.get(organization.id) || projects.filter((project) => {
            const organizationKey = getProjectOrganizationKey(project);
            return organizationKey === organization.id || organizationKey === organization.slug;
          });

          return {
            key: `organization:${organization.id}`,
            kind: 'organization',
            teamId: organization.team_id,
            title: organization.name,
            subtitle: organization.description || '',
            iconUrl: organization.icon_url,
            organization,
            projects: organizationProjects,
            members: membersByTeam.get(organization.team_id) || [],
            searchText: [
              organization.name,
              organization.slug,
              organization.description || '',
              ...organizationProjects.map((project) => `${getProjectTitle(project)} ${project.slug || ''}`),
              ...(membersByTeam.get(organization.team_id) || []).map((member) => member.user.username),
            ].join(' ').toLowerCase(),
          };
        });

        const organizationProjectIds = new Set(
          organizationTeams.flatMap((team) => team.projects.map((project) => project.id))
        );
        const standaloneProjects = projects.filter((project) => !organizationProjectIds.has(project.id));
        const projectsByTeam = new Map<string, ModrinthProject[]>();

        standaloneProjects.forEach((project) => {
          const current = projectsByTeam.get(project.team) || [];
          current.push(project);
          projectsByTeam.set(project.team, current);
        });

        const projectTeams = Array.from(projectsByTeam.entries())
          .map(([teamId, teamProjects]): TeamOverview => {
            const primaryProject = teamProjects[0];
            return {
              key: `project:${teamId}`,
              kind: 'project',
              teamId,
              title: getProjectTitle(primaryProject),
              subtitle: getProjectDescription(primaryProject),
              iconUrl: primaryProject.icon_url,
              projects: teamProjects,
              members: membersByTeam.get(teamId) || [],
              searchText: [
                getProjectTitle(primaryProject),
                primaryProject.slug || '',
                getProjectDescription(primaryProject),
                ...teamProjects.map((project) => `${getProjectTitle(project)} ${project.slug || ''}`),
                ...(membersByTeam.get(teamId) || []).map((member) => member.user.username),
              ].join(' ').toLowerCase(),
            };
          })
          .filter((team) => team.members.some((member) => member.user.id !== user.id));

        if (isMountedRef.current && requestIdRef.current === requestId) {
          const allProjectsById = new Map<string, ModrinthProject>();
          [
            ...projects,
            ...Array.from(projectsByOrganization.values()).flat(),
          ].forEach((project) => allProjectsById.set(project.id, project));
          setAllProjects(Array.from(allProjectsById.values()).sort(compareProjectTitle));
          setTeams([...organizationTeams, ...projectTeams].sort((a, b) => {
            if (a.kind !== b.kind) return a.kind === 'organization' ? -1 : 1;
            return a.title.localeCompare(b.title);
          }));
        }
      } catch (error) {
        console.error(error);
        if (isMountedRef.current && requestIdRef.current === requestId) {
          setAllProjects([]);
          setTeams([]);
        }
      } finally {
        if (isMountedRef.current && requestIdRef.current === requestId) setLoading(false);
      }
    };

    run();
  }, [token, user.id]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  const visibleTeams = useMemo(() => {
    const normalizedQuery = debouncedQuery.trim().toLowerCase();
    if (!normalizedQuery) return teams;

    return teams.filter((team) => team.searchText.includes(normalizedQuery));
  }, [debouncedQuery, teams]);

  const stats = useMemo(() => {
    const allProjects = teams.flatMap((team) => team.projects);
    const allMembers = uniqueByUserId(teams.flatMap((team) => team.members));

    return {
      organizations: teams.filter((team) => team.kind === 'organization').length,
      teams: teams.length,
      members: allMembers.length,
      downloads: allProjects.reduce((sum, project) => sum + project.downloads, 0),
    };
  }, [teams]);

  const reloadAfterAction = async () => {
    loadTeams();
  };

  const requestConfirm = (title: string, text: string, actionLabel: string, onConfirm: () => Promise<void>) => {
    setConfirmAction({ title, text, actionLabel, onConfirm });
  };

  const handleInvite = async (team: TeamOverview, userId: string) => {
    try {
      await addTeamMember(team.teamId, userId, token);
      setInviteTeam(null);
      await reloadAfterAction();
      showToast(t('saved'));
    } catch (error: any) {
      showToast(error?.message || 'Failed to invite member', 'error');
    }
  };

  const handleJoin = async (team: TeamOverview) => {
    try {
      await joinTeam(team.teamId, token);
      await reloadAfterAction();
      showToast(t('saved'));
    } catch (error: any) {
      showToast(error?.message || 'Failed to join team', 'error');
    }
  };

  const handleLeave = async (team: TeamOverview) => {
    requestConfirm(
      t(team.kind === 'organization' ? 'leave_organization' : 'leave_team'),
      t(team.kind === 'organization' ? 'leave_organization_confirm' : 'leave_team_confirm'),
      t(team.kind === 'organization' ? 'leave_organization' : 'leave_team'),
      async () => {
        try {
          await deleteTeamMember(team.teamId, user.id, token);
          await reloadAfterAction();
          showToast(t('saved'));
        } catch (error: any) {
          showToast(error?.message || 'Failed to leave team', 'error');
        }
      }
    );
  };

  const handleRemoveMember = async (team: TeamOverview, member: ProjectMember) => {
    requestConfirm(t('remove'), t('member_remove_confirm'), t('remove'), async () => {
      try {
        await deleteTeamMember(team.teamId, member.user.id, token);
        await reloadAfterAction();
        showToast(t('saved'));
      } catch (error: any) {
        showToast(error?.message || 'Failed to remove member', 'error');
      }
    });
  };

  const handleSaveMember = async (team: TeamOverview, member: ProjectMember) => {
    const edit = memberEdits[makeEditKey(team.teamId, member.user.id)];
    if (!edit) return;

    const payload: { role?: string; permissions?: number; organization_permissions?: number; payouts_split?: number; ordering?: number } = {};
    if (edit.role.trim()) payload.role = edit.role.trim();

    const permissions = edit.permissions !== '' ? Number(edit.permissions) : null;
    const organizationPermissions = edit.organization_permissions !== undefined && edit.organization_permissions !== '' ? Number(edit.organization_permissions) : null;
    const payoutsSplit = edit.payouts_split !== '' ? Number(edit.payouts_split) : null;
    const ordering = edit.ordering !== '' ? Number(edit.ordering) : null;
    if (permissions !== null && !Number.isNaN(permissions)) payload.permissions = permissions;
    if (organizationPermissions !== null && !Number.isNaN(organizationPermissions)) payload.organization_permissions = organizationPermissions;
    if (payoutsSplit !== null && !Number.isNaN(payoutsSplit)) payload.payouts_split = payoutsSplit;
    if (ordering !== null && !Number.isNaN(ordering)) payload.ordering = ordering;

    setSavingMemberId(makeEditKey(team.teamId, member.user.id));
    try {
      await updateTeamMember(team.teamId, member.user.id, payload, token);
      await reloadAfterAction();
      showToast(t('saved'));
    } catch (error: any) {
      showToast(error?.message || 'Failed to update member', 'error');
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleTransferOwnership = async (team: TeamOverview, member: ProjectMember) => {
    requestConfirm(t('transfer_owner_title'), `${t('transfer_owner_desc')} ${member.user.username}`, t('transfer_owner_confirm'), async () => {
      try {
        await transferTeamOwnership(team.teamId, member.user.id, token);
        await reloadAfterAction();
        showToast(t('saved'));
      } catch (error: any) {
        showToast(error?.message || 'Failed to transfer ownership', 'error');
      }
    });
  };

  const handleSaveOrganization = async (data: { slug: string; name: string; description: string }) => {
    try {
      if (organizationSheet?.mode === 'edit') {
        const organizationKey = organizationSheet.team.organization?.id || organizationSheet.team.organization?.slug;
        if (!organizationKey) return;
        await updateOrganization(organizationKey, {
          name: data.name,
          slug: data.slug,
          description: data.description,
        }, token);
      } else {
        await createOrganization({
          name: data.name,
          slug: data.slug,
          description: data.description,
        }, token);
      }
      setOrganizationSheet(null);
      await reloadAfterAction();
      showToast(t('saved'));
    } catch (error: any) {
      showToast(error?.message || 'Failed to save organization', 'error');
    }
  };

  const handleDeleteOrganization = async (team: TeamOverview) => {
    const organizationKey = team.organization?.id || team.organization?.slug;
    if (!organizationKey) return;
    requestConfirm(t('delete_organization'), t('delete_organization_confirm'), t('delete_organization'), async () => {
      try {
        await deleteOrganization(organizationKey, token);
        await reloadAfterAction();
        showToast(t('saved'));
      } catch (error: any) {
        showToast(error?.message || 'Failed to delete organization', 'error');
      }
    });
  };

  const handleTransferProject = async (project: ModrinthProject, organization: ModrinthOrganization | null) => {
    try {
      await transferProjectToOrganization(project.id, organization?.id || null, token);
      setTransferProjectSheet(null);
      await reloadAfterAction();
      showToast(t('saved'));
    } catch (error: any) {
      showToast(error?.message || t('transfer_project_unavailable'), 'error');
    }
  };

  const handleRemoveProjectFromOrganization = async (team: TeamOverview, project: ModrinthProject) => {
    const organizationId = team.organization?.id;
    if (!organizationId) return;
    requestConfirm(t('remove_from_organization'), t('remove_from_organization_confirm'), t('remove'), async () => {
      try {
        await removeProjectFromOrganization(organizationId, project.id, user.id, token);
        await reloadAfterAction();
        showToast(t('saved'));
      } catch (error: any) {
        showToast(error?.message || 'Failed to remove project from organization', 'error');
      }
    });
  };

  const handleOpenTransferProjects = async (team: TeamOverview) => {
    if (allProjects.length === 0) {
      try {
        const projects = await fetchUserProjects(user.id, token);
        if (isMountedRef.current) {
          setAllProjects(projects.sort(compareProjectTitle));
        }
      } catch {
        // The sheet still opens and explains that there are no projects available.
      }
    }
    setTransferProjectSheet(team);
  };

  const handleCreateProject = async (data: {
    title: string;
    slug: string;
    description: string;
    body: string;
    project_type: string;
    categories: string[];
    client_side: 'required' | 'optional' | 'unsupported';
    server_side: 'required' | 'optional' | 'unsupported';
    license_id: string;
    organization_id?: string;
    icon?: File | null;
  }) => {
    await createProject(data, token);
    setProjectSheet(null);
    await reloadAfterAction();
    showToast(t('saved'));
  };

  const toggleExpanded = (key: string) => {
    setExpandedTeamKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="px-4 pb-24 animate-fade-in">
      <header className="app-topbar sticky top-0 z-50 -mx-4 mb-5 flex min-h-[82px] items-center justify-between overflow-hidden px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.85rem)] transition-colors duration-300">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-none text-modrinth-text">{t('teams')}</h1>
          <p className="mt-1 text-xs font-medium text-modrinth-muted">{t('teams_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOrganizationSheet({ mode: 'create' })}
            className="app-primary flex h-10 w-10 items-center justify-center transition-transform active:scale-95"
            aria-label={t('create_organization')}
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            onClick={() => loadTeams()}
            disabled={loading}
            className="app-command flex h-10 w-10 items-center justify-center transition-transform active:scale-95 disabled:opacity-60"
            aria-label="Refresh teams"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <TeamStat icon={<Building2 size={18} />} label={t('organizations_label')} value={stats.organizations.toLocaleString()} />
        <TeamStat icon={<Users size={18} />} label={t('other_project_teams')} value={(stats.teams - stats.organizations).toLocaleString()} />
        <TeamStat icon={<Check size={18} />} label={t('members')} value={stats.members.toLocaleString()} />
        <TeamStat icon={<Download size={18} />} label={t('downloads')} value={stats.downloads.toLocaleString()} />
      </div>

      <div className="app-panel-soft mb-4 flex items-center gap-2 px-3 py-2.5">
        <Search size={17} className="shrink-0 text-modrinth-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('search_teams')}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-modrinth-text outline-none placeholder:text-modrinth-muted"
        />
      </div>

      {loading ? (
        <div className="flex justify-center pt-32">
          <Loader2 className="h-10 w-10 animate-spin text-modrinth-green" />
        </div>
      ) : visibleTeams.length === 0 ? (
        <div className="py-28 text-center text-modrinth-muted">
          <div className="app-panel mb-4 inline-flex h-16 w-16 items-center justify-center">
            <Building2 size={30} />
          </div>
          <p className="text-base font-bold text-modrinth-text">{t('no_teams')}</p>
          <p className="mx-auto mt-2 max-w-[18rem] text-sm leading-relaxed">{t('no_teams_desc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleTeams.map((team, index) => (
            <TeamCard
              key={team.key}
              currentUserId={user.id}
              index={index}
              memberEdits={memberEdits}
              permissionDefs={permissionDefs}
              organizationPermissionDefs={organizationPermissionDefs}
              savingMemberId={savingMemberId}
              team={team}
              theme={theme}
              isExpanded={expandedTeamKeys.has(team.key)}
              onToggleExpanded={() => toggleExpanded(team.key)}
              onInvite={() => setInviteTeam(team)}
              onEditOrganization={() => setOrganizationSheet({ mode: 'edit', team })}
              onDeleteOrganization={() => handleDeleteOrganization(team)}
              onOpenTransferProjects={() => handleOpenTransferProjects(team)}
              onCreateProject={() => setProjectSheet({ organization: team.organization })}
              onJoin={() => handleJoin(team)}
              onLeave={() => handleLeave(team)}
              onOpenProject={(project) => navigate(`/project/${project.slug || project.id}`)}
              onRemoveProjectFromOrganization={(project) => handleRemoveProjectFromOrganization(team, project)}
              onRemoveMember={(member) => handleRemoveMember(team, member)}
              onSaveMember={(member) => handleSaveMember(team, member)}
              onSetMemberEdits={setMemberEdits}
              onTransferOwnership={(member) => handleTransferOwnership(team, member)}
              t={t}
            />
          ))}
        </div>
      )}

      <InviteMemberSheet
        isOpen={!!inviteTeam}
        onClose={() => setInviteTeam(null)}
        onInvite={(userId) => inviteTeam ? handleInvite(inviteTeam, userId) : Promise.resolve()}
      />
      <OrganizationSheet
        isOpen={!!organizationSheet}
        mode={organizationSheet?.mode || 'create'}
        organization={organizationSheet?.mode === 'edit' ? organizationSheet.team.organization : undefined}
        onClose={() => setOrganizationSheet(null)}
        onSave={handleSaveOrganization}
      />
      <CreateProjectSheet
        isOpen={!!projectSheet}
        organizations={teams.map((team) => team.organization).filter(Boolean) as ModrinthOrganization[]}
        defaultOrganization={projectSheet?.organization}
        onClose={() => setProjectSheet(null)}
        onSave={handleCreateProject}
      />
      <TransferProjectSheet
        isOpen={!!transferProjectSheet}
        projects={allProjects}
        organizations={teams.map((team) => team.organization).filter(Boolean) as ModrinthOrganization[]}
        currentOrganization={transferProjectSheet?.organization}
        onClose={() => setTransferProjectSheet(null)}
        onTransfer={handleTransferProject}
      />
      <ConfirmSheet
        actionLabel={confirmAction?.actionLabel || ''}
        isOpen={!!confirmAction}
        text={confirmAction?.text || ''}
        title={confirmAction?.title || ''}
        onClose={() => setConfirmAction(null)}
        onConfirm={async () => {
          const action = confirmAction?.onConfirm;
          setConfirmAction(null);
          if (action) await action();
        }}
      />
    </div>
  );
};

const TeamStat: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="app-panel-soft p-3">
    <div className="flex items-center gap-2 text-modrinth-green">{icon}</div>
    <div className="mt-3 text-xl font-black leading-none text-modrinth-text">{value}</div>
    <div className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-modrinth-muted">{label}</div>
  </div>
);

type TeamCardProps = {
  currentUserId: string;
  index: number;
  memberEdits: Record<string, MemberEdit>;
  permissionDefs: Array<{ bit: number; label: string }>;
  organizationPermissionDefs: Array<{ bit: number; label: string }>;
  savingMemberId: string | null;
  team: TeamOverview;
  theme: string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onInvite: () => void;
  onEditOrganization: () => void;
  onDeleteOrganization: () => void;
  onOpenTransferProjects: () => void;
  onCreateProject: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onOpenProject: (project: ModrinthProject) => void;
  onRemoveProjectFromOrganization: (project: ModrinthProject) => void;
  onRemoveMember: (member: ProjectMember) => void;
  onSaveMember: (member: ProjectMember) => void;
  onSetMemberEdits: React.Dispatch<React.SetStateAction<Record<string, MemberEdit>>>;
  onTransferOwnership: (member: ProjectMember) => void;
  t: (key: string) => string;
};

const TeamCardBase: React.FC<TeamCardProps> = ({ currentUserId, index, memberEdits, permissionDefs, organizationPermissionDefs, savingMemberId, team, theme, isExpanded, onToggleExpanded, onInvite, onEditOrganization, onDeleteOrganization, onOpenTransferProjects, onCreateProject, onJoin, onLeave, onOpenProject, onRemoveProjectFromOrganization, onRemoveMember, onSaveMember, onSetMemberEdits, onTransferOwnership, t }) => {
  const acceptedMembers = getAcceptedMembers(team.members);
  const pendingMembers = getPendingMembers(team.members);
  const downloads = team.projects.reduce((sum, project) => sum + project.downloads, 0);
  const followers = team.projects.reduce((sum, project) => sum + project.followers, 0);
  const currentMember = team.members.find((member) => member.user.id === currentUserId);
  const canInvite = team.kind === 'organization' ? hasOrganizationPermission(currentMember, 1) : hasTeamPermission(currentMember, 4);
  const canRemove = team.kind === 'organization' ? hasOrganizationPermission(currentMember, 2) : hasTeamPermission(currentMember, 5);
  const canEdit = team.kind === 'organization' ? hasOrganizationPermission(currentMember, 3) : hasTeamPermission(currentMember, 6);
  const canEditOrganization = team.kind === 'organization' && hasOrganizationPermission(currentMember, 0);
  const canCreateOrganizationProject = team.kind === 'organization' && hasOrganizationPermission(currentMember, 4);
  const canRemoveOrganizationProject = team.kind === 'organization' && hasOrganizationPermission(currentMember, 5);
  const canDeleteOrganization = team.kind === 'organization' && hasOrganizationPermission(currentMember, 6);
  const canLeave = !!currentMember && !isOwnerMember(currentMember);
  const canAcceptInvite = !!currentMember && !currentMember.accepted;
  const titleKind = team.kind === 'organization' ? t('organization') : t('team');
  const visibleProjects = isExpanded ? team.projects.slice(0, 12) : [];

  return (
    <article className="app-panel overflow-hidden p-4 animate-fade-in-up" style={{ animationDelay: `${index * 0.035}s` }}>
      <button type="button" onClick={onToggleExpanded} className="flex w-full items-start gap-3 text-left">
        <div className="app-icon-tile flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden">
          {team.iconUrl ? (
            <img src={team.iconUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
          ) : team.kind === 'organization' ? (
            <Building2 size={25} className="text-modrinth-green" />
          ) : (
            <Package size={25} className="text-modrinth-green" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="min-w-0 truncate text-lg font-black text-modrinth-text">{team.title}</h2>
            <span className="shrink-0 rounded-md bg-modrinth-green/12 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-modrinth-green">
              {titleKind}
            </span>
            {currentMember && (
              <span className="shrink-0 rounded-md bg-modrinth-bg px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-modrinth-muted">
                {currentMember.accepted ? currentMember.role : t('pending')}
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-modrinth-muted">
            {team.subtitle || (team.kind === 'organization' ? t('organization') : t('project_team_hint'))}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
        {team.organization?.slug && (
          <a
            href={`https://modrinth.com/organization/${team.organization.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="app-command flex h-9 w-9 shrink-0 items-center justify-center"
            aria-label={t('open_organization')}
          >
            <ExternalLink size={16} />
          </a>
        )}
          <span className="app-command flex h-9 w-9 items-center justify-center">
            <ChevronDown size={16} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </span>
        </div>
      </button>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniMetric icon={<Package size={14} />} label={t('projects_label')} value={team.projects.length.toLocaleString()} />
        <MiniMetric icon={<Users size={14} />} label={t('members')} value={acceptedMembers.length.toLocaleString()} />
        <MiniMetric icon={<Download size={14} />} label={t('downloads')} value={downloads.toLocaleString()} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <MiniMetric icon={<Heart size={14} />} label={t('likes')} value={followers.toLocaleString()} />
        <MiniMetric icon={<Users size={14} />} label={t('pending_invites')} value={pendingMembers.length.toLocaleString()} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {canAcceptInvite && (
          <button type="button" onClick={onJoin} className="app-primary inline-flex items-center gap-2 px-3 py-2 text-xs">
            <Check size={14} />
            {t('accept_invite')}
          </button>
        )}
        {canInvite && (
          <button type="button" onClick={onInvite} className="app-command inline-flex items-center gap-2 px-3 py-2 text-xs font-extrabold">
            <UserPlus size={14} />
            {t('invite')}
          </button>
        )}
        {team.kind === 'organization' && (canEditOrganization || canCreateOrganizationProject || canDeleteOrganization || isOwnerMember(currentMember)) && (
          <>
            {canEditOrganization && (
              <button type="button" onClick={onEditOrganization} className="app-command inline-flex items-center gap-2 px-3 py-2 text-xs font-extrabold">
                <Edit3 size={14} />
                {t('edit')}
              </button>
            )}
            {canDeleteOrganization && (
              <button type="button" onClick={onDeleteOrganization} className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-extrabold text-red-400 transition-colors hover:bg-red-500/15">
                {t('delete_organization')}
              </button>
            )}
            {canCreateOrganizationProject && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenTransferProjects();
                }}
                className="app-command inline-flex items-center gap-2 px-3 py-2 text-xs font-extrabold"
              >
                {t('transfer_projects')}
              </button>
            )}
            {canCreateOrganizationProject && (
              <button type="button" onClick={onCreateProject} className="app-command inline-flex items-center gap-2 px-3 py-2 text-xs font-extrabold">
                <Plus size={14} />
                {t('create_project_action')}
              </button>
            )}
          </>
        )}
        {canLeave && (
          <button type="button" onClick={onLeave} className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-extrabold text-red-400 transition-colors hover:bg-red-500/15">
            {t(team.kind === 'organization' ? 'leave_organization' : 'leave_team')}
          </button>
        )}
      </div>

      <div className={`grid transition-[grid-template-rows,opacity] duration-[260ms] ease-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="min-h-0 overflow-hidden">
      {isExpanded && team.projects.length > 0 && (
        <section className="mt-4">
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-modrinth-muted">{t('organization_projects')}</div>
          <div className="space-y-2">
            {visibleProjects.map((project) => (
              <div key={project.id} className="app-panel-soft flex w-full items-center gap-2 p-2 transition-transform active:scale-[0.99]">
                <button
                  type="button"
                  onClick={() => onOpenProject(project)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-modrinth-bg">
                    {project.icon_url ? (
                      <img src={project.icon_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <Package size={17} className="text-modrinth-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-modrinth-text">{getProjectTitle(project)}</div>
                    <div className="truncate text-xs text-modrinth-muted">{getProjectDescription(project)}</div>
                  </div>
                  <ExternalLink size={15} className="shrink-0 text-modrinth-green" />
                </button>
                {team.kind === 'organization' && canRemoveOrganizationProject && (
                  <button
                    type="button"
                    onClick={() => onRemoveProjectFromOrganization(project)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/15"
                    aria-label={t('remove_from_organization')}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
            {team.projects.length > visibleProjects.length && (
              <div className="app-panel-soft px-3 py-2 text-xs font-bold text-modrinth-muted">
                +{team.projects.length - visibleProjects.length}
              </div>
            )}
          </div>
        </section>
      )}

      {isExpanded && (
      <section className="mt-4">
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-modrinth-muted">{t('organization_members')}</div>
        <div className="space-y-2">
          {team.members.map((member) => {
            const editKey = makeEditKey(team.teamId, member.user.id);
            const edit = memberEdits[editKey] || { role: member.role || '', permissions: '', organization_permissions: '', payouts_split: '', ordering: '' };
            const permissionsValue = edit.permissions !== '' ? Number(edit.permissions) : (member.permissions || 0);
            const organizationPermissionsValue = edit.organization_permissions !== undefined && edit.organization_permissions !== '' ? Number(edit.organization_permissions) : (member.organization_permissions || 0);
            const isOwner = isOwnerMember(member);
            const isSelf = member.user.id === currentUserId;
            const canManageThisMember = !isOwner && (canEdit || canRemove || isOwnerMember(currentMember));

            return (
              <div key={editKey} className="app-panel-soft space-y-3 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-modrinth-bg ring-2 ${
                    theme === 'light' ? 'ring-white' : 'ring-modrinth-card'
                  }`}>
                    {member.user.avatar_url ? (
                      <img src={member.user.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <Users size={16} className="m-3 text-modrinth-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-modrinth-text">{member.user.username}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-modrinth-muted">
                      <span>{member.role}</span>
                      <span>{member.accepted ? t('accepted') : t('pending')}</span>
                    </div>
                  </div>
                  {isOwner && <ShieldCheck size={18} className="shrink-0 text-modrinth-green" />}
                  {canRemove && !isOwner && !isSelf && (
                    <button type="button" onClick={() => onRemoveMember(member)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                {canManageThisMember && (
                  <div className="space-y-3">
                    <input
                      value={edit.role}
                      onChange={(event) => onSetMemberEdits((prev) => ({
                        ...prev,
                        [editKey]: { ...(prev[editKey] || edit), role: event.target.value },
                      }))}
                      className="app-input"
                      placeholder={t('custom_role_placeholder')}
                    />

                    {canEdit && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={edit.payouts_split}
                            onChange={(event) => onSetMemberEdits((prev) => ({
                              ...prev,
                              [editKey]: { ...(prev[editKey] || edit), payouts_split: event.target.value },
                            }))}
                            className="app-input"
                            placeholder={t('payouts_split_label')}
                          />
                          <input
                            value={edit.ordering}
                            onChange={(event) => onSetMemberEdits((prev) => ({
                              ...prev,
                              [editKey]: { ...(prev[editKey] || edit), ordering: event.target.value },
                            }))}
                            className="app-input"
                            placeholder={t('ordering_label')}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="col-span-full text-[10px] font-black uppercase tracking-[0.14em] text-modrinth-muted">{t('project_permissions')}</div>
                          {permissionDefs.map((permission) => {
                            const isOn = !!(permissionsValue & (1 << permission.bit));
                            return (
                              <button
                                key={permission.bit}
                                type="button"
                                onClick={() => {
                                  const nextValue = isOn ? (permissionsValue & ~(1 << permission.bit)) : (permissionsValue | (1 << permission.bit));
                                  onSetMemberEdits((prev) => ({
                                    ...prev,
                                    [editKey]: { ...(prev[editKey] || edit), permissions: String(nextValue) },
                                  }));
                                }}
                                style={isOn ? { borderColor: 'var(--accent-color)', backgroundColor: 'color-mix(in srgb, var(--accent-color) 16%, transparent)' } : undefined}
                                className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-[11px] font-extrabold transition-colors ${isOn ? 'text-modrinth-text' : 'border-modrinth-border bg-modrinth-bg text-modrinth-muted hover:border-modrinth-green'}`}
                              >
                                {isOn ? <Check size={13} className="shrink-0" /> : <span className="h-[13px] w-[13px] shrink-0" />}
                                <span className="min-w-0 truncate">{permission.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        {team.kind === 'organization' && (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="col-span-full text-[10px] font-black uppercase tracking-[0.14em] text-modrinth-muted">{t('organization_permissions')}</div>
                            {organizationPermissionDefs.map((permission) => {
                              const isOn = !!(organizationPermissionsValue & (1 << permission.bit));
                              return (
                                <button
                                  key={`org-${permission.bit}`}
                                  type="button"
                                  onClick={() => {
                                    const nextValue = isOn ? (organizationPermissionsValue & ~(1 << permission.bit)) : (organizationPermissionsValue | (1 << permission.bit));
                                    onSetMemberEdits((prev) => ({
                                      ...prev,
                                      [editKey]: { ...(prev[editKey] || edit), organization_permissions: String(nextValue) },
                                    }));
                                  }}
                                  style={isOn ? { borderColor: 'var(--accent-color)', backgroundColor: 'color-mix(in srgb, var(--accent-color) 16%, transparent)' } : undefined}
                                  className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-[11px] font-extrabold transition-colors ${isOn ? 'text-modrinth-text' : 'border-modrinth-border bg-modrinth-bg text-modrinth-muted hover:border-modrinth-green'}`}
                                >
                                  {isOn ? <Check size={13} className="shrink-0" /> : <span className="h-[13px] w-[13px] shrink-0" />}
                                  <span className="min-w-0 truncate">{permission.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => onSaveMember(member)}
                      disabled={savingMemberId === editKey}
                      className="app-primary flex w-full items-center justify-center gap-2 px-3 py-3 text-sm disabled:opacity-60"
                      aria-label={t('save')}
                    >
                      {savingMemberId === editKey ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      {t('save')}
                    </button>

                    {isOwnerMember(currentMember) && (
                      <button type="button" onClick={() => onTransferOwnership(member)} className="app-command w-full px-3 py-2 text-xs font-extrabold">
                        {t('transfer_owner')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      )}
        </div>
      </div>
    </article>
  );
};

const TeamCard = React.memo(TeamCardBase, (prev, next) =>
  prev.currentUserId === next.currentUserId &&
  prev.index === next.index &&
  prev.isExpanded === next.isExpanded &&
  prev.memberEdits === next.memberEdits &&
  prev.permissionDefs === next.permissionDefs &&
  prev.organizationPermissionDefs === next.organizationPermissionDefs &&
  prev.savingMemberId === next.savingMemberId &&
  prev.team === next.team &&
  prev.theme === next.theme &&
  prev.t === next.t
);

const MiniMetric: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="app-panel-soft min-w-0 p-2">
    <div className="flex items-center gap-1.5 text-modrinth-green">{icon}</div>
    <div className="mt-2 truncate text-sm font-black text-modrinth-text">{value}</div>
    <div className="truncate text-[9px] font-extrabold uppercase tracking-[0.12em] text-modrinth-muted">{label}</div>
  </div>
);

const InviteMemberSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onInvite: (userId: string) => Promise<void>;
}> = ({ isOpen, onClose, onInvite }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const { t } = useSettings();
  const { visible, closing, requestClose } = useAnimatedDismiss(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setInvitingUserId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const users = await searchUser(query.trim());
        if (!cancelled) setResults(users);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  if (!visible) return null;

  const invite = async (userId: string) => {
    setInvitingUserId(userId);
    try {
      await onInvite(userId);
    } finally {
      setInvitingUserId(null);
    }
  };

  return (
    <div data-closing={closing ? 'true' : undefined} className="app-overlay fixed inset-0 z-[250] flex items-end justify-center bg-black/65 p-4 sm:items-center" onClick={requestClose}>
      <div className="app-panel app-responsive-sheet relative w-full max-w-sm overflow-y-auto p-5" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-modrinth-text">{t('invite')}</h3>
          <button type="button" onClick={requestClose} className="app-close-button p-2">
            <X size={18} />
          </button>
        </div>

        <div className="relative mb-4">
          <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-11 items-center justify-center text-modrinth-muted">
            <Search size={16} />
          </span>
          <input
            autoFocus
            type="text"
            placeholder={t('search_user')}
            className="app-input"
            style={{ paddingLeft: '2.75rem' }}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {searching && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-modrinth-green" /></div>}
          {!searching && results.map((result) => (
            <button
              key={result.user_id}
              type="button"
              onClick={() => invite(result.user_id)}
              className="app-panel-soft flex w-full items-center justify-between gap-3 p-2 text-left"
              disabled={invitingUserId === result.user_id}
            >
              <div className="flex min-w-0 items-center gap-3">
                <img src={result.avatar_url} className="h-9 w-9 rounded-lg object-cover" alt="" />
                <span className="truncate text-sm font-bold text-modrinth-text">{result.username}</span>
              </div>
              {invitingUserId === result.user_id ? <Loader2 size={16} className="animate-spin text-modrinth-green" /> : <UserPlus size={16} className="text-modrinth-green" />}
            </button>
          ))}
          {!searching && query && results.length === 0 && <p className="py-4 text-center text-xs text-modrinth-muted">{t('user_not_found')}</p>}
        </div>
      </div>
    </div>
  );
};

const OrganizationSheet: React.FC<{
  isOpen: boolean;
  mode: 'create' | 'edit';
  organization?: ModrinthOrganization;
  onClose: () => void;
  onSave: (data: { slug: string; name: string; description: string }) => Promise<void>;
}> = ({ isOpen, mode, organization, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const { t } = useSettings();
  const { visible, closing, requestClose } = useAnimatedDismiss(isOpen, onClose);
  const [lastMode, setLastMode] = useState(mode);

  useEffect(() => {
    if (!isOpen) return;
    setLastMode(mode);
    setName(organization?.name || '');
    setSlug(organization?.slug || '');
    setDescription(organization?.description || '');
    setSlugEdited(mode === 'edit');
  }, [isOpen, organization]);

  useEffect(() => {
    if (!isOpen || slugEdited) return;
    setSlug(slugifyOrganizationName(name));
  }, [isOpen, name, slugEdited]);

  if (!visible) return null;

  const save = async () => {
    const nextName = name.trim();
    const nextSlug = slug.trim().toLowerCase();
    if (!nextName || !nextSlug) {
      alert(t('organization_required'));
      return;
    }

    setSaving(true);
    try {
      await onSave({ name: nextName, slug: nextSlug, description: description.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-closing={closing ? 'true' : undefined} className="app-overlay fixed inset-0 z-[250] flex items-end justify-center bg-black/65 p-4 sm:items-center" onClick={saving ? undefined : requestClose}>
      <div className="app-panel app-responsive-sheet relative w-full max-w-sm overflow-y-auto p-5" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-modrinth-text">
            {lastMode === 'create' ? t('create_organization') : t('edit_organization')}
          </h3>
          <button type="button" onClick={requestClose} disabled={saving} className="app-close-button p-2 disabled:opacity-60">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="app-form-label">{t('organization_name')}</label>
            <input className="app-input" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="app-form-label">{t('organization_slug')}</label>
            <input
              className="app-input"
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(slugifyOrganizationName(event.target.value));
              }}
              placeholder="my-organization"
            />
            <p className="mt-1 text-[11px] text-modrinth-muted">{t('organization_slug_hint')}</p>
          </div>
          <div>
            <label className="app-form-label">{t('description')}</label>
            <textarea className="app-input app-textarea min-h-[6rem]" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={requestClose} disabled={saving} className="app-command flex-1 px-3 py-3 text-sm font-extrabold disabled:opacity-60">
              {t('cancel')}
            </button>
            <button type="button" onClick={save} disabled={saving} className="app-primary flex flex-1 items-center justify-center gap-2 px-3 py-3 text-sm disabled:opacity-60">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {t('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ConfirmSheet: React.FC<{
  isOpen: boolean;
  title: string;
  text: string;
  actionLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}> = ({ isOpen, title, text, actionLabel, onClose, onConfirm }) => {
  const [saving, setSaving] = useState(false);
  const { t } = useSettings();
  const { visible, closing, requestClose } = useAnimatedDismiss(isOpen, onClose);
  if (!visible) return null;

  const confirm = async () => {
    setSaving(true);
    try {
      await onConfirm();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-closing={closing ? 'true' : undefined} className="app-overlay fixed inset-0 z-[260] flex items-end justify-center bg-black/65 p-4 sm:items-center" onClick={requestClose}>
      <div className="app-panel app-responsive-sheet relative w-full max-w-sm p-5" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-modrinth-text">{title}</h3>
          <button type="button" onClick={requestClose} className="app-close-button p-2">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm leading-relaxed text-modrinth-muted">{text}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={requestClose} className="app-command flex-1 px-3 py-3 text-sm font-extrabold">
            {t('cancel')}
          </button>
          <button type="button" onClick={confirm} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-500/35 bg-red-500/14 px-3 py-3 text-sm font-extrabold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const TransferProjectSheet: React.FC<{
  isOpen: boolean;
  projects: ModrinthProject[];
  organizations: ModrinthOrganization[];
  currentOrganization?: ModrinthOrganization;
  onClose: () => void;
  onTransfer: (project: ModrinthProject, organization: ModrinthOrganization | null) => Promise<void>;
}> = ({ isOpen, projects, organizations, currentOrganization, onClose, onTransfer }) => {
  const [projectId, setProjectId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [saving, setSaving] = useState(false);
  const { t } = useSettings();
  const { visible, closing, requestClose } = useAnimatedDismiss(isOpen, onClose);
  const transferableProjects = useMemo(
    () => projects.filter((project) => !getProjectOrganizationKey(project)),
    [projects]
  );

  useEffect(() => {
    if (!isOpen) return;
    setProjectId(transferableProjects[0]?.id || '');
    setOrganizationId(currentOrganization?.id || organizations[0]?.id || '');
  }, [currentOrganization?.id, isOpen, organizations, transferableProjects]);

  if (!visible) return null;

  const selectedProject = transferableProjects.find((project) => project.id === projectId);
  const selectedOrganization = organizations.find((organization) => organization.id === organizationId) || null;
  const canTransfer = !!selectedProject && !!selectedOrganization;

  const transfer = async () => {
    if (!selectedProject) return;
    setSaving(true);
    try {
      await onTransfer(selectedProject, selectedOrganization);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-closing={closing ? 'true' : undefined} className="app-overlay fixed inset-0 z-[250] flex items-end justify-center bg-black/65 p-4 sm:items-center" onClick={saving ? undefined : requestClose}>
      <div className="app-panel app-responsive-sheet relative w-full max-w-sm overflow-y-auto p-5" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-modrinth-text">{t('transfer_projects')}</h3>
          <button type="button" onClick={requestClose} disabled={saving} className="app-close-button p-2 disabled:opacity-60">
            <X size={18} />
          </button>
        </div>
        {transferableProjects.length === 0 || organizations.length === 0 ? (
          <div className="app-panel-soft p-4 text-sm leading-relaxed text-modrinth-muted">
            {transferableProjects.length === 0 ? t('no_transfer_projects') : t('no_transfer_organizations')}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="app-form-label">{t('projects_label')}</label>
              <AppSelect
                value={projectId}
                onChange={setProjectId}
                options={transferableProjects.map((project) => ({ value: project.id, label: getProjectTitle(project) }))}
              />
            </div>
            <div>
              <label className="app-form-label">{t('organization')}</label>
              <AppSelect
                value={organizationId}
                onChange={setOrganizationId}
                options={organizations.map((organization) => ({ value: organization.id, label: organization.name }))}
              />
            </div>
            <button type="button" onClick={transfer} disabled={saving || !canTransfer} className="app-primary flex w-full items-center justify-center gap-2 px-3 py-3 text-sm disabled:opacity-60">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
              {t('transfer_projects')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const CreateProjectSheet: React.FC<{
  isOpen: boolean;
  organizations: ModrinthOrganization[];
  defaultOrganization?: ModrinthOrganization;
  onClose: () => void;
  onSave: (data: {
    title: string;
    slug: string;
    description: string;
    body: string;
    project_type: string;
    categories: string[];
    client_side: 'required' | 'optional' | 'unsupported';
    server_side: 'required' | 'optional' | 'unsupported';
    license_id: string;
    organization_id?: string;
    icon?: File | null;
  }) => Promise<void>;
}> = ({ isOpen, organizations, defaultOrganization, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');
  const [projectType, setProjectType] = useState('mod');
  const [categories, setCategories] = useState('');
  const [clientSide, setClientSide] = useState<'required' | 'optional' | 'unsupported'>('optional');
  const [serverSide, setServerSide] = useState<'required' | 'optional' | 'unsupported'>('required');
  const [licenseId, setLicenseId] = useState('MIT');
  const [organizationId, setOrganizationId] = useState('');
  const [icon, setIcon] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const { t } = useSettings();
  const { visible, closing, requestClose } = useAnimatedDismiss(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setSlug('');
    setSlugEdited(false);
    setDescription('');
    setBody('');
    setProjectType('mod');
    setCategories('');
    setClientSide('optional');
    setServerSide('required');
    setLicenseId('MIT');
    setOrganizationId(defaultOrganization?.id || '');
    setIcon(null);
    setFormError('');
  }, [defaultOrganization?.id, isOpen]);

  useEffect(() => {
    if (!isOpen || slugEdited) return;
    setSlug(slugifyOrganizationName(title));
  }, [isOpen, slugEdited, title]);

  if (!visible) return null;

  const save = async () => {
    const nextTitle = title.trim();
    const nextSlug = slug.trim();
    const nextDescription = description.trim();
    if (!nextTitle || !nextSlug || !nextDescription) {
      const message = t('project_required');
      setFormError(message);
      showToast(message, 'error');
      return;
    }

    setFormError('');
    setSaving(true);
    try {
      await onSave({
        title: nextTitle,
        slug: nextSlug,
        description: nextDescription,
        body: body.trim() || nextDescription,
        project_type: projectType,
        categories: categories.split(',').map((category) => category.trim()).filter(Boolean),
        client_side: clientSide,
        server_side: serverSide,
        license_id: licenseId.trim() || 'MIT',
        organization_id: organizationId || undefined,
        icon,
      });
    } catch (error) {
      const message = getActionErrorMessage(error, 'Failed to create project');
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const syncProjectText = (value: string) => {
    setFormError('');
    setDescription(value);
    setBody(value);
  };

  return (
    <div data-closing={closing ? 'true' : undefined} className="app-overlay fixed inset-0 z-[250] flex items-end justify-center bg-black/65 p-3 sm:items-center" onClick={saving ? undefined : requestClose}>
      <div className="app-panel app-responsive-sheet relative flex w-full max-w-lg flex-col overflow-hidden p-0" onClick={(event) => event.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-modrinth-border px-5 py-4">
          <h3 className="text-lg font-bold text-modrinth-text">{t('create_project_action')}</h3>
          <button type="button" onClick={requestClose} disabled={saving} className="app-close-button p-2 disabled:opacity-60">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {formError && (
            <div className="app-inline-error rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm font-bold leading-relaxed text-red-300">
              {formError}
            </div>
          )}
          <div>
            <label className="app-form-label">{t('name')}</label>
            <input className="app-input" value={title} onChange={(event) => { setFormError(''); setTitle(event.target.value); }} />
          </div>
          <div>
            <label className="app-form-label">Slug</label>
            <input
              className="app-input"
              value={slug}
              onChange={(event) => {
                setFormError('');
                setSlugEdited(true);
                setSlug(slugifyOrganizationName(event.target.value));
              }}
            />
          </div>
          <div>
            <label className="app-form-label">{t('summary')}</label>
            <textarea className="app-input app-textarea min-h-[5rem]" value={description} onChange={(event) => syncProjectText(event.target.value)} />
          </div>
          <div>
            <label className="app-form-label">{t('description')}</label>
            <textarea className="app-input app-textarea min-h-[7rem]" value={body} onChange={(event) => syncProjectText(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="app-form-label">{t('type')}</label>
              <AppSelect
                value={projectType}
                onChange={setProjectType}
                options={[
                  { value: 'mod', label: 'Mod' },
                  { value: 'modpack', label: 'Modpack' },
                  { value: 'resourcepack', label: 'Resource Pack' },
                  { value: 'shader', label: 'Shader' },
                ]}
              />
            </div>
            <div>
              <label className="app-form-label">{t('license_id')}</label>
              <input className="app-input" value={licenseId} onChange={(event) => setLicenseId(event.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="app-form-label">{t('client')}</label>
              <AppSelect<'required' | 'optional' | 'unsupported'> value={clientSide} onChange={setClientSide} options={[
                { value: 'required', label: t('side_required') },
                { value: 'optional', label: t('side_optional') },
                { value: 'unsupported', label: t('side_unsupported') },
              ]} />
            </div>
            <div>
              <label className="app-form-label">{t('server')}</label>
              <AppSelect<'required' | 'optional' | 'unsupported'> value={serverSide} onChange={setServerSide} options={[
                { value: 'required', label: t('side_required') },
                { value: 'optional', label: t('side_optional') },
                { value: 'unsupported', label: t('side_unsupported') },
              ]} />
            </div>
          </div>
          {organizations.length > 0 && (
            <div>
              <label className="app-form-label">{t('organization')}</label>
              <AppSelect
                value={organizationId}
                onChange={setOrganizationId}
                options={[
                  { value: '', label: t('no_organization') },
                  ...organizations.map((organization) => ({ value: organization.id, label: organization.name })),
                ]}
              />
            </div>
          )}
          <div>
            <label className="app-form-label">{t('categories')}</label>
            <input className="app-input" value={categories} onChange={(event) => setCategories(event.target.value)} placeholder="fabric, utility" />
          </div>
          <div>
            <label className="app-form-label">{t('icon')}</label>
            <input
              ref={iconInputRef}
              className="hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setIcon(event.target.files?.[0] || null)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => iconInputRef.current?.click()}
                className="app-command flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left text-sm font-extrabold"
              >
                <Upload size={16} className="shrink-0 text-modrinth-green" />
                <span className="min-w-0 truncate">{icon?.name || t('choose_file')}</span>
              </button>
              {icon && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIcon(null);
                    if (iconInputRef.current) iconInputRef.current.value = '';
                  }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/15"
                  aria-label={t('remove')}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-modrinth-border bg-modrinth-card px-5 py-4">
          <button type="button" onClick={save} disabled={saving} className="app-primary flex w-full items-center justify-center gap-2 px-3 py-3 text-sm disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {t('create_project_action')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamsPage;
