// [ClinicalConfig] React hook
import { getConfig } from "../bootstrap";

/** 读取 gradingScales 模块 */
export function useGradingScales(): ReturnType<typeof getConfig>["gradingScales"] {
  return getConfig().gradingScales;
}