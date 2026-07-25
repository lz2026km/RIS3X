/**
 * G005 放射RIS系统 v3.0.6.0 - 品牌配置组件
 * Phase R7:Logo/颜色/字体/页脚配置
 */
import React, { useState, useEffect } from 'react';
import { Palette, Image, Type, Save, RotateCcw } from 'lucide-react';
import { getBrandingEngine } from '../../services/export/branding/BrandingEngine';
import type { BrandingConfig } from '../../types/export';

interface BrandingConfigProps {
  onConfigChange?: (config: BrandingConfig) => void;
}

export const BrandingConfig: React.FC<BrandingConfigProps> = ({ onConfigChange }) => {
  const engine = getBrandingEngine();
  const [config, setConfig] = useState<BrandingConfig>(engine.getConfig());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const unsub = engine.subscribe((c) => setConfig({ ...c }));
    return unsub;
  }, [engine]);

  const update = (patch: Partial<BrandingConfig>) => {
    const next = engine.update(patch);
    setConfig({ ...next });
    onConfigChange?.(next);
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    const next = engine.reset();
    setConfig({ ...next });
    onConfigChange?.(next);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update({ logoDataUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Palette size={16} color="#7c3aed" />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>站点品牌设置</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>站点名称</label>
          <input value={config.siteName} onChange={e => update({ siteName: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>页脚文字</label>
          <input value={config.footerText} onChange={e => update({ footerText: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>主色</label>
          <input type="color" value={config.primaryColor} onChange={e => update({ primaryColor: e.target.value })} style={{ width: '100%', height: 36, border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>辅助色</label>
          <input type="color" value={config.secondaryColor} onChange={e => update({ secondaryColor: e.target.value })} style={{ width: '100%', height: 36, border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}><Type size={11} /> 字体</label>
          <select value={config.fontFamily} onChange={e => update({ fontFamily: e.target.value })} style={inputStyle}>
            <option value="Noto Serif SC, serif">Noto Serif SC</option>
            <option value="SimSun, serif">宋体</option>
            <option value="Microsoft YaHei, sans-serif">微软雅黑</option>
            <option value="SimHei, sans-serif">黑体</option>
            <option value="Arial, sans-serif">Arial</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>联系邮箱</label>
          <input value={config.contactEmail ?? ''} onChange={e => update({ contactEmail: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>联系电话</label>
          <input value={config.contactPhone ?? ''} onChange={e => update({ contactPhone: e.target.value })} style={inputStyle} />
        </div>

        <div>
          <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}><Image size={11} /> Logo</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {config.logoDataUrl && <img src={config.logoDataUrl} alt="logo" decoding="async" style={{ height: 32, borderRadius: 4 }} />}
            <label style={{ padding: '4px 10px', border: '1px solid #7c3aed', borderRadius: 4, background: '#f5f3ff', color: '#7c3aed', fontSize: 12, cursor: 'pointer' }}>
              上传
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
            </label>
            {config.logoDataUrl && <button onClick={() => update({ logoDataUrl: undefined })} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>清除</button>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={config.showWatermark} onChange={e => update({ showWatermark: e.target.checked })} /> 水印
          </label>
          <label style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={config.showQrCode} onChange={e => update({ showQrCode: e.target.checked })} /> 二维码
          </label>
          <label style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={config.showSignature} onChange={e => update({ showSignature: e.target.checked })} /> 签名
          </label>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button onClick={handleSave} style={saveBtnStyle}><Save size={13} /> {saved ? '已保存' : '保存配置'}</button>
        <button onClick={handleReset} style={resetBtnStyle}><RotateCcw size={13} /> 恢复默认</button>
      </div>

      <div style={{ marginTop: 12, padding: 10, background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#64748b' }}>
        <div>CSS 变量: <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: 2 }}>{engine.buildCssVariables()}</code></div>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, outline: 'none',
};
const saveBtnStyle: React.CSSProperties = {
  padding: '7px 14px', border: 'none', borderRadius: 6, background: '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
};
const resetBtnStyle: React.CSSProperties = {
  padding: '7px 14px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#475569', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
};
