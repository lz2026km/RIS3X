// [ClinicalConfig] 启动时一次加载所有模块，缓存到内存
// App.tsx 启动 await loadAll()，错误时跳 ConfigurationError 页
import { listModules, loadModule, type ModuleKey } from "./registry";
import type { GradingScalesModule } from "./modules/gradingScales.schema";
import type { AiModelsModule } from "./modules/aiModels.schema";
import type { ImagingDevicesModule } from "./modules/imagingDevices.schema";
import type { KpiThresholdsModule } from "./modules/kpiThresholds.schema";
import type { ReportTemplatesModule } from "./modules/reportTemplates.schema";
import type { FindingsLexiconModule } from "./modules/findingsLexicon.schema";
import type { IolFormulasModule } from "./modules/iolFormulas.schema";

interface ConfigCache {
  gradingScales: GradingScalesModule;
  aiModels: AiModelsModule;
  imagingDevices: ImagingDevicesModule;
  kpiThresholds: KpiThresholdsModule;
  reportTemplates: ReportTemplatesModule;
  findingsLexicon: FindingsLexiconModule;
  iolFormulas: IolFormulasModule;
}

let cache: ConfigCache | null = null;
let bootError: Error | null = null;

/** 同步获取已加载的配置（未加载则抛错） */
export function getConfig(): ConfigCache {
  if (bootError) throw bootError;
  if (!cache) throw new Error("Config not loaded. Call await loadAll() at app boot.");
  return cache;
}

/** 启动时调用一次 */
export async function loadAll(): Promise<void> {
  if (cache || bootError) return;
  try {
    const [gradingScales, aiModels, imagingDevices, kpiThresholds, reportTemplates, findingsLexicon, iolFormulas] = await Promise.all([
      loadModule<GradingScalesModule>("gradingScales"),
      loadModule<AiModelsModule>("aiModels"),
      loadModule<ImagingDevicesModule>("imagingDevices"),
      loadModule<KpiThresholdsModule>("kpiThresholds"),
      loadModule<ReportTemplatesModule>("reportTemplates"),
      loadModule<FindingsLexiconModule>("findingsLexicon"),
      loadModule<IolFormulasModule>("iolFormulas"),
    ]);
    cache = { gradingScales, aiModels, imagingDevices, kpiThresholds, reportTemplates, findingsLexicon, iolFormulas };
  } catch (e) {
    bootError = e instanceof Error ? e : new Error(String(e));
  }
}

/** 启动时获取错误（供 App.tsx 渲染 ConfigurationError） */
export function getBootError(): Error | null {
  return bootError;
}

/** 重新加载单个模块（admin UI 保存后用） */
export async function reloadModule(key: ModuleKey): Promise<void> {
  if (!cache) return;
  switch (key) {
    case "gradingScales": cache.gradingScales = await loadModule<GradingScalesModule>("gradingScales"); break;
    case "aiModels": cache.aiModels = await loadModule<AiModelsModule>("aiModels"); break;
    case "imagingDevices": cache.imagingDevices = await loadModule<ImagingDevicesModule>("imagingDevices"); break;
    case "kpiThresholds": cache.kpiThresholds = await loadModule<KpiThresholdsModule>("kpiThresholds"); break;
    case "reportTemplates": cache.reportTemplates = await loadModule<ReportTemplatesModule>("reportTemplates"); break;
    case "findingsLexicon": cache.findingsLexicon = await loadModule<FindingsLexiconModule>("findingsLexicon"); break;
    case "iolFormulas": cache.iolFormulas = await loadModule<IolFormulasModule>("iolFormulas"); break;
    default: { const _exhaustive: never = key; void _exhaustive; }
  }
}

export type { ConfigCache, ModuleKey };
export { listModules };