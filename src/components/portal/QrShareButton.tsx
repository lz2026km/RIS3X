import { useState } from 'react';
import { QrCode, Link2 } from 'lucide-react';

export default function QrShareButton({
  shortUrl,
  label,
}: {
  shortUrl: string;
  label?: string;
}) {
  const [showQr, setShowQr] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setShowQr(!showQr)}
        style={{
          padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 6,
          background: 'var(--bg-card)', cursor: 'pointer', fontSize: 12, color: '#475569',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <QrCode size={14} color="#0ea5e9" /> {label ?? '二维码'}
      </button>

      {showQr && (
        <div style={{
          position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
          marginTop: 8, background: 'var(--bg-card)', borderRadius: 10, padding: 14,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 100, width: 180, textAlign: 'center',
        }}>
          <div style={{
            width: 140, height: 140, margin: '0 auto 8px', background: 'var(--bg-card)',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border-color)',
          }}>
            <QrCode size={60} color="#0ea5e9" />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, wordBreak: 'break-all' }}>
            {shortUrl}
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(shortUrl)}
            style={{
              padding: '4px 12px', border: '1px solid #0ea5e9', borderRadius: 4,
              background: 'var(--color-info-bg)', fontSize: 12, color: '#1e40af', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, margin: '0 auto',
            }}
          >
            <Link2 size={10} /> 复制链接
          </button>
        </div>
      )}
    </div>
  );
}
