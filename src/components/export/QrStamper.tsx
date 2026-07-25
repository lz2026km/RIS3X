/**
 * G005 放射RIS系统 v3.0.6.0 - QR 码印章组件
 * Phase R7:生成/预览/调整二维码
 */
import React, { useState, useEffect, useCallback } from 'react';
import { QrCode, Download } from 'lucide-react';
import { getQrGenerator } from '../../services/export/qr/QrGenerator';
import type { QrStampOptions } from '../../types/export';

interface QrStamperProps {
  reportId: string;
  baseUrl?: string;
  onGenerated?: (dataUrl: string) => void;
}

export const QrStamper: React.FC<QrStamperProps> = ({ reportId, baseUrl = window.location.origin, onGenerated }) => {
  const [size, setSize] = useState(128);
  const [errorLevel, setErrorLevel] = useState<QrStampOptions['errorCorrectionLevel']>('M');
  const [margin, setMargin] = useState(2);
  const [caption, setCaption] = useState('扫码查看报告');
  const [dataUrl, setDataUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getQrGenerator().generateReportUrl(baseUrl, reportId);
      setDataUrl(r.dataUrl);
      onGenerated?.(r.dataUrl);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, reportId, onGenerated]);

  useEffect(() => { generate(); }, [generate]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${reportId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <QrCode size={16} color="#10b981" />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>二维码印章</span>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          {loading ? (
            <div style={{ width: size, height: size, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>生成中...</div>
          ) : dataUrl ? (
            <div>
              <img src={dataUrl} alt="QR" loading="lazy" decoding="async" style={{ width: size, height: size, borderRadius: 4 }} />
              {caption && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{caption}</div>}
            </div>
          ) : (
            <div style={{ width: size, height: size, border: '1px dashed #cbd5e1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>未生成</div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>尺寸: {size}px</label>
            <input type="range" min="64" max="256" value={size} onChange={e => setSize(+e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>纠错等级</label>
            <select value={errorLevel} onChange={e => setErrorLevel(e.target.value as QrStampOptions['errorCorrectionLevel'])} style={selectStyle}>
              <option value="L">L (低)</option>
              <option value="M">M (中)</option>
              <option value="Q">Q (较高)</option>
              <option value="H">H (高)</option>
            </select>
          </div>
          <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="二维码说明" style={inputStyle} />
          <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
            <button onClick={generate} style={btnStyle}><QrCode size={12} /> 重新生成</button>
            <button onClick={handleDownload} disabled={!dataUrl} style={!dataUrl ? btnDisabled : btnStyle}><Download size={12} /> 下载</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, outline: 'none',
};
const selectStyle: React.CSSProperties = {
  ...inputStyle, width: '100%',
};
const btnStyle: React.CSSProperties = {
  padding: '5px 10px', border: '1px solid #10b981', borderRadius: 4, background: '#f0fdf4',
  color: '#16a34a', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
};
const btnDisabled: React.CSSProperties = {
  ...btnStyle, opacity: 0.5, cursor: 'not-allowed',
};
