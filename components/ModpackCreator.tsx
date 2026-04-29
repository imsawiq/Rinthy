import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Package, Search, Plus, Trash2, Download, Loader2, X, ChevronDown, Check } from 'lucide-react';
import JSZip from 'jszip';
import { searchProjects, fetchProjectVersions } from '../services/modrinthService';
import { ModrinthProject, ModrinthVersion, ThemeMode } from '../types';

interface ModpackFile {
  project: ModrinthProject;
  version: ModrinthVersion;
}

interface ModpackCreatorProps {
  theme: ThemeMode;
  t: (key: string) => string;
  token: string;
}

const ModpackCreator: React.FC<ModpackCreatorProps> = ({ theme, t, token }) => {
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [summary, setSummary] = useState('');
  const [minecraftVersion, setMinecraftVersion] = useState('1.20.1');
  const [loader, setLoader] = useState<'fabric' | 'forge' | 'neoforge' | 'quilt'>('fabric');
  const [loaderVersion, setLoaderVersion] = useState('');
  const [files, setFiles] = useState<ModpackFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ModrinthProject[]>([]);
  const [searching, setSearching] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedProjectVersions, setSelectedProjectVersions] = useState<ModrinthVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [currentProject, setCurrentProject] = useState<ModrinthProject | null>(null);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchProjects(searchQuery);
        setSearchResults(results);
      } catch (e) {
        console.error(e);
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery]);

  const handleAddProject = async (project: ModrinthProject) => {
    setCurrentProject(project);
    setLoadingVersions(true);
    try {
      const versions = await fetchProjectVersions(project.id, token);
      setSelectedProjectVersions(versions.filter(v => v.game_versions.includes(minecraftVersion)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleSelectVersion = (version: ModrinthVersion) => {
    if (!currentProject) return;
    setFiles(prev => [...prev, { project: currentProject, version }]);
    setCurrentProject(null);
    setSelectedProjectVersions([]);
    setShowSearch(false);
    setSearchQuery('');
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const zip = new JSZip();

      const indexJson = {
        formatVersion: 1,
        game: "minecraft",
        versionId: version,
        name: name || "My Modpack",
        summary: summary,
        files: files.map(f => {
          const primaryFile = f.version.files.find(file => file.primary) || f.version.files[0];
          return {
            path: `mods/${primaryFile.filename}`,
            hashes: primaryFile.hashes,
            env: {
              client: f.project.client_side || "required",
              server: f.project.server_side || "required"
            },
            downloads: [primaryFile.url],
            fileSize: primaryFile.size
          };
        }),
        dependencies: {
          minecraft: minecraftVersion,
          [loader]: loaderVersion || "latest"
        }
      };

      zip.file("modrinth.index.json", JSON.stringify(indexJson, null, 2));
      zip.folder("overrides");

      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${name || "modpack"}.mrpack`;
      link.click();
      window.URL.revokeObjectURL(url);

      const toast = document.createElement('div');
      toast.innerText = t('modpack_exported');
      toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-modrinth-green text-white px-6 py-3 rounded-full shadow-xl z-[200] font-bold text-sm';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    } catch (e) {
      console.error(e);
      alert("Failed to export modpack");
    } finally {
      setExporting(false);
    }
  };

  const inputClass = theme === 'light'
    ? 'bg-black/[0.04] text-black border border-black/10 focus:border-modrinth-green'
    : 'bg-modrinth-card text-modrinth-text border-modrinth-border focus:border-modrinth-green';

  const cardClass = theme === 'light'
    ? 'bg-white border border-black/10'
    : 'bg-modrinth-card/50 backdrop-blur-xl border-modrinth-border';

  return (
    <div className="p-4 space-y-6 animate-fade-in">
      <header className="flex flex-col gap-1 mb-2">
        <h1 className="text-2xl font-bold text-modrinth-text">{t('modpack_creator')}</h1>
        <p className="text-modrinth-muted text-xs font-medium">{t('dev_panel')}</p>
      </header>

      <div className={`${cardClass} p-5 rounded-3xl space-y-4 shadow-lg`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-modrinth-muted uppercase mb-1.5">{t('modpack_name')}</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={`w-full rounded-xl p-3 text-sm outline-none transition-colors ${inputClass}`}
              placeholder="Cool Pack"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-modrinth-muted uppercase mb-1.5">{t('modpack_version')}</label>
            <input
              type="text"
              value={version}
              onChange={e => setVersion(e.target.value)}
              className={`w-full rounded-xl p-3 text-sm outline-none transition-colors ${inputClass}`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-modrinth-muted uppercase mb-1.5">{t('modpack_summary')}</label>
          <textarea
            value={summary}
            onChange={e => setSummary(e.target.value)}
            className={`w-full rounded-xl p-3 text-sm outline-none transition-colors h-20 resize-none ${inputClass}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-modrinth-muted uppercase mb-1.5">{t('modpack_game')} Version</label>
            <input
              type="text"
              value={minecraftVersion}
              onChange={e => setMinecraftVersion(e.target.value)}
              className={`w-full rounded-xl p-3 text-sm outline-none transition-colors ${inputClass}`}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-modrinth-muted uppercase mb-1.5">Loader</label>
            <select
              value={loader}
              onChange={e => setLoader(e.target.value as any)}
              className={`w-full rounded-xl p-3 text-sm outline-none transition-colors ${inputClass}`}
            >
              <option value="fabric">Fabric</option>
              <option value="forge">Forge</option>
              <option value="neoforge">NeoForge</option>
              <option value="quilt">Quilt</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-modrinth-muted uppercase">{t('modpack_files')}</h3>
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 bg-modrinth-green text-white px-4 py-2 rounded-full text-xs font-bold active:scale-95 transition-transform"
          >
            <Plus size={16} /> {t('modpack_add_file')}
          </button>
        </div>

        <div className="space-y-2">
          {files.map((file, idx) => (
            <div key={idx} className={`${cardClass} p-3 rounded-2xl flex items-center gap-3 animate-fade-in-up`}>
              <img src={file.project.icon_url} className="w-10 h-10 rounded-lg bg-modrinth-bg" alt="" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-modrinth-text truncate">{file.project.title}</div>
                <div className="text-[10px] text-modrinth-muted uppercase font-bold">{file.version.version_number}</div>
              </div>
              <button
                onClick={() => handleRemoveFile(idx)}
                className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {files.length === 0 && (
            <div className="text-center py-10 text-modrinth-muted italic text-sm">
              {t('modpack_no_files')}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleExport}
        disabled={exporting || files.length === 0}
        className="w-full bg-modrinth-green text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-modrinth-green/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
      >
        {exporting ? <Loader2 className="animate-spin" /> : <Download size={20} />}
        {exporting ? t('modpack_exporting') : t('modpack_export')}
      </button>

      {showSearch && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className={`${theme === 'light' ? 'bg-white' : 'bg-modrinth-card'} w-full max-w-sm rounded-3xl p-5 shadow-2xl animate-scale-in flex flex-col max-h-[80vh]`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-modrinth-text">{t('modpack_add_file')}</h3>
              <button onClick={() => setShowSearch(false)} className="p-2 hover:bg-black/5 rounded-full text-modrinth-muted"><X size={20} /></button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 text-modrinth-muted" size={18} />
              <input
                autoFocus
                type="text"
                placeholder={t('modpack_search_placeholder')}
                className={`w-full rounded-2xl pl-10 pr-4 py-3 text-sm outline-none border transition-colors ${inputClass}`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {searching && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-modrinth-green" /></div>}
              {!searching && searchResults.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleAddProject(p)}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-colors ${theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/5'}`}
                >
                  <div className="flex items-center gap-3">
                    <img src={p.icon_url} className="w-10 h-10 rounded-xl" alt="" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-modrinth-text truncate">{p.title}</div>
                      <div className="text-[10px] text-modrinth-muted uppercase font-bold">{p.downloads.toLocaleString()} downloads</div>
                    </div>
                  </div>
                  <ChevronDown size={18} className="text-modrinth-muted" />
                </div>
              ))}
            </div>

            {currentProject && (
              <div className="absolute inset-0 bg-inherit rounded-3xl p-5 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-modrinth-text truncate pr-4">{currentProject.title}</h3>
                  <button onClick={() => setCurrentProject(null)} className="p-2 hover:bg-black/5 rounded-full text-modrinth-muted"><X size={20} /></button>
                </div>
                <p className="text-xs text-modrinth-muted mb-4 uppercase font-bold tracking-wider">Select Version for {minecraftVersion}</p>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {loadingVersions && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-modrinth-green" /></div>}
                  {!loadingVersions && selectedProjectVersions.length === 0 && (
                    <div className="text-center py-10 text-modrinth-muted italic">No compatible versions found.</div>
                  )}
                  {!loadingVersions && selectedProjectVersions.map(v => (
                    <div
                      key={v.id}
                      onClick={() => handleSelectVersion(v)}
                      className={`p-3 rounded-2xl cursor-pointer transition-colors border ${theme === 'light' ? 'border-black/5 hover:bg-black/5' : 'border-white/5 hover:bg-white/5'}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-modrinth-text">{v.version_number}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          v.version_type === 'release' ? 'bg-green-500/10 text-green-500' :
                          v.version_type === 'beta' ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'
                        }`}>
                          {v.version_type}
                        </span>
                      </div>
                      <div className="text-[10px] text-modrinth-muted mt-1 uppercase font-bold">{v.loaders.join(', ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModpackCreator;
