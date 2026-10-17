/**
 * [G005 v3.0.6.16-2] 数据来源标识
 *
 * 背景: 审查发现 11 个已注册路由页面**完全不调后端**, 其中一部分是
 * 概念/本地计算页 (临床计算器、全景标注、IHE 连通性自检 等), 另一部分
 * 却以"看起来像真实业务数据"的表格/看板呈现。若不标识, 客户演示时会
 * 误以为是真实生产数据 —— 属信任风险。
 *
 * 本组件提供统一、克制的来源披露:
 *   - `backend`  : 真实后端数据(不显示标识)
 *   - `hybrid`   : 部分真实 + 部分本地推导
 *   - `computed` : 纯本地公式计算 (计算器类, 合理但需说明)
 *   - `concept`  : 概念演示 / 自检桩, 无真实后端
 *
 * 仅在非 `backend` 时渲染, 避免给正常页面增加噪音。
 */
import { Tag, Tooltip } from 'antd';
import { Info } from 'lucide-react';

export type DataSourceKind = 'backend' | 'hybrid' | 'computed' | 'concept';

export interface DataSourceBadgeProps {
  kind: DataSourceKind;
  /** 覆盖默认说明 */
  label?: string;
  /** 更详细的补充说明 */
  detail?: string;
  className?: string;
  style?: React.CSSProperties;
  'data-testid'?: string;
}

const META: Record<Exclude<DataSourceKind, 'backend'>, { label: string; detail: string; color: string }> = {
  hybrid: {
    label: '部分本地数据',
    detail: '本页面部分指标为前端本地推导/演示数据, 非全部来自后端。用于功能演示, 不可直接用于生产决策。',
    color: 'gold',
  },
  computed: {
    label: '本地计算',
    detail: '本页面结果由浏览器端公式实时计算得出, 不依赖后端存储; 结果随输入参数变化。',
    color: 'blue',
  },
  concept: {
    label: '概念演示',
    detail: '本页面为概念演示/连通性自检, 后端尚未提供对应业务端点, 展示内容不代表真实业务数据。',
    color: 'orange',
  },
};

export function DataSourceBadge({
  kind,
  label,
  detail,
  className,
  style,
  'data-testid': testId,
}: DataSourceBadgeProps) {
  if (kind === 'backend') return null;
  const meta = META[kind];
  return (
    <Tooltip title={detail ?? meta.detail}>
      <Tag
        color={meta.color}
        className={className}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...style }}
        data-testid={testId ?? `data-source-${kind}`}
      >
        <Info size={12} aria-hidden />
        {label ?? meta.label}
      </Tag>
    </Tooltip>
  );
}

export default DataSourceBadge;
