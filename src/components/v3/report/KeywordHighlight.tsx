/**
 * G005 放射RIS系统 v3.0.2 - 报告编辑器内联 关键字/术语 高亮扫描
 * 对标:GE Centricity 报告编辑器 实时语法/术语检测
 *
 * 功能:
 *  - 实时扫描报告文本
 *  - 高亮 ICD-10 编码
 *  - 高亮 RadLex ID
 *  - 高亮 RADS 类别
 *  - 高亮 关键解剖结构
 *  - 高亮 数值(毫米/厘米等)
 *  - 高亮 危急值
 */
import React, { useMemo, useCallback, useState } from 'react'
import { Input, Tag, Space, Button, Switch } from 'antd'
import { sanitizeHtml } from '../../../utils/sanitization'
import { Search, Zap, ListChecks } from 'lucide-react'

const ANATOMY_TERMS = [
  '大脑', '小脑', '脑干', '丘脑', '基底节', '侧脑室', '第三脑室', '第四脑室',
  '肝脏', '肝右叶', '肝左叶', '胆囊', '胆总管', '胰头', '胰体', '胰尾',
  '脾脏', '左肾', '右肾', '肾上腺', '胃', '十二指肠', '空肠', '回肠', '升结肠', '横结肠', '降结肠', '乙状结肠', '直肠',
  '膀胱', '前列腺', '子宫', '卵巢', '输卵管', '阴道',
  '气管', '主支气管', '左肺', '右肺', '纵隔', '心包', '心脏', '主动脉', '肺动脉',
  '颈椎', '胸椎', '腰椎', '骶椎', '椎间盘', '脊髓', '椎管',
  '肩关节', '肘关节', '腕关节', '髋关节', '膝关节', '踝关节', '半月板', '交叉韧带',
]

const ICD10_PATTERN = /\b([A-TV-Z][0-9][0-9AB](\.[0-9A-Z]{1,4})?)\b/g
const RADLEX_PATTERN = /RID\d{4,5}/g
const RADS_PATTERN = /(BI|LI|TI|PI|CAD-RADS|Lung-RADS|ACR|PI-RADS|BI-RADS|TI-RADS|LI-RADS|OVAR-RADS)\s*([0-9]|[a-d]|M[1-6]|V[1-6])/g
const MEASURE_PATTERN = /(\d+(?:\.\d+)?)\s*(mm|cm|m|hu|HU|ml|cc|%)/gi
const CRITICAL_PATTERNS = [
  /(?:大|大量)?气胸/,
  /主动脉夹层/,
  /Stanford\s*[A-B]/i,
  /大面积脑梗死/,
  /急性.{0,3}STEMI/,
  /脑干出血/,
  /颅内大量出血/,
  /心脏压塞/,
  /大面积肺栓塞/,
  /消化道穿孔/,
  /异位妊娠/,
  /(?:气|液)胸/,
]

const COUNT_PATTERNS = {
  anatomy: 0,
  icd10: 0,
  radlex: 0,
  rads: 0,
  measure: 0,
  critical: 0,
}

export interface KeywordHighlightProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  /** 高亮开关 */
  enableHighlight?: boolean
  /** 是否 危急值 检测 */
  enableCriticalCheck?: boolean
  /** 危急值回调 */
  onCriticalFound?: (matches: string[]) => void
  /** 术语统计回调 */
  onStatsChange?: (stats: typeof COUNT_PATTERNS) => void
}

export const KeywordHighlight: React.FC<KeywordHighlightProps> = ({
  value,
  onChange,
  placeholder = '请输入报告内容...',
  rows = 6,
  enableHighlight = true,
  enableCriticalCheck = true,
  onCriticalFound,
  onStatsChange,
}) => {
  const [showHighlight, setShowHighlight] = useState(enableHighlight)

  const stats = useMemo(() => {
    const s = { ...COUNT_PATTERNS }
    if (!value) return s
    s.icd10 = (value.match(ICD10_PATTERN) ?? []).length
    s.radlex = (value.match(RADLEX_PATTERN) ?? []).length
    s.rads = (value.match(RADS_PATTERN) ?? []).length
    s.measure = (value.match(MEASURE_PATTERN) ?? []).length
    s.anatomy = ANATOMY_TERMS.reduce((n, term) => n + (value.includes(term) ? 1 : 0), 0)
    s.critical = CRITICAL_PATTERNS.reduce((n, p) => n + (p.test(value) ? 1 : 0), 0)
    return s
  }, [value])

  // 通知 stats
  React.useEffect(() => {
    onStatsChange?.(stats)
  }, [stats, onStatsChange])

  // 危急值通知
  React.useEffect(() => {
    if (!enableCriticalCheck || !value) return
    const matches: string[] = []
    for (const p of CRITICAL_PATTERNS) {
      const m = value.match(p)
      if (m) matches.push(...m)
    }
    if (matches.length > 0) {
      onCriticalFound?.(Array.from(new Set(matches)))
    }
  }, [value, enableCriticalCheck, onCriticalFound])

  // 高亮渲染
  const highlightedHtml = useMemo(() => {
    if (!showHighlight || !value) return value
    let html = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    // 危急值
    if (enableCriticalCheck) {
      for (const p of CRITICAL_PATTERNS) {
        html = html.replace(p, (m) => `<mark data-kw="critical" style="background:#fee2e2;color:#dc2626;font-weight:600;padding:0 2px;border-radius:2px">${m}</mark>`)
      }
    }
    // ICD-10
    html = html.replace(ICD10_PATTERN, (m) => `<mark data-kw="icd10" style="background:#dbeafe;color:#1e40af;padding:0 2px;border-radius:2px" title="ICD-10">${m}</mark>`)
    // RadLex
    html = html.replace(RADLEX_PATTERN, (m) => `<mark data-kw="radlex" style="background:#dcfce7;color:#166534;padding:0 2px;border-radius:2px" title="RadLex">${m}</mark>`)
    // RADS
    html = html.replace(RADS_PATTERN, (m) => `<mark data-kw="rads" style="background:#fef3c7;color:#92400e;padding:0 2px;border-radius:2px" title="RADS 分级">${m}</mark>`)
    // 数值
    html = html.replace(MEASURE_PATTERN, (m) => `<mark data-kw="measure" style="background:#f3e8ff;color:#6b21a8;padding:0 2px;border-radius:2px">${m}</mark>`)
    // 解剖
    for (const term of ANATOMY_TERMS) {
      const re = new RegExp(`(?<![\u4e00-\u9fa5A-Za-z])${term}(?![\u4e00-\u9fa5A-Za-z])`, 'g')
      html = html.replace(re, (m) => `<mark data-kw="anatomy" style="background:#f1f5f9;color:#475569;padding:0 2px;border-radius:2px" title="解剖结构">${m}</mark>`)
    }
    return html
  }, [value, showHighlight, enableCriticalCheck])

  const insertTerm = useCallback(
    (term: string) => {
      onChange(value ? `${value}${value.endsWith(' ') ? '' : ' '}${term}` : term)
    },
    [value, onChange]
  )

  return (
    <div data-testid="keyword-highlight">
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size={4} wrap>
          <Tag color="blue" data-testid="kw-icd10">
            ICD-10: {stats.icd10}
          </Tag>
          <Tag color="green" data-testid="kw-radlex">
            RadLex: {stats.radlex}
          </Tag>
          <Tag color="orange" data-testid="kw-rads">
            RADS: {stats.rads}
          </Tag>
          <Tag color="purple" data-testid="kw-measure">
            数值: {stats.measure}
          </Tag>
          <Tag data-testid="kw-anatomy">
            解剖: {stats.anatomy}
          </Tag>
          {enableCriticalCheck && stats.critical > 0 && (
            <Tag color="red" icon={<Zap size={10} />} data-testid="kw-critical">
              危急值: {stats.critical}
            </Tag>
          )}
        </Space>
        <Space>
          <span style={{ fontSize: 12 }}>高亮</span>
          <Switch size="small" checked={showHighlight} onChange={setShowHighlight} data-testid="kw-toggle" />
        </Space>
      </div>

      {showHighlight ? (
        <div
          data-testid="kw-highlight-area"
          style={{
            minHeight: rows * 24,
            maxHeight: rows * 24 * 2,
            overflow: 'auto',
            padding: '4px 11px',
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#fafafa',
          }}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerText)}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(highlightedHtml || `<span style="color:#bbb">${placeholder}</span>`) }}
        />
      ) : (
        <Input.TextArea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          data-testid="kw-textarea"
        />
      )}

      {showHighlight && value && (
        <Space size={4} wrap style={{ marginTop: 8 }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            <ListChecks size={10} /> 快速插入:
          </span>
          {['双肺纹理清晰', '未见明显异常', 'RID11936', 'J18.901', 'BI-RADS 3', '5mm', '建议随访'].map((t) => (
            <Button
              key={t}
              size="small"
              type="text"
              onClick={() => insertTerm(t)}
              data-testid={`kw-insert-${t}`}
            >
              {t}
            </Button>
          ))}
        </Space>
      )}
    </div>
  )
}

export default KeywordHighlight
