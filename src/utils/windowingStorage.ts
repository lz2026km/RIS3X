import { useEffect, useState, useCallback } from 'react';
import { safeGetItem, safeSetItem } from './safeStorage';

export interface WindowingState {
  ww: number;
  wl: number;
  zoom: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  brightness: number;
  contrast: number;
  invert: boolean;
  activePresetIdx: number | null;
  activeTool: string;
  pseudoColorMode: string;
}

export const DEFAULT_WINDOWING: WindowingState = {
  ww: 400,
  wl: 40,
  zoom: 100,
  rotation: 0,
  flipH: false,
  flipV: false,
  brightness: 100,
  contrast: 100,
  invert: false,
  activePresetIdx: null,
  activeTool: 'zoom',
  pseudoColorMode: 'none',
};

const STORAGE_KEY = 'g005_dicom_windowing';

export function loadWindowingState(modality?: string): WindowingState {
  const raw = safeGetItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_WINDOWING };
  try {
    const parsed = JSON.parse(raw);
    const store: Record<string, WindowingState> = parsed?.byModality ?? {};
    if (modality && store[modality]) {
      return { ...DEFAULT_WINDOWING, ...store[modality] };
    }
    return { ...DEFAULT_WINDOWING, ...parsed };
  } catch {
    return { ...DEFAULT_WINDOWING };
  }
}

export function saveWindowingState(modality: string, state: WindowingState): void {
  const raw = safeGetItem(STORAGE_KEY);
  let store: Record<string, WindowingState> = {};
  try {
    if (raw) store = JSON.parse(raw)?.byModality ?? {};
  } catch {
    store = {};
  }
  store[modality] = state;
  safeSetItem(STORAGE_KEY, JSON.stringify({ byModality: store }));
}

export function useWindowingState(modality: string) {
  const [state, setState] = useState<WindowingState>(() => loadWindowingState(modality));

  useEffect(() => {
    setState(loadWindowingState(modality));
  }, [modality]);

  useEffect(() => {
    saveWindowingState(modality, state);
  }, [modality, state]);

  const update = useCallback((partial: Partial<WindowingState>) => {
    setState(prev => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...DEFAULT_WINDOWING });
  }, []);

  return { state, setState, update, reset };
}
