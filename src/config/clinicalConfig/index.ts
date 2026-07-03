// [ClinicalConfig] 公开 API
// 应用其他模块从这里导入，不要直接 import 内部文件
export * from "./primitives";
export * from "./loader";
export * from "./registry";
export { gradingScalesModuleSchema, type GradingScaleConfig, type GradingScalesModule } from "./modules/gradingScales.schema";