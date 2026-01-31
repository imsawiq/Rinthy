import React, { useState } from 'react';
import { ModrinthProject } from '../types';
import { Download, Activity, ChevronRight, Globe, Lock, Archive, Clock, Heart, MoreVertical, ExternalLink, Copy } from 'lucide-react';

interface ProjectCardProps {
  project: ModrinthProject;
  onClick: (id: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick }) => {
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

  const projectUrl = `https://modrinth.com/project/${project.slug}`;

  const handleOpenOnWeb = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(projectUrl, '_blank');
    setShowMenu(false);
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <div 
      onClick={() => onClick(project.id)}
      className="bg-modrinth-card/70 backdrop-blur-xl rounded-3xl p-4 mb-4 active:scale-[0.985] transition-all duration-300 cursor-pointer shadow-[0_12px_38px_rgba(0,0,0,0.32)] hover:shadow-[0_18px_50px_rgba(0,0,0,0.40)] group relative overflow-hidden"
    >
      {/* Decorative gradient glow */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.035] via-transparent to-black/10" />
      <div className="absolute inset-0 pointer-events-none rounded-3xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035),inset_0_0_0_2px_rgba(0,0,0,0.25)]" />
      <div className="absolute top-0 right-0 w-24 h-24 bg-modrinth-green/6 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          <div className="w-14 h-14 rounded-2xl bg-modrinth-bg overflow-hidden flex-shrink-0 border border-modrinth-border/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            {project.icon_url ? (
              <img src={project.icon_url} alt={project.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-modrinth-card to-modrinth-bg text-modrinth-muted font-bold text-xl">
                {project.title.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 pr-2">
            <h3 className="font-bold text-modrinth-text text-lg leading-tight truncate group-hover:text-modrinth-green transition-colors">
              {project.title}
            </h3>
            <p className="text-xs text-modrinth-muted truncate mt-0.5 font-mono opacity-70">
              {project.slug}
            </p>
          </div>
        </div>
        
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${status.color}`}>
          <StatusIcon size={10} />
          {status.label}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }}
          className="ml-2 p-2 rounded-full text-zinc-500 hover:text-modrinth-green hover:bg-modrinth-bg/60 transition-colors"
        >
          <MoreVertical size={16} />
        </button>
      </div>

      {showMenu && (
        <div
          className="absolute top-10 right-4 z-30 bg-modrinth-card backdrop-blur-2xl rounded-2xl shadow-[0_18px_50px_rgba(0,0,0,0.55)] py-1.5 min-w-[180px] text-xs overflow-hidden animate-fade-in-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.03] via-transparent to-black/10" />
          <div className="absolute inset-0 pointer-events-none rounded-2xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_0_0_2px_rgba(0,0,0,0.28)]" />
          <button
            type="button"
            onClick={handleOpenOnWeb}
            className="relative w-full px-3 py-2 flex items-center gap-2 text-modrinth-text hover:bg-modrinth-bg text-left"
          >
            <ExternalLink size={14} className="text-modrinth-green" />
            <span>Open on Modrinth</span>
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="relative w-full px-3 py-2 flex items-center gap-2 text-modrinth-text hover:bg-modrinth-bg text-left border-t border-modrinth-border/20"
          >
            <Copy size={14} className="text-modrinth-green" />
            <span>Copy link</span>
          </button>
        </div>
      )}

      <p className="text-sm text-modrinth-text/80 line-clamp-2 mb-4 leading-relaxed min-h-[2.5em] relative z-10">
        {project.description}
      </p>

      <div className="flex items-center justify-between text-xs text-modrinth-muted border-t border-modrinth-border/40 pt-3 relative z-10">
        <div className="flex gap-5">
          <div className="flex items-center gap-1.5 group/stat">
            <Download size={14} className="text-zinc-500 group-hover/stat:text-modrinth-green transition-colors" />
            <span className="font-medium group-hover/stat:text-modrinth-text transition-colors">{project.downloads.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 group/stat">
            <Heart size={14} className="text-zinc-500 group-hover/stat:text-modrinth-green transition-colors" />
            <span className="font-medium group-hover/stat:text-modrinth-text transition-colors">{project.followers.toLocaleString()}</span>
          </div>
        </div>
        <ChevronRight size={16} className="text-zinc-600 group-hover:text-modrinth-green transition-all transform group-hover:translate-x-1" />
      </div>
    </div>
  );
};

export default ProjectCard;