// [ClinicalConfig] 模块注册中心
// 阶段 1：gradingScales 一项
// 阶段 2：+ aiModels / imagingDevices / kpiThresholds / reportTemplates / findingsLexicon / iolFormulas
// 后续阶段 3+ 逐个追加
import type { z } from "zod";
import { gradingScalesModuleSchema, type GradingScalesModule } from "./modules/gradingScales.schema";
import { aiModelsModuleSchema, type AiModelsModule } from "./modules/aiModels.schema";
import { imagingDevicesModuleSchema, type ImagingDevicesModule } from "./modules/imagingDevices.schema";
import { kpiThresholdsModuleSchema, type KpiThresholdsModule } from "./modules/kpiThresholds.schema";
import { reportTemplatesModuleSchema, type ReportTemplatesModule } from "./modules/reportTemplates.schema";
import { findingsLexiconModuleSchema, type FindingsLexiconModule } from "./modules/findingsLexicon.schema";
import { iolFormulasModuleSchema, type IolFormulasModule } from "./modules/iolFormulas.schema";
import { mergeLayers, validate } from "./loader";

/** 模块分类（与计划中"参数归类"一致） */
export type ConfigCategory = "clinical" | "operational" | "financial" | "device" | "reporting";

/** 模块元数据：每个 config 模块一份 */
export interface ConfigModuleMeta<T> {
  /** 模块 key，唯一 */
  id: string;
  /** 中文标签 */
  label: string;
  /** 分类（用于 admin UI 分组） */
  category: ConfigCategory;
  /** 描述 */
  description: string;
  /** zod schema */
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  /** 默认 JSON 相对路径（开发时从仓库 src/.../defaults 加载） */
  defaultPath: string;
  /** 运行时覆盖 JSON 相对路径（生产环境覆盖） */
  overridePath: string;
  /** 人类可读版本号 */
  schemaVersion: string;
}

/** 模块注册表（顺序敏感：后面覆盖前面） */
export const REGISTRY = {
  gradingScales: {
    id: "gradingScales",
    label: "眼科分级量表",
    category: "clinical",
    description: "DR 国际分级 / LOCS III / ETDRS / ISNT 等",
    schema: gradingScalesModuleSchema,
    defaultPath: "src/config/clinicalConfig/defaults/gradingScales.json",
    overridePath: "public/config-overrides/gradingScales.json",
    schemaVersion: "v1",
  } satisfies ConfigModuleMeta<GradingScalesModule>,
  aiModels: {
    id: "aiModels",
    label: "AI 诊断模型注册",
    category: "clinical",
    description: "AI 模型（准确率/敏感性/特异性/审批标志）和诊断结果",
    schema: aiModelsModuleSchema,
    defaultPath: "src/config/clinicalConfig/defaults/aiModels.json",
    overridePath: "public/config-overrides/aiModels.json",
    schemaVersion: "v1",
  } satisfies ConfigModuleMeta<AiModelsModule>,
  imagingDevices: {
    id: "imagingDevices",
    label: "牙科影像设备",
    category: "device",
    description: "CBCT / 全景 / 根尖 / 扫描设备清单",
    schema: imagingDevicesModuleSchema,
    defaultPath: "src/config/clinicalConfig/defaults/imagingDevices.json",
    overridePath: "public/config-overrides/imagingDevices.json",
    schemaVersion: "v1",
  } satisfies ConfigModuleMeta<ImagingDevicesModule>,
  kpiThresholds: {
    id: "kpiThresholds",
    label: "KPI 阈值与目标值",
    category: "operational",
    description: "KPI 目标值 / 实际值 / 趋势 / 周期",
    schema: kpiThresholdsModuleSchema,
    defaultPath: "src/config/clinicalConfig/defaults/kpiThresholds.json",
    overridePath: "public/config-overrides/kpiThresholds.json",
    schemaVersion: "v1",
  } satisfies ConfigModuleMeta<KpiThresholdsModule>,
  reportTemplates: {
    id: "reportTemplates",
    label: "眼科报告模板",
    category: "reporting",
    description: "报告章节结构 (text/findings/grading/images/measurements/diagnosis)",
    schema: reportTemplatesModuleSchema,
    defaultPath: "src/config/clinicalConfig/defaults/reportTemplates.json",
    overridePath: "public/config-overrides/reportTemplates.json",
    schemaVersion: "v1",
  } satisfies ConfigModuleMeta<ReportTemplatesModule>,
  findingsLexicon: {
    id: "findingsLexicon",
    label: "眼科影像所见词典",
    category: "clinical",
    description: "92 条眼底/前节/神经等所见词条 + 严重度 + 关键词",
    schema: findingsLexiconModuleSchema,
    defaultPath: "src/config/clinicalConfig/defaults/findingsLexicon.json",
    overridePath: "public/config-overrides/findingsLexicon.json",
    schemaVersion: "v1",
  } satisfies ConfigModuleMeta<FindingsLexiconModule>,
  iolFormulas: {
    id: "iolFormulas",
    label: "IOL 计算公式注册",
    category: "clinical",
    description: "8 种 IOL 公式 (SRK/T/Holladay/Hoffer/Barrett/Hill-RBF/Kane/EVO) + AL 段推荐",
    schema: iolFormulasModuleSchema,
    defaultPath: "src/config/clinicalConfig/defaults/iolFormulas.json",
    overridePath: "public/config-overrides/iolFormulas.json",
    schemaVersion: "v1",
  } satisfies ConfigModuleMeta<IolFormulasModule>,
} as const;

export type ModuleKey = keyof typeof REGISTRY;

/** 获取模块的元数据 */
export function getModuleMeta(key: ModuleKey): ConfigModuleMeta<unknown> {
  return REGISTRY[key] as unknown as ConfigModuleMeta<unknown>;
}

/** 同步加载某个模块的 defaults（开发用，从源文件直接 import） */
export async function loadDefaults<T>(key: ModuleKey): Promise<T> {
  switch (key) {
    case "gradingScales": {
      const m = await import("./defaults/gradingScales.json");
      return m.default as T;
    }
    case "aiModels": {
      const m = await import("./defaults/aiModels.json");
      return m.default as T;
    }
    case "imagingDevices": {
      const m = await import("./defaults/imagingDevices.json");
      return m.default as T;
    }
    case "kpiThresholds": {
      const m = await import("./defaults/kpiThresholds.json");
      return m.default as T;
    }
    case "reportTemplates": {
      const m = await import("./defaults/reportTemplates.json");
      return m.default as T;
    }
    case "findingsLexicon": {
      const m = await import("./defaults/findingsLexicon.json");
      return m.default as T;
    }
    case "iolFormulas": {
      const m = await import("./defaults/iolFormulas.json");
      return m.default as T;
    }
    default: {
      const _exhaustive: never = key;
      void _exhaustive;
      throw new Error("Unknown module: " + (key as string));
    }
  }
}

/** 同步加载某个模块的 override（可选；生产覆盖）。 */
export async function loadOverride<T>(_key: ModuleKey): Promise<T | undefined> {
  // 阶段 2 暂未提供 override 目录；返回 undefined
  return undefined;
}

/** 加载 + 校验 + 合并：返回最终配置 */
export async function loadModule<T>(key: ModuleKey): Promise<T> {
  const meta = getModuleMeta(key);
  const def = await loadDefaults<T>(key);
  const ov = await loadOverride<T>(key);
  const merged = mergeLayers<T>({ defaults: def, override: ov });
  const r = validate(meta.schema, merged);
  if (!r.ok) {
    const summary = (r.error?.issues ?? []).slice(0, 5).map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; ");
    throw new Error(`Config "${meta.id}" (${meta.schemaVersion}) validation failed: ${summary}`);
  }
  return r.data as T;
}

/** 列出所有注册模块 */
export function listModules(): ConfigModuleMeta<unknown>[] {
  return Object.values(REGISTRY) as unknown as ConfigModuleMeta<unknown>[];
}