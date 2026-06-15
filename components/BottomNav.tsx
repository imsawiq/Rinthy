import React from 'react';
import { NavTab } from '../types';
import { Grid, BarChart2, Settings, Users } from 'lucide-react';
import type { ThemeMode } from '../types';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  t: (key: string) => string;
  theme: ThemeMode;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, t, theme }) => {
  const navItems = [
    { id: NavTab.PROJECTS, icon: Grid, label: t('dashboard') },
    { id: NavTab.TEAMS, icon: Users, label: t('teams') },
    { id: NavTab.ANALYTICS, icon: BarChart2, label: t('analytics') },
    { id: NavTab.SETTINGS, icon: Settings, label: t('settings') },
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] w-full max-w-full pointer-events-none overflow-hidden">
      <div
        className="mx-auto w-full max-w-md px-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
      >
        <div className="pointer-events-auto">
          <div className={`app-bottom-nav relative overflow-hidden border transition-colors duration-300 ${
            theme === 'light'
              ? 'rounded-lg bg-modrinth-card border-black/10 shadow-none'
              : theme === 'glass'
                ? 'rounded-[2rem] bg-modrinth-card border-modrinth-border shadow-[0_18px_46px_rgba(0,0,0,0.42)]'
                : 'rounded-lg bg-modrinth-card border-modrinth-border shadow-[0_18px_46px_rgba(0,0,0,0.42)]'
          }`}>
            <div className={`relative h-[60px] ${theme === 'glass' ? 'px-2 py-1.5' : 'px-1.5'}`}>
              <div className="flex justify-between items-center h-full gap-1">
                {navItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      data-active={isActive ? 'true' : undefined}
                      className={
                        `app-bottom-nav-item relative flex flex-col items-center justify-center gap-1 w-full cursor-pointer group transition-all duration-200 active:scale-[0.98] ` +
                        (theme === 'glass'
                          ? 'h-full rounded-[1.45rem]'
                          : 'h-full')
                      }
                    >
                      <span className={`absolute top-0 h-0.5 w-8 rounded-full transition-all ${isActive && theme !== 'glass' ? 'bg-modrinth-green opacity-100' : 'bg-transparent opacity-0'}`} />
                      <div
                        className={
                          `relative flex items-center justify-center h-8 w-12 transition-all duration-300 overflow-hidden ${theme === 'glass' ? 'rounded-full' : 'rounded-md'} ` +
                          (isActive
                            ? theme === 'glass' ? 'bg-transparent' : 'bg-modrinth-green/16'
                            : 'bg-transparent hover:bg-modrinth-text/5')
                        }
                      >
                        <item.icon
                          size={22}
                          strokeWidth={isActive ? 2.6 : 2.1}
                          className={
                            `transition-colors duration-300 ` +
                            (isActive
                              ? 'text-modrinth-green'
                              : 'text-modrinth-muted group-hover:text-modrinth-text')
                          }
                        />
                      </div>
                      <span
                        className={
                          `text-[10px] font-bold transition-all duration-300 ` +
                          (isActive
                            ? 'text-modrinth-text opacity-100'
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
