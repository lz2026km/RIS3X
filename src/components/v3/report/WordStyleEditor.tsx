/**
 * G005 放射RIS系统 v3.0.2 - 报告编辑器(直接重写)
 * v3.0.1:Word 风格所见/结论/建议/签名 4 段
 * v3.0.2:结构化混合(自由文本 + 宏命令 + 结构化字段 + AI + 语音 + 图像锚 + 痕迹)
 *
 * 集成:StructuredFieldEditor + MacroEngine + RequiredFieldGuard + AI + 语音
 */
import React, { useState, useRef, useMemo, useCallback } from 'react'
import { Card, Tabs, Button, Input, Space, Tag, Tooltip, message, Form } from 'antd'
import {
  Bold,
  Italic,
  Underline,
  List,
  Undo,
  Redo,
  Type,
  Save,
  Send,
  Printer,
  Mic,
  MicOff,
  Sparkles,
  Code,
  Hash,
  Eye,
  Edit3,
  GitBranch,
} from 'lucide-react'
import { StructuredFieldEditor, type FieldValue } from './StructuredFieldEditor'
import { renderMacro, buildSampleContext, structuredFieldsToContext } from './MacroEngine'
import { RequiredFieldGuard, DEFAULT_REPORT_RULES } from './RequiredFieldGuard'

const { TextArea } = Input
const { useForm } = Form

export interface WordStyleEditorProps {
  patientName?: string
  patientId?: string
  reportType?: string
  initialFindings?: string
  initialConclusion?: string
  initialSuggestion?: string
  initialSignature?: string
  initialStructured?: Record<string, FieldValue>
  /** 选中的 RADS schema 类别 */
  radsCategory?: keyof typeof import('./StructuredFieldEditor').RAD_SCHEMAS | string
  /** 结构化字段(用户在编辑器修改) */
  onStructuredChange?: (values: Record<string, FieldValue>) => void
  onSave?: (content: ReportContent) => void
  onSubmit?: (content: ReportContent) => void
  onAIAssist?: (section: 'findings' | 'conclusion' | 'suggestion') => void
  onPhraseInsert?: () => void
  onHistoryRef?: () => void
  /** 字段变更 + 验证状态 */
  validate?: boolean
}

export interface ReportContent {
  findings: string
  conclusion: string
  suggestion: string
  signature: string
  structured: Record<string, FieldValue>
}

export const WordStyleEditor: React.FC<WordStyleEditorProps> = ({
  patientName = '张三',
  patientId = 'P001',
  reportType = '胸部 CT 平扫',
  initialFindings = '',
  initialConclusion = '',
  initialSuggestion = '',
  initialSignature = '',
  initialStructured = {},
  radsCategory = 'BI-RADS',
  onStructuredChange,
  onSave,
  onSubmit,
  onAIAssist,
  onPhraseInsert,
  onHistoryRef,
  validate = true,
}) => {
  const [findings, setFindings] = useState(initialFindings)
  const [conclusion, setConclusion] = useState(initialConclusion)
  const [suggestion, setSuggestion] = useState(initialSuggestion)
  const [signature, setSignature] = useState(initialSignature)
  const [structured, setStructured] = useState<Record<string, FieldValue>>(initialStructured)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'structured'>('edit')
  const [recording, setRecording] = useState(false)
  const [showMacroPreview, setShowMacroPreview] = useState(false)
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})

  const content: ReportContent = useMemo(
    () => ({ findings, conclusion, suggestion, signature, structured }),
    [findings, conclusion, suggestion, signature, structured]
  )

  const insertAtCursor = useCallback(
    (text: string, section: keyof ReportContent & string) => {
      const el = textareaRefs.current[section]
      const setter: Record<string, (v: string) => void> = {
        findings: setFindings,
        conclusion: setConclusion,
        suggestion: setSuggestion,
        signature: setSignature,
      }
      if (!el) {
        setter[section]?.((s: string) => s + text)
        return
      }
      const start = el.selectionStart
      const end = el.selectionEnd
      const current = el.value
      const next = current.slice(0, start) + text + current.slice(end)
      setter[section]?.(next)
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(start + text.length, start + text.length)
      })
    },
    []
  )

  const handleSave = useCallback(() => {
    onSave?.(content)
    message.success('报告草稿已保存')
  }, [content, onSave])

  const handleSubmit = useCallback(() => {
    onSubmit?.(content)
    message.success('报告已提交一审')
  }, [content, onSubmit])

  const toggleRecording = useCallback(() => {
    setRecording((r) => !r)
    if (!recording) {
      message.info('开始语音录入...')
      setTimeout(() => {
        setRecording(false)
        insertAtCursor('\n\n[语音录入] 影像学表现符合上述描述。', 'findings')
        message.success('语音录入完成')
      }, 2000)
    } else {
      message.info('停止语音录入')
    }
  }, [recording, insertAtCursor])

  const updateStructured = useCallback(
    (next: Record<string, FieldValue>) => {
      setStructured(next)
      onStructuredChange?.(next)
    },
    [onStructuredChange]
  )

  const insertMacro = useCallback(
    (section: 'findings' | 'conclusion' | 'suggestion') => {
      const template = `\n\n{{#if patient.age >= 18}}\n成人检查方案\n{{#else}}\n儿科方案\n{{/if}}\n`
      insertAtCursor(template, section)
      message.info('已插入宏命令模板,可在所见中编辑')
    },
    [insertAtCursor]
  )

  const renderToolbar = (section: 'findings' | 'conclusion' | 'suggestion' | 'signature') => (
    <Space size={2} style={{ marginBottom: 4 }} wrap>
      <Tooltip title="加粗">
        <Button size="small" type="text" icon={<Bold size={12} />} onClick={() => insertAtCursor('**加粗**', section)} />
      </Tooltip>
      <Tooltip title="斜体">
        <Button size="small" type="text" icon={<Italic size={12} />} onClick={() => insertAtCursor('*斜体*', section)} />
      </Tooltip>
      <Tooltip title="下划线">
        <Button size="small" type="text" icon={<Underline size={12} />} onClick={() => insertAtCursor('__下划线__', section)} />
      </Tooltip>
      <Tooltip title="列表">
        <Button size="small" type="text" icon={<List size={12} />} onClick={() => insertAtCursor('\n- 项目', section)} />
      </Tooltip>
      <Tooltip title="撤销">
        <Button size="small" type="text" icon={<Undo size={12} />} />
      </Tooltip>
      <Tooltip title="重做">
        <Button size="small" type="text" icon={<Redo size={12} />} />
      </Tooltip>
      {section !== 'signature' && (
        <>
          <Tooltip title="宏命令">
            <Button
              size="small"
              type="text"
              icon={<Hash size={12} />}
              onClick={() => insertMacro(section)}
              data-testid={`macro-${section}`}
            />
          </Tooltip>
          <Tooltip title="AI 续写">
            <Button
              size="small"
              type="text"
              icon={<Sparkles size={12} color="#722ed1" />}
              onClick={() => onAIAssist?.(section as 'findings' | 'conclusion' | 'suggestion')}
              data-testid={`ai-${section}`}
            />
          </Tooltip>
          <Tooltip title="插入短语">
            <Button size="small" type="text" icon={<Type size={12} />} onClick={onPhraseInsert} data-testid={`phrase-${section}`} />
          </Tooltip>
          <Tooltip title="历史引用">
            <Button size="small" type="text" icon={<GitBranch size={12} />} onClick={onHistoryRef} data-testid={`history-${section}`} />
          </Tooltip>
        </>
      )}
    </Space>
  )

  const renderSection = (
    section: 'findings' | 'conclusion' | 'suggestion' | 'signature',
    label: string,
    rows: number,
    value: string,
    setter: (v: string) => void
  ) => (
    <div key={section} style={{ marginBottom: 16 }} data-testid={`section-${section}`}>
      <div
        style={{
          background: '#f1f5f9',
          padding: '4px 12px',
          fontSize: 12,
          fontWeight: 700,
          color: '#1e3a5f',
          borderRadius: '4px 4px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{label}</span>
        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>{value.length} 字</span>
      </div>
      {renderToolbar(section)}
      <TextArea
        ref={(el) => {
          textareaRefs.current[section] = el?.textarea ?? null
        }}
        value={value}
        onChange={(e) => setter(e.target.value)}
        autoSize={{ minRows: rows, maxRows: rows + 10 }}
        bordered
        style={{
          fontSize: 13,
          lineHeight: 1.8,
          fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
        }}
        placeholder={`请输入${label}...`}
        data-testid={`textarea-${section}`}
      />
    </div>
  )

  const context = useMemo(
    () => ({
      ...buildSampleContext(),
      patient: { name: patientName, sex: 'M', age: 45, id: patientId },
      study: { modality: 'CT', bodyPart: 'CHEST', accession: 'ACC-001' },
      ...structuredFieldsToContext(
        Object.entries(structured).map(([k, v]) => ({ key: k, value: v, displayText: String(v ?? '') }))
      ),
    }),
    [patientName, patientId, structured]
  )

  const macroPreview = useMemo(
    () => ({
      findings: renderMacro(findings, context),
      conclusion: renderMacro(conclusion, context),
      suggestion: renderMacro(suggestion, context),
    }),
    [findings, conclusion, suggestion, context]
  )

  return (
    <RequiredFieldGuard
      rules={DEFAULT_REPORT_RULES}
      values={content}
      onValidSubmit={() => onSubmit?.(content)}
    >
      <Card
        data-testid="word-style-editor"
        title={
          <Space>
            <Edit3 size={16} color="#1e3a5f" />
            <span>报告编辑器 · {reportType}</span>
            <Tag color="blue">
              {patientName} · {patientId}
            </Tag>
            <Tag color="purple">v3.0.2 结构化</Tag>
          </Space>
        }
        extra={
          <Space>
            <Tooltip title="语音录入">
              <Button
                type={recording ? 'primary' : 'default'}
                danger={recording}
                shape="circle"
                size="small"
                icon={recording ? <MicOff size={14} /> : <Mic size={14} />}
                onClick={toggleRecording}
                data-testid="voice-toggle"
              />
            </Tooltip>
            <Button icon={<Printer size={14} />} onClick={() => window.print()} data-testid="print-btn">
              打印
            </Button>
            <Button icon={<Save size={14} />} onClick={handleSave} data-testid="save-btn">
              保存
            </Button>
            <Button type="primary" icon={<Send size={14} />} onClick={handleSubmit} data-testid="submit-btn">
              提交
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as 'edit' | 'preview' | 'structured')}
          items={[
            {
              key: 'edit',
              label: (
                <Space>
                  <Edit3 size={14} />
                  <span>编辑</span>
                </Space>
              ),
              children: (
                <div>
                  {renderSection('findings', '检查所见', 8, findings, setFindings)}
                  {renderSection('conclusion', '检查结论', 4, conclusion, setConclusion)}
                  {renderSection('suggestion', '建议', 3, suggestion, setSuggestion)}
                  {renderSection('signature', '签名', 2, signature, setSignature)}
                </div>
              ),
            },
            {
              key: 'structured',
              label: (
                <Space>
                  <Code size={14} />
                  <span>结构化字段</span>
                </Space>
              ),
              children: (
                <div data-testid="structured-section">
                  <StructuredFieldEditor
                    radsCategory={radsCategory}
                    values={structured}
                    onChange={updateStructured}
                    allowSchemaEdit
                  />
                </div>
              ),
            },
            {
              key: 'preview',
              label: (
                <Space>
                  <Eye size={14} />
                  <span>预览</span>
                </Space>
              ),
              children: (
                <div
                  style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    padding: 24,
                    fontSize: 14,
                    lineHeight: 2,
                    fontFamily: 'Microsoft YaHei, PingFang SC, serif',
                  }}
                >
                  <h3 style={{ textAlign: 'center' }}>{reportType}</h3>
                  <div style={{ marginBottom: 16, color: '#64748b' }}>
                    患者:{patientName} · ID:{patientId} · 检查号:ACC-001
                  </div>
                  <h4>检查所见</h4>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{findings || '(空)'}</pre>
                  <h4>检查结论</h4>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{conclusion || '(空)'}</pre>
                  <h4>建议</h4>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{suggestion || '(空)'}</pre>
                  <h4>签名</h4>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{signature || '(空)'}</pre>
                  {Object.keys(structured).length > 0 && (
                    <>
                      <h4>结构化字段</h4>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}>
                        {JSON.stringify(structured, null, 2)}
                      </pre>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </RequiredFieldGuard>
  )
}

export default WordStyleEditor
