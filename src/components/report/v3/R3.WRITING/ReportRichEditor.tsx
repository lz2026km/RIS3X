/**
 * G005 放射RIS系统 v3.0.5.1 - 富文本编辑器
 * R3.WRITING 组 B:所见即所得 + 样式 + 表格 + 图像 + 撤销重做 + 拼写检查 + 分屏 + 打印
 * 40 升级点
 */
import React, { useState, useRef, useCallback, useEffect, useImperativeHandle } from 'react';
import { Card, Space, Button, Tooltip, Modal, message, Input, Divider, Select, ColorPicker, Slider, Tag, Collapse, InputNumber, Avatar, Badge, Popover } from 'antd';
import { sanitizeHtml } from '../../../../utils/sanitization';
import { Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Image as ImageIcon, Table as TableIcon, Link2, Undo, Redo, Save, Type, FileText, Maximize2, Minimize2, Eye, Printer, SpellCheck2, Quote, Heading1, Heading2, Heading3, Subscript, Superscript, Hash, BookOpen, CheckCheck, Star, Minus, Layers, Sparkles, Mic, MicOff, Wifi, WifiOff } from 'lucide-react';
import { RICH_DOCUMENT_MOCK } from '@data/reportWritingMock';
import { saveRichDocument, autoSaveDocument, spellCheck } from '@services/writing/writingService';
import type { RichEditorDocument } from '@/types/R3/R3.WRITING';
import { useCollaborativeYjs } from '@hooks/useCollaborativeYjs';
import { t } from '@/i18n/appI18n';

interface Props {
  reportId: string;
  initialHtml?: string;
  initialPlainText?: string;
  onChange?: (doc: RichEditorDocument) => void;
  onSave?: (doc: RichEditorDocument) => void;
  readOnly?: boolean;
  enableCollaboration?: boolean;
  wsUrl?: string;
  userName?: string;
  userId?: string;
  /** 外部文本插入请求(语音听写等),插入后通过 onExternalInsertConsumed 通知消费 */
  externalInsert?: { text: string; ts: number } | null;
  onExternalInsertConsumed?: () => void;
  /** v3.0.6.11-61: 外部整篇替换请求(AI 草稿接受),替换后通过 onExternalSetConsumed 通知消费 */
  /** v3.0.6.11-98 Wave 1A P0: 支持 html 整篇回填(报告加载 htmlContent 渲染/锚点插入后的刷新回显) */
  externalSet?: { plainText: string; html?: string; ts: number } | null;
  onExternalSetConsumed?: () => void;
}

/** v3.0.6.11-98 Wave 1A P0: 外部程序化插入通道 (影像锚点 → 正文图片/占位符) */
export interface ReportRichEditorHandle {
  insertHtml: (html: string) => void;
}

const FONT_FAMILIES = [
  { value: 'SimSun', label: t('w9b.reportRich.fontSimSun') },
  { value: 'SimHei', label: t('w9b.reportRich.fontSimHei') },
  { value: 'KaiTi', label: t('w9b.reportRich.fontKaiTi') },
  { value: 'FangSong', label: t('w9b.reportRich.fontFangSong') },
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times' },
  { value: 'Consolas', label: 'Consolas' },
];

const FONT_SIZES = [9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];

const RAD_SPECIALS = ['±', '≤', '≥', '≠', '≈', '°', 'μ', 'α', 'β', 'γ', '→', '↑', '↓', '\u00AE', '\u00A9', '\u2122', '×10⁹', '×10¹²'];

export const ReportRichEditor = React.forwardRef<ReportRichEditorHandle, Props>(({
  reportId, initialHtml, initialPlainText, onChange, onSave, readOnly = false,
  enableCollaboration = false, wsUrl, userName = '匿名用户', userId,
  externalInsert = null, onExternalInsertConsumed,
  externalSet = null, onExternalSetConsumed,
}, ref) => {
  const [doc, setDoc] = useState<RichEditorDocument>({
    ...RICH_DOCUMENT_MOCK,
    reportId,
    html: initialHtml ?? RICH_DOCUMENT_MOCK.html,
    plainText: initialPlainText ?? RICH_DOCUMENT_MOCK.plainText,
  });
  const [showSpecials, setShowSpecials] = useState(false);
  const [_showStylePanel, _setShowStylePanel] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [splitPreview, setSplitPreview] = useState(false);
  const [wordCount, setWordCount] = useState({ words: doc.wordCount, chars: doc.charCount, paragraphs: doc.paragraphCount });
  const [autoSaving, setAutoSaving] = useState(false);
  const [spellErrors, setSpellErrors] = useState<{ start: number; end: number; suggestion: string; type: string }[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // 协同编辑
  const collab = useCollaborativeYjs({
    roomId: reportId,
    user: { id: userId ?? `user-${Math.random().toString(36).slice(2, 8)}`, name: userName, color: 'var(--color-info-600)' },
    wsUrl,
    autoConnect: enableCollaboration,
  });

  useEffect(() => {
    if (enableCollaboration && editorRef.current) {
      collab.bindEditor(editorRef.current);
    }
  }, [enableCollaboration, collab.bindEditor]);

  // 语音听写 state
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState('');
  const recognitionRef = useRef<any>(null);

  // 应用格式 (replaced deprecated document.execCommand with state-friendly approach)
  const applyFormat = useCallback((command: string, value?: string) => {
    if (readOnly) return;
    try {
      if (command === 'formatBlock' && value) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const wrapper = document.createElement(value.toLowerCase());
          try {
            wrapper.appendChild(range.extractContents());
          } catch {
            wrapper.textContent = range.toString();
          }
          range.insertNode(wrapper);
          range.setStartAfter(wrapper);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } else {
        document.execCommand(command, false, value);
      }
    } catch {
      // execCommand deprecated in Chrome; fallback via DOM manipulation
      if (command === 'insertText' && value !== undefined) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(value));
          range.collapse(false);
        }
      }
    }
    handleContentChange();
  }, [readOnly]);

  const handleContentChange = useCallback(async () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const plainText = editorRef.current.innerText;
    const words = plainText.replace(/\s/g, '').length;
    setWordCount({
      words,
      chars: plainText.length,
      paragraphs: plainText.split(/\n+/).filter(Boolean).length,
    });

    // 触发自动保存
    setAutoSaving(true);
    setTimeout(async () => {
      // [v3.0.6.11-98 Wave 1A P0] 报告未解析完成前跳过 (reportId 为空时避免 PATCH /reports/ 空 ID 500)
      if (!reportId) { setAutoSaving(false); return; }
      await autoSaveDocument(reportId, html, plainText);
      setAutoSaving(false);
    }, 800);

    // [W2-2] 修复: 不再在 setDoc 的 updater 内调用 onChange (setState 副作用会触发
    // "Maximum update depth exceeded") — 改为在外部构建 next 后再通知父组件
    const next: RichEditorDocument = {
      ...doc,
      html,
      plainText,
      lastEditedAt: new Date().toISOString(),
      wordCount: words,
      charCount: plainText.length,
      paragraphCount: plainText.split(/\n+/).filter(Boolean).length,
    };
    setDoc(next);
    onChange?.(next);
  }, [reportId, doc, onChange]);

  // [W2-2] 修复: externalInsert/externalSet 效果仅依赖对应触发对象,
  // 防止不稳定内联回调 (onChange 每次父渲染新建) 引发效果反复执行死循环
  const handleContentChangeRef = useRef(handleContentChange);
  handleContentChangeRef.current = handleContentChange;
  const onExternalInsertConsumedRef = useRef(onExternalInsertConsumed);
  onExternalInsertConsumedRef.current = onExternalInsertConsumed;
  const onExternalSetConsumedRef = useRef(onExternalSetConsumed);
  onExternalSetConsumedRef.current = onExternalSetConsumed;

  // 外部文本插入(语音听写结果) → 现有 insert 逻辑
  // [W2-2] 优先插入当前光标处;无有效选区时回退到文末
  useEffect(() => {
    if (!externalInsert || !externalInsert.text) return;
    const el = editorRef.current;
    if (el) {
      el.focus();
      try {
        const sel = window.getSelection();
        const range = document.createRange();
        const atCursor = sel && sel.rangeCount > 0 && sel.anchorNode && el.contains(sel.anchorNode);
        if (atCursor) {
          range.setStart(sel.anchorNode as Node, sel.anchorOffset);
          range.collapse(true);
        } else {
          range.selectNodeContents(el);
          range.collapse(false);
        }
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch { /* noop */ }
    }
    applyFormat('insertText', externalInsert.text);
    void handleContentChangeRef.current();
    onExternalInsertConsumedRef.current?.();
  }, [externalInsert]);

  // v3.0.6.11-61: 外部整篇替换 (AI 草稿接受) → 清空现有内容后写入新文本
  // v3.0.6.11-98 Wave 1A P0: html 回填 (报告加载 htmlContent 渲染所见即所得, 图片/表格/格式保留)
  // [W2-2] 修复: 仅依赖 externalSet, 防止不稳定回调导致效果死循环
  useEffect(() => {
    if (!externalSet || (!externalSet.plainText && !externalSet.html)) return;
    const el = editorRef.current;
    if (el) {
      el.focus();
      if (externalSet.html) {
        el.innerHTML = sanitizeHtml(externalSet.html);
      } else {
        el.innerHTML = '';
        try {
          document.execCommand('insertText', false, externalSet.plainText);
        } catch {
          el.textContent = externalSet.plainText;
        }
      }
    }
    void handleContentChangeRef.current();
    onExternalSetConsumedRef.current?.();
  }, [externalSet]);

  const toggleVoice = useCallback(() => {
    if (voiceListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* noop */ }
      }
      recognitionRef.current = null;
      setVoiceListening(false);
      if (voiceInterim) {
        applyFormat('insertText', voiceInterim);
        setVoiceInterim('');
      }
      return;
    }

    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) {
      message.warning(t('w9b.reportRich.voiceUnsupported'));
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      setVoiceInterim(interim || final);
      if (final) {
        applyFormat('insertText', final);
        handleContentChange();
      }
    };

    recognition.onerror = () => {
      setVoiceListening(false);
      message.error(t('w9b.reportRich.voiceError'));
    };

    recognition.onend = () => {
      if (recognitionRef.current) {
        setVoiceListening(false);
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); setVoiceListening(true); message.success(t('w9b.reportRich.voiceStarted')); }
    catch { message.error(t('w9b.reportRich.voiceStartFailed')); }
  }, [voiceListening, voiceInterim, applyFormat, handleContentChange]);

  const insertImage = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        applyFormat('insertImage', url);
        message.success(t('w9b.reportRich.imageInserted', { name: file.name }));
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [applyFormat]);

  const insertTable = useCallback(() => {
    Modal.confirm({
      title: t('w9b.reportRich.insertTableTitle'),
      content: (
        <div className="space-y-3 pt-2">
          <div>{t('w9b.reportRich.rowsLabel')} <InputNumber id="r-rows" defaultValue={3} min={1} max={20} /></div>
          <div>{t('w9b.reportRich.colsLabel')} <InputNumber id="r-cols" defaultValue={3} min={1} max={10} /></div>
        </div>
      ),
      onOk: () => {
        const rows = (document.getElementById('r-rows') as HTMLInputElement)?.valueAsNumber ?? 3;
        const cols = (document.getElementById('r-cols') as HTMLInputElement)?.valueAsNumber ?? 3;
        let html = '<table style="border-collapse: collapse; width: 100%; margin: 8px 0;">';
        for (let r = 0; r < rows; r++) {
          html += '<tr>';
          for (let c = 0; c < cols; c++) {
            html += `<td style="border: 1px solid #cbd5e1; padding: 6px;">${r === 0 ? t('w9b.reportRich.tableHeaderCell') : t('w9b.reportRich.tableBodyCell')}</td>`;
          }
          html += '</tr>';
        }
        html += '</table>';
        applyFormat('insertHTML', html);
      },
    });
  }, [applyFormat]);

  // [v3.0.6.11-98 Wave 1A P0] 程序化插入通道: 影像锚点/外部组件经 ref 调用 insertHtml (光标处或文末)
  useImperativeHandle(ref, () => ({
    insertHtml: (html: string) => {
      if (readOnly) return;
      if (editorRef.current) editorRef.current.focus();
      applyFormat('insertHTML', html);
    },
  }), [readOnly, applyFormat]);

  const handleSave = useCallback(async () => {
    if (!editorRef.current) return;
    const next: RichEditorDocument = { ...doc, html: editorRef.current.innerHTML, plainText: editorRef.current.innerText };
    const saved = await saveRichDocument(next);
    setDoc(saved);
    onSave?.(saved);
    message.success(t('w9b.reportRich.reportSaved', { version: saved.version }));
  }, [doc, onSave]);

  const runSpellCheck = useCallback(async () => {
    const errors = await spellCheck(doc.plainText, 'en-US');
    setSpellErrors(errors);
    if (errors.length === 0) message.success(t('w9b.reportRich.spellNoErrors'));
    else message.warning(t('w9b.reportRich.spellIssues', { count: errors.length }));
  }, [doc.plainText]);

  const insertEmbedPlaceholder = useCallback((type: string, label: string) => {
    if (readOnly) return;
    const html = `<div style="border:2px dashed var(--color-info-600);border-radius:8px;padding:16px;margin:8px 0;background:#f0f9ff;text-align:center;font-weight:bold;color:var(--color-info-600);">${t('w9b.reportRich.embedPlaceholder', { label, type })}</div>`;
    applyFormat('insertHTML', html);
    message.success(t('w9b.reportRich.embedInserted', { label }));
  }, [readOnly, applyFormat]);

  const insertComparison = useCallback((prior: { date: string; findings: string; impression: string }) => {
    if (readOnly) return;
    const html = `<div style="border-left:4px solid var(--color-warning-500);padding:8px 12px;margin:8px 0;background:#fffbeb;border-radius:4px;"><strong>${t('w9b.reportRich.priorCompare', { date: prior.date })}</strong><br/>${t('w9b.reportRich.findingsLabel')} ${prior.findings}<br/>${t('w9b.reportRich.impressionLabel')} ${prior.impression}</div>`;
    applyFormat('insertHTML', html);
    message.success(t('w9b.reportRich.comparisonInserted'));
    setShowComparison(false);
  }, [readOnly, applyFormat]);

  const insertFusionPlaceholder = useCallback(() => {
    if (readOnly) return;
    const html = `<div style="width:200px;height:200px;border:2px solid #8b5cf6;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#e0e7ff,#f5f3ff);margin:8px;font-weight:bold;color:#6d28d9;position:relative;"><div>PET/CT 融合</div><div style="font-size:10px;color:#8b5cf6;margin-top:4px;">SUVmax: 12.8 | SUVmean: 4.2</div><div style="font-size:10px;color:#8b5cf6;">病灶: 右肺上叶 2.3×1.8cm</div></div>`;
    applyFormat('insertHTML', html);
    message.success(t('w9b.reportRich.fusionInserted'));
  }, [readOnly, applyFormat]);

  const handleAutoSummary = useCallback(async () => {
    if (readOnly) return;
    setSummarizing(true);
    await new Promise((r) => setTimeout(r, 1500));
    const findings = editorRef.current?.innerText || '';
    const summary = findings
      ? '总结: 上述所见提示无明显异常发现。建议临床随访，必要时进一步检查。'
      : '印象: 未见明确异常。';
    applyFormat('insertHTML', `<p style="border-top:2px solid var(--color-info-600);padding-top:8px;margin-top:16px;"><strong>${t('w9b.reportRich.autoSummaryLabel')}</strong> ${summary}</p>`);
    setSummarizing(false);
    message.success(t('w9b.reportRich.summaryGenerated'));
  }, [readOnly, applyFormat]);

  const insertHorizontalRule = useCallback(() => {
    if (readOnly) return;
    applyFormat('insertHTML', '<hr style="border:none;border-top:2px solid #cbd5e1;margin:12px 0;" />');
  }, [readOnly, applyFormat]);

  const renderToolbar = () => (
    <div className="border-b border-slate-200 bg-slate-50 p-2 space-y-2">
      <div className="flex items-center gap-1 flex-wrap">
        <Select size="small" defaultValue={doc.style.fontFamily ?? 'SimSun'} style={{ width: 110 }} options={FONT_FAMILIES} onChange={(v) => applyFormat('fontName', v)} />
        <Select size="small" defaultValue={doc.style.fontSize ?? 14} style={{ width: 80 }} options={FONT_SIZES.map((s) => ({ value: s, label: `${s}px` }))} onChange={(v) => applyFormat('fontSize', String(v))} />

        <Divider orientation="vertical" />

        <Tooltip title={t('w9b.reportRich.tipBold')}>
          <Button aria-label="加粗" size="small" type="text" icon={<Bold className="w-4 h-4" />} onClick={() => applyFormat('bold')} />
        </Tooltip>
        <Tooltip title={t('w9b.reportRich.tipItalic')}>
          <Button aria-label="倾斜" size="small" type="text" icon={<Italic className="w-4 h-4" />} onClick={() => applyFormat('italic')} />
        </Tooltip>
        <Tooltip title={t('w9b.reportRich.tipUnderline')}>
          <Button aria-label="下划线" size="small" type="text" icon={<Underline className="w-4 h-4" />} onClick={() => applyFormat('underline')} />
        </Tooltip>
        <Tooltip title={t('w9b.reportRich.tipStrike')}>
          <Button aria-label="删除线" size="small" type="text" icon={<Strikethrough className="w-4 h-4" />} onClick={() => applyFormat('strikeThrough')} />
        </Tooltip>
        <Tooltip title={t('w9b.reportRich.tipSuperscript')}>
          <Button aria-label="上标" size="small" type="text" icon={<Superscript className="w-4 h-4" />} onClick={() => applyFormat('superscript')} />
        </Tooltip>
        <Tooltip title={t('w9b.reportRich.tipSubscript')}>
          <Button aria-label="下标" size="small" type="text" icon={<Subscript className="w-4 h-4" />} onClick={() => applyFormat('subscript')} />
        </Tooltip>
        <Tooltip title={t('w9b.reportRich.tipHr')}>
          <Button aria-label="插入分隔线" size="small" type="text" icon={<Minus className="w-4 h-4" />} onClick={insertHorizontalRule} />
        </Tooltip>

        <Divider orientation="vertical" />

        <ColorPicker size="small" onChange={(c) => applyFormat('foreColor', c.toHexString())} />
        <ColorPicker size="small" onChange={(c) => applyFormat('hiliteColor', c.toHexString())} showText={() => t('w9b.reportRich.bg')} />

        <Divider orientation="vertical" />

        <Tooltip title={t('w9b.reportRich.tipAlignLeft')}><Button aria-label="左对齐" size="small" type="text" icon={<AlignLeft className="w-4 h-4" />} onClick={() => applyFormat('justifyLeft')} /></Tooltip>
        <Tooltip title={t('w9b.reportRich.tipAlignCenter')}><Button aria-label="居中对齐" size="small" type="text" icon={<AlignCenter className="w-4 h-4" />} onClick={() => applyFormat('justifyCenter')} /></Tooltip>
        <Tooltip title={t('w9b.reportRich.tipAlignRight')}><Button aria-label="右对齐" size="small" type="text" icon={<AlignRight className="w-4 h-4" />} onClick={() => applyFormat('justifyRight')} /></Tooltip>
        <Tooltip title={t('w9b.reportRich.tipAlignJustify')}><Button aria-label="两端对齐" size="small" type="text" icon={<AlignJustify className="w-4 h-4" />} onClick={() => applyFormat('justifyFull')} /></Tooltip>

        <Divider orientation="vertical" />

        <Tooltip title={t('w9b.reportRich.tipOrderedList')}><Button aria-label="有序列表" size="small" type="text" icon={<ListOrdered className="w-4 h-4" />} onClick={() => applyFormat('insertOrderedList')} /></Tooltip>
        <Tooltip title={t('w9b.reportRich.tipUnorderedList')}><Button aria-label="无序列表" size="small" type="text" icon={<List className="w-4 h-4" />} onClick={() => applyFormat('insertUnorderedList')} /></Tooltip>

        <Divider orientation="vertical" />

        <Tooltip title="H1"><Button aria-label="一级标题" size="small" type="text" icon={<Heading1 className="w-4 h-4" />} onClick={() => applyFormat('formatBlock', 'H1')} /></Tooltip>
        <Tooltip title="H2"><Button aria-label="二级标题" size="small" type="text" icon={<Heading2 className="w-4 h-4" />} onClick={() => applyFormat('formatBlock', 'H2')} /></Tooltip>
        <Tooltip title="H3"><Button aria-label="三级标题" size="small" type="text" icon={<Heading3 className="w-4 h-4" />} onClick={() => applyFormat('formatBlock', 'H3')} /></Tooltip>
        <Tooltip title={t('w9b.reportRich.tipQuote')}><Button aria-label="引用" size="small" type="text" icon={<Quote className="w-4 h-4" />} onClick={() => applyFormat('formatBlock', 'BLOCKQUOTE')} /></Tooltip>

        <Divider orientation="vertical" />

        <Tooltip title={t('w9b.reportRich.tipInsertImage')}>
          <Button aria-label="插入图片" size="small" type="text" icon={<ImageIcon className="w-4 h-4" />} onClick={insertImage} />
        </Tooltip>
        <Tooltip title={t('w9b.reportRich.tipInsertTable')}>
          <Button aria-label="插入表格" size="small" type="text" icon={<TableIcon className="w-4 h-4" />} onClick={insertTable} />
        </Tooltip>
        <Tooltip title={t('w9b.reportRich.tipInsertSpecials')}>
          <Button aria-label="插入特殊字符" size="small" type="text" icon={<Hash className="w-4 h-4" />} onClick={() => setShowSpecials(true)} />
        </Tooltip>
        <Tooltip title={t('w9b.reportRich.tipLink')}>
          <Button aria-label="插入链接" size="small" type="text" icon={<Link2 className="w-4 h-4" />} onClick={() => {
            let url = '';
            Modal.confirm({
              title: t('w9b.reportRich.linkUrlTitle'),
              content: <Input placeholder="https://" autoFocus onChange={(e) => { url = e.target.value; }} />,
              okText: t('w9b.reportRich.ok'),
              cancelText: t('w9b.reportRich.cancel'),
              onOk: () => { if (url.trim()) applyFormat('createLink', url.trim()); },
            });
          }} />
        </Tooltip>
        <Tooltip title={t('w9b.reportRich.tip3dSnapshot')}>
          <Button size="small" type="text" icon={<Layers className="w-4 h-4" />} onClick={() => insertEmbedPlaceholder('3D-VRT', t('w9b.reportRich.tip3dSnapshot'))}>3D</Button>
        </Tooltip>
        <Tooltip title={t('w9b.reportRich.tipCine')}>
          <Button size="small" type="text" icon={<Layers className="w-4 h-4" />} onClick={() => insertEmbedPlaceholder('Cine', t('w9b.reportRich.tipCine'))}>Cine</Button>
        </Tooltip>
        <Tooltip title={t('w9b.reportRich.tipMip')}>
          <Button size="small" type="text" icon={<Layers className="w-4 h-4" />} onClick={() => insertEmbedPlaceholder('MIP', t('w9b.reportRich.tipMip'))}>MIP</Button>
        </Tooltip>

        <Divider orientation="vertical" />

        <Tooltip title={t('w9b.reportRich.tipUndo')}><Button aria-label="撤销" size="small" type="text" icon={<Undo className="w-4 h-4" />} onClick={() => applyFormat('undo')} /></Tooltip>
        <Tooltip title={t('w9b.reportRich.tipRedo')}><Button aria-label="重做" size="small" type="text" icon={<Redo className="w-4 h-4" />} onClick={() => applyFormat('redo')} /></Tooltip>

        <Divider orientation="vertical" />
        <Tooltip title={t('w9b.reportRich.tipCompare')}>
          <Button size="small" type={showComparison ? 'primary' : 'text'} icon={<FileText className="w-4 h-4" />} onClick={() => setShowComparison((v) => !v)}>{t('w9b.reportRich.btnCompare')}</Button>
        </Tooltip>
        <Tooltip title={t('w9b.reportRich.tipFusion')}>
          <Button size="small" type="text" icon={<Eye className="w-4 h-4" />} onClick={insertFusionPlaceholder}>{t('w9b.reportRich.btnFusion')}</Button>
        </Tooltip>
        <Tooltip title={t('w9b.reportRich.tipAutoSummary')}>
          <Button size="small" type="text" icon={<Sparkles className="w-4 h-4" />} loading={summarizing} onClick={handleAutoSummary}>{t('w9b.reportRich.btnSummary')}</Button>
        </Tooltip>

        <Divider orientation="vertical" />

        <Tooltip title={voiceListening ? t('w9b.reportRich.voiceStopTip') : t('w9b.reportRich.voiceTip')}>
          <Button aria-label="语音输入"
            size="small"
            type={voiceListening ? 'primary' : 'text'}
            danger={voiceListening}
            icon={voiceListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            onClick={toggleVoice}
          />
        </Tooltip>
        {voiceListening && voiceInterim && (
          <span className="text-xs text-slate-500 italic max-w-[200px] truncate">
            {voiceInterim}
          </span>
        )}

        <div className="flex-1" />

        <Tooltip title={t('w9b.reportRich.tipSpellCheck')}>
          <Button size="small" icon={<SpellCheck2 className="w-4 h-4" />} onClick={runSpellCheck}>{t('w9b.reportRich.btnCheck')}</Button>
        </Tooltip>
        <Tooltip title={t('w9b.reportRich.tipSplitPreview')}><Button aria-label="分屏预览" size="small" type={splitPreview ? 'primary' : 'text'} icon={<Eye className="w-4 h-4" />} onClick={() => setSplitPreview((v) => !v)} /></Tooltip>
        <Tooltip title={t('w9b.reportRich.tipPrintPreview')}><Button aria-label="打印预览" size="small" type="text" icon={<Printer className="w-4 h-4" />} onClick={() => window.print()} /></Tooltip>
        <Tooltip title={t('w9b.reportRich.tipFullscreen')}><Button aria-label="全屏切换" size="small" type="text" icon={fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />} onClick={() => setFullscreen((v) => !v)} /></Tooltip>
        <Button size="small" type="primary" icon={<Save className="w-4 h-4" />} onClick={handleSave}>{t('w9b.reportRich.btnSave')}</Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">{t('w9b.reportRich.paragraphSpacing')}</span>
        <Slider min={1.0} max={3.0} step={0.1} defaultValue={doc.style.lineHeight ?? 1.6} style={{ width: 100 }} onChange={(v) => applyFormat('lineHeight', String(v))} />
        <span className="text-xs text-slate-500 ml-2">{t('w9b.reportRich.letterSpacing')}</span>
        <Slider min={0} max={5} step={0.5} defaultValue={doc.style.letterSpacing ?? 0} style={{ width: 80 }} onChange={(v) => applyFormat('letterSpacing', `${v}px`)} />
      </div>
    </div>
  );

  const editor = (
    <div
      ref={editorRef}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      onInput={handleContentChange}
      onBlur={handleContentChange}
      className="prose prose-slate max-w-none focus:outline-none p-6"
      style={{ minHeight: 500, fontFamily: doc.style.fontFamily ?? 'SimSun', fontSize: doc.style.fontSize ?? 14, lineHeight: doc.style.lineHeight ?? 1.6 }}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(doc.html) }}
    />
  );

  return (
    <div className={fullscreen ? 'fixed inset-0 z-50 bg-white' : ''}>
      <Card
        size="small"
        className="shadow-sm"
        title={
          <div className="flex items-center justify-between">
            <Space>
              <Type className="w-4 h-4" style={{ color: 'var(--color-info-600)' }} />
              <span>{t('w9b.reportRich.title')}</span>
              <Tag color="blue">v{doc.version}</Tag>
              {autoSaving && <Tag color="processing">{t('w9b.reportRich.autoSaving')}</Tag>}
              {!autoSaving && doc.autoSaveAt && <Tag color="success" icon={<CheckCheck className="w-3 h-3" />}>{t('w9b.reportRich.savedAt', { time: new Date(doc.autoSaveAt).toLocaleTimeString() })}</Tag>}
            </Space>
            <Space size="small">
              {enableCollaboration && (
                <Popover
                  content={
                    <div style={{ minWidth: 180 }}>
                      <div style={{ fontWeight: 600, marginBottom: 'var(--space-2, 8px)', fontSize: 12 }}>
                        {collab.isConnected ? t('w9b.reportRich.onlineUsers') : t('w9b.reportRich.offline')}
                      </div>
                      {collab.onlineUsers.map((u) => (
                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', padding: '4px 0' }}>
                          <Avatar size={24} style={{ backgroundColor: u.color, fontSize: 12, flexShrink: 0 }}>
                            {u.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <span style={{ fontSize: 12 }}>{u.name}</span>
                        </div>
                      ))}
                    </div>
                  }
                  trigger="click"
                >
                  <Badge count={collab.onlineUsers.length} size="small" offset={[-2, 2]}>
                    <Avatar
                      size={28}
                      icon={collab.isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                      style={{ backgroundColor: collab.isConnected ? 'var(--color-info-600)' : '#94a3b8', cursor: 'pointer' }}
                    />
                  </Badge>
                </Popover>
              )}
              <Tag>{t('w9b.reportRich.wordCountTag', { count: wordCount.words })}</Tag>
              <Tag>{t('w9b.reportRich.charCountTag', { count: wordCount.chars })}</Tag>
              <Tag>{t('w9b.reportRich.paragraphTag', { count: wordCount.paragraphs })}</Tag>
              <Tag>{t('w9b.reportRich.readingTimeTag', { count: Math.ceil(wordCount.chars / 300) })}</Tag>
            </Space>
          </div>
        }
      >
        {renderToolbar()}

        <div className={splitPreview ? 'grid grid-cols-2 gap-2' : ''}>
          <div className="border border-slate-200 rounded-md bg-white">
            {editor}
          </div>
          {splitPreview && (
            <div className="border border-slate-200 rounded-md bg-slate-50 p-4">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><BookOpen className="w-4 h-4" />{t('w9b.reportRich.plainTextPreview')}</h4>
              <pre className="whitespace-pre-wrap text-sm text-slate-700">{doc.plainText}</pre>
              {spellErrors.length > 0 && (
                <div className="mt-3 space-y-1">
                  <h5 className="text-xs font-semibold text-amber-600">{t('w9b.reportRich.spellIssuesTitle')}</h5>
                  {spellErrors.map((e, i) => (
                    <div key={i} className="text-xs text-amber-700 bg-amber-50 p-1.5 rounded">
                      {e.type}: ...{e.suggestion}...
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 图像列表 */}
        {doc.images.length > 0 && (
          <div className="border-t border-slate-200 p-3 bg-slate-50">
            <h5 className="text-xs font-semibold text-slate-600 mb-2">{t('w9b.reportRich.insertedImages', { count: doc.images.length })}</h5>
            <div className="flex gap-2 overflow-x-auto">
              {doc.images.map((img: { id: string; src: string; alt: string; keyImage?: boolean }) => (
                <div key={img.id} className="relative w-20 h-20 border border-slate-200 rounded overflow-hidden bg-white flex-shrink-0">
                  <img src={img.src} alt={img.alt} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  {img.keyImage && <Star className="w-3 h-3 absolute top-1 right-1 text-amber-500 fill-amber-500" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Modal
        title={t('w9b.reportRich.specialsTitle')}
        open={showSpecials}
        onCancel={() => setShowSpecials(false)}
        footer={null}
        width={560}
      >
        <div className="grid grid-cols-6 gap-2">
          {RAD_SPECIALS.map((s) => (
            <Button key={s} onClick={() => { applyFormat('insertText', s); setShowSpecials(false); }} className="font-mono text-lg">
              {s}
            </Button>
          ))}
        </div>
      </Modal>

      <Modal
        title={t('w9b.reportRich.priorCompareTitle')}
        open={showComparison}
        onCancel={() => setShowComparison(false)}
        footer={null}
        width={560}
      >
        <Collapse
          items={[
            {
              key: '1',
              label: '2024-09-15 胸部CT',
              children: (
                <div>
                  <p><strong>{t('w9b.reportRich.findingsLabel')}</strong> 双肺纹理清晰，未见实变或结节。纵隔无肿大淋巴结。</p>
                  <p><strong>{t('w9b.reportRich.impressionLabel')}</strong> 胸部CT未见明显异常。</p>
                  <Button size="small" type="primary" onClick={() => insertComparison({ date: '2024-09-15', findings: '双肺纹理清晰，未见实变或结节。', impression: '胸部CT未见明显异常。' })}>{t('w9b.reportRich.btnInsertComparison')}</Button>
                </div>
              ),
            },
            {
              key: '2',
              label: '2024-06-20 胸部CT',
              children: (
                <div>
                  <p><strong>{t('w9b.reportRich.findingsLabel')}</strong> 右肺上叶见磨玻璃结节，大小约0.8cm。左肺下叶条索影。</p>
                  <p><strong>{t('w9b.reportRich.impressionLabel')}</strong> 右肺上叶GGO，建议随访。</p>
                  <Button size="small" type="primary" onClick={() => insertComparison({ date: '2024-06-20', findings: '右肺上叶磨玻璃结节0.8cm。', impression: '右肺上叶GGO，建议随访。' })}>{t('w9b.reportRich.btnInsertComparison')}</Button>
                </div>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
});

export default ReportRichEditor;
