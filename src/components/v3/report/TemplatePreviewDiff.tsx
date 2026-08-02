/**
 * G005 放射RIS系统 v3.0.2 - 模板预览+差异对比
 * 对标:飞利浦 / 卫宁 — 模板插入前预览+与当前报告差异对比
 */
import React, { useState, useMemo, useCallback } from 'react'
import { Modal, Button, Space, Tag, Alert, Tabs, Input, Tooltip } from 'antd'
import { FileText, GitCompare, Plus, X, Check, AlertCircle } from 'lucide-react'
import type { ReportTemplate } from '@data/reportTemplates'
import { renderMacro, buildSampleContext } from './MacroEngine'

export interface TemplatePreviewDiffProps {
  template: ReportTemplate | null
  currentFindings?: string
  currentConclusion?: string
  open: boolean
  onClose: () => void
  onApply: (template: ReportTemplate, mode: 'replace' | 'append') => void
  /** 父模板(用于继承预览) */
  parent?: ReportTemplate
}

export const TemplatePreviewDiff: React.FC<TemplatePreviewDiffProps> = ({
  template,
  currentFindings = '',
  currentConclusion = '',
  open,
  onClose,
  onApply,
  parent,
}) => {
  const [mode, setMode] = useState<'replace' | 'append'>('append')
  const [activeTab, setActiveTab] = useState<'preview' | 'diff'>('preview')
  const [varOverrides, setVarOverrides] = useState<Record<string, string>>({})

  const context = useMemo(() => {
    const base = buildSampleContext()
    return { ...base, ...varOverrides }
  }, [varOverrides])

  const renderedBody = useMemo(() => {
    if (!template) return ''
    return renderMacro(template.body, context).text
  }, [template, context])

  const extractVars = useCallback((body: string): string[] => {
    const set = new Set<string>()
    const re = /\{\{\s*([^{}]+?)\s*\}\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(body)) !== null) {
      const expr = m[1]!
      if (expr.startsWith('#') || expr.startsWith('/')) continue
      // 提取简单变量名(单 token)
      const idMatch = expr.match(/^[A-Za-z_$][A-Za-z0-9_$]*/)
      if (idMatch) set.add(idMatch[0]!)
    }
    return Array.from(set)
  }, [])

  const variables = useMemo(() => (template ? extractVars(template.body) : []), [template, extractVars])

  // 简易差异计算(行级 LCS)
  const diff = useMemo(() => {
    if (!template) return { added: [], removed: [], same: [] }
    const oldLines = currentFindings.split('\n')
    const newLines = renderedBody.split('\n')
    const m = oldLines.length
    const n = newLines.length
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        if (oldLines[i] === newLines[j]) {
          dp[i]![j] = (dp[i + 1]?.[j + 1] ?? 0) + 1
        } else {
          dp[i]![j] = Math.max(dp[i + 1]?.[j] ?? 0, dp[i]?.[j + 1] ?? 0)
        }
      }
    }
    const added: number[] = []
    const same: number[] = []
    let i = 0
    let j = 0
    while (i < m && j < n) {
      if (oldLines[i] === newLines[j]) {
        same.push(j)
        i++
        j++
      } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
        i++
      } else {
        added.push(j)
        j++
      }
    }
    while (j < n) {
      added.push(j)
      j++
    }
    return { added, removed: [], same }
  }, [template, renderedBody, currentFindings])

  if (!template) return null

  return (
    <Modal
      data-testid="template-preview-diff"
      title={
        <Space>
          <FileText size={16} />
          <span>模板预览 · {template.name}</span>
          <Tag color="blue">{template.category}</Tag>
          {parent && (
            <Tooltip title={`继承自:${parent.name}`}>
              <Tag color="purple">继承</Tag>
            </Tooltip>
          )}
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={840}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => onApply(template, mode)}
            data-testid="tpd-apply"
          >
            {mode === 'append' ? '追加到当前报告' : '替换当前报告'}
          </Button>
        </Space>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'preview' | 'diff')}
        items={[
          {
            key: 'preview',
            label: '预览',
            children: (
              <div>
                {variables.length > 0 && (
                  <Alert
                    type="info"
                    showIcon
                    title="此模板包含变量,可在下方修改后预览"
                    style={{ marginBottom: 8 }}
                  />
                )}
                {variables.length > 0 && (
                  <Space wrap style={{ marginBottom: 8 }}>
                    {variables.map((v) => (
                      <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Tag color="cyan">{v}</Tag>
                        <Input
                          size="small"
                          placeholder="值"
                          style={{ width: 120 }}
                          value={varOverrides[v] ?? ''}
                          onChange={(e) => setVarOverrides((prev) => ({ ...prev, [v]: e.target.value }))}
                          data-testid={`tpd-var-${v}`}
                        />
                      </div>
                    ))}
                  </Space>
                )}

                <pre
                  data-testid="tpd-preview"
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    padding: 12,
                    fontSize: 13,
                    lineHeight: 1.8,
                    maxHeight: 360,
                    overflow: 'auto',
                    fontFamily: 'inherit',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {renderedBody}
                </pre>
              </div>
            ),
          },
          {
            key: 'diff',
            label: (
              <Space>
                <GitCompare size={14} />
                <span>差异对比</span>
              </Space>
            ),
            children: (
              <div data-testid="tpd-diff">
                {currentFindings || currentConclusion ? (
                  <pre
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      padding: 12,
                      fontSize: 12,
                      lineHeight: 1.8,
                      maxHeight: 400,
                      overflow: 'auto',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {renderedBody.split('\n').map((line, idx) => {
                      const isAdded = diff.added.includes(idx)
                      const isSame = diff.same.includes(idx)
                      return (
                        <div
                          key={idx}
                          style={{
                            background: isAdded ? '#dcfce7' : isSame ? 'transparent' : 'transparent',
                            padding: '2px 4px',
                          }}
                        >
                          <span style={{ color: '#94a3b8', marginRight: 8, display: 'inline-block', width: 24 }}>
                            {isAdded ? '+' : isSame ? '=' : ' '}
                          </span>
                          {line}
                        </div>
                      )
                    })}
                  </pre>
                ) : (
                  <Alert type="info" showIcon title="当前报告为空,无差异可对比" />
                )}
              </div>
            ),
          },
        ]}
      />

      <Space style={{ marginTop: 12 }}>
        <span>应用方式:</span>
        <Space.Compact>
          <Button
            type={mode === 'append' ? 'primary' : 'default'}
            onClick={() => setMode('append')}
            icon={<Plus size={12} />}
            data-testid="tpd-mode-append"
          >
            追加
          </Button>
          <Button
            type={mode === 'replace' ? 'primary' : 'default'}
            onClick={() => setMode('replace')}
            icon={<Check size={12} />}
            data-testid="tpd-mode-replace"
          >
            替换
          </Button>
        </Space.Compact>
        {mode === 'replace' && (
          <Tag color="orange" icon={<AlertCircle size={10} />}>
            替换会清空当前所见和结论
          </Tag>
        )}
      </Space>
    </Modal>
  )
}

export default TemplatePreviewDiff
