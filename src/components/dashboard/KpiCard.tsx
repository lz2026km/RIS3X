/**
 * G005 放射RIS系统 [K-0] v3.0.6.12-9
 * dashboard/KpiCard — 已收敛为 common/StatCard 的别名, 消除双 KPI 组件并存。
 * 保留原有导出名 (KpiCard / KpiCardGrid / KpiCardProps / KpiCardColor / KpiCardTrend)
 * 以兼容 dashboard 桶导出; 视觉与语义完全由唯一权威 StatCard 提供。
 */
import { StatCard, StatCardGrid } from "../common/StatCard";

export const KpiCard = StatCard;
export const KpiCardGrid = StatCardGrid;

export type {
  StatCardProps as KpiCardProps,
  StatCardColor as KpiCardColor,
  StatCardTrend as KpiCardTrend,
} from "../common/StatCard";

export default StatCard;
