import { useState, useMemo, type CSSProperties } from 'react'
import { Segmented, Space, SegmentedProps } from 'antd'
import { Code, SplitSquareHorizontal, Columns } from 'lucide-react'
import { computeDiff, computeWordDiff, type DiffChunk } from '@services/reportDiffEngine'

type DiffMode = 'side-by-side' | 'unified' | 'word-level'

export interface DiffViewerProps {
  oldText: string
  newText: string
  mode?: DiffMode
  language?: string
  oldTitle?: string
  newTitle?: string
  height?: number
}

const lineStyle: CSSProperties = {
  padding: '2px 8px',
  fontSize: 13,
  fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  minHeight: 22,
  display: 'flex',
  gap: 8,
}

const lineNumStyle: CSSProperties = {
  color: '#94a3b8',
  minWidth: 36,
  textAlign: 'right',
  userSelect: 'none',
  flexShrink: 0,
}

function renderWordDiff(chunks: DiffChunk[], keyPrefix: string) {
  return chunks.map((c, i) => {
    const style: CSSProperties = {
      padding: '1px 2px',
      borderRadius: 3,
    }
    if (c.type === 'added') {
      style.background = '#d1fae5'
      style.color = '#065f46'
    } else if (c.type === 'removed') {
      style.background = '#fee2e2'
      style.color = '#991b1b'
      style.textDecoration = 'line-through'
    }
    return (
      <span key={`${keyPrefix}-${i}`} style={style}>
        {c.text}
      </span>
    )
  })
}

export function DiffViewer({
  oldText,
  newText,
  mode: initialMode = 'side-by-side',
  language,
  oldTitle = '旧版本',
  newTitle = '新版本',
  height = 500,
}: DiffViewerProps) {
  const [diffMode, setDiffMode] = useState<DiffMode>(initialMode)

  const oldLines = useMemo(() => oldText.split('\n'), [oldText])
  const newLines = useMemo(() => newText.split('\n'), [newText])

  const diffLines = useMemo(() => {
    const engineLines: { type: 'equal' | 'add' | 'remove'; line: string; oldIdx?: number; newIdx?: number }[] = []
    const chunks = computeDiff(oldText, newText)
    let oi = 0
    let ni = 0
    for (const c of chunks) {
      if (c.type === 'unchanged') {
        const ls = c.text.split('\n')
        for (const l of ls) {
          if (l) {
            engineLines.push({ type: 'equal', line: l, oldIdx: oi++, newIdx: ni++ })
          }
        }
      } else if (c.type === 'added') {
        const ls = c.text.split('\n')
        for (const l of ls) {
          if (l) engineLines.push({ type: 'add', line: l, newIdx: ni++ })
        }
      } else if (c.type === 'removed') {
        const ls = c.text.split('\n')
        for (const l of ls) {
          if (l) engineLines.push({ type: 'remove', line: l, oldIdx: oi++ })
        }
      }
    }
    return engineLines
  }, [oldText, newText])

  const added = diffLines.filter((l) => l.type === 'add').length
  const removed = diffLines.filter((l) => l.type === 'remove').length

  const renderDiffLine = (line: typeof diffLines[0], i: number) => {
    const bg = line.type === 'add' ? '#f0fdf4' : line.type === 'remove' ? '#fef2f2' : 'transparent'
    return (
      <div
        key={i}
        style={{
          ...lineStyle,
          background: bg,
          borderLeft: `3px solid ${line.type === 'add' ? '#22c55e' : line.type === 'remove' ? '#ef4444' : 'transparent'}`,
        }}
      >
        <span style={lineNumStyle}>{line.oldIdx != null ? line.oldIdx + 1 : ''}</span>
        <span style={lineNumStyle}>{line.newIdx != null ? line.newIdx + 1 : ''}</span>
        <span style={{ flex: 1 }}>
          {line.type === 'add' && line.line}
          {line.type === 'remove' && line.line}
          {line.type === 'equal' && line.line}
        </span>
      </div>
    )
  }

  const wordChunks = useMemo(() => computeWordDiff(oldText, newText), [oldText, newText])

  const modeOptions: SegmentedProps['options'] = [
    { label: <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><SplitSquareHorizontal size={12} />统一</span>, value: 'unified' },
    { label: <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><Columns size={12} />分栏</span>, value: 'side-by-side' },
    { label: <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>词级</span>, value: 'word-level' },
  ]

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', background: '#f8fafc' }}>
      <Space size={8}>
        <Code size={16} />
        <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>差异对比</span>
        {language && <span style={{ fontSize: 12, color: '#94a3b8' }}>{language}</span>}
        <span style={{ fontSize: 12, color: '#16a34a' }}>+{added}</span>
        <span style={{ fontSize: 12, color: '#dc2626' }}>-{removed}</span>
      </Space>
      <Segmented
        size="small"
        value={diffMode}
        onChange={(v) => setDiffMode(v as DiffMode)}
        options={modeOptions}
      />
    </div>
  )

  if (diffMode === 'word-level') {
    return (
      <div style={{ border: '1px solid var(--border-subtle, #e2e8f0)', borderRadius: 8, overflow: 'hidden' }}>
        {header}
        <div style={{ padding: 16, height, overflow: 'auto', background: '#fafafa', fontSize: 13, lineHeight: 1.8, fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace" }}>
          {renderWordDiff(wordChunks, 'wd')}
        </div>
      </div>
    )
  }

  if (diffMode === 'unified') {
    return (
      <div style={{ border: '1px solid var(--border-subtle, #e2e8f0)', borderRadius: 8, overflow: 'hidden' }}>
        {header}
        <div style={{ overflow: 'auto', height, padding: '8px 0', background: '#fafafa' }}>
          {diffLines.map(renderDiffLine)}
        </div>
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid var(--border-subtle, #e2e8f0)', borderRadius: 8, overflow: 'hidden' }}>
      {header}
      <div style={{ display: 'flex', height, overflow: 'auto' }}>
        <div style={{ flex: 1, borderRight: '1px solid var(--border-subtle, #e2e8f0)' }}>
          <div style={{ padding: '4px 8px', background: '#f1f5f9', fontSize: 12, fontWeight: 600, borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1 }}>{oldTitle}</div>
          {oldLines.map((line, i) => {
            const diffLine = diffLines.find((d) => d.oldIdx === i)
            const bg = diffLine?.type === 'remove' ? '#fef2f2' : 'transparent'
            return (
              <div key={i} style={{ ...lineStyle, background: bg }}>
                <span style={lineNumStyle}>{i + 1}</span>
                <span style={{ flex: 1 }}>{line}</span>
              </div>
            )
          })}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ padding: '4px 8px', background: '#f1f5f9', fontSize: 12, fontWeight: 600, borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1 }}>{newTitle}</div>
          {newLines.map((line, i) => {
            const diffLine = diffLines.find((d) => d.newIdx === i)
            const bg = diffLine?.type === 'add' ? '#f0fdf4' : 'transparent'
            return (
              <div key={i} style={{ ...lineStyle, background: bg }}>
                <span style={lineNumStyle}>{i + 1}</span>
                <span style={{ flex: 1 }}>{line}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default DiffViewer
