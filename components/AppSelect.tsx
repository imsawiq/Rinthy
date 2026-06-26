import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useBackDismiss } from '../hooks/useBackDismiss';

export type AppSelectOption<T extends string = string> = {
  value: T;
  label: string;
};

type AppSelectProps<T extends string = string> = {
  value: T;
  options: Array<AppSelectOption<T>>;
  onChange: (value: T) => void;
  className?: string;
  compact?: boolean;
};

const AppSelect = <T extends string = string>({ value, options, onChange, className = '', compact = false }: AppSelectProps<T>) => {
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
  const [menuRect, setMenuRect] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const viewportFrameRef = useRef<number | null>(null);
  const selected = options.find(option => option.value === value) ?? options[0];
  const open = phase === 'open';
  const visible = phase !== 'closed';

  const updateMenuRect = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const gap = 6;
    const margin = 12;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const desiredHeight = Math.min(280, Math.max(44, options.length * (compact ? 34 : 40) + 8));
    const shouldOpenUp = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
    const availableSpace = Math.max(80, shouldOpenUp ? spaceAbove - gap : spaceBelow - gap);
    const maxHeight = Math.min(desiredHeight, availableSpace);

    setMenuRect({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      top: shouldOpenUp
        ? Math.max(margin, rect.top - gap - maxHeight)
        : Math.min(rect.bottom + gap, window.innerHeight - margin),
      width: rect.width,
      maxHeight,
    });
  };

  const openMenu = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    updateMenuRect();
    setPhase('open');
  };

  const closeMenu = () => {
    if (phase !== 'open') return;
    setPhase('closing');
    closeTimerRef.current = window.setTimeout(() => setPhase('closed'), 120);
  };

  useBackDismiss(open, closeMenu);

  useEffect(() => {
    if (!visible) return;
    updateMenuRect();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    const handleViewportChange = () => {
      if (viewportFrameRef.current !== null) return;
      viewportFrameRef.current = window.requestAnimationFrame(() => {
        viewportFrameRef.current = null;
        updateMenuRect();
      });
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
      if (viewportFrameRef.current !== null) {
        window.cancelAnimationFrame(viewportFrameRef.current);
        viewportFrameRef.current = null;
      }
    };
  }, [visible, phase]);

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    if (viewportFrameRef.current !== null) window.cancelAnimationFrame(viewportFrameRef.current);
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`app-input app-select-control flex items-center justify-between gap-3 text-left transition-colors ${compact ? 'min-h-8 rounded-lg px-3 py-2 text-[0.72rem] leading-tight' : ''} ${className}`}
        onClick={() => open ? closeMenu() : openMenu()}
      >
        <span className="min-w-0 truncate">{selected?.label}</span>
        <ChevronDown size={14} className={`shrink-0 text-modrinth-muted transition-transform duration-200 ${open ? 'rotate-180 text-modrinth-text' : ''}`} />
      </button>

      {visible && menuRect && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          data-closing={phase === 'closing' ? 'true' : undefined}
          className="app-select-menu fixed z-[360] overflow-y-auto rounded-lg border border-modrinth-border bg-modrinth-card p-1 text-sm text-modrinth-text shadow-[0_18px_44px_rgba(0,0,0,0.42)]"
          style={{ left: menuRect.left, top: menuRect.top, width: menuRect.width, maxHeight: menuRect.maxHeight }}
        >
          {options.map(option => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-active={isSelected ? 'true' : undefined}
                className={`app-glass-menu-item flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left font-semibold transition-colors ${
                  isSelected ? 'text-modrinth-green' : 'text-modrinth-text hover:bg-modrinth-bg'
                } ${compact ? 'text-[11px]' : 'text-sm'}`}
                onClick={() => {
                  onChange(option.value);
                  closeMenu();
                }}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {isSelected && <Check size={13} className="shrink-0 text-[var(--accent-color)]" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
};

export default AppSelect;
