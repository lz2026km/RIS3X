/**
 * G005 放射RIS系统 v3.0.6.0 - PPTX 导出对话框
 * Phase R7:幻灯片编排 + 导出
 */
import React, { useState } from 'react';
import { Download, X, Plus, Trash2, GripVertical, FileText } from 'lucide-react';
import { getPptxExporter } from '../../services/export/pptx/PptxExporter';
import type { PptxSlide, PptxExportOptions } from '../../types/export';

interface PptxExportDialogProps {
  open: boolean;
  onClose: () => void;
  reportId: string;
}

const emptySlide = (): PptxSlide => ({ title: '', body: '', layout: 'content' });

export const PptxExportDialog: React.FC<PptxExportDialogProps> = ({ open, onClose }) => {
  const [title, setTitle] = useState('放射诊断报告');
  const [author, setAuthor] = useState('');
  const [themeColor, _setThemeColor] = useState('#1e40af');
  const [slides, setSlides] = useState<PptxSlide[]>([{ title: '影像所见', body: '', layout: 'content' }, { title: '诊断意见', body: '', layout: 'content' }]);
  const [exporting, setExporting] = useState(false);

  const updateSlide = (idx: number, patch: Partial<PptxSlide>) => {
    setSlides(slides.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  const addSlide = () => setSlides([...slides, emptySlide()]);
  const removeSlide = (idx: number) => setSlides(slides.filter((_, i) => i !== idx));

  const handleExport = async () => {
    setExporting(true);
    try {
      const opts: PptxExportOptions = { title, author, themeColor, slides: slides.filter(s => s.title) };
      const result = await getPptxExporter().export(opts);
      if (result.blob) {
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.fileName ?? 'report.pptx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: 640, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color="#7c3aed" />
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>PPTX 导出</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>标题</label>
              <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>作者</label>
              <input value={author} onChange={e => setAuthor(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>幻灯片 ({slides.length})</span>
            <button onClick={addSlide} style={addBtnStyle}><Plus size={14} /> 添加</button>
          </div>

          {slides.map((slide, idx) => (
            <div key={idx} style={{ padding: 12, marginBottom: 8, background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <GripVertical size={14} color="#94a3b8" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>#{idx + 1}</span>
                <input value={slide.title} onChange={e => updateSlide(idx, { title: e.target.value })} placeholder="幻灯片标题" style={{ ...inputStyle, flex: 1 }} />
                <select value={slide.layout} onChange={e => updateSlide(idx, { layout: e.target.value as PptxSlide['layout'] })} style={selectSmall}>
                  <option value="content">正文</option>
                  <option value="title">标题</option>
                  <option value="two-column">双栏</option>
                  <option value="image-full">全图</option>
                </select>
                <button onClick={() => removeSlide(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><Trash2 size={14} /></button>
              </div>
              <textarea value={slide.body ?? ''} onChange={e => updateSlide(idx, { body: e.target.value })} placeholder="幻灯片内容" rows={3} style={textAreaStyle} />
            </div>
          ))}

          <button onClick={handleExport} disabled={exporting || slides.filter(s => s.title).length === 0} style={exporting ? btnDisabled : btnPrimary}>
            <Download size={14} /> {exporting ? '生成中...' : `导出 PPTX (${slides.filter(s => s.title).length} 页)`}
          </button>
        </div>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, };
const textAreaStyle: React.CSSProperties = {
  ...inputStyle, resize: 'vertical', fontFamily: 'inherit',
};
const selectSmall: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, };
const addBtnStyle: React.CSSProperties = {
  padding: '4px 10px', border: '1px solid #7c3aed', borderRadius: 4, background: '#f5f3ff',
  color: '#7c3aed', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
};
const btnPrimary: React.CSSProperties = {
  width: '100%', padding: '10px 16px', border: 'none', borderRadius: 6,
  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff',
  fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
};
const btnDisabled: React.CSSProperties = {
  ...btnPrimary, background: '#cbd5e1', cursor: 'not-allowed',
};
