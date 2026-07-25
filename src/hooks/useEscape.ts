import { useEffect, type RefObject } from 'react';

export function useEscape(
  active: boolean,
  onEscape: () => void,
  options?: { stopPropagation?: boolean }
): void {
  useEffect(() => {
    if (!active) return;
    if (typeof document === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (options?.stopPropagation) e.stopPropagation();
        e.preventDefault();
        onEscape();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active, onEscape, options?.stopPropagation]);
}

export function useFocusOnMount(
  ref: RefObject<HTMLElement | null>,
  active: boolean
): void {
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      ref.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [active, ref]);
}
