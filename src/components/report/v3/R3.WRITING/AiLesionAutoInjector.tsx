/**
 * [G005 v3.0.6.11-100 Wave 6A (D-1)] AI 检出插入面板 — 报告书写页侧
 * - 数据源: 父级 (ReportWritePage) 挂载时经 consumeAiFindingsForReport 从 sessionStorage 消费
 *   (ris_ai_findings_insert, 影像查看器 D-1 写入) 后以 items prop 传入; 本组件不再自行读缓存,
 *   避免与父级消费时序竞争 (子组件渲染早于父组件 effect)
 * - 检出列表: 类型/详情/置信度/风险 → 逐条「采纳」(insertHtml 通道插入编辑器) /「忽略」
 * - 「插入全部」一键插入剩余检出;「忽略全部」放弃缓存
 * - 自动插入由 ReportWritePage 挂载时完成 (目标报告匹配时); 本组件用于未匹配/手动审查场景
 */
import { useCallback, useMemo, useState } from 'react'
import { Card, Tag, Button, Space, Alert, Empty, message, Tooltip } from 'antd'
import { FileText, CheckCircle2, XCircle, X, Sparkles, ClipboardPaste } from 'lucide-react'
import { AI_FINDINGS_INSERT_KEY, type AiInsertItem } from '@pages/dicom/aiFindings'
import { t } from '../../../../i18n/appI18n'

const CONFIDENCE_COLOR = (c: number): string => (c >= 70 ? 'red' : c >= 40 ? 'orange' : 'green')

export interface AiLesionAutoInjectorProps {
  /** 当前报告 ID (用于提示目标报告; 自动插入匹配判断由父级完成) */
  reportId?: string
  /** 挂载时待插入检出 (父级已从 sessionStorage 消费, 自动插入后清空) */
  items?: AiInsertItem[]
  /** 逐条插入回调 (父级经 editorRef.insertHtml 插入编辑器) */
  onInsertHtml: (item: AiInsertItem) => void
  /** 忽略回调 (父级同步移除列表项) */
  onIgnore: (id: string) => void
  /** 父级状态同步: 清空待插入列表 */
  onConsumed: (items: AiInsertItem[]) => void
}

export default function AiLesionAutoInjector({
  reportId = '',
  items = [],
  onInsertHtml,
  onIgnore,
  onConsumed,
}: AiLesionAutoInjectorProps) {
  const list = items

  const [localIgnored, setLocalIgnored] = useState<Set<string>>(new Set())
  const visible = useMemo(() => list.filter((f) => !localIgnored.has(f.id)), [list, localIgnored])

  const handleAccept = useCallback((f: AiInsertItem) => {
    onInsertHtml(f)
    message.success(t('w9e.aiInjector.insertedOne', { label: f.label }))
    onIgnore(f.id)
    setLocalIgnored((prev) => new Set(prev).add(f.id))
  }, [onInsertHtml, onIgnore])

  const handleAcceptAll = useCallback(() => {
    if (visible.length === 0) {
      message.info(t('w9e.aiInjector.noPending'))
      return
    }
    visible.forEach((f) => onInsertHtml(f))
    message.success(t('w9e.aiInjector.insertedCount', { count: visible.length }))
    onConsumed([])
    setLocalIgnored(new Set(list.map((f) => f.id)))
  }, [visible, list, onInsertHtml, onConsumed])

  const handleIgnoreAll = useCallback(() => {
    onConsumed([])
    setLocalIgnored(new Set(list.map((f) => f.id)))
    try { window.sessionStorage.removeItem(AI_FINDINGS_INSERT_KEY) } catch { /* 忽略 */ }
    message.info(t('w9e.aiInjector.ignoredAll'))
  }, [list, onConsumed])

  if (list.length === 0) return null

  return (
    <Card
      size="small"
      className="v3-card no-print"
      data-testid="ai-lesion-auto-injector"
      title={
        <Space>
          <Sparkles size={14} className="text-blue-500" />
          <span>{t('w9e.aiInjector.title')}</span>
          <Tag color="blue">D-1</Tag>
          {reportId && <span className="text-xs text-slate-400">{t('w9e.aiInjector.targetReport', { id: reportId })}</span>}
        </Space>
      }
      extra={
        <Space size={4}>
          <Button size="small" type="primary" icon={<ClipboardPaste size={12} />} onClick={handleAcceptAll} data-testid="ai-inject-all">
            {t('w9e.aiInjector.insertAll', { count: visible.length })}
          </Button>
          <Button size="small" icon={<X size={12} />} onClick={handleIgnoreAll} data-testid="ai-inject-ignore-all">
            {t('w9e.aiInjector.ignoreAll')}
          </Button>
        </Space>
      }
      style={{ border: '1px solid #bfdbfe', marginBottom: 12 }}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 8 }}
        message={t('w9e.aiInjector.cacheAlert', { count: list.length })}
      />
      {visible.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('w9e.aiInjector.allHandled')} style={{ margin: '12px 0' }} />
      ) : (
        <div className="flex flex-col gap-2 max-h-72 overflow-auto">
          {visible.map((f) => (
            <div
              key={f.id}
              data-testid={`ai-inject-item-${f.id}`}
              className="flex items-start gap-2 border border-blue-100 rounded px-2 py-2"
              style={{ background: '#f8faff' }}
            >
              <FileText size={13} className="text-blue-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <b style={{ fontSize: 12, color: 'var(--color-primary-800)' }}>{f.label}</b>
                  <Tag color={CONFIDENCE_COLOR(f.confidence)} style={{ margin: 0 }}>{t('w9e.aiInjector.confidence', { value: f.confidence })}</Tag>
                  {f.modelLabel && <Tag style={{ margin: 0 }}>{f.modelLabel}</Tag>}
                </div>
                {f.detail && <div className="text-xs text-slate-500 mt-1 leading-5 line-clamp-2">{f.detail}</div>}
                {f.risk && <div className="text-xs mt-1"><span className="text-slate-400">{t('w9e.aiInjector.riskLabel')}</span><span className="text-red-600 font-medium">{f.risk}</span></div>}
              </div>
              <Space size={2} className="shrink-0">
                <Tooltip title={t('w9e.aiInjector.insertOneTip')}>
                  <Button size="small" type="primary" icon={<CheckCircle2 size={12} />} onClick={() => handleAccept(f)} data-testid={`ai-inject-accept-${f.id}`} />
                </Tooltip>
                <Tooltip title={t('w9e.aiInjector.ignoreOneTip')}>
                  <Button size="small" icon={<XCircle size={12} />} onClick={() => { onIgnore(f.id); setLocalIgnored((prev) => new Set(prev).add(f.id)) }} data-testid={`ai-inject-ignore-${f.id}`} />
                </Tooltip>
              </Space>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
