import React from 'react';
import { NavTab } from '../types';
import { Grid, BarChart2, Settings } from 'lucide-react';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  t: (key: string) => string;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, t }) => {
  const navItems = [
    { id: NavTab.PROJECTS, icon: Grid, label: t('dashboard') },
    { id: NavTab.ANALYTICS, icon: BarChart2, label: t('analytics') },
    { id: NavTab.SETTINGS, icon: Settings, label: t('settings') },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] pointer-events-none">
      <div
        className="mx-auto max-w-md px-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 14px)' }}
      >
        <div className="pointer-events-auto">
          <div className="h-2"></div>
          <div className="relative overflow-hidden rounded-[22px] bg-modrinth-card/55 backdrop-blur-2xl shadow-[0_14px_50px_rgba(0,0,0,0.55)] transition-colors duration-300">
            <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-gradient-to-b from-white/[0.045] via-transparent to-black/10"></div>
            <div className="pointer-events-none absolute inset-0 rounded-[22px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),inset_0_0_0_2px_rgba(0,0,0,0.35)]"></div>
            <div className="relative h-[68px] px-2">
              <div className="flex justify-between items-center h-full gap-1">
                {navItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className="relative flex flex-col items-center justify-center gap-1 w-full h-full cursor-pointer group active:scale-[0.98] transition-transform duration-150"
                    >
                      <div
                        className={
                          `relative flex items-center justify-center h-9 w-12 rounded-2xl transition-all duration-300 overflow-hidden ` +
                          (isActive
                            ? 'bg-modrinth-green/12 shadow-[0_10px_25px_rgba(48,178,124,0.14)]'
                            : 'bg-transparent hover:bg-modrinth-text/5')
                        }
                      >
                        <div
                          className={
                            `pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300 ` +
                            (isActive
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-60')
                          }
                        >
                          <div className="absolute inset-0 bg-gradient-to-b from-white/14 via-white/6 to-transparent"></div>
                          <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.10)]"></div>
                        </div>
                        <item.icon
                          size={23}
                          strokeWidth={isActive ? 2.6 : 2.1}
                          className={
                            `transition-colors duration-300 ` +
                            (isActive
                              ? 'text-modrinth-green'
                              : 'text-modrinth-muted group-hover:text-modrinth-text')
                          }
                        />
                        {isActive && (
                          <>
                            <div className="absolute -bottom-2 h-0.5 w-9 rounded-full bg-modrinth-green/70 blur-0 shadow-[0_0_10px_rgba(48,178,124,0.35)] animate-fade-in"></div>
                            <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"></div>
                          </>
                        )}
                      </div>
                      <span
                        className={
                          `text-[10px] font-medium transition-all duration-300 ` +
                          (isActive
                            ? 'text-modrinth-text opacity-100 translate-y-0'
                            : 'text-modrinth-muted opacity-70 group-hover:opacity-100')
                        }
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottomNav;