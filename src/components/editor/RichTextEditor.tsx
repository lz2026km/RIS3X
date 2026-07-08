// ============================================================
// G005 放射科RIS系统 v1.0.1 - 富文本编辑器
// Phase R1：基于 contenteditable 的轻量级富文本
// 医疗专用：上下标/特殊符号/测量值/征象/化验/公式插入
// ============================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronDown, Type } from 'lucide-react';
import { TOOLBAR_BUTTONS, TOOLBAR_GROUPS, SPECIAL_SYMBOLS } from './editorConfig';
import { checkKeywords, type KeywordCheckOutput } from '../../utils/keywordChecker';

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  minHeight?: number;
  showKeywordCheck?: boolean;
  modality?: string;
  bodyPart?: string;
  enableAutoKeywords?: boolean;
  onInsertSnippet?: (snippet: { type: 'measurement' | 'finding' | 'formula' | 'lab' }) => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = '请输入报告内容...',
  minHeight = 300,
  showKeywordCheck = true,
  modality,
  bodyPart,
  onInsertSnippet,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showSymbols, setShowSymbols] = useState(false);
  const [keywordResult, setKeywordResult] = useState<KeywordCheckOutput | null>(null);

  // 同步外部 value 到 contenteditable
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  // 关键字实时检查
  useEffect(() => {
    if (!showKeywordCheck) return;
    const text = editorRef.current?.innerText || '';
    const result = checkKeywords({
      text,
      modality,
      bodyPart,
      hasFindings: text.length > 0,
      hasImpression: text.includes('意见') || text.includes('诊断') || text.includes('考虑') || text.includes('提示'),
    });
    setKeywordResult(result);
  }, [value, modality, bodyPart, showKeywordCheck]);

  // 执行编辑器命令 (replaced deprecated document.execCommand with state-friendly approach)
  const execCommand = useCallback((command: string, value?: string) => {
    if (command === 'insertMeasurement' || command === 'insertFinding' ||
        command === 'insertFormula' || command === 'insertLab') {
      const snippetType = command.replace('insert', '').toLowerCase() as any;
      onInsertSnippet?.({ type: snippetType });
      return;
    }
    try {
      document.execCommand(command, false, value);
    } catch {
      if (command === 'formatBlock' && value) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const wrapper = document.createElement(value.toLowerCase());
          try { wrapper.appendChild(range.extractContents()); } catch { wrapper.textContent = range.toString(); }
          range.insertNode(wrapper);
        }
      } else if (command === 'insertText' && value !== undefined) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          sel.getRangeAt(0).insertNode(document.createTextNode(value));
        }
      }
    }
    handleInput();
  }, [onInsertSnippet]);

  // 插入特殊符号
  const insertSymbol = useCallback((symbol: string) => {
    document.execCommand('insertText', false, symbol);
    handleInput();
    setShowSymbols(false);
  }, []);

  // 插入测量值/征象 - 通过 toolbar 调用，保留 hooks 以备扩展
   
  const insertMeasurement = useCallback(() => {
    onInsertSnippet?.({ type: 'measurement' });
  }, [onInsertSnippet]);

   
  const insertFinding = useCallback(() => {
    onInsertSnippet?.({ type: 'finding' });
  }, [onInsertSnippet]);
  void insertMeasurement; void insertFinding;

  // 输入事件
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      const text = editorRef.current.innerText;
      onChange(html, text);
    }
  }, [onChange]);

  // 阻止默认的粘贴行为，改为纯文本粘贴
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  // 阻止某些组合键的浏览器默认行为
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl+B / Ctrl+I / Ctrl+U
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') { e.preventDefault(); execCommand('bold'); }
      if (key === 'i') { e.preventDefault(); execCommand('italic'); }
      if (key === 'u') { e.preventDefault(); execCommand('underline'); }
      // Ctrl+S 自动保存
      if (key === 's') { e.preventDefault(); handleInput(); /* 触发父组件保存 */ }
    }
  }, [execCommand, handleInput]);

  const wordCount = (editorRef.current?.innerText || '').length;

  return (
    <div style={{
      border: '1px solid #cbd5e1',
      borderRadius: 8,
      background: '#fff',
      overflow: 'hidden',
    }}>
      {/* 工具栏 */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        padding: '6px 8px',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        alignItems: 'center',
      }}>
        {TOOLBAR_GROUPS.map((group, groupIdx) => (
          <React.Fragment key={group.key}>
            <div style={{ display: 'flex', gap: 1 }}>
              {group.buttons.map(btnId => {
                const btn = TOOLBAR_BUTTONS.find(b => b.id === btnId);
                if (!btn) return null;
                const Icon = btn.icon;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => execCommand(btn.command, btn.value)}
                    title={btn.shortcut ? `${btn.label} (${btn.shortcut})` : btn.label}
                    style={{
                      padding: '4px 6px',
                      border: '1px solid transparent',
                      borderRadius: 4,
                      background: 'transparent',
                      color: '#475569',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      fontSize: 12,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Icon size={14} />
                  </button>
                );
              })}
            </div>
            {groupIdx < TOOLBAR_GROUPS.length - 1 && (
              <div style={{ width: 1, height: 18, background: '#cbd5e1', margin: '0 4px' }} />
            )}
          </React.Fragment>
        ))}

        {/* 特殊符号下拉 */}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={() => setShowSymbols(!showSymbols)}
            style={{
              padding: '4px 8px',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              background: showSymbols ? '#e0f2fe' : '#fff',
              color: '#0c4a6e',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <Type size={13} /> 特殊符号 <ChevronDown size={11} />
          </button>
          {showSymbols && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              padding: 6,
              background: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 10,
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 2,
              minWidth: 280,
            }}>
              {SPECIAL_SYMBOLS.map(s => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => insertSymbol(s.label)}
                  title={s.name}
                  style={{
                    padding: '4px 6px',
                    border: '1px solid transparent',
                    borderRadius: 4,
                    background: 'transparent',
                    color: '#1e293b',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#e0f2fe'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 编辑区 */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        style={{
          minHeight,
          padding: '12px 16px',
          fontSize: 14,
          lineHeight: 1.7,
          color: '#1e293b',
          outline: 'none',
          fontFamily: 'inherit',
        }}
        data-placeholder={placeholder}
      />

      {/* 底部状态栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        background: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        fontSize: 12,
        color: '#64748b',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>字数：<strong style={{ color: '#0c4a6e' }}>{wordCount}</strong></span>
          {keywordResult && (
            <>
              <span style={{
                color: keywordResult.passed ? '#10b981' : keywordResult.errorCount > 0 ? '#dc2626' : '#f59e0b',
                fontWeight: 600,
              }}>
                {keywordResult.passed ? '✓ 检查通过' : `⚠ ${keywordResult.errorCount} 错 / ${keywordResult.warningCount} 警`}
              </span>
              <span>得分：<strong style={{ color: keywordResult.score >= 80 ? '#10b981' : '#f59e0b' }}>{keywordResult.score}/100</strong></span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#94a3b8' }}>Ctrl+B/I/U 加格式 · Ctrl+S 保存</span>
        </div>
      </div>

      {/* 关键字问题提示面板 */}
      {keywordResult && keywordResult.totalIssues > 0 && (
        <div style={{
          padding: '8px 12px',
          background: '#fffbeb',
          borderTop: '1px solid #fcd34d',
          maxHeight: 120,
          overflowY: 'auto',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
            ⚠ 关键字检查发现 {keywordResult.totalIssues} 个问题：
          </div>
          {keywordResult.issues.slice(0, 5).map(issue => (
            <div key={issue.id} style={{
              fontSize: 12,
              color: issue.severity === 'error' ? '#7f1d1d' : issue.severity === 'warning' ? '#92400e' : '#0c4a6e',
              padding: '2px 0',
              display: 'flex',
              gap: 6,
            }}>
              <span style={{
                fontSize: 12, padding: '0 4px', borderRadius: 2,
                background: issue.severity === 'error' ? '#dc2626' : issue.severity === 'warning' ? '#f59e0b' : '#3b82f6',
                color: '#fff', fontWeight: 700, alignSelf: 'center', flexShrink: 0,
              }}>{issue.severity === 'error' ? '错' : issue.severity === 'warning' ? '警' : '示'}</span>
              <span>{issue.message}</span>
            </div>
          ))}
          {keywordResult.issues.length > 5 && (
            <div style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>
              ...还有 {keywordResult.issues.length - 5} 个问题
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;
