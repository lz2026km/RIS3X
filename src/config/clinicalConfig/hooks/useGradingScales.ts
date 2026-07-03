// [ClinicalConfig] React hook
import { getConfig } from "../bootstrap";
import type { GradingScalesModule } from "./modules/gradingScales.schema";

/** 读取 gradingScales 模块 */
export function useGradingScales(): GradingScalesModule {
  return getConfig().gradingScales;
}