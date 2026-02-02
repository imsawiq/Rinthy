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
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
      >
        <div className="pointer-events-auto">
          <div className="relative overflow-hidden rounded-2xl bg-modrinth-card/70 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-colors duration-300">
            <div className="relative h-[56px] px-1">
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
                          `relative flex items-center justify-center h-8 w-12 rounded-xl transition-all duration-300 overflow-hidden ` +
                          (isActive
                            ? 'bg-modrinth-green/14'
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
                          `text-[10px] font-semibold transition-all duration-300 ` +
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