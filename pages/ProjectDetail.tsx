import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Package, Save, Search, X } from 'lucide-react';
import { addGalleryImage, addTeamMember, changeProjectIcon, createVersion, deleteGalleryImage, deleteProjectIcon, deleteTeamMember, deleteVersionById, fetchGameVersionTags, fetchLoaderTags, fetchProject, fetchProjectDependencies, fetchProjectMembers, fetchProjectVersions, joinTeam, modifyVersion, searchUser, transferTeamOwnership, updateProject, updateTeamMember } from '../services/modrinthService';
import type { ModrinthProject, ModrinthVersion, ProjectDependency, ProjectMember, UserSearchResult } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { EditTab, MembersTab, OverviewTab, VersionsTab, projectTabs } from './project-detail/ProjectDetailTabs';
import type { MemberEdit, ProjectTab } from './project-detail/ProjectDetailTabs';
import AppSelect from '../components/AppSelect';
import { showToast } from '../utils/toast';

const MarkdownRenderer = React.lazy(() => import('../components/MarkdownRenderer'));
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

  return { visible, closing, requestClose };
};

const InviteMemberModal: React.FC<{ isOpen: boolean; onClose: () => void; onInvite: (userId: string) => Promise<void> }> = ({ isOpen, onClose, onInvite }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const { t } = useSettings();
  const { visible, closing, requestClose } = useAnimatedDismiss(isOpen, onClose);

  useEffect(() => {
    if (!query) { setResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const hits = await searchUser(query);
        if (cancelled) return;
        setResults(hits || []); 
      } catch (e) { 
        if (cancelled) return;
        setResults([]); 
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  if (!visible) return null;

  return (
    <div data-closing={closing ? 'true' : undefined} className="app-overlay fixed inset-0 z-[250] flex items-end justify-center bg-black/65 p-4 sm:items-center" onClick={requestClose}>
      <div className="app-panel app-responsive-sheet relative w-full max-w-sm overflow-y-auto p-5" onClick={(event) => event.stopPropagation()}>
        <div className="relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-modrinth-text">{t('invite')}</h3>
          <button onClick={requestClose} className="app-close-button p-2">
          <X size={18}/></button>
        </div>
        <div className="relative mb-4">
           <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-modrinth-muted" size={16}/>
           <input
             autoFocus
             type="text"
             placeholder={t('search_user')}
             className="w-full rounded-lg border border-modrinth-border bg-modrinth-bg py-3 pl-10 pr-4 text-sm text-modrinth-text outline-none transition-colors placeholder:text-modrinth-muted focus:border-modrinth-green"
             value={query}
             onChange={e=>setQuery(e.target.value)}
           />
        </div>
        <div className="max-h-60 overflow-y-auto space-y-2">
           {searching && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-modrinth-green"/></div>}
           {!searching && results.map(user => (
             <div key={user.user_id} className="group flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors hover:bg-modrinth-bg/70" onClick={() => { onInvite(user.user_id); requestClose(); }}>
                <div className="flex items-center gap-3">
                  <img src={user.avatar_url} className="w-8 h-8 rounded-full" alt=""/>
                  <span className="text-sm font-bold text-modrinth-text">{user.username}</span>
                </div>
                <button className="rounded-lg px-3 py-1.5 text-xs font-bold text-modrinth-green transition-colors hover:bg-modrinth-green hover:text-white active:scale-[0.98]">{t('add')}</button>
             </div>
           ))}
           {!searching && query && results.length === 0 && <p className="text-center text-xs text-modrinth-muted py-4">{t('user_not_found')}</p>}
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
  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');
  const loadRequestIdRef = useRef(0);
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
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [creatingVersionName, setCreatingVersionName] = useState('');
  const [creatingVersionNumber, setCreatingVersionNumber] = useState('');
  const [creatingVersionType, setCreatingVersionType] = useState<'release' | 'beta' | 'alpha'>('release');
  const [creatingVersionChangelog, setCreatingVersionChangelog] = useState('');
  const [creatingVersionGameVersions, setCreatingVersionGameVersions] = useState<string[]>([]);
  const [creatingVersionLoaders, setCreatingVersionLoaders] = useState<string[]>([]);
  const [creatingVersionGameVersionInput, setCreatingVersionGameVersionInput] = useState('');
  const [creatingVersionLoaderInput, setCreatingVersionLoaderInput] = useState('');
  const [creatingVersionDependencies, setCreatingVersionDependencies] = useState<ProjectDependency[]>([]);
  const [creatingVersionFeatured, setCreatingVersionFeatured] = useState(false);
  const [creatingVersionFiles, setCreatingVersionFiles] = useState<File[]>([]);
  const [creatingVersionPrimaryIndex, setCreatingVersionPrimaryIndex] = useState(0);
  const [draggingVersionFiles, setDraggingVersionFiles] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [creatingVersionSaving, setCreatingVersionSaving] = useState(false);
  const [versionMenuId, setVersionMenuId] = useState<string | null>(null);
  const versionMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ModrinthVersion | null>(null);
  const [selectedVersionClosing, setSelectedVersionClosing] = useState(false);
  const selectedVersionTimerRef = useRef<number | null>(null);
  const [selectedVersionDeps, setSelectedVersionDeps] = useState<ProjectDependency[]>([]);
  const [selectedVersionDepsLoading, setSelectedVersionDepsLoading] = useState(false);
  const { t } = useSettings();

  const [showBodyPreview, setShowBodyPreview] = useState(false);
  const [galleryPreviewUrl, setGalleryPreviewUrl] = useState<string | null>(null);
  const [galleryPreviewClosing, setGalleryPreviewClosing] = useState(false);
  const galleryPreviewTimerRef = useRef<number | null>(null);
  const [memberEdits, setMemberEdits] = useState<Record<string, MemberEdit>>({});
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [transferCandidate, setTransferCandidate] = useState<{ id: string; name: string } | null>(null);
  const [transferClosing, setTransferClosing] = useState(false);
  const transferCloseTimerRef = useRef<number | null>(null);
  const [pendingIconFile, setPendingIconFile] = useState<File | null>(null);
  const [pendingIconPreviewUrl, setPendingIconPreviewUrl] = useState<string | null>(null);
  const [removeIconPending, setRemoveIconPending] = useState(false);

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

  useEffect(() => {
    if (!pendingIconFile) {
      setPendingIconPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingIconFile);
    setPendingIconPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingIconFile]);

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

  const tabsOrder = projectTabs;
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const depInputRef = useRef<HTMLInputElement | null>(null);
  const createDepInputRef = useRef<HTMLInputElement | null>(null);
  const createVersionFileInputRef = useRef<HTMLInputElement | null>(null);

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
      setActiveTab(tabsOrder[currentIndex + 1]);
    } else if (dx > 0 && currentIndex > 0) {
      setActiveTab(tabsOrder[currentIndex - 1]);
    }
  };

  const loadData = useCallback(async () => {
    if (!id) return;
    const requestId = ++loadRequestIdRef.current;
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
      if (requestId !== loadRequestIdRef.current) return;
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
      setPendingIconFile(null);
      setRemoveIconPending(false);
    } catch (error) {
      if (requestId === loadRequestIdRef.current) console.error(error);
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false);
    }
  }, [id, token]);

  const handleAddDependency = useCallback(async (rawIdOrSlug: string, target: 'edit' | 'create' = 'edit') => {
    const value = rawIdOrSlug.trim();
    if (!value) return;
    try {
      // Resolve slug or id to internal project id so DB foreign key passes
      const proj = await fetchProject(value, token);
      const projectId = proj.id;
      const nextDependency: ProjectDependency = { project_id: projectId, version_id: null, file_name: null, dependency_type: newDepType };
      if (target === 'create') {
        setCreatingVersionDependencies(prev => [...prev, nextDependency]);
      } else {
        setEditingVersionDependencies(prev => [...prev, nextDependency]);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to resolve project id for dependency');
    }
  }, [token, newDepType]);

  const inferVersionNumberFromFile = (fileName: string) => {
    const stem = fileName.replace(/\.[^.]+$/, '');
    const match = stem.match(/(?:^|[-_+\s])v?(\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?)/);
    return match?.[1] || '';
  };

  const inferVersionNameFromFile = (fileName: string) =>
    fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();

  const applyCreateVersionFiles = (files: File[]) => {
    const acceptedFiles = files.filter((file) => /\.(jar|mrpack|zip)$/i.test(file.name));
    setCreatingVersionFiles(acceptedFiles);
    setCreatingVersionPrimaryIndex(0);

    const primaryFile = acceptedFiles[0];
    if (!primaryFile) return;

    const inferredVersion = inferVersionNumberFromFile(primaryFile.name);
    if (inferredVersion) {
      setCreatingVersionNumber((current) => current.trim() ? current : inferredVersion);
    }
    setCreatingVersionName((current) => current.trim() ? current : inferVersionNameFromFile(primaryFile.name));
  };

  const openCreateVersion = () => {
    const latestVersion = versions[0];
    setCreatingVersion(true);
    setCreatingVersionName('');
    setCreatingVersionNumber('');
    setCreatingVersionType('release');
    setCreatingVersionChangelog('');
    setCreatingVersionGameVersions(latestVersion ? [...latestVersion.game_versions] : []);
    setCreatingVersionLoaders(latestVersion ? [...latestVersion.loaders] : []);
    setCreatingVersionGameVersionInput('');
    setCreatingVersionLoaderInput('');
    setCreatingVersionDependencies([]);
    setCreatingVersionFeatured(false);
    setCreatingVersionFiles([]);
    setCreatingVersionPrimaryIndex(0);
    setDraggingVersionFiles(false);
  };

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

  useEffect(() => () => {
    loadRequestIdRef.current += 1;
    if (transferCloseTimerRef.current !== null) window.clearTimeout(transferCloseTimerRef.current);
    if (galleryPreviewTimerRef.current !== null) window.clearTimeout(galleryPreviewTimerRef.current);
    if (selectedVersionTimerRef.current !== null) window.clearTimeout(selectedVersionTimerRef.current);
  }, []);

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
      const nextData: Partial<ModrinthProject> = {};
      const validSides = ['required', 'optional', 'unsupported'];

      if (formData.title !== undefined && formData.title !== project.title) nextData.title = formData.title;
      if (formData.description !== undefined && formData.description !== project.description) nextData.description = formData.description;
      if (formData.body !== undefined && formData.body !== project.body) nextData.body = formData.body;
      if (formData.client_side !== undefined && validSides.includes(formData.client_side) && formData.client_side !== project.client_side) {
        nextData.client_side = formData.client_side;
      }
      if (formData.server_side !== undefined && validSides.includes(formData.server_side) && formData.server_side !== project.server_side) {
        nextData.server_side = formData.server_side;
      }
      if (formData.source_url !== undefined && formData.source_url !== (project.source_url || '')) nextData.source_url = formData.source_url;
      if (formData.issues_url !== undefined && formData.issues_url !== (project.issues_url || '')) nextData.issues_url = formData.issues_url;
      if (formData.wiki_url !== undefined && formData.wiki_url !== (project.wiki_url || '')) nextData.wiki_url = formData.wiki_url;
      if (formData.discord_url !== undefined && formData.discord_url !== (project.discord_url || '')) nextData.discord_url = formData.discord_url;
      if (formData.license?.id && formData.license.id !== project.license?.id) nextData.license = formData.license;
      if (formData.status && formData.status !== project.status) nextData.status = formData.status;

      if (Object.keys(nextData).length > 0) {
        await updateProject(id, nextData, token);
      }
      if (removeIconPending) {
        await deleteProjectIcon(id, token);
      } else if (pendingIconFile) {
        await changeProjectIcon(id, pendingIconFile, token);
      }
      await loadData();
      showToast(t('saved'));
      setActiveTab('overview');
    } catch (error: any) {
      showToast(error?.message || 'Failed to save project', 'error');
    } finally {
      setIsSaving(false);
    }
  };


  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if(!e.target.files?.[0] || !id) return;
      setPendingIconFile(e.target.files[0]);
      setRemoveIconPending(false);
      showToast(t('unsaved_changes'), 'neutral');
  };

  const handleDeleteIcon = async () => {
      if(!id || !confirm('Delete icon?')) return;
      setPendingIconFile(null);
      setRemoveIconPending(true);
      showToast(t('unsaved_changes'), 'neutral');
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if(!e.target.files?.[0] || !id) return;
      try {
          await addGalleryImage(id, e.target.files[0], false, 'Gallery Image', '', token);
          await loadData();
          showToast(t('saved'));
      } catch(err:any) { showToast(err.message || 'Failed to add image', 'error'); }
  };

  const handleDeleteGallery = async (url: string) => {
      if(!id || !confirm('Delete image?')) return;
      try { await deleteGalleryImage(id, url, token); await loadData(); showToast(t('saved')); } catch(err:any) { showToast(err.message || 'Failed to delete image', 'error'); }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!project || !confirm(t('member_remove_confirm'))) return;
    try {
      await deleteTeamMember(project.team, userId, token);
      await loadData();
      showToast(t('saved'));
    } catch(e) { showToast('Failed to remove member', 'error'); }
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
        showToast(t('saved'));
     } catch(e) { showToast('Failed to update member', 'error'); }
     finally { setSavingMemberId(null); }
  };

  const handleJoinTeam = async () => {
    if (!project) return;
    try {
      await joinTeam(project.team, token);
      await loadData();
      showToast(t('saved'));
    } catch (e: any) {
      showToast(e.message || 'Failed to join team', 'error');
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
      showToast(t('saved'));
    } catch (e: any) {
      showToast(e.message || 'Failed to transfer ownership', 'error');
    }
    closeTransferCandidate();
  };

  const handleCreateVersion = async () => {
    if (!project) return;
    const files = creatingVersionFiles;
    const name = creatingVersionName.trim();
    const versionNumber = creatingVersionNumber.trim();

    if (!name) {
      alert(t('version_name_required'));
      return;
    }
    if (!versionNumber) {
      alert(t('version_number_required'));
      return;
    }
    if (creatingVersionGameVersions.length === 0) {
      alert(t('game_versions_required'));
      return;
    }
    if (creatingVersionLoaders.length === 0) {
      alert(t('loaders_required'));
      return;
    }
    if (files.length === 0) {
      alert(t('version_files_required'));
      return;
    }

    const fileParts = files.map((_, index) => `file-${index}`);
    const primaryIndex = Math.min(Math.max(creatingVersionPrimaryIndex, 0), files.length - 1);

    try {
      setCreatingVersionSaving(true);
      await createVersion(
        {
          project_id: project.id,
          name,
          version_number: versionNumber,
          changelog: creatingVersionChangelog,
          dependencies: creatingVersionDependencies,
          game_versions: creatingVersionGameVersions,
          version_type: creatingVersionType,
          loaders: creatingVersionLoaders,
          featured: creatingVersionFeatured,
          file_parts: fileParts,
          primary_file: fileParts[primaryIndex],
          files: files.map((file, index) => ({ part: fileParts[index], file }))
        },
        token
      );
      await loadData();
      setCreatingVersion(false);
      showToast(t('saved'));
    } catch (e: any) {
      showToast(e.message || 'Failed to create version', 'error');
    } finally {
      setCreatingVersionSaving(false);
    }
  };

  const handleInvite = async (userId: string) => {
    if (!project) return;
    try {
      await addTeamMember(project.team, userId, token);
      await loadData();
      setShowInviteModal(false);
      showToast(t('saved'));
    } catch(e: any) { showToast(e.message || 'Failed to invite', 'error'); }
  };

  const closeTransferCandidate = () => {
    if (transferClosing) return;
    if (transferCloseTimerRef.current !== null) window.clearTimeout(transferCloseTimerRef.current);
    setTransferClosing(true);
    transferCloseTimerRef.current = window.setTimeout(() => {
      transferCloseTimerRef.current = null;
      setTransferCandidate(null);
      setTransferClosing(false);
    }, DISMISS_ANIMATION_MS);
  };

  const closeGalleryPreview = () => {
    if (galleryPreviewClosing) return;
    if (galleryPreviewTimerRef.current !== null) window.clearTimeout(galleryPreviewTimerRef.current);
    setGalleryPreviewClosing(true);
    galleryPreviewTimerRef.current = window.setTimeout(() => {
      galleryPreviewTimerRef.current = null;
      setGalleryPreviewUrl(null);
      setGalleryPreviewClosing(false);
    }, DISMISS_ANIMATION_MS);
  };

  const closeSelectedVersion = () => {
    if (selectedVersionClosing) return;
    if (selectedVersionTimerRef.current !== null) window.clearTimeout(selectedVersionTimerRef.current);
    setSelectedVersionClosing(true);
    selectedVersionTimerRef.current = window.setTimeout(() => {
      selectedVersionTimerRef.current = null;
      setSelectedVersion(null);
      setSelectedVersionClosing(false);
    }, DISMISS_ANIMATION_MS);
  };

  if (loading && !project) return <div className="h-screen flex items-center justify-center bg-modrinth-bg"><Loader2 className="animate-spin text-modrinth-green w-10 h-10" /></div>;
  if (!project) return <div className="h-screen flex items-center justify-center bg-modrinth-bg text-modrinth-text">Not Found</div>;

  const projectSummary = (project.description || '').trim();
  const translateEnum = (key: string, fallback: string) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const dependencyTypeLabel = (value: string) => translateEnum(`dependency_${value}`, value);
  const versionTypeOptions: Array<'release' | 'beta' | 'alpha'> = ['release', 'beta', 'alpha'];
  const createVersionWarnings = [
    !creatingVersionChangelog.trim() ? t('version_checklist_changelog') : null,
    creatingVersionGameVersions.length === 0 ? t('version_checklist_game_versions') : null,
    creatingVersionLoaders.length === 0 ? t('version_checklist_loaders') : null,
    creatingVersionFiles.length === 0 ? t('version_checklist_files') : null
  ].filter(Boolean) as string[];
  const editVersionWarnings = [
    !editingVersionChangelog.trim() ? t('version_checklist_changelog') : null,
    editingVersionGameVersions.length === 0 ? t('version_checklist_game_versions') : null,
    editingVersionLoaders.length === 0 ? t('version_checklist_loaders') : null
  ].filter(Boolean) as string[];
  const hasUnsavedProjectChanges = !!project && (
    formData.title !== project.title ||
    formData.description !== project.description ||
    formData.body !== project.body ||
    formData.client_side !== project.client_side ||
    formData.server_side !== project.server_side ||
    formData.source_url !== (project.source_url || '') ||
    formData.issues_url !== (project.issues_url || '') ||
    formData.wiki_url !== (project.wiki_url || '') ||
    formData.discord_url !== (project.discord_url || '') ||
    formData.license?.id !== project.license?.id ||
    formData.status !== project.status ||
    !!pendingIconFile ||
    removeIconPending
  );

  return (
    <div
      className="min-h-screen bg-modrinth-bg pb-10 relative z-0 animate-fade-in"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="app-topbar sticky top-0 z-50 pt-[env(safe-area-inset-top)] transition-colors duration-300">
        <div className="flex items-center gap-2 px-4 py-3">
          <button onClick={() => navigate(-1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-modrinth-text hover:bg-white/10 active:scale-90"><ArrowLeft size={23} /></button>
          <h1 className="min-w-0 flex-1 text-center text-base font-extrabold text-modrinth-text truncate">{project.title}</h1>
          {activeTab === 'edit' ? (
            <button aria-label={t('save')} onClick={handleSave} disabled={isSaving || !hasUnsavedProjectChanges} className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white active:scale-95 disabled:opacity-45 ${hasUnsavedProjectChanges ? 'bg-modrinth-green' : 'bg-modrinth-cardHover text-modrinth-muted'}`}>
              {isSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14} />}
              {hasUnsavedProjectChanges && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-yellow-300" />}
            </button>
          ) : <div className="h-9 w-10 shrink-0" />}
        </div>
        <div className="px-4 pb-3">
          <div className="app-segmented-tabs grid grid-cols-4 gap-1 rounded-lg border border-modrinth-border bg-modrinth-bg p-1">
          {projectTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
              }}
              data-active={activeTab === tab ? 'true' : undefined}
              className={`app-segmented-tab relative min-w-0 overflow-hidden rounded-md px-2 py-2 text-[10px] font-extrabold leading-tight transition-colors ${
                activeTab === tab
                  ? 'text-modrinth-green shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent-color)_32%,var(--border))]'
                  : 'text-modrinth-muted hover:text-modrinth-text hover:bg-modrinth-cardHover/60'
              }`}
            >
              <span className="block truncate">{t(tab)}</span>
            </button>
          ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6">
          {activeTab === 'overview' && <OverviewTab project={project} deps={deps} projectSummary={projectSummary} t={t} />}
          {activeTab === 'versions' && (
            <VersionsTab
              versions={versions}
              versionMenuId={versionMenuId}
              versionMenuRef={versionMenuRef}
              t={t}
              setVersionMenuId={setVersionMenuId}
              setSelectedVersion={setSelectedVersion}
              openCreateVersion={openCreateVersion}
              openEditVersion={openEditVersion}
              handleDeleteVersion={handleDeleteVersion}
            />
          )}
          {activeTab === 'edit' && (
            <EditTab
              project={project}
              formData={formData}
              showBodyPreview={showBodyPreview}
              t={t}
              setShowBodyPreview={setShowBodyPreview}
              setGalleryPreviewUrl={setGalleryPreviewUrl}
              handleInputChange={handleInputChange}
              handleIconUpload={handleIconUpload}
              handleDeleteIcon={handleDeleteIcon}
              pendingIconFile={pendingIconFile}
              pendingIconPreviewUrl={pendingIconPreviewUrl}
              removeIconPending={removeIconPending}
              handleGalleryUpload={handleGalleryUpload}
              handleDeleteGallery={handleDeleteGallery}
            />
          )}
          {activeTab === 'members' && (
            <MembersTab
              members={members}
              memberEdits={memberEdits}
              savingMemberId={savingMemberId}
              currentUserId={currentUserId}
              permissionDefs={permissionDefs}
              t={t}
              setShowInviteModal={setShowInviteModal}
              setMemberEdits={setMemberEdits}
              handleRemoveMember={handleRemoveMember}
              handleRoleSave={handleRoleSave}
              handleJoinTeam={handleJoinTeam}
              openTransferOwnership={openTransferOwnership}
            />
          )}
        </div>
      </div>
      <InviteMemberModal isOpen={showInviteModal} onClose={()=>setShowInviteModal(false)} onInvite={handleInvite} />

      {transferCandidate && (
        <div data-closing={transferClosing ? 'true' : undefined} className="app-overlay fixed inset-0 z-[220] flex items-end justify-center bg-black/65 p-4 sm:items-center" onClick={closeTransferCandidate}>
          <div className="app-panel app-responsive-sheet w-full max-w-sm overflow-y-auto p-5" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold text-modrinth-text mb-2">{t('transfer_owner_title')}</h3>
            <p className="text-sm text-modrinth-muted mb-4">
              {t('transfer_owner_desc')} <span className="text-modrinth-text font-bold">{transferCandidate.name}</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={closeTransferCandidate}
                className="flex-1 py-2.5 rounded-lg font-bold text-sm bg-modrinth-bg text-modrinth-muted hover:text-modrinth-text"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleTransferOwnership}
                className="flex-1 py-2.5 rounded-lg font-bold text-sm bg-modrinth-green text-white"
              >
                {t('transfer_owner_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {galleryPreviewUrl && (
        <div
          className="app-overlay fixed inset-0 z-[260] flex items-center justify-center bg-black"
          data-closing={galleryPreviewClosing ? 'true' : undefined}
          onClick={closeGalleryPreview}
        >
          <button
            onClick={closeGalleryPreview}
            className="app-close-button absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-10 h-10 w-10 bg-black/60 text-white"
            aria-label="Close preview"
          >
            <X size={18}/>
          </button>
          <img
            src={galleryPreviewUrl}
            alt="Gallery preview"
            className="h-screen w-screen object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {selectedVersion && (
        <div className="fixed inset-0 z-[250] bg-modrinth-bg">
          <div data-closing={selectedVersionClosing ? 'true' : undefined} className="app-fullscreen-panel flex h-full w-full flex-col bg-modrinth-bg">
            <div className="app-topbar flex items-start justify-between gap-4 px-4 py-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-modrinth-muted mb-2">{t('version_details')}</div>
                <h3 className="text-xl font-extrabold text-modrinth-text break-words">{selectedVersion.name || selectedVersion.version_number}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-modrinth-muted">
                  <span className="px-2.5 py-1 rounded-md bg-modrinth-card text-modrinth-text font-semibold">{selectedVersion.version_number}</span>
                  <span className="px-2.5 py-1 rounded-md border border-modrinth-border bg-modrinth-card font-bold uppercase text-modrinth-muted">
                    {t(selectedVersion.version_type)}
                  </span>
                </div>
              </div>
              <button
                onClick={closeSelectedVersion}
                className="app-close-button h-10 w-10 shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="app-panel rounded-lg p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-modrinth-muted mb-1">{t('downloads')}</div>
                  <div className="text-lg font-bold text-modrinth-text">{selectedVersion.downloads.toLocaleString()}</div>
                </div>
                <div className="app-panel rounded-lg p-3">
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

              <div className="app-panel app-reveal p-4" style={{ animationDelay: '80ms' }}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h4 className="text-lg font-bold text-modrinth-text">{t('changelog')}</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVersion(null);
                      openEditVersion(selectedVersion);
                    }}
                    className="text-xs font-bold px-3 py-2 rounded-lg bg-modrinth-cardHover text-modrinth-text hover:bg-modrinth-border/60 transition-colors"
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

              <div className="app-panel app-reveal p-4" style={{ animationDelay: '120ms' }}>
                <h4 className="text-lg font-bold text-modrinth-text mb-3">{t('dependencies')}</h4>
                {selectedVersionDepsLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="animate-spin text-modrinth-green" /></div>
                ) : selectedVersionDeps.length === 0 ? (
                  <p className="text-sm text-modrinth-muted">{t('no_dependencies')}</p>
                ) : (
                  <div className="space-y-3">
                    {selectedVersionDeps.map((dep, index) => (
                      <div key={`${dep.project_id || dep.file_name || dep.version_id || index}`} className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 rounded-lg border border-modrinth-border bg-modrinth-bg p-3">
                        <div className="w-12 h-12 rounded-lg bg-modrinth-card overflow-hidden flex items-center justify-center flex-shrink-0">
                          {dep.icon_url ? (
                            <img src={dep.icon_url} alt={dep.title || dep.project_id || 'Dependency'} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={18} className="text-modrinth-muted opacity-70" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 break-words text-sm font-semibold leading-5 text-modrinth-text">{dep.title || dep.project_id || dep.file_name || dep.version_id}</div>
                            <span className="shrink-0 rounded-lg border border-modrinth-border bg-modrinth-card px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-modrinth-muted">
                              {dependencyTypeLabel(dep.dependency_type)}
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
                onClick={closeSelectedVersion}
                className="w-full py-3 rounded-lg font-bold text-sm bg-modrinth-cardHover text-modrinth-text hover:bg-modrinth-border/60 transition-colors"
              >
                {t('close_details')}
              </button>
            </div>
          </div>
        </div>
      )}

      {creatingVersion && (
        <div className="fixed inset-0 z-[260] bg-modrinth-bg">
          <div className="app-fullscreen-panel flex h-full w-full flex-col bg-modrinth-bg">
            <div className="app-topbar flex justify-between items-center gap-3 px-4 py-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-modrinth-muted">{t('versions')}</div>
                <h3 className="min-w-0 truncate text-lg font-extrabold text-modrinth-text">{t('create_version')}</h3>
              </div>
              <button onClick={() => setCreatingVersion(false)} className="app-close-button h-10 w-10 shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+6rem)] space-y-5">
              <div className="app-panel app-reveal space-y-4 p-4">
                <div>
                  <label className="app-form-label">{translateEnum('version_name', 'Name')}</label>
                  <input className="app-input" value={creatingVersionName} onChange={e => setCreatingVersionName(e.target.value)} placeholder={project.title} />
                </div>
                <div>
                  <label className="app-form-label">{t('version_number')}</label>
                  <input className="app-input font-mono" value={creatingVersionNumber} onChange={e => setCreatingVersionNumber(e.target.value)} placeholder="1.0.0" />
                </div>
                <div>
                  <label className="app-form-label">{translateEnum('version_type', 'Type')}</label>
                  <div className="app-segmented-tabs grid grid-cols-3 gap-1 rounded-lg border border-modrinth-border bg-modrinth-bg p-1">
                    {versionTypeOptions.map((type) => {
                      const active = creatingVersionType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setCreatingVersionType(type)}
                          data-active={active ? 'true' : undefined}
                          className={`app-segmented-tab rounded-md px-2 py-2 text-xs font-extrabold uppercase ${active ? 'text-modrinth-text' : 'text-modrinth-muted'}`}
                        >
                          {t(type)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="app-panel app-reveal p-4" style={{ animationDelay: '40ms' }}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label className="app-form-label mb-0">{t('version_files')}</label>
                  <button
                    type="button"
                    onClick={() => createVersionFileInputRef.current?.click()}
                    className="rounded-lg bg-modrinth-green px-3 py-2 text-xs font-extrabold text-white active:scale-95"
                  >
                    {t('add_files')}
                  </button>
                </div>
                <input
                  ref={createVersionFileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".jar,.mrpack,.zip"
                  onChange={(event) => {
                    applyCreateVersionFiles(Array.from(event.target.files || []));
                    event.currentTarget.value = '';
                  }}
                />
                {creatingVersionFiles.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => createVersionFileInputRef.current?.click()}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDraggingVersionFiles(true);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDraggingVersionFiles(true);
                    }}
                    onDragLeave={() => setDraggingVersionFiles(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDraggingVersionFiles(false);
                      applyCreateVersionFiles(Array.from(event.dataTransfer.files || []));
                    }}
                    className={`w-full rounded-lg border border-dashed bg-modrinth-bg px-4 py-6 text-center text-sm font-bold transition-colors ${draggingVersionFiles ? 'border-modrinth-green text-modrinth-green' : 'border-modrinth-border text-modrinth-muted hover:border-modrinth-green hover:text-modrinth-green'}`}
                  >
                    {draggingVersionFiles ? t('drop_version_files') : t('choose_version_files')}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onDragEnter={(event) => {
                        event.preventDefault();
                        setDraggingVersionFiles(true);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDraggingVersionFiles(true);
                      }}
                      onDragLeave={() => setDraggingVersionFiles(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDraggingVersionFiles(false);
                        applyCreateVersionFiles(Array.from(event.dataTransfer.files || []));
                      }}
                      onClick={() => createVersionFileInputRef.current?.click()}
                      className={`w-full rounded-lg border border-dashed px-3 py-2 text-xs font-bold transition-colors ${draggingVersionFiles ? 'border-modrinth-green bg-modrinth-green/10 text-modrinth-green' : 'border-modrinth-border bg-modrinth-bg text-modrinth-muted hover:text-modrinth-text'}`}
                    >
                      {t('replace_version_files')}
                    </button>
                    {creatingVersionFiles.map((file, index) => (
                      <div key={`${file.name}-${file.size}-${index}`} className="flex min-w-0 items-center gap-3 rounded-lg bg-modrinth-bg p-3">
                        <button
                          type="button"
                          onClick={() => setCreatingVersionPrimaryIndex(index)}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${creatingVersionPrimaryIndex === index ? 'bg-modrinth-green text-white' : 'bg-modrinth-card text-modrinth-muted'}`}
                          aria-label={t('primary_file')}
                        >
                          {creatingVersionPrimaryIndex === index ? <Check size={14} /> : index + 1}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-extrabold text-modrinth-text">{file.name}</div>
                          <div className="mt-0.5 text-[10px] font-mono text-modrinth-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCreatingVersionFiles(prev => prev.filter((_, fileIndex) => fileIndex !== index));
                            setCreatingVersionPrimaryIndex(prev => Math.max(0, Math.min(prev, creatingVersionFiles.length - 2)));
                          }}
                          className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <p className="text-[11px] leading-relaxed text-modrinth-muted">{t('primary_file_hint')}</p>
                  </div>
                )}
              </div>

              <div className="app-panel app-reveal p-4" style={{ animationDelay: '80ms' }}>
                <label className="app-form-label">{t('changelog')}</label>
                <textarea className="app-input app-textarea min-h-[8rem] font-mono" value={creatingVersionChangelog} onChange={e => setCreatingVersionChangelog(e.target.value)} />
              </div>

              <div className="app-panel app-reveal p-4" style={{ animationDelay: '120ms' }}>
                <label className="app-form-label">{t('game_versions')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {allGameVersions.map(gv => {
                    const active = creatingVersionGameVersions.includes(gv);
                    return (
                      <button
                        key={gv}
                        type="button"
                        onClick={() => setCreatingVersionGameVersions(prev => prev.includes(gv) ? prev.filter(x => x !== gv) : [...prev, gv])}
                        style={active ? { borderColor: 'var(--accent-color)', backgroundColor: 'color-mix(in srgb, var(--accent-color) 16%, transparent)' } : undefined}
                        className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${active ? 'text-modrinth-text' : 'border-modrinth-border bg-modrinth-bg text-modrinth-muted'}`}
                      >
                        {gv}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={creatingVersionGameVersionInput}
                    onChange={event => setCreatingVersionGameVersionInput(event.target.value)}
                    onKeyDown={event => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      const value = creatingVersionGameVersionInput.trim();
                      if (!value) return;
                      setCreatingVersionGameVersions(prev => prev.includes(value) ? prev : [...prev, value]);
                      setCreatingVersionGameVersionInput('');
                    }}
                    className="app-input min-w-0 flex-1 text-xs"
                    placeholder="1.21.5"
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-modrinth-border bg-modrinth-bg px-3 text-xs font-bold text-modrinth-muted hover:text-modrinth-text"
                    onClick={() => {
                      const value = creatingVersionGameVersionInput.trim();
                      if (!value) return;
                      setCreatingVersionGameVersions(prev => prev.includes(value) ? prev : [...prev, value]);
                      setCreatingVersionGameVersionInput('');
                    }}
                  >
                    {t('add')}
                  </button>
                </div>
                {creatingVersionGameVersions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {creatingVersionGameVersions.map(value => (
                      <button
                        key={`selected-game-${value}`}
                        type="button"
                        onClick={() => setCreatingVersionGameVersions(prev => prev.filter(item => item !== value))}
                        className="rounded-lg bg-modrinth-green/12 px-2 py-1 text-[10px] font-bold text-modrinth-green"
                      >
                        {value} ×
                      </button>
                    ))}
                  </div>
                )}
                {allGameVersions.length === 0 && <p className="mt-2 text-xs text-modrinth-muted">{t('create_first_version_hint')}</p>}
              </div>

              <div className="app-panel app-reveal p-4" style={{ animationDelay: '160ms' }}>
                <label className="app-form-label">{t('loaders')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {allLoaders.map(ld => {
                    const active = creatingVersionLoaders.includes(ld);
                    return (
                      <button
                        key={ld}
                        type="button"
                        onClick={() => setCreatingVersionLoaders(prev => prev.includes(ld) ? prev.filter(x => x !== ld) : [...prev, ld])}
                        style={active ? { borderColor: 'var(--accent-color)', backgroundColor: 'color-mix(in srgb, var(--accent-color) 16%, transparent)' } : undefined}
                        className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase ${active ? 'text-modrinth-text' : 'border-modrinth-border bg-modrinth-bg text-modrinth-muted'}`}
                      >
                        {ld}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={creatingVersionLoaderInput}
                    onChange={event => setCreatingVersionLoaderInput(event.target.value)}
                    onKeyDown={event => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      const value = creatingVersionLoaderInput.trim().toLowerCase();
                      if (!value) return;
                      setCreatingVersionLoaders(prev => prev.includes(value) ? prev : [...prev, value]);
                      setCreatingVersionLoaderInput('');
                    }}
                    className="app-input min-w-0 flex-1 text-xs"
                    placeholder="fabric"
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-modrinth-border bg-modrinth-bg px-3 text-xs font-bold text-modrinth-muted hover:text-modrinth-text"
                    onClick={() => {
                      const value = creatingVersionLoaderInput.trim().toLowerCase();
                      if (!value) return;
                      setCreatingVersionLoaders(prev => prev.includes(value) ? prev : [...prev, value]);
                      setCreatingVersionLoaderInput('');
                    }}
                  >
                    {t('add')}
                  </button>
                </div>
                {creatingVersionLoaders.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {creatingVersionLoaders.map(value => (
                      <button
                        key={`selected-loader-${value}`}
                        type="button"
                        onClick={() => setCreatingVersionLoaders(prev => prev.filter(item => item !== value))}
                        className="rounded-lg bg-modrinth-green/12 px-2 py-1 text-[10px] font-bold uppercase text-modrinth-green"
                      >
                        {value} ×
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="app-panel app-reveal p-4" style={{ animationDelay: '200ms' }}>
                <label className="app-form-label">{t('dependencies')}</label>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {creatingVersionDependencies.map((dep, idx) => {
                    const meta = deps.find(d => d.project_id && d.project_id === dep.project_id);
                    return (
                      <div key={idx} className="flex items-center justify-between rounded-lg border border-modrinth-border bg-modrinth-bg px-3 py-2 text-[11px]">
                        <span className="min-w-0 truncate text-xs text-modrinth-text">{meta?.title || dep.project_id || dep.file_name || dep.version_id || 'unknown'}</span>
                        <button type="button" className="ml-2 shrink-0 rounded-lg bg-red-500/10 px-2 py-1 text-[10px] text-red-400" onClick={() => setCreatingVersionDependencies(prev => prev.filter((_, i) => i !== idx))}>
                          {t('remove')}
                        </button>
                      </div>
                    );
                  })}
                  {creatingVersionDependencies.length === 0 && <p className="text-[11px] text-modrinth-muted">{t('no_dependencies')}</p>}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="project id or slug"
                    className="min-w-[9rem] flex-1 rounded-lg border border-modrinth-border bg-modrinth-bg px-3 py-2 text-[11px] text-modrinth-text outline-none focus:border-modrinth-green"
                    ref={createDepInputRef}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const value = e.currentTarget.value.trim();
                        if (!value) return;
                        void handleAddDependency(value, 'create');
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <AppSelect
                    compact
                    className="min-w-[9rem]"
                    value={newDepType}
                    onChange={value => setNewDepType(value as typeof newDepType)}
                    options={[
                      { value: 'required', label: dependencyTypeLabel('required') },
                      { value: 'optional', label: dependencyTypeLabel('optional') },
                      { value: 'incompatible', label: dependencyTypeLabel('incompatible') },
                      { value: 'embedded', label: dependencyTypeLabel('embedded') },
                    ]}
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-modrinth-border bg-modrinth-bg px-3 py-2 text-[11px] text-modrinth-muted hover:text-modrinth-text"
                    onClick={() => {
                      const input = createDepInputRef.current;
                      if (!input || !input.value) return;
                      const value = input.value.trim();
                      if (!value) return;
                      void handleAddDependency(value, 'create');
                      input.value = '';
                    }}
                  >
                    {t('add')}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCreatingVersionFeatured(prev => !prev)}
                style={creatingVersionFeatured ? { borderColor: 'var(--accent-color)', backgroundColor: 'color-mix(in srgb, var(--accent-color) 14%, transparent)' } : undefined}
                className={`flex w-full items-center justify-between rounded-lg border p-4 text-left ${creatingVersionFeatured ? 'text-modrinth-text' : 'border-modrinth-border bg-modrinth-card text-modrinth-muted'}`}
              >
                <span>
                  <span className="block text-sm font-extrabold">{t('featured_version')}</span>
                  <span className="mt-1 block text-xs text-modrinth-muted">{t('featured_version_desc')}</span>
                </span>
                {creatingVersionFeatured && <Check size={18} className="shrink-0 text-modrinth-green" />}
              </button>

              <div className="rounded-lg bg-modrinth-card p-4">
                <div className="mb-2 text-sm font-extrabold text-modrinth-text">{t('release_checklist')}</div>
                {createVersionWarnings.length === 0 ? (
                  <p className="text-xs font-bold text-modrinth-green">{t('release_checklist_ready')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {createVersionWarnings.map((warning) => (
                      <div key={warning} className="text-xs leading-relaxed text-yellow-400">{warning}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="app-topbar fixed bottom-0 left-0 right-0 z-[270] flex gap-3 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <button onClick={() => setCreatingVersion(false)} className="flex-1 rounded-lg bg-modrinth-card py-3 text-sm font-bold text-modrinth-muted hover:text-modrinth-text">
                {t('cancel')}
              </button>
              <button onClick={handleCreateVersion} disabled={creatingVersionSaving} className="flex-1 rounded-lg bg-modrinth-green py-3 text-sm font-bold text-white flex items-center justify-center active:scale-95 disabled:opacity-70">
                {creatingVersionSaving ? <Loader2 size={16} className="animate-spin" /> : t('create_version')}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingVersion && (
        <div className="fixed inset-0 z-[260] bg-modrinth-bg">
          <div className="app-fullscreen-panel flex h-full w-full flex-col bg-modrinth-bg">
            <div className="app-topbar flex justify-between items-center gap-3 px-4 py-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
              <h3 className="min-w-0 truncate text-lg font-extrabold text-modrinth-text">{translateEnum('edit_version', 'Edit version')}</h3>
              <button
                onClick={() => setEditingVersion(null)}
                className="app-close-button h-10 w-10 shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+6rem)] space-y-5">
              <div className="app-panel app-reveal p-4">
                <label className="app-form-label">{translateEnum('version_name', 'Name')}</label>
                <input
                  className="app-input"
                  value={editingVersionName}
                  onChange={e => setEditingVersionName(e.target.value)}
                />
              </div>

              <div className="app-panel app-reveal p-4" style={{ animationDelay: '40ms' }}>
                <label className="app-form-label">{translateEnum('version_type', 'Type')}</label>
                <div className="app-segmented-tabs grid grid-cols-3 gap-1 rounded-lg border border-modrinth-border bg-modrinth-bg p-1">
                  {versionTypeOptions.map((type) => {
                    const active = editingVersionType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setEditingVersionType(type)}
                        data-active={active ? 'true' : undefined}
                        className={`app-segmented-tab rounded-md px-2 py-2 text-xs font-extrabold uppercase ${active ? 'text-modrinth-text' : 'text-modrinth-muted'}`}
                      >
                        {t(type)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="app-panel app-reveal p-4" style={{ animationDelay: '160ms' }}>
                <label className="app-form-label">{t('changelog')}</label>
                <textarea
                  className="app-input app-textarea min-h-[8rem] font-mono"
                  value={editingVersionChangelog}
                  onChange={e => setEditingVersionChangelog(e.target.value)}
                />
              </div>

              <div className="app-panel app-reveal p-4" style={{ animationDelay: '200ms' }}>
                <label className="app-form-label">{t('game_versions')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {allGameVersions.map(gv => {
                    const active = editingVersionGameVersions.includes(gv);
                    return (
                      <button
                        key={gv}
                        type="button"
                        onClick={() => setEditingVersionGameVersions(prev => prev.includes(gv) ? prev.filter(x => x !== gv) : [...prev, gv])}
                        style={active ? { borderColor: 'var(--accent-color)', backgroundColor: 'color-mix(in srgb, var(--accent-color) 16%, transparent)' } : undefined}
                        className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${active ? 'text-modrinth-text' : 'border-modrinth-border bg-modrinth-bg text-modrinth-muted'}`}
                      >
                        {gv}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="app-panel p-4">
                <label className="app-form-label">{t('dependencies')}</label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {editingVersionDependencies.map((dep, idx) => {
                    const meta = deps.find(d => d.project_id && d.project_id === dep.project_id);
                    return (
                      <div key={idx} className="flex items-center justify-between rounded-lg border border-modrinth-border bg-modrinth-bg px-3 py-2 text-[11px]">
                        <div className="flex items-center gap-2 mr-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-modrinth-card border border-modrinth-border">
                            {meta?.icon_url ? (
                              <img src={meta.icon_url} className="w-full h-full object-cover" />
                            ) : (
                              <Package size={14} className="text-modrinth-muted" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-modrinth-text truncate text-xs">{meta?.title || dep.project_id || dep.file_name || dep.version_id || 'unknown'}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] text-modrinth-muted uppercase">{translateEnum('dependency_type', 'Type')}:</span>
                              <AppSelect
                                compact
                                className="min-w-[8rem]"
                                value={dep.dependency_type}
                                onChange={val => setEditingVersionDependencies(prev => prev.map((d, i) => i === idx ? { ...d, dependency_type: val } : d))}
                                options={[
                                  { value: 'required', label: dependencyTypeLabel('required') },
                                  { value: 'optional', label: dependencyTypeLabel('optional') },
                                  { value: 'incompatible', label: dependencyTypeLabel('incompatible') },
                                  { value: 'embedded', label: dependencyTypeLabel('embedded') },
                                ]}
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="text-red-400 text-[10px] px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20"
                          onClick={() => setEditingVersionDependencies(prev => prev.filter((_, i) => i !== idx))}
                        >
                          {t('remove')}
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
                    className="min-w-[9rem] flex-1 rounded-lg border border-modrinth-border bg-modrinth-bg px-3 py-2 text-[11px] text-modrinth-text outline-none focus:border-modrinth-green"
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
                  <AppSelect
                    compact
                    className="min-w-[9rem]"
                    value={newDepType}
                    onChange={value => setNewDepType(value as typeof newDepType)}
                    options={[
                      { value: 'required', label: dependencyTypeLabel('required') },
                      { value: 'optional', label: dependencyTypeLabel('optional') },
                      { value: 'incompatible', label: dependencyTypeLabel('incompatible') },
                      { value: 'embedded', label: dependencyTypeLabel('embedded') },
                    ]}
                  />
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg border border-modrinth-border bg-modrinth-bg text-[11px] text-modrinth-muted hover:text-modrinth-text shrink-0"
                    onClick={() => {
                      const input = depInputRef.current;
                      if (!input || !input.value) return;
                      const value = input.value.trim();
                      if (!value) return;
                      void handleAddDependency(value);
                      input.value = '';
                    }}
                  >
                  {t('add')}
                  </button>
                </div>
              </div>

              <div className="app-panel p-4">
                <label className="app-form-label">{t('loaders')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {allLoaders.map(ld => {
                    const active = editingVersionLoaders.includes(ld);
                    return (
                      <button
                        key={ld}
                        type="button"
                        onClick={() => setEditingVersionLoaders(prev => prev.includes(ld) ? prev.filter(x => x !== ld) : [...prev, ld])}
                        style={active ? { borderColor: 'var(--accent-color)', backgroundColor: 'color-mix(in srgb, var(--accent-color) 16%, transparent)' } : undefined}
                        className={`rounded-lg border px-2 py-1 text-[10px] uppercase ${active ? 'text-modrinth-text' : 'border-modrinth-border bg-modrinth-bg text-modrinth-muted'}`}
                      >
                        {ld}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg bg-modrinth-card p-4">
                <div className="mb-2 text-sm font-extrabold text-modrinth-text">{t('release_checklist')}</div>
                {editVersionWarnings.length === 0 ? (
                  <p className="text-xs font-bold text-modrinth-green">{t('release_checklist_ready')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {editVersionWarnings.map((warning) => (
                      <div key={warning} className="text-xs leading-relaxed text-yellow-400">{warning}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="app-topbar fixed bottom-0 left-0 right-0 z-[270] flex gap-3 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <button
                onClick={() => setEditingVersion(null)}
                className="flex-1 py-3 rounded-lg text-sm font-bold bg-modrinth-card text-modrinth-muted hover:text-modrinth-text hover:bg-modrinth-cardHover"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSaveVersion}
                disabled={savingVersion}
                className="flex-1 py-3 rounded-lg text-sm font-bold bg-modrinth-green text-white flex items-center justify-center active:scale-95"
              >
                {savingVersion ? <Loader2 size={16} className="animate-spin" /> : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default ProjectDetail;
