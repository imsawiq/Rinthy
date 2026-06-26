import React, { useEffect, useRef, useState } from 'react';
import { ModrinthProject } from '../types';
import { Download, ChevronRight, Globe, Lock, Archive, Clock, Heart, MoreVertical, ExternalLink, Copy, Star, Box, Building2, Trash2 } from 'lucide-react';

interface ProjectCardProps {
  project: ModrinthProject;
  onClick: (id: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  showFavoriteAction?: boolean;
  organizationName?: string | null;
  onDeleteProject?: (project: ModrinthProject) => void;
  deleteProjectLabel?: string;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick, isFavorite = false, onToggleFavorite, showFavoriteAction = true, organizationName = null, onDeleteProject, deleteProjectLabel = 'Delete project' }) => {
  const title = project.title || project.name || project.slug || project.id;
  const summary = (project.description || '').trim() || 'No summary available';

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'approved': return { color: 'text-modrinth-green border-modrinth-green bg-modrinth-green/10', icon: Globe, label: 'Approved' };
      case 'draft': return { color: 'text-yellow-500 border-yellow-500 bg-yellow-500/10', icon: Lock, label: 'Draft' };
      case 'rejected': return { color: 'text-red-500 border-red-500 bg-red-500/10', icon: Lock, label: 'Rejected' };
      case 'archived': return { color: 'text-zinc-400 border-zinc-500 bg-zinc-500/10', icon: Archive, label: 'Archived' };
      case 'processing': return { color: 'text-blue-400 border-blue-500 bg-blue-500/10', icon: Clock, label: 'Processing' };
      default: return { color: 'text-gray-400 border-gray-500 bg-gray-500/10', icon: Clock, label: status };
    }
  };

  const status = getStatusInfo(project.status);
  const StatusIcon = status.icon;

  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const projectUrl = `https://modrinth.com/project/${project.slug || project.id}`;

  const clearPressedControl = (target: Element) => {
    window.requestAnimationFrame(() => {
      if (target instanceof HTMLElement) target.blur();
    });
  };

  const handleOpenOnWeb = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearPressedControl(e.currentTarget);
    window.open(projectUrl, '_blank');
    setShowMenu(false);
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    clearPressedControl(e.currentTarget);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(projectUrl);
      } else {
        // Fallback
        const tmp = document.createElement('textarea');
        tmp.value = projectUrl;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand('copy');
        document.body.removeChild(tmp);
      }
    } catch (err) {
      console.error(err);
    }
    setShowMenu(false);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearPressedControl(e.currentTarget);
    onToggleFavorite?.(project.id);
  };

  const handleDeleteProject = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearPressedControl(e.currentTarget);
    setShowMenu(false);
    onDeleteProject?.(project);
  };

  useEffect(() => {
    if (!showMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showMenu]);

  return (
    <article
      ref={menuRef}
      onClick={() => onClick(project.id)}
      className="app-panel app-project-card mb-3 cursor-pointer relative overflow-hidden transition-all duration-300 active:scale-[0.992]"
    >
      <div className="p-4">
      <div className="flex items-start justify-between gap-2 mb-3 relative z-10">
        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
          <div className="w-14 h-14 rounded-lg app-icon-tile overflow-hidden flex-shrink-0">
          {project.icon_url ? (
            <img src={project.icon_url} alt={title} className="w-full h-full object-cover object-center scale-[1.02]" loading="lazy" decoding="async" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-modrinth-bg text-modrinth-muted">
              <Box size={24} />
            </div>
          )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="app-project-card-title font-extrabold text-modrinth-text text-[17px] leading-tight truncate transition-colors">
              {title}
            </h3>
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <p className="min-w-0 truncate font-mono text-[11px] text-modrinth-muted opacity-80">
                {project.slug || project.id}
              </p>
              {organizationName && (
                <span className="inline-flex min-w-0 shrink items-center gap-1 rounded-md bg-modrinth-green/10 px-1.5 py-0.5 text-[10px] font-black text-modrinth-green">
                  <Building2 size={10} className="shrink-0" />
                  <span className="min-w-0 truncate">{organizationName}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {showFavoriteAction && (
          <button
            type="button"
            onClick={handleToggleFavorite}
            data-active={isFavorite ? 'true' : undefined}
            className="app-action-button app-favorite-button p-2.5"
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={18} strokeWidth={2.6} className={isFavorite ? 'fill-current' : ''} />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            clearPressedControl(e.currentTarget);
            setShowMenu(v => !v);
          }}
          data-active={showMenu ? 'true' : undefined}
          className="app-action-button p-2.5"
          aria-label="Project actions"
        >
          <MoreVertical size={20} strokeWidth={2.75} />
        </button>
      </div>

      <p className="text-sm text-modrinth-muted line-clamp-2 mb-4 leading-relaxed min-h-[2.5em] relative z-10">
        {summary}
      </p>

      {showMenu && (
        <div
          className="app-floating-menu app-glass-menu absolute top-14 right-4 z-50 rounded-lg text-xs overflow-hidden min-w-[188px] bg-modrinth-card border border-modrinth-border shadow-[0_18px_42px_rgba(0,0,0,0.48)]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleOpenOnWeb}
            className="app-glass-menu-item relative w-full px-3 py-2.5 flex items-center gap-2 text-modrinth-text text-left font-semibold"
          >
            <ExternalLink size={14} className="text-modrinth-green" />
            <span>Open on Modrinth</span>
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="app-glass-menu-item relative w-full px-3 py-2.5 flex items-center gap-2 text-modrinth-text text-left font-semibold"
          >
            <Copy size={14} className="text-modrinth-green" />
            <span>Copy link</span>
          </button>
          {onDeleteProject && (
            <button
              type="button"
              onClick={handleDeleteProject}
              className="app-glass-menu-item relative w-full px-3 py-2.5 flex items-center gap-2 text-red-400 text-left font-semibold"
            >
              <Trash2 size={14} />
              <span>{deleteProjectLabel}</span>
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-modrinth-muted border-t app-divider pt-3 relative z-10">
        <div className="flex flex-wrap gap-2 min-w-0">
          <div className="app-panel-soft flex items-center gap-1.5 px-2.5 py-1.5">
            <Download size={14} className="text-modrinth-green" />
            <span className="font-semibold text-modrinth-text">{project.downloads.toLocaleString()}</span>
          </div>
          <div className="app-panel-soft flex items-center gap-1.5 px-2.5 py-1.5">
            <Heart size={14} className="text-red-400" />
            <span className="font-semibold text-modrinth-text">{project.followers.toLocaleString()}</span>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${status.color}`}>
            <StatusIcon size={10} />
            {status.label}
          </div>
        </div>
        <ChevronRight size={17} className="app-project-card-chevron shrink-0 text-modrinth-muted transition-all transform" />
      </div>
      </div>
    </article>
  );
};

export default React.memo(ProjectCard);
