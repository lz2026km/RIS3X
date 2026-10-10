/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 5 - EmptyState
 * 放射专业主题升级:
 *   - 4 场景定制 SVG 插画 (type): 无数据 / 无权限 / 无结果 / 加载中
 *   - 保留 icon 自定义覆盖 + 默认 Inbox 回退 (不破坏既有用法)
 */
import { Inbox } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

export type EmptyStateType = "nodata" | "nopermission" | "noresult" | "loading";

export interface EmptyStateProps {
  /** 自定义图标 (优先于 type 插画) */
  icon?: ReactNode;
  /** 空状态类型 (决定插画与默认描述) */
  type?: EmptyStateType;
  description?: ReactNode;
  action?: ReactNode;
  style?: CSSProperties;
  testId?: string;
}

const DEFAULT_DESCRIPTION: Record<EmptyStateType, string> = {
  nodata: "暂无数据",
  nopermission: "无权限访问该模块",
  noresult: "无匹配结果",
  loading: "数据加载中…",
};

/* ============================================================
   场景插画 (200x140, 主题色)
   ============================================================ */

/** 无数据: 空箱 + 问号 */
function NoDataArt(): JSX.Element {
  return (
    <svg width={120} height={84} viewBox="0 0 200 140" aria-hidden="true">
      <g fill="none" stroke="#cbd5e1" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M38 52l62-26 62 26v58l-62 26-62-26z" />
        <path d="M38 52l62 26 62-26" />
        <path d="M100 78v32" />
      </g>
      <g fill="none" stroke="var(--color-primary-600)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M91 106c0-7 10-7 10-13 0-5-5-7-9-4" />
        <circle cx="91.5" cy="116" r={2.5} fill="var(--color-primary-600)" stroke="none" />
      </g>
    </svg>
  );
}

/** 无权限: 盾牌 + 锁 */
function NoPermissionArt(): JSX.Element {
  return (
    <svg width={120} height={84} viewBox="0 0 200 140" aria-hidden="true">
      <g fill="none" stroke="var(--color-primary-600)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M100 24l46 18v30c0 28-21 43-46 52-25-9-46-24-46-52V42z" />
        <rect x="86" y="80" width="28" height="20" rx={4} fill="var(--color-primary-600)" opacity={0.12} stroke="var(--color-primary-600)" />
        <path d="M90 80v-7a10 10 0 0 1 20 0v7" />
        <path d="M100 88v6" />
        <circle cx={100} cy={97.5} r={2} fill="var(--color-primary-600)" stroke="none" />
      </g>
    </svg>
  );
}

/** 无结果: 放大镜 + 叉 */
function NoResultArt(): JSX.Element {
  return (
    <svg width={120} height={84} viewBox="0 0 200 140" aria-hidden="true">
      <circle cx="86" cy="86" r="34" fill="none" stroke="#cbd5e1" strokeWidth={4} />
      <circle cx="86" cy="86" r="22" fill="none" stroke="#cbd5e1" strokeWidth={2.5} opacity={0.6} />
      <path d="M112 112l30 30" stroke="var(--color-primary-600)" strokeWidth={6} strokeLinecap="round" />
      <path d="M72 84l28-28M100 84l-28 28" stroke="var(--color-primary-600)" strokeWidth={5} strokeLinecap="round" />
      <circle cx="86" cy="86" r="6" fill="var(--color-primary-600)" opacity={0.15} />
    </svg>
  );
}

/** 加载中: 雷达扫描 */
function LoadingArt(): JSX.Element {
  return (
    <svg width={120} height={84} viewBox="0 0 200 140" aria-hidden="true">
      <style>{`@keyframes radsSweep { to { transform: rotate(360deg); } }`}</style>
      <circle cx="100" cy="66" r="42" fill="none" stroke="#cbd5e1" strokeWidth={3} />
      <circle cx="100" cy="66" r="28" fill="none" stroke="#cbd5e1" strokeWidth={2.5} opacity={0.6} />
      <circle cx="100" cy="66" r="14" fill="none" stroke="var(--color-primary-600)" strokeWidth={2} opacity={0.35} />
      <g style={{ transformOrigin: "100px 66px", animation: "radsSweep 2s linear infinite" }}>
        <path d="M100 66l30-22" stroke="var(--color-primary-600)" strokeWidth={4} strokeLinecap="round" />
      </g>
      <circle cx="100" cy="66" r="4" fill="var(--color-primary-600)" />
      <circle cx="118" cy="44" r="3.5" fill="var(--color-primary-600)" opacity={0.5} />
      <path d="M62 122h76" stroke="#cbd5e1" strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}

const TYPE_ART: Record<EmptyStateType, () => JSX.Element> = {
  nodata: NoDataArt,
  nopermission: NoPermissionArt,
  noresult: NoResultArt,
  loading: LoadingArt,
};

export function EmptyState({
  icon,
  type,
  description,
  action,
  style,
  testId,
}: EmptyStateProps) {
  const finalType: EmptyStateType = type ?? "nodata";
  const desc = description ?? DEFAULT_DESCRIPTION[finalType];
  const Art = TYPE_ART[finalType];

  return (
    <div
      data-testid={testId}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
        gap: 'var(--space-3, 12px)',
        textAlign: "center",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary, #475569)",
        }}
      >
        {icon ?? (type ? <Art /> : <Inbox size={48} strokeWidth={1.5} style={{ opacity: 0.4 }} />)}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-secondary, #475569)",
          maxWidth: 320,
          lineHeight: 1.5,
        }}
      >
        {desc}
      </div>
      {action && <div style={{ marginTop: 'var(--space-1, 4px)' }}>{action}</div>}
    </div>
  );
}

export default EmptyState;
