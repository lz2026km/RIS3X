/**
 * G005 RIS - U1-B: UserConfig 本地持久化 hook (localStorage)
 * 为 SettingsPanel 提供 config / updateConfig / updateField / resetConfig。
 * 注: 主题字段由 Provider 的 useAppTheme 接管, 此处仅保留冗余同步。
 */
import { useCallback, useState } from "react";
import { DEFAULT_CONFIG, type UserConfig } from "../config/userConfig";

const USER_CONFIG_STORAGE_KEY = "g005-user-config";

function loadUserConfig(): UserConfig {
  if (typeof window === "undefined") return { ...DEFAULT_CONFIG };
  try {
    const raw = localStorage.getItem(USER_CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<UserConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export interface UseUserConfigResult {
  config: UserConfig;
  updateConfig: (partial: Partial<UserConfig>) => void;
  updateField: <K extends keyof UserConfig>(
    key: K,
    value: UserConfig[K],
  ) => void;
  resetConfig: () => void;
}

export function useUserConfig(): UseUserConfigResult {
  const [config, setConfig] = useState<UserConfig>(loadUserConfig);

  const updateConfig = useCallback((partial: Partial<UserConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem(USER_CONFIG_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  const updateField = useCallback(
    <K extends keyof UserConfig>(key: K, value: UserConfig[K]) => {
      updateConfig({ [key]: value } as Partial<UserConfig>);
    },
    [updateConfig],
  );

  const resetConfig = useCallback(() => {
    setConfig({ ...DEFAULT_CONFIG });
    try {
      localStorage.removeItem(USER_CONFIG_STORAGE_KEY);
    } catch {
      /* noop */
    }
  }, []);

  return { config, updateConfig, updateField, resetConfig };
}
