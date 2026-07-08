import { useState, useMemo, type CSSProperties } from 'react'
import { Segmented, Space } from 'antd'
import { Code, SplitSquareHorizontal, Columns } from 'lucide-react'

type DiffMode = 'side-by-side' | 'unified'

export interface DiffViewerProps {
  oldText: string
  newText: string
  mode?: DiffMode
  language?: string
  oldTitle?: string
  newTitle?: string
  height?: number
}

interface DiffLine {
  type: 'equal' | 'add' | 'remove'
  oldLineNum?: number
  newLineNum?: number
  text: string
}

function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = []
  const oldSet = new Map<string, number>()
  const newSet = new Map<string, number>()

  oldLines.forEach((line) => {
    const trimmed = line.trim()
    if (trimmed) oldSet.set(trimmed, (oldSet.get(trimmed) ?? 0) + 1)
  })
  newLines.forEach((line) => {
    const trimmed = line.trim()
    if (trimmed) newSet.set(trimmed, (newSet.get(trimmed) ?? 0) + 1)
  })

  let oi = 0
  let ni = 0

  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && ni < newLines.length && oldLines[oi] === newLines[ni]) {
      result.push({ type: 'equal', oldLineNum: oi + 1, newLineNum: ni + 1, text: oldLines[oi]! })
      oi++
      ni++
    } else {
      const oldTrimmed = oldLines[oi]?.trim()
      const newTrimmed = newLines[ni]?.trim()
      const oldCount = oldTrimmed ? oldSet.get(oldTrimmed) ?? 0 : 0
      const newCount = newTrimmed ? newSet.get(newTrimmed) ?? 0 : 0

      if (ni < newLines.length && (oi >= oldLines.length || (newCount > 0 && oldCount === 0))) {
        result.push({ type: 'add', newLineNum: ni + 1, text: newLines[ni]! })
        ni++
      } else if (oi < oldLines.length) {
        result.push({ type: 'remove', oldLineNum: oi + 1, text: oldLines[oi]! })
        oi++
      } else {
        if (ni < newLines.length) {
          result.push({ type: 'add', newLineNum: ni + 1, text: newLines[ni]! })
          ni++
        } else {
          break
        }
      }
    }
  }

  return result
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
  const diffLines = useMemo(() => computeDiff(oldLines, newLines), [oldLines, newLines])

  const added = diffLines.filter((l) => l.type === 'add').length
  const removed = diffLines.filter((l) => l.type === 'remove').length

  if (diffMode === 'unified') {
    return (
      <div style={{ border: '1px solid var(--border-subtle, #e2e8f0)', borderRadius: 8, overflow: 'hidden' }}>
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
            options={[
              { label: <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><SplitSquareHorizontal size={12} />统一</span>, value: 'unified' },
              { label: <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><Columns size={12} />分栏</span>, value: 'side-by-side' },
            ]}
          />
        </div>
        <div style={{ overflow: 'auto', height, padding: '8px 0', background: '#fafafa' }}>
          {diffLines.map((line, i) => {
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
                <span style={lineNumStyle}>{line.oldLineNum ?? ''}</span>
                <span style={lineNumStyle}>{line.newLineNum ?? ''}</span>
                <span style={{ flex: 1 }}>
                  {line.type === 'add' && line.text}
                  {line.type === 'remove' && line.text}
                  {line.type === 'equal' && line.text}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const _maxLen = Math.max(oldLines.length, newLines.length); void _maxLen

  return (
    <div style={{ border: '1px solid var(--border-subtle, #e2e8f0)', borderRadius: 8, overflow: 'hidden' }}>
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
          options={[
            { label: <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><SplitSquareHorizontal size={12} />统一</span>, value: 'unified' },
            { label: <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><Columns size={12} />分栏</span>, value: 'side-by-side' },
          ]}
        />
      </div>
      <div style={{ display: 'flex', height, overflow: 'auto' }}>
        <div style={{ flex: 1, borderRight: '1px solid var(--border-subtle, #e2e8f0)' }}>
          <div style={{ padding: '4px 8px', background: '#f1f5f9', fontSize: 12, fontWeight: 600, borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1 }}>{oldTitle}</div>
          {oldLines.map((line, i) => {
            const diffLine = diffLines.find((d) => d.oldLineNum === i + 1)
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
            const diffLine = diffLines.find((d) => d.newLineNum === i + 1)
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
