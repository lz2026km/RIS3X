/**
 * G005 放射RIS系统 v3.0.0 - a11y 跳过链接 / 焦点管理
 * Phase T3-W7: 键盘导航 + 屏幕阅读器
 *
 * 功能:
 *   - 跳过导航,直达主内容
 *   - 全局快捷键 Ctrl+K 命令面板,Ctrl+/ 帮助)
 *   - 焦点陷阱(Modal)
 *   - 实时公告(aria-live)
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/** 跳过链接(无障碍) */
export function SkipLink({ targetId = 'main-content' }: { targetId?: string }): JSX.Element {
  return (
    <a
      href={`#${targetId}`}
      style={{
        position: 'absolute',
        left: '-9999px',
        top: '0',
        zIndex: 9999,
        padding: '12px 24px',
        background: 'var(--color-primary-800)',
        color: 'white',
        textDecoration: 'none',
        borderRadius: '0 0 4px 0',
      }}
      onFocus={(e) => {
        e.currentTarget.style.left = '0';
      }}
      onBlur={(e) => {
        e.currentTarget.style.left = '-9999px';
      }}
    >
      跳到主内容
    </a>
  );
}

/** 主内容ID(配合 SkipLink) */
export const MAIN_CONTENT_ID = 'main-content';

/** 实时公告(aria-live) - 视觉隐藏但屏幕阅读器可读 */
export function LiveRegion({ message, politeness = 'polite' }: { message: string; politeness?: 'polite' | 'assertive' }): JSX.Element {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        clipPath: 'inset(50%)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {message}
    </div>
  );
}

/** 焦点陷阱 hook(用于 Modal / Drawer) */
export function useFocusTrap(active = true): React.RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !ref.current) return;

    const container = ref.current;
    const focusable = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    container.addEventListener('keydown', handleKey);
    first?.focus();

    return () => container.removeEventListener('keydown', handleKey);
  }, [active]);

  return ref;
}

/** 全局快捷键 hook */
export function useGlobalShortcuts(shortcuts: Record<string, () => void>): void {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const key = [
        e.ctrlKey && 'Ctrl',
        e.metaKey && 'Meta',
        e.altKey && 'Alt',
        e.shiftKey && 'Shift',
        e.key.toUpperCase(),
      ].filter(Boolean).join('+');

      const handler = shortcuts[key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [shortcuts]);
}

/** 命令面板(Ctrl+K) */
export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  shortcut?: string;
  action: () => void;
  category?: string;
}

export function useCommandPalette(items: CommandItem[]): {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  filter: string;
  setFilter: (q: string) => void;
  filtered: CommandItem[];
} {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');

  useGlobalShortcuts({
    'Ctrl+K': () => setIsOpen(true),
    'Meta+K': () => setIsOpen(true),
  });

  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(filter.toLowerCase()) ||
    item.description?.toLowerCase().includes(filter.toLowerCase())
  );

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => { setIsOpen(false); setFilter(''); },
    filter,
    setFilter,
    filtered,
  };
}

/** 屏幕阅读器友好动态内容通知 */
export function useScreenReaderAnnouncer(): {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  Announcement: () => JSX.Element;
} {
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'polite' | 'assertive'>('polite');

  const announce = useCallback((msg: string, pri: 'polite' | 'assertive' = 'polite') => {
    setMessage('');
    // 短暂清空再设置,确保屏幕阅读器重新读
    setTimeout(() => {
      setMessage(msg);
      setPriority(pri);
    }, 50);
  }, []);

  const Announcement = useCallback(() => <LiveRegion message={message} politeness={priority} />, [message, priority]);

  return { announce, Announcement };
}
