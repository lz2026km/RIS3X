/**
 * G005 放射RIS系统 [UI-5] - BrandMark
 * 专业医疗/影像品牌标识 (SVG):
 *   - 深蓝渐变圆角徽章 (令牌 --color-primary-500/800)
 *   - 光圈 (aperture) 环 = 影像/放射
 *   - 医疗十字 = 临床医疗
 *   - 底部波形 = 放射/生命体征
 * 28–36px 下保持清晰 (纯几何 + 均匀描边, 无细碎元素)。
 */
import { useId } from "react";

export interface BrandMarkProps {
  /** 徽章边长 (默认 32, 推荐 28–36) */
  size?: number;
  /** 无障碍名称 */
  title?: string;
  /** 透传 testid */
  testId?: string;
  /** 圆角比例 (默认 0.26 ≈ 8/32) */
  radiusRatio?: number;
}

export function BrandMark({
  size = 32,
  title,
  testId,
  radiusRatio = 0.26,
}: BrandMarkProps) {
  const uid = useId().replace(/[:]/g, "");
  const gradId = `bm-grad-${uid}`;
  const clipId = `bm-clip-${uid}`;
  const rx = Math.max(4, Math.round(size * radiusRatio));

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      data-testid={testId}
      focusable="false"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-mark-from, var(--color-primary-500))" />
          <stop offset="55%" stopColor="var(--color-primary-600, var(--color-primary-600))" />
          <stop offset="100%" stopColor="var(--brand-mark-to, var(--color-primary-800))" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x="2" y="2" width="44" height="44" rx={rx} ry={rx} />
        </clipPath>
      </defs>

      {/* 徽章底 */}
      <rect x="2" y="2" width="44" height="44" rx={rx} ry={rx} fill={`url(#${gradId})`} />
      {/* 顶部高光 */}
      <rect
        x="2"
        y="2"
        width="44"
        height="22"
        rx={rx}
        ry={rx}
        fill="#ffffff"
        opacity={0.08}
        clipPath={`url(#${clipId})`}
      />

      <g clipPath={`url(#${clipId})`}>
        {/* 光圈环 (aperture) */}
        <circle
          cx="24"
          cy="21"
          r="11"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeDasharray="6 4"
          opacity={0.95}
        />
        {/* 医疗十字 */}
        <path
          d="M24 15v12M18 21h12"
          stroke="#ffffff"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        {/* 底部放射 / 生命体征波形 */}
        <path
          d="M8 40h5l2.2-4.2 2.6 7.4 2.6-10.4 2.6 7.4 2-3.2H40"
          fill="none"
          stroke="#bfdbfe"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export default BrandMark;
