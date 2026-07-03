import { z } from "zod";
import { idSchema, percentSchema } from "../primitives";

export const kpiCategorySchema = z.enum([
  "productivity",
  "clinical",
  "operational",
  "financial",
  "satisfaction",
]);

/** KPI 阈值/目标 */
export const kpiMetricSchema = z.object({
  id: idSchema,
  category: kpiCategorySchema,
  name: z.string().min(1).max(64),
  value: z.number(),
  target: z.number(),
  unit: z.string().min(1).max(16),
  trend: z.enum(["up", "down", "stable", "worsening", "improving"]),
  period: z.string().min(1).max(32),
  department: z.string().min(1).max(64).optional(),
  doctorId: z.string().max(32).optional(),
  /** hint: 1 = 越高越好 (默认值越大越好) ,  -1 = 越低越好 */
  direction: z.union([z.literal(1), z.literal(-1)]).default(1),
}).refine(
  (m) => {
    // KPI 合理性：value 与 target 必须在合理量级
    if (!isFinite(m.value) || !isFinite(m.target)) return false;
    return true;
  },
  { message: "value/target must be finite numbers" },
);

export const kpiThresholdsModuleSchema = z.object({
  $schema: z.literal("kpiThresholds.v1").optional(),
  version: z.number().int().min(1).max(999).default(1),
  metrics: z.array(kpiMetricSchema).min(1).max(128),
});

export type KpiMetricConfig = z.infer<typeof kpiMetricSchema>;
export type KpiThresholdsModule = z.infer<typeof kpiThresholdsModuleSchema>;