import React from 'react';
import { Calendar, Check, Download, Edit3, ExternalLink, FileText, Globe, Heart, Image as ImageIcon, Info, Layers, Loader2, Lock, Monitor, MoreVertical, Package, Plus, Save, Server, ShieldCheck, Trash2, Upload, UserPlus, Users, X } from 'lucide-react';
import type { GalleryImage, ModrinthProject, ModrinthVersion, ProjectDependency, ProjectMember } from '../../types';
import AppSelect from '../../components/AppSelect';

const MarkdownRenderer = React.lazy(() => import('../../components/MarkdownRenderer'));

export type ProjectTab = 'overview' | 'versions' | 'edit' | 'members';
export type Translator = (key: string) => string;

export type MemberEdit = {
  role: string;
  permissions: string;
  organization_permissions?: string;
  payouts_split: string;
  ordering: string;
};

type PermissionDefinition = {
  bit: number;
  label: string;
};

export const projectTabs: ProjectTab[] = ['overview', 'versions', 'edit', 'members'];

export const SectionHeading: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="app-section-heading px-1">
    {icon}
    <h3 className="min-w-0 truncate">{children}</h3>
  </div>
);

export const CompactPanel: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`app-panel relative ${className}`}>{children}</div>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="app-form-label">{children}</label>
);

const MetricTile: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <CompactPanel className="p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-modrinth-muted">{label}</p>
      <div className="text-modrinth-text/80">{icon}</div>
    </div>
    <p className="break-words text-2xl font-extrabold leading-none text-modrinth-text">{value}</p>
  </CompactPanel>
);

const translateEnum = (t: Translator, key: string, fallback: string) => {
  const translated = t(key);
  return translated === key ? fallback : translated;
};

const sideStatusMeta = (value?: string) => {
  switch (value) {
    case 'required':
      return { key: 'side_required', fallback: 'Required', tone: 'text-modrinth-text' };
    case 'optional':
      return { key: 'side_optional', fallback: 'Optional', tone: 'text-modrinth-text' };
    case 'unsupported':
      return { key: 'side_unsupported', fallback: 'Unsupported', tone: 'text-modrinth-text' };
    default:
      return { key: 'side_unknown', fallback: 'Unknown', tone: 'text-modrinth-muted' };
  }
};

const dependencyLabel = (t: Translator, value: string) => translateEnum(t, `dependency_${value}`, value);

const getFullGalleryImageUrl = (image: GalleryImage) => image.raw_url || image.url;

const versionTypeClass = (type: ModrinthVersion['version_type']) => {
  if (type === 'release') return 'bg-modrinth-green';
  if (type === 'beta') return 'bg-yellow-300';
  return 'bg-red-300';
};

const VersionTypeBadge: React.FC<{ type: ModrinthVersion['version_type']; t: Translator }> = ({ type, t }) => (
  <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-modrinth-muted">
    <span className={`h-1.5 w-1.5 rounded-full ${versionTypeClass(type)}`} />
    <span>{t(type)}</span>
  </span>
);

const SideValue: React.FC<{ icon: React.ReactNode; label: string; value: string; description: string; t: Translator }> = ({ icon, label, value, description, t }) => {
  const meta = sideStatusMeta(value);

  return (
  <CompactPanel className="p-4">
    <div className="mb-3 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-modrinth-muted">
      {icon}
      <span className="truncate">{label}</span>
    </div>
    <div className="rounded-lg border border-modrinth-border bg-modrinth-bg/70 px-3 py-2">
      <div className={`text-sm font-extrabold ${meta.tone}`}>{translateEnum(t, meta.key, meta.fallback)}</div>
      <div className="mt-1 text-[11px] leading-4 text-modrinth-muted">{description}</div>
    </div>
  </CompactPanel>
  );
};

const DependencyList: React.FC<{ deps: ProjectDependency[]; t: Translator }> = ({ deps, t }) => (
  <CompactPanel className="p-4">
    <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-modrinth-text">
      <Package size={16} className="text-modrinth-green" />
      {t('dependencies')}
    </h3>
    {deps.length === 0 ? (
      <p className="text-xs text-modrinth-muted">{t('no_dependencies')}</p>
    ) : (
      <div className="space-y-2">
        {deps.map((dep, index) => (
          <div key={`${dep.project_id || dep.file_name || index}`} className="grid min-w-0 grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-lg border border-modrinth-border bg-modrinth-bg/70 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-modrinth-border bg-modrinth-card">
              {dep.icon_url ? (
                <img src={dep.icon_url} className="h-full w-full object-cover" alt="" />
              ) : (
                <Package size={18} className="text-modrinth-muted" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <span className="min-w-0 flex-1 break-words text-sm font-extrabold leading-5 text-modrinth-text">{dep.title || dep.project_id || dep.file_name}</span>
                <span className="shrink-0 rounded-lg border border-modrinth-border bg-modrinth-card px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-modrinth-muted">{dependencyLabel(t, dep.dependency_type)}</span>
              </div>
              <p className="mt-1 break-all font-mono text-[10px] text-modrinth-muted">{dep.project_id || dep.file_name || dep.version_id}</p>
            </div>
          </div>
        ))}
      </div>
    )}
  </CompactPanel>
);

export const OverviewTab: React.FC<{
  project: ModrinthProject;
  deps: ProjectDependency[];
  projectSummary: string;
  t: Translator;
}> = ({ project, deps, projectSummary, t }) => (
  <div className="space-y-5 animate-fade-in">
    <div className="grid grid-cols-2 gap-3">
      <MetricTile icon={<Download size={34} strokeWidth={2.1} />} label={t('downloads')} value={project.downloads.toLocaleString()} />
      <MetricTile icon={<Heart size={34} strokeWidth={2.1} />} label={t('likes')} value={project.followers.toLocaleString()} />
    </div>

    <CompactPanel className="p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-modrinth-text">
        <Info size={16} className="text-modrinth-green" />
        {t('summary')}
      </h3>
      <p className="text-sm leading-6 text-modrinth-text/85">{projectSummary || t('no_summary')}</p>
    </CompactPanel>

    <CompactPanel className="p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-modrinth-text">
        <FileText size={16} className="text-modrinth-green" />
        {t('description')}
      </h3>
      {project.body?.trim() ? (
        <React.Suspense fallback={<div className="py-2 text-sm text-modrinth-muted">Loading description...</div>}>
          <MarkdownRenderer content={project.body} className="markdown-preview text-sm leading-6 text-modrinth-text/85" />
        </React.Suspense>
      ) : (
        <p className="text-sm leading-6 text-modrinth-text/80">{t('no_description')}</p>
      )}
    </CompactPanel>

    <div className="grid grid-cols-2 gap-3">
      <SideValue icon={<Monitor size={14} />} label={t('client')} value={project.client_side} description={translateEnum(t, 'client_side_desc', 'Whether the project is needed on the player side.')} t={t} />
      <SideValue icon={<Server size={14} />} label={t('server')} value={project.server_side} description={translateEnum(t, 'server_side_desc', 'Whether the project is needed on the server side.')} t={t} />
    </div>

    <DependencyList deps={deps} t={t} />

    {(project.source_url || project.issues_url) && (
      <div className="space-y-2 pt-1">
        <h3 className="px-1 text-xs font-extrabold uppercase tracking-[0.1em] text-modrinth-muted">{t('resources')}</h3>
        {project.source_url && (
          <a href={project.source_url} target="_blank" rel="noopener noreferrer" className="app-panel flex min-w-0 items-center gap-3 rounded-lg p-4 text-modrinth-text active:scale-[0.99]">
            <Globe size={18} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t('source')}</span>
            <ExternalLink size={14} className="shrink-0 opacity-40" />
          </a>
        )}
        {project.issues_url && (
          <a href={project.issues_url} target="_blank" rel="noopener noreferrer" className="app-panel flex min-w-0 items-center gap-3 rounded-lg p-4 text-modrinth-text active:scale-[0.99]">
            <Info size={18} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t('issues')}</span>
            <ExternalLink size={14} className="shrink-0 opacity-40" />
          </a>
        )}
      </div>
    )}
  </div>
);

export const VersionsTab: React.FC<{
  versions: ModrinthVersion[];
  versionMenuId: string | null;
  versionMenuRef: React.RefObject<HTMLDivElement | null>;
  t: Translator;
  canCreateVersions: boolean;
  canEditVersions: boolean;
  canDeleteVersions: boolean;
  setVersionMenuId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedVersion: (version: ModrinthVersion) => void;
  openCreateVersion: () => void;
  openEditVersion: (version: ModrinthVersion) => void;
  handleDeleteVersion: (version: ModrinthVersion) => void;
}> = ({ versions, versionMenuId, versionMenuRef, t, canCreateVersions, canEditVersions, canDeleteVersions, setVersionMenuId, setSelectedVersion, openCreateVersion, openEditVersion, handleDeleteVersion }) => (
  <div className="space-y-3 pb-24 animate-fade-in">
    {canCreateVersions && (
      <button
        type="button"
        onClick={openCreateVersion}
        className="app-primary flex w-full items-center justify-center gap-2 px-4 py-3 text-sm"
      >
        <Plus size={17} />
        {t('create_version')}
      </button>
    )}
    {versions.length === 0 ? (
      <div className="py-10 text-center text-modrinth-muted">
        <Layers size={44} className="mx-auto mb-4 opacity-45" />
        <p>{t('no_versions')}</p>
      </div>
    ) : (
      versions.map((version, index) => (
        <div key={version.id} className="app-panel app-reveal relative rounded-lg p-4 transition-transform active:scale-[0.99]" style={{ animationDelay: `${Math.min(index, 8) * 28}ms` }}>
          <button type="button" onClick={() => setSelectedVersion(version)} className="block w-full text-left">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="break-all text-lg font-extrabold leading-tight text-modrinth-text">{version.version_number}</span>
                  <VersionTypeBadge type={version.version_type} t={t} />
                </div>
                <p className="mt-1 break-words text-xs font-medium leading-5 text-modrinth-muted">{version.name}</p>
              </div>
              <div className="shrink-0 pr-8 text-right">
                <div className="flex items-center justify-end gap-1.5 text-xs font-extrabold text-modrinth-green">
                  <Download size={13} />
                  {version.downloads.toLocaleString()}
                </div>
                <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-modrinth-muted">
                  <Calendar size={10} />
                  {new Date(version.date_published).toLocaleDateString()}
                </div>
              </div>
            </div>
          </button>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {version.game_versions.map((gameVersion) => (
                  <span key={gameVersion} className="whitespace-nowrap rounded-md bg-modrinth-bg px-2 py-1 text-[10px] font-bold text-modrinth-text/80">{gameVersion}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {version.loaders.map((loader) => (
                  <span key={loader} className="rounded-md bg-modrinth-bg px-2 py-0.5 text-[10px] font-extrabold uppercase text-modrinth-green">{loader}</span>
                ))}
              </div>
            </div>
            {(canEditVersions || canDeleteVersions) && (
              <div className="absolute right-3 top-3" ref={versionMenuId === version.id ? versionMenuRef : null}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    const button = event.currentTarget;
                    window.requestAnimationFrame(() => button.blur());
                    setVersionMenuId(prev => prev === version.id ? null : version.id);
                  }}
                  data-active={versionMenuId === version.id ? 'true' : undefined}
                  className="app-action-button p-2"
                  aria-label="Version actions"
                >
                  <MoreVertical size={20} strokeWidth={3} />
                </button>
                {versionMenuId === version.id && (
                  <div className={`app-floating-menu app-glass-menu absolute right-0 z-[120] min-w-[148px] overflow-hidden rounded-lg border border-modrinth-border bg-modrinth-card text-xs shadow-[0_18px_42px_rgba(0,0,0,0.48)] ${index < 2 ? 'top-11' : 'bottom-11'}`}>
                    {canEditVersions && (
                      <button className="app-glass-menu-item w-full px-3 py-2.5 text-left font-semibold text-modrinth-text" onClick={(event) => { const button = event.currentTarget; window.requestAnimationFrame(() => button.blur()); setVersionMenuId(null); openEditVersion(version); }}>
                        Edit
                      </button>
                    )}
                    {canDeleteVersions && (
                      <button className="app-glass-menu-item w-full border-t border-modrinth-border/50 px-3 py-2.5 text-left font-semibold text-red-400" onClick={(event) => { const button = event.currentTarget; window.requestAnimationFrame(() => button.blur()); setVersionMenuId(null); handleDeleteVersion(version); }}>
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))
    )}
  </div>
);

export const EditTab: React.FC<{
  project: ModrinthProject;
  formData: Partial<ModrinthProject>;
  showBodyPreview: boolean;
  pendingIconFile: File | null;
  pendingIconPreviewUrl: string | null;
  removeIconPending: boolean;
  t: Translator;
  setShowBodyPreview: React.Dispatch<React.SetStateAction<boolean>>;
  setGalleryPreviewUrl: (url: string) => void;
  handleInputChange: (field: keyof ModrinthProject | string, value: any) => void;
  handleIconUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeleteIcon: () => void;
  handleGalleryUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeleteGallery: (url: string) => void;
}> = ({ project, formData, showBodyPreview, pendingIconFile, pendingIconPreviewUrl, removeIconPending, t, setShowBodyPreview, setGalleryPreviewUrl, handleInputChange, handleIconUpload, handleDeleteIcon, handleGalleryUpload, handleDeleteGallery }) => (
  <div className="space-y-6 pb-24 animate-fade-in">
    <section className="space-y-3">
      <SectionHeading icon={<ImageIcon size={17} />}>{t('icon')}</SectionHeading>
      <CompactPanel className="grid grid-cols-[60px_minmax(0,1fr)] items-center gap-3 p-4">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-modrinth-border bg-modrinth-bg/60">
          {pendingIconPreviewUrl && !removeIconPending ? (
            <img src={pendingIconPreviewUrl} className="h-full w-full object-cover" alt="" />
          ) : project.icon_url && !removeIconPending ? (
            <img src={project.icon_url} className="h-full w-full object-cover" alt="" />
          ) : (
            <ImageIcon className="text-modrinth-muted" />
          )}
        </div>
        <div className="min-w-0 space-y-2">
          {(pendingIconFile || removeIconPending) && (
            <div className="rounded-lg bg-yellow-300/10 px-3 py-2 text-xs font-extrabold text-yellow-300">
              {t('unsaved_changes')}
            </div>
          )}
          <label className="flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-modrinth-border bg-modrinth-bg/60 px-3 py-2 text-xs font-extrabold text-modrinth-text transition-colors hover:bg-modrinth-bg">
            <Upload size={14} className="shrink-0" />
            <span className="truncate">{t('upload')}</span>
            <input type="file" className="hidden" accept="image/png,image/jpeg" onChange={handleIconUpload} />
          </label>
          {project.icon_url && (
            <button onClick={handleDeleteIcon} className="flex w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-extrabold text-red-400 hover:bg-red-500/20">
              <Trash2 size={14} className="shrink-0" />
              <span className="truncate">{t('remove')}</span>
            </button>
          )}
        </div>
      </CompactPanel>
    </section>

    <section className="space-y-3">
      <SectionHeading icon={<Edit3 size={17} />}>{t('main_info')}</SectionHeading>
      <CompactPanel className="space-y-4 p-4">
        <div>
          <FieldLabel>{t('title')}</FieldLabel>
          <input type="text" value={formData.title || ''} onChange={(event) => handleInputChange('title', event.target.value)} className="app-input" />
        </div>
        <div>
          <FieldLabel>{t('short_desc')}</FieldLabel>
          <textarea value={formData.description || ''} onChange={(event) => handleInputChange('description', event.target.value)} className="app-input app-textarea min-h-[6rem]" />
        </div>
        <div className="space-y-2">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <FieldLabel>{t('body_desc')}</FieldLabel>
            <button type="button" onClick={() => setShowBodyPreview((value) => !value)} className="max-w-full shrink-0 truncate rounded-lg border border-modrinth-border bg-modrinth-bg px-2.5 py-1.5 text-[10px] text-modrinth-muted transition-colors hover:border-modrinth-green hover:text-modrinth-text">
              {showBodyPreview ? t('hide_preview') : t('show_preview')}
            </button>
          </div>
          <textarea value={formData.body || ''} onChange={(event) => handleInputChange('body', event.target.value)} className="app-input app-textarea min-h-[10rem] font-mono" />
          {showBodyPreview && (
            <div className="mt-1 overflow-x-auto rounded-xl border border-dashed border-modrinth-border bg-modrinth-bg p-3.5 text-sm text-modrinth-text markdown-preview no-scrollbar">
              <React.Suspense fallback={<div className="text-xs text-modrinth-muted">Loading preview...</div>}>
                <MarkdownRenderer content={formData.body || ''} />
              </React.Suspense>
            </div>
          )}
        </div>
      </CompactPanel>
    </section>

    <section className="space-y-3">
      <SectionHeading icon={<ImageIcon size={17} />}>{t('gallery')}</SectionHeading>
      <CompactPanel className="p-4">
        <div className="mb-4 grid grid-cols-2 gap-2">
          {project.gallery?.map((image, index) => (
            <button key={`${image.url}-${index}`} type="button" className="group relative aspect-square overflow-hidden rounded-lg bg-modrinth-bg" onClick={() => setGalleryPreviewUrl(getFullGalleryImageUrl(image))}>
              <img src={image.url} className="h-full w-full object-cover" alt="" />
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => { event.stopPropagation(); handleDeleteGallery(image.url); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    handleDeleteGallery(image.url);
                  }
                }}
                className="absolute right-1 top-1 rounded bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X size={12} />
              </span>
            </button>
          ))}
        </div>
        <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-modrinth-border bg-modrinth-bg px-4 py-3 text-sm font-extrabold text-modrinth-muted transition-colors hover:border-modrinth-green hover:text-modrinth-green">
          <Upload size={17} />
          {t('add')} Image
          <input type="file" className="hidden" accept="image/*" onChange={handleGalleryUpload} />
        </label>
      </CompactPanel>
    </section>

    <section className="space-y-3">
      <SectionHeading icon={<ShieldCheck size={17} />}>{t('status_license')}</SectionHeading>
      <CompactPanel className="space-y-4 p-4">
        <div>
          <FieldLabel>{t('status')}</FieldLabel>
          <div className="flex w-full items-center gap-2 rounded-lg border border-modrinth-border bg-modrinth-bg/60 p-3 text-sm text-modrinth-muted">
            <Lock size={14} />
            {formData.status}
          </div>
        </div>
        <div>
          <FieldLabel>{t('change_status')}</FieldLabel>
          <AppSelect
            value={['approved', 'processing', 'rejected', 'unknown'].includes(formData.status || '') ? 'keep' : formData.status}
            onChange={(value) => {
              handleInputChange('status', value === 'keep' ? project.status : value);
            }}
            options={[
              { value: 'keep', label: t('keep_current') },
              { value: 'draft', label: 'Draft' },
              { value: 'unlisted', label: 'Unlisted' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>
        <div>
          <FieldLabel>{t('license_id')}</FieldLabel>
          <input type="text" value={formData.license?.id || ''} onChange={(event) => handleInputChange('license_id', event.target.value)} className="app-input font-mono" />
        </div>
      </CompactPanel>
    </section>

    <section className="space-y-3">
      <SectionHeading icon={<Globe size={17} />}>{t('links')}</SectionHeading>
      <CompactPanel className="space-y-4 p-4">
        {['source_url', 'issues_url', 'wiki_url', 'discord_url'].map((field) => (
          <div key={field}>
            <FieldLabel>{field.replace('_url', '')}</FieldLabel>
            <input type="url" value={formData[field as keyof ModrinthProject] as string || ''} onChange={(event) => handleInputChange(field, event.target.value)} className="app-input" placeholder="https://..." />
          </div>
        ))}
      </CompactPanel>
    </section>
  </div>
);

export const MembersTab: React.FC<{
  members: ProjectMember[];
  memberEdits: Record<string, MemberEdit>;
  savingMemberId: string | null;
  currentUserId?: string | null;
  permissionDefs: PermissionDefinition[];
  t: Translator;
  setShowInviteModal: (visible: boolean) => void;
  setMemberEdits: React.Dispatch<React.SetStateAction<Record<string, MemberEdit>>>;
  handleRemoveMember: (userId: string) => void;
  handleRoleSave: (userId: string) => void;
  handleJoinTeam: () => void;
  openTransferOwnership: (userId: string, name: string) => void;
}> = ({ members, memberEdits, savingMemberId, currentUserId, permissionDefs, t, setShowInviteModal, setMemberEdits, handleRemoveMember, handleRoleSave, handleJoinTeam, openTransferOwnership }) => (
  <div className="space-y-4 pb-24 animate-fade-in">
    <div className="mb-2 flex items-center justify-between px-1">
      <div className="flex min-w-0 items-center gap-2 text-modrinth-green">
        <Users size={18} className="shrink-0" />
        <h3 className="min-w-0 truncate text-sm font-extrabold uppercase tracking-[0.08em]">{t('manage_members')}</h3>
      </div>
      <button onClick={() => setShowInviteModal(true)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-modrinth-green text-white active:scale-90">
        <UserPlus size={18} />
      </button>
    </div>

    {members.map((member) => {
      const edit = memberEdits[member.user.id] || { role: member.role || '', permissions: '', payouts_split: '', ordering: '' };
      const permissionsValue = edit.permissions !== '' ? Number(edit.permissions) : (member.permissions || 0);
      const canEditMember = member.role !== 'Owner';

      return (
        <CompactPanel key={member.user.id} className="space-y-4 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <img src={member.user.avatar_url} className="h-10 w-10 shrink-0 rounded-lg bg-modrinth-bg object-cover" alt="" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-extrabold text-modrinth-text">{member.user.username}</div>
              <div className="mt-1 text-xs text-modrinth-muted">{member.accepted ? t('accepted') : t('pending')}</div>
            </div>
            {canEditMember && (
              <button onClick={() => handleRemoveMember(member.user.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">
                <Trash2 size={16} />
              </button>
            )}
          </div>

          <div className="space-y-2">
            <FieldLabel>{t('role')}</FieldLabel>
            {canEditMember ? (
              <input
                value={edit.role}
                onChange={(event) => setMemberEdits(prev => ({
                  ...prev,
                  [member.user.id]: {
                    ...(prev[member.user.id] || { permissions: '', payouts_split: '', ordering: '' }),
                    role: event.target.value,
                  }
                }))}
                className="app-input"
                placeholder={t('custom_role_placeholder')}
              />
            ) : (
              <span className="inline-flex w-fit rounded-lg bg-modrinth-bg px-3 py-2 text-xs font-extrabold text-modrinth-green">Owner</span>
            )}
          </div>

          {canEditMember && (
            <div className="space-y-4">
              <div>
                <FieldLabel>{t('permissions_label')}</FieldLabel>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {permissionDefs.map((permission) => {
                    const isOn = !!(permissionsValue & (1 << permission.bit));
                    return (
                      <button
                        key={permission.bit}
                        type="button"
                        onClick={() => {
                          const nextValue = isOn ? (permissionsValue & ~(1 << permission.bit)) : (permissionsValue | (1 << permission.bit));
                          setMemberEdits(prev => ({
                            ...prev,
                            [member.user.id]: {
                              ...(prev[member.user.id] || { role: member.role || '', payouts_split: '', ordering: '' }),
                              permissions: String(nextValue),
                            }
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>{t('payouts_split_label')}</FieldLabel>
                  <input
                    value={edit.payouts_split}
                    onChange={(event) => setMemberEdits(prev => ({
                      ...prev,
                      [member.user.id]: {
                        ...(prev[member.user.id] || { role: member.role || '', permissions: '', ordering: '' }),
                        payouts_split: event.target.value,
                      }
                    }))}
                    className="app-input"
                    placeholder="50"
                  />
                </div>
                <div>
                  <FieldLabel>{t('ordering_label')}</FieldLabel>
                  <input
                    value={edit.ordering}
                    onChange={(event) => setMemberEdits(prev => ({
                      ...prev,
                      [member.user.id]: {
                        ...(prev[member.user.id] || { role: member.role || '', permissions: '', payouts_split: '' }),
                        ordering: event.target.value,
                      }
                    }))}
                    className="app-input"
                    placeholder="0"
                  />
                </div>
              </div>

              <button
                onClick={() => handleRoleSave(member.user.id)}
                className="app-primary flex w-full items-center justify-center gap-2 px-3 py-3 text-sm disabled:opacity-60"
                disabled={savingMemberId === member.user.id}
                aria-label={t('save')}
              >
                {savingMemberId === member.user.id ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {t('save')}
              </button>

              <button onClick={() => openTransferOwnership(member.user.id, member.user.username)} className="w-full rounded-lg border border-modrinth-border bg-modrinth-bg px-3 py-2 text-xs font-extrabold text-modrinth-muted hover:border-modrinth-green hover:text-modrinth-text">
                {t('transfer_owner')}
              </button>
            </div>
          )}

          {member.user.id === currentUserId && member.accepted === false && (
            <button onClick={handleJoinTeam} className="rounded-lg bg-modrinth-green px-3 py-2 text-xs font-extrabold text-white">
              {t('accept_invite')}
            </button>
          )}
        </CompactPanel>
      );
    })}
  </div>
);
