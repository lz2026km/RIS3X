// [v3.0.6.8-27] 生成器统一导出
export * from "./medicalDataGen";

// 预生成数据, 避免运行时重复生成
import { seedRandom } from "./medicalDataGen";
import {
  generateDoctorPerformance,
  generateExamReport,
  generateQualityScore,
  generateCriticalValueEvents,
  generateCosignTasks,
  generateDailyKPI,
} from "./medicalDataGen";

// 固定种子保证数据可复现
seedRandom(0x12345);
export const DOCTOR_PERFORMANCE_PRE = generateDoctorPerformance(800, 6);
export const EXAM_REPORT_PRE = generateExamReport(10000, 180, 0x12345);
export const QUALITY_SCORE_PRE = generateQualityScore(500, 180);
export const CRITICAL_EVENTS_PRE = generateCriticalValueEvents(300, 180);
export const COSIGN_TASKS_PRE = generateCosignTasks(400, 180);
export const DAILY_KPI_PRE = generateDailyKPI(180);
