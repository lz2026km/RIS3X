/**
 * G005 放射RIS系统 v3.0.6.0 - 水印编辑器
 * Phase R7:可视化水印配置
 */
import React, { useState } from 'react';
import { Droplet, RotateCw, Type } from 'lucide-react';
import { sanitizeHtml } from '../../utils/sanitization';
import type { WatermarkOptions } from '../../types/export';
import { getWatermarkEngine } from '../../services/export/watermark/WatermarkEngine';

interface WatermarkEditorProps {
  value?: Partial<WatermarkOptions>;
  onChange?: (opts: Partial<WatermarkOptions>) => void;
}

export const WatermarkEditor: React.FC<WatermarkEditorProps> = ({ value, onChange }) => {
  const [opts, setOpts] = useState<Partial<WatermarkOptions>>(value ?? { type: 'text', text: 'DRAFT', opacity: 0.1, rotation: -30, fontSize: 80, color: '#dc2626', position: 'center' });

  const update = (patch: Partial<WatermarkOptions>) => {
    const next = { ...opts, ...patch };
    setOpts(next);
    onChange?.(next);
  };

  const previewHtml = getWatermarkEngine().buildOverlayHtml({ ...opts, type: opts.type ?? 'text' });

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Droplet size={16} color="#f59e0b" />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>水印设置</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>类型</label>
          <select value={opts.type ?? 'text'} onChange={e => update({ type: e.target.value as WatermarkOptions['type'] })} style={inputStyle}>
            <option value="text">文字</option>
            <option value="image">图片</option>
          </select>
        </div>
        {opts.type === 'text' && (
          <>
            <div>
              <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>文字</label>
              <input value={opts.text ?? ''} onChange={e => update({ text: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>字号</label>
              <input type="number" value={opts.fontSize ?? 80} onChange={e => update({ fontSize: +e.target.value })} style={inputStyle} min={12} max={200} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>颜色</label>
              <input type="color" value={opts.color ?? '#dc2626'} onChange={e => update({ color: e.target.value })} style={{ width: '100%', height: 32, border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }} />
            </div>
          </>
        )}
        <div>
          <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>不透明度: {opts.opacity ?? 0.1}</label>
          <input type="range" min="0" max="1" step="0.05" value={opts.opacity ?? 0.1} onChange={e => update({ opacity: +e.target.value })} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}><RotateCw size={11} /> 旋转: {opts.rotation ?? -30}°</label>
          <input type="range" min="-90" max="90" value={opts.rotation ?? -30} onChange={e => update({ rotation: +e.target.value })} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>位置</label>
          <select value={opts.position ?? 'center'} onChange={e => update({ position: e.target.value as WatermarkOptions['position'] })} style={inputStyle}>
            <option value="center">居中</option>
            <option value="tile">平铺</option>
            <option value="top-right">右上</option>
            <option value="bottom-left">左下</option>
          </select>
        </div>
        {opts.type === 'image' && (
          <div>
            <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>图片 URL</label>
            <input value={opts.imageDataUrl ?? ''} onChange={e => update({ imageDataUrl: e.target.value })} style={inputStyle} placeholder="data:image/..." />
          </div>
        )}
      </div>

      {previewHtml && (
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 4 }}><Type size={11} /> 预览</label>
          <div style={{ position: 'relative', height: 80, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }} />
        </div>
      )}
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, outline: 'none',
};
