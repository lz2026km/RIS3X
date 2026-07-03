import { z } from "zod";

/** IOL 公式注册 */
export const iolFormulaSchema = z.object({
  id: z.string().min(1).max(32),
  name: z.string().min(1).max(32),
  /** 显示标签 */
  label: z.string().min(1).max(64),
  /** 适用 AL 范围 [min, max]，闭区间 */
  alRange: z.tuple([z.number().min(15).max(35), z.number().min(15).max(35)]),
  /** 公式识别码（与 iolCalculator.ts 中 calc* 对应） */
  implementation: z.enum([
    "calcSrkt",
    "calcHolladay1",
    "calcHofferQ",
    "calcBarrettIi",
    "calcHillRbf",
    "calcKane",
    "calcEvo",
  ]),
  /** 排序（推荐时使用） */
  priority: z.number().int().min(0).max(64),
  /** 是否在长眼轴时启用 Wang-Koch 修正 */
  wangKoch: z.boolean().default(false),
  note: z.string().max(128).optional(),
}).refine(
  (f) => f.alRange[0] < f.alRange[1],
  { message: "alRange[0] must be < alRange[1]", path: ["alRange"] },
);

/** AL 段对应的推荐公式组合 */
export const iolAlBandSchema = z.object({
  alMin: z.number().min(15).max(35),
  alMaxExclusive: z.number().min(15).max(35),
  recommendedFormulaIds: z.array(z.string()).min(1).max(8),
}).refine(
  (b) => b.alMin < b.alMaxExclusive,
  { message: "alMin must be < alMaxExclusive" },
);

export const iolFormulasModuleSchema = z.object({
  $schema: z.literal("iolFormulas.v1").optional(),
  version: z.number().int().min(1).max(999).default(1),
  formulas: z.array(iolFormulaSchema).min(1).max(32),
  alBands: z.array(iolAlBandSchema).min(1).max(16),
  /** Wang-Koch 触发阈值 (mm) */
  wangKochThreshold: z.number().min(20).max(35).default(26.0),
});

export type IolFormulaConfig = z.infer<typeof iolFormulaSchema>;
export type IolAlBandConfig = z.infer<typeof iolAlBandSchema>;
export type IolFormulasModule = z.infer<typeof iolFormulasModuleSchema>;