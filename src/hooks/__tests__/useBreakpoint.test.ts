/**
 * G005 放射RIS系统 v3.0.0 - useBreakpoint hook 测试
 * Phase T1-W2: 响应式 hooks 测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
vi.mock('../useBreakpoint', async () => {
  const actual = await vi.importActual<typeof import('../useBreakpoint')>('../useBreakpoint');
  return { ...actual, useIsTouchDevice: () => false };
});
import {
  useBreakpoint,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useViewportWidth,
  useOrientation,
  useIsTouchDevice,
  getBreakpoint,
} from '../useBreakpoint';

describe('getBreakpoint - 断点计算', () => {
  it('< 576 返回 xs', () => {
    expect(getBreakpoint(375)).toBe('xs');
    expect(getBreakpoint(0)).toBe('xs');
  });

  it('576-767 返回 sm', () => {
    expect(getBreakpoint(576)).toBe('sm');
    expect(getBreakpoint(767)).toBe('sm');
  });

  it('768-991 返回 md', () => {
    expect(getBreakpoint(768)).toBe('md');
    expect(getBreakpoint(991)).toBe('md');
  });

  it('992-1199 返回 lg', () => {
    expect(getBreakpoint(992)).toBe('lg');
    expect(getBreakpoint(1199)).toBe('lg');
  });

  it('1200-1599 返回 xl', () => {
    expect(getBreakpoint(1200)).toBe('xl');
    expect(getBreakpoint(1599)).toBe('xl');
  });

  it('>= 1600 返回 xxl', () => {
    expect(getBreakpoint(1600)).toBe('xxl');
    expect(getBreakpoint(2400)).toBe('xxl');
  });
});

describe('useBreakpoint - 响应式断点 hook', () => {
  beforeEach(() => {
    // jsdom 默认 1024x768 → lg
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  it('初始为当前视口宽度的断点', () => {
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('lg');
  });

  it('resize 触发更新', async () => {
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('lg');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
      window.dispatchEvent(new Event('resize'));
    });

    // 防抖 100ms
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    expect(result.current).toBe('xs');
  });
});

describe('useIsMobile / useIsTablet / useIsDesktop', () => {
  it('useIsMobile 在 xs/sm 时返回 true', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('useIsTablet 在 md 时返回 true', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(true);
  });

  it('useIsDesktop 在 lg+ 时返回 true', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
  });
});

describe('useViewportWidth', () => {
  it('返回当前视口宽度', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1366, configurable: true });
    const { result } = renderHook(() => useViewportWidth());
    expect(result.current).toBe(1366);
  });
});

describe('useOrientation', () => {
  it('宽度 < 768 返回 portrait', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    const { result } = renderHook(() => useOrientation());
    expect(result.current).toBe('portrait');
  });

  it('宽度 >= 768 返回 landscape', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    const { result } = renderHook(() => useOrientation());
    expect(result.current).toBe('landscape');
  });
});

describe('useIsTouchDevice', () => {
  it('桌面端返回 false', () => {
    const { result } = renderHook(() => useIsTouchDevice());
    expect(result.current).toBe(false);
  });
});
