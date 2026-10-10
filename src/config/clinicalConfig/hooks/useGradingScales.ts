// [ClinicalConfig] React hook
import { getConfig } from "../bootstrap";

/** 读取 gradingScales 模块 (配置未就绪时降级为空, 避免渲染期抛错) */
export function useGradingScales(): ReturnType<typeof getConfig>["gradingScales"] | null {
  try {
    return getConfig().gradingScales;
  } catch {
    return null;
  }
}