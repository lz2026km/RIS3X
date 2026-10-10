/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 17 - 结构化报告编辑器 V3
 * PACS 对标 (PowerScribe 级): 四区结构化 + 所见即所得 + 段落锁定/解锁申请
 * + 宏命令 (/size /follow /normal /sign) + 段落子模板 (部位+征象+测量组合)
 */
import React, { useState, useCallback, useRef, useEffect, useMemo, useImperativeHandle } from 'react'
import { t } from '@i18n/appI18n'
import { sanitizeHtml } from '@utils/sanitization'
import {
  Bold, Italic, Underline, List, ListOrdered, Undo, Redo, Lock, LockOpen,
  FileText, Eye, Save, Type, Sparkles, Command, Plus, Check, AlertCircle,
} from 'lucide-react'

export type StructuredSectionKey = 'findings' | 'impression' | 'recommendation' | 'conclusion'

export type StructuredSections = Record<StructuredSectionKey, string>

export interface StructuredReportDoc {
  reportId: string
  sections: StructuredSections
  html: string
  plainText: string
  locked: Record<StructuredSectionKey, boolean>
  updatedAt: string
}

export interface StructuredReportEditorHandle {
  getDoc: () => StructuredReportDoc
  insertInto: (section: StructuredSectionKey, html: string) => void
}

export interface MacroItem {
  key: string
  label: string
  desc: string
  html: string
}

export interface SubTemplateItem {
  key: string
  label: string
  bodyPart: string
  html: string
}

const SECTION_KEYS: StructuredSectionKey[] = ['findings', 'impression', 'recommendation', 'conclusion']

export const SECTION_LABEL: Record<StructuredSectionKey, string> = {
  findings: '所见',
  impression: '印象',
  recommendation: '建议',
  conclusion: '结论',
}

// ── 宏命令表 (输入 / 触发) ────────────────────────────────────────────────────
export const SLASH_MACROS: MacroItem[] = [
  { key: 'size', label: '/size', desc: '尺寸模板', html: '<p>大小约 <strong>__长__</strong>cm × <strong>__宽__</strong>cm，边缘清晰。</p>' },
  { key: 'follow', label: '/follow', desc: '随访建议', html: '<p>建议 <strong>__N__</strong> 个月后复查影像学检查，观察病灶变化。</p>' },
  { key: 'normal', label: '/normal', desc: '正常模板', html: '<p>双肺纹理清晰，未见明确实变影及结节影。心影大小正常，纵隔无增宽，膈面光滑，肋膈角锐利。</p>' },
  { key: 'sign', label: '/sign', desc: '签名落款', html: '<p style="margin-top:16px;">报告医师：<strong>__医生__</strong></p>' },
]

// ── 段落子模板 (部位+征象+测量组合) ─────────────────────────────────────────
export const SECTION_SUB_TEMPLATES: SubTemplateItem[] = [
  {
    key: 'chest-nodule',
    label: '胸部·肺结节测量',
    bodyPart: '胸部CT',
    html: '<p>右肺上叶见一<strong>磨玻璃结节影</strong>，大小约 <strong>1.2cm × 0.9cm</strong>，CT值约 <strong>-520 HU</strong>，边缘见毛刺征及胸膜牵拉征象。</p>',
  },
  {
    key: 'chest-effusion',
    label: '胸部·胸腔积液',
    bodyPart: '胸部CT',
    html: '<p>右侧胸腔见<strong>少量液性密度影</strong>，局部肺组织受压，邻近胸膜增厚。</p>',
  },
  {
    key: 'abdomen-liver',
    label: '腹部·肝占位',
    bodyPart: '腹部CT',
    html: '<p>肝脏右叶见一类圆形<strong>低密度灶</strong>，大小约 <strong>3.5cm × 2.8cm</strong>，边界欠清，增强扫描呈"快进快出"强化模式。</p>',
  },
  {
    key: 'abdomen-gb',
    label: '腹部·胆囊结石',
    bodyPart: '腹部超声',
    html: '<p>胆囊内见<strong>强回声团</strong>，大小约 <strong>1.0cm × 0.8cm</strong>，后伴声影，随体位移动。</p>',
  },
  {
    key: 'brain-hemorrhage',
    label: '颅脑·出血灶',
    bodyPart: '颅脑CT',
    html: '<p>右侧基底节区见<strong>高密度出血灶</strong>，大小约 <strong>2.1cm × 1.6cm</strong>，周围见低密度水肿带，占位效应轻度。</p>',
  },
  {
    key: 'spine-disc',
    label: '脊柱·椎间盘突出',
    bodyPart: '腰椎MRI',
    html: '<p>L4/5椎间盘<strong>向后突出</strong>，硬膜囊受压，双侧神经根受累，椎管有效容积减小。</p>',
  },
]

export function structuredSectionsToHtml(sections: StructuredSections): string {
  const body = SECTION_KEYS.map((key) => {
    const text = (sections[key] ?? '').trim()
    if (!text) return ''
    return `<section><h3 style="color:#1e3a8a;border-left:4px solid #2563eb;padding-left:8px;margin:12px 0 6px;font-size:15px;">【${SECTION_LABEL[key]}】</h3><div>${text}</div></section>`
  }).join('')
  return `<div style="font-family:SimSun,serif;line-height:1.8;">${body}</div>`
}

function plainTextOf(sections: StructuredSections): string {
  return SECTION_KEYS.map((key) => {
    const text = (sections[key] ?? '').trim()
    return text ? `【${SECTION_LABEL[key]}】${text}` : ''
  }).filter(Boolean).join('\n')
}

interface ZoneEditorProps {
  section: StructuredSectionKey
  html: string
  locked: boolean
  unlockPending: boolean
  readOnly: boolean
  onChange: (html: string) => void
  onLockToggle: (section: StructuredSectionKey, locked: boolean) => void
  onUnlockRequest: (section: StructuredSectionKey) => void
}

function ZoneEditor({ section, html, locked, unlockPending, readOnly, onChange, onLockToggle, onUnlockRequest }: ZoneEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [showMacros, setShowMacros] = useState(false)
  const [macroFilter, setMacroFilter] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== sanitizeHtml(html)) {
      editorRef.current.innerHTML = sanitizeHtml(html)
    }
  }, [html])

  const sync = useCallback(() => {
    if (!editorRef.current) return
    onChange(editorRef.current.innerHTML)
  }, [onChange])

  const exec = useCallback((command: string, value?: string) => {
    try {
      document.execCommand(command, false, value)
    } catch {
      /* execCommand deprecated fallback */
    }
    sync()
  }, [sync])

  const insertHtmlAtCaret = useCallback((htmlToInsert: string) => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    try {
      document.execCommand('insertHTML', false, htmlToInsert)
    } catch {
      const sel = window.getSelection()
      const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const frag = range.createContextualFragment(htmlToInsert)
      range.insertNode(frag)
      if (sel) {
        sel.removeAllRanges()
        const r = document.createRange()
        r.setStartAfter(frag)
        r.collapse(true)
        sel.addRange(r)
      }
    }
    sync()
  }, [sync])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === '/' && !locked) {
      e.preventDefault()
      setShowMacros(true)
      setMacroFilter('')
    }
    if (e.key === 'Escape') {
      setShowMacros(false)
      setShowTemplates(false)
    }
  }, [locked])

  const pickMacro = useCallback((macro: MacroItem) => {
    setShowMacros(false)
    const html2 = macro.html
    insertHtmlAtCaret(html2.replace('__长__', '3.2').replace('__宽__', '2.5').replace('__N__', '3').replace('__医生__', '张伟'))
  }, [insertHtmlAtCaret])

  const pickTemplate = useCallback((tpl: SubTemplateItem) => {
    setShowTemplates(false)
    insertHtmlAtCaret(tpl.html)
  }, [insertHtmlAtCaret])

  const filteredMacros = useMemo(() => {
    const q = macroFilter.trim().toLowerCase()
    return q ? SLASH_MACROS.filter((m) => m.key.includes(q) || m.desc.includes(q) || m.label.includes(q)) : SLASH_MACROS
  }, [macroFilter])

  const editable = !readOnly && !locked
  const label = SECTION_LABEL[section]

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 14, background: '#fff', overflow: 'visible' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={14} color="#2563eb" />【{label}】
        </span>
        <div style={{ flex: 1 }} />
        {locked ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#b45309', fontWeight: 600 }}>
            <Lock size={12} />{t('w17.sr.locked')}
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}>
            <LockOpen size={12} />{t('w17.sr.editable')}
          </span>
        )}
        {!readOnly && (
          <>
            <button
              type="button"
              title={t('w17.sr.lockSection')}
              onClick={() => onLockToggle(section, !locked)}
              style={{ border: 'none', background: locked ? '#fee2e2' : '#dbeafe', color: locked ? '#b91c1c' : '#1d4ed8', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
            >
              {locked ? <Lock size={12} /> : <LockOpen size={12} />}
              {locked ? t('w17.sr.unlock') : t('w17.sr.lock')}
            </button>
            {locked && (
              <button
                type="button"
                disabled={unlockPending}
                onClick={() => onUnlockRequest(section)}
                style={{ border: '1px solid #f59e0b', background: unlockPending ? '#fef3c7' : '#fffbeb', color: '#92400e', borderRadius: 6, padding: '3px 8px', cursor: unlockPending ? 'default' : 'pointer', fontSize: 11, fontWeight: 600 }}
              >
                {unlockPending ? <Check size={12} /> : <AlertCircle size={12} />}
                {unlockPending ? t('w17.sr.unlockPending') : t('w17.sr.unlockRequest')}
              </button>
            )}
          </>
        )}
      </div>

      {editable && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
          <button type="button" title={t('w9e.structuredEditorV3.toolbarBold')} onClick={() => exec('bold')} style={toolBtn}><Bold size={13} /></button>
          <button type="button" title={t('w9e.structuredEditorV3.toolbarItalic')} onClick={() => exec('italic')} style={toolBtn}><Italic size={13} /></button>
          <button type="button" title={t('w9e.structuredEditorV3.toolbarUnderline')} onClick={() => exec('underline')} style={toolBtn}><Underline size={13} /></button>
          <button type="button" title={t('w9e.structuredEditorV3.toolbarBulletList')} onClick={() => exec('insertUnorderedList')} style={toolBtn}><List size={13} /></button>
          <button type="button" title={t('w9e.structuredEditorV3.toolbarNumberedList')} onClick={() => exec('insertOrderedList')} style={toolBtn}><ListOrdered size={13} /></button>
          <span style={{ width: 1, height: 14, background: '#e2e8f0', margin: '0 6px' }} />
          <button type="button" title={t('w9e.structuredEditorV3.toolbarUndo')} onClick={() => exec('undo')} style={toolBtn}><Undo size={13} /></button>
          <button type="button" title={t('w9e.structuredEditorV3.toolbarRedo')} onClick={() => exec('redo')} style={toolBtn}><Redo size={13} /></button>
          <span style={{ width: 1, height: 14, background: '#e2e8f0', margin: '0 6px' }} />
          <span style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowTemplates((v) => !v)}
              style={{ ...toolBtn, display: 'flex', alignItems: 'center', gap: 4, background: showTemplates ? '#e0e7ff' : 'transparent' }}
            >
              <Plus size={13} />{t('w17.sr.insertTemplate')}
            </button>
            {showTemplates && (
              <div style={{ position: 'absolute', top: 26, left: 0, zIndex: 50, width: 320, maxHeight: 320, overflowY: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 8 }}>
                {SECTION_SUB_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => pickTemplate(tpl)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{tpl.label}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{tpl.bodyPart}</div>
                  </button>
                ))}
              </div>
            )}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>{t('w17.sr.slashHint')}</span>
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <div
          ref={editorRef}
          contentEditable={editable}
          suppressContentEditableWarning
          onInput={sync}
          onBlur={sync}
          onKeyDown={handleKeyDown}
          data-testid={`zone-${section}`}
          style={{
            minHeight: 120,
            padding: '10px 14px',
            fontSize: 14,
            lineHeight: 1.8,
            fontFamily: 'SimSun, serif', background: editable ? '#fff' : '#f8fafc',
            color: editable ? '#0f172a' : '#475569',
          }}
        />
        {locked && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(248,250,252,0.4)', pointerEvents: 'none', border: '1px dashed #cbd5e1' }} />
        )}
        {showMacros && editable && (
          <div style={{ position: 'absolute', top: 4, left: 14, zIndex: 60, width: 300, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 12, fontWeight: 600, color: '#334155' }}>
              <Command size={12} color="#2563eb" />{t('w17.sr.macroTitle')}
              <input
                autoFocus
                value={macroFilter}
                onChange={(e) => setMacroFilter(e.target.value)}
                placeholder={t('w17.sr.macroFilter')}
                style={{ flex: 1, padding: '3px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12,}}
              />
            </div>
            {filteredMacros.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => pickMacro(m)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '7px 8px', borderRadius: 6, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <Sparkles size={13} color="#2563eb" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1e3a8a', minWidth: 70 }}>{m.label}</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>{m.desc}</span>
              </button>
            ))}
            {filteredMacros.length === 0 && (
              <div style={{ padding: 10, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>{t('w17.sr.macroEmpty')}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const toolBtn: React.CSSProperties = {
  border: 'none', background: 'transparent', borderRadius: 4, cursor: 'pointer',
  padding: '4px 6px', color: '#475569', display: 'inline-flex', alignItems: 'center',
}

interface Props {
  reportId: string
  initialSections?: Partial<StructuredSections>
  readOnly?: boolean
  approved?: boolean
  onChange?: (doc: StructuredReportDoc) => void
  onSave?: (doc: StructuredReportDoc) => void
  onUnlockRequest?: (section: StructuredSectionKey) => void
}

export const StructuredReportEditorV3 = React.forwardRef<StructuredReportEditorHandle, Props>(({
  reportId, initialSections, readOnly = false, approved = false,
  onChange, onSave, onUnlockRequest,
}, ref) => {
  const [sections, setSections] = useState<StructuredSections>({
    findings: initialSections?.findings ?? '',
    impression: initialSections?.impression ?? '',
    recommendation: initialSections?.recommendation ?? '',
    conclusion: initialSections?.conclusion ?? '',
  })
  // 审批通过后全部段落锁定; 手动锁/解锁在 locked 中覆盖
  const [locked, setLocked] = useState<Record<StructuredSectionKey, boolean>>({
    findings: approved, impression: approved, recommendation: approved, conclusion: approved,
  })
  const [unlockPending, setUnlockPending] = useState<Record<StructuredSectionKey, boolean>>({
    findings: false, impression: false, recommendation: false, conclusion: false,
  })
  const [preview, setPreview] = useState(false)

  const buildDoc = useCallback((): StructuredReportDoc => ({
    reportId,
    sections,
    html: structuredSectionsToHtml(sections),
    plainText: plainTextOf(sections),
    locked: { ...locked },
    updatedAt: new Date().toISOString(),
  }), [reportId, sections, locked])

  useEffect(() => {
    onChange?.(buildDoc())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, locked])

  useImperativeHandle(ref, () => ({
    getDoc: () => buildDoc(),
    insertInto: (section: StructuredSectionKey, htmlToInsert: string) => {
      setSections((prev) => ({ ...prev, [section]: `${prev[section]}${htmlToInsert}` }))
    },
  }), [buildDoc])

  const handleZoneChange = useCallback((key: StructuredSectionKey, html: string) => {
    setSections((prev) => ({ ...prev, [key]: html }))
  }, [])

  const handleLockToggle = useCallback((key: StructuredSectionKey, next: boolean) => {
    setLocked((prev) => ({ ...prev, [key]: next }))
  }, [])

  const handleUnlockRequest = useCallback((key: StructuredSectionKey) => {
    setUnlockPending((prev) => ({ ...prev, [key]: true }))
    onUnlockRequest?.(key)
  }, [onUnlockRequest])

  const handleSave = useCallback(() => {
    onSave?.(buildDoc())
  }, [buildDoc, onSave])

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Type size={16} color="#2563eb" />{t('w17.sr.title')}
        </span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{reportId}</span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          style={{ padding: '6px 14px', border: '1px solid #cbd5e1', borderRadius: 6, background: preview ? '#eff6ff' : '#fff', color: preview ? '#1d4ed8' : '#475569', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Eye size={14} />{preview ? t('w17.sr.editMode') : t('w17.sr.previewMode')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          style={{ padding: '6px 16px', border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Save size={14} />{t('w17.sr.save')}
        </button>
      </div>

      {preview ? (
        <div
          data-testid="sr-preview"
          style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, minHeight: 480, background: '#fff' }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(structuredSectionsToHtml(sections)) }}
        />
      ) : (
        SECTION_KEYS.map((key) => (
          <ZoneEditor
            key={key}
            section={key}
            html={sections[key]}
            locked={locked[key]}
            unlockPending={unlockPending[key]}
            readOnly={readOnly}
            onChange={(html) => handleZoneChange(key, html)}
            onLockToggle={handleLockToggle}
            onUnlockRequest={handleUnlockRequest}
          />
        ))
      )}
    </div>
  )
})

export default StructuredReportEditorV3
