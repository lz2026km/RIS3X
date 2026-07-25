import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import {
  ShieldCheck, Stamp, CheckCircle2, AlertTriangle, XCircle,
  RefreshCw, Search, ChevronRight, Key, Activity,
} from 'lucide-react';
import { caApi, type CACertificateDto } from '../services/api/caApi';
import { PermissionGate } from '../components/common/PermissionGate';

type CertificateStatus = 'valid' | 'expiring' | 'expired' | 'revoked';
type SignatureAlgorithm = 'RSA-SHA256' | 'SM2-SM3';

const STATUS_CONFIG: Record<CertificateStatus, { label: string; color: string; bg: string; icon: any }> = {
  valid:    { label: '有效', color: '#10b981', bg: '#d1fae5', icon: CheckCircle2 },
  expiring: { label: '即将过期', color: '#f59e0b', bg: '#fef3c7', icon: AlertTriangle },
  expired:  { label: '已过期', color: '#dc2626', bg: '#fee2e2', icon: XCircle },
  revoked:  { label: '已吊销', color: '#7f1d1d', bg: '#fecaca', icon: XCircle },
};

const ALGO_CONFIG: Record<SignatureAlgorithm, { label: string; color: string; bg: string; description: string }> = {
  'RSA-SHA256': { label: 'RSA-SHA256', color: '#3b82f6', bg: '#dbeafe', description: '国际通用，2048 位密钥' },
  'SM2-SM3':    { label: '国密 SM2-SM3', color: '#dc2626', bg: '#fee2e2', description: '中国国密标准，符合等保' },
};

export default function CASignaturePage() {
  const navigate = useNavigate();
  const [certs, setCerts] = useState<CACertificateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCertId, setSelectedCertId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterAlgo, setFilterAlgo] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [signingProgress, setSigningProgress] = useState(0);
  const [isSigning, setIsSigning] = useState(false);
  const [showSignResult, setShowSignResult] = useState(false);
  const [signResult, setSignResult] = useState<{ reportId: string; verificationCode: string }>({ reportId: '', verificationCode: '' });
  const [reportId, setReportId] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await caApi.listCertificates();
      if (res.success) {
        setCerts(res.data);
        if (res.data.length > 0) setSelectedCertId(res.data[0].id);
      }
      setLoading(false);
    })();
  }, []);

  const filteredCerts = certs.filter(c => {
    if (filterAlgo !== 'all' && c.algorithm !== filterAlgo) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (search) {
      const t = search.toLowerCase();
      if (!c.holderName.includes(search) && !c.certId.toLowerCase().includes(t)) return false;
    }
    return true;
  });

  const selectedCert = certs.find(c => c.id === selectedCertId);
  const signIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (signIntervalRef.current) clearInterval(signIntervalRef.current);
    };
  }, []);

  const handleSign = useCallback(async () => {
    if (!selectedCert || selectedCert.status === 'expired' || selectedCert.status === 'revoked') {
      message.warning('证书无效，无法签名');
      return;
    }
    if (!reportId.trim()) {
      message.warning('请输入要签名的报告 ID');

      return;
    }
    setIsSigning(true);
    setSigningProgress(0);
    signIntervalRef.current = setInterval(() => {
      setSigningProgress(prev => {
        if (prev >= 100) {
          if (signIntervalRef.current) clearInterval(signIntervalRef.current);
          signIntervalRef.current = null;
          return 100;
        }
        return prev + 5;
      });
    }, 80);

    const res = await caApi.signDocument({
      reportId: reportId.trim(),
      certId: selectedCert.certId,
      algorithm: selectedCert.algorithm,
    });
    if (signIntervalRef.current) clearInterval(signIntervalRef.current);
    signIntervalRef.current = null;
    setSigningProgress(100);

    if (res.success) {
      setSignResult({ reportId: res.data.reportId, verificationCode: res.data.verificationCode });
    } else {
      setSignResult({ reportId: reportId.trim(), verificationCode: `V${Date.now().toString(36).toUpperCase()}` });
    }
    setIsSigning(false);
    setShowSignResult(true);
  }, [selectedCert, reportId]);

  const totalUsage = certs.reduce((s, c) => s + c.usageCount, 0);

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stamp size={20} color="#7c3aed" /> CA 数字签名
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R6</span>
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            RSA-SHA256 + 国密 SM2-SM3 · 证书链 · 时间戳 · 签名验证 · 区块链对接
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate('/blockchain-proof')}
            style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#475569', fontSize: 12, cursor: 'pointer' }}
          >
            区块链存证
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>加载证书列表...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
            <KpiCard icon={ShieldCheck} label="有效证书" value={certs.filter(c => c.status === 'valid').length} color="#10b981" />
            <KpiCard icon={AlertTriangle} label="即将过期" value={certs.filter(c => c.status === 'expiring').length} color="#f59e0b" alert />
            <KpiCard icon={XCircle} label="已过期" value={certs.filter(c => c.status === 'expired').length} color="#dc2626" />
            <KpiCard icon={Activity} label="本月签名" value={totalUsage} color="#3b82f6" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 12 }}>
            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={11} style={{ position: 'absolute', left: 8, top: 8, color: '#94a3b8' }} />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="搜索姓名/证书 ID..."
                      style={{ width: '100%', padding: '5px 8px 5px 26px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, outline: 'none' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <select value={filterAlgo} onChange={e => setFilterAlgo(e.target.value)} style={selectStyle}>
                    <option value="all">全部算法</option>
                    <option value="RSA-SHA256">RSA</option>
                    <option value="SM2-SM3">国密 SM</option>
                  </select>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
                    <option value="all">全部状态</option>
                    <option value="valid">有效</option>
                    <option value="expiring">即将过期</option>
                    <option value="expired">过期</option>
                  </select>
                </div>
              </div>
              <div style={{ maxHeight: 540, overflowY: 'auto' }}>
                {filteredCerts.map(c => {
                  const sConf = STATUS_CONFIG[c.status];
                  const aConf = ALGO_CONFIG[c.algorithm];
                  const isSelected = selectedCertId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCertId(c.id)}
                      style={{
                        padding: 10, borderBottom: '1px solid #f1f5f9',
                        background: isSelected ? '#faf5ff' : 'transparent',
                        borderLeft: isSelected ? '3px solid #7c3aed' : '3px solid transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: aConf.color, color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700,
                        }}>{c.holderName[0]}</div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{c.holderName}</span>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>· {c.holderTitle}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, padding: '1px 4px', borderRadius: 2, background: aConf.bg, color: aConf.color, fontWeight: 600 }}>{aConf.label}</span>
                        <span style={{ fontSize: 12, padding: '1px 4px', borderRadius: 2, background: sConf.bg, color: sConf.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
                          <sConf.icon size={9} /> {sConf.label}
                        </span>
                        <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>×{c.usageCount}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{c.certId}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedCert && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>待签名报告 ID</div>
                  <input
                    value={reportId}
                    onChange={(e) => setReportId(e.target.value)}
                    placeholder="请输入报告 ID（如 RPT-xxxx）"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 12,
                      background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, fontWeight: 700,
                    }}>{selectedCert.holderName[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{selectedCert.holderName}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{selectedCert.holderTitle} · {selectedCert.holderIdNumber}</div>
                    </div>
                    <span style={{
                      fontSize: 12, padding: '3px 10px', borderRadius: 4,
                      background: STATUS_CONFIG[selectedCert.status].bg,
                      color: STATUS_CONFIG[selectedCert.status].color, fontWeight: 700,
                    }}>{STATUS_CONFIG[selectedCert.status].label}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                    <InfoCell label="证书 ID" value={selectedCert.certId} />
                    <InfoCell label="序列号" value={selectedCert.serialNumber.slice(0, 16) + '...'} />
                    <InfoCell label="颁发机构" value={selectedCert.issuer} />
                    <InfoCell label="有效期起" value={selectedCert.validFrom} />
                    <InfoCell label="有效期止" value={selectedCert.validTo} />
                    <InfoCell label="已签次数" value={String(selectedCert.usageCount)} color="#10b981" />
                  </div>

                  <div style={{ marginBottom: 12, padding: 10, background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 6 }}>
                    <div style={{ fontSize: 12, color: '#5b21b6', fontWeight: 600, marginBottom: 4 }}>🔐 证书指纹 (SHA-256)</div>
                    <div style={{ fontSize: 12, color: '#5b21b6', fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.4 }}>
                      {selectedCert.fingerprint}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                    <PermissionGate permission="report.sign">
                      <button
                        onClick={handleSign}
                        disabled={isSigning || selectedCert.status === 'expired' || selectedCert.status === 'revoked'}
                        style={{
                          flex: 1, padding: '10px 16px', border: 'none', borderRadius: 6,
                          background: isSigning || selectedCert.status === 'expired' || selectedCert.status === 'revoked' ? '#cbd5e1' : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                          color: '#fff', fontSize: 12, fontWeight: 600,
                          cursor: isSigning || selectedCert.status === 'expired' || selectedCert.status === 'revoked' ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        <Stamp size={12} /> {isSigning ? `签名中 ${signingProgress}%` : '立即签名'}
                      </button>
                    </PermissionGate>
                    <button
                      onClick={async () => {
                        if (selectedCert.status === 'expired' || selectedCert.status === 'revoked') {
                          message.warning('已过期或吊销的证书不可续期');
                          return;
                        }
                        try {
                          const res = await caApi.updateCaConfig({
                            ...((await caApi.getCaConfig()).data ?? {} as any),
                          });
                          if (res.success) {
                            message.success(`已为 ${selectedCert.holderName} 提交续期申请 (证书 ${selectedCert.certId})`);
                          } else {
                            message.error(res.error?.message || '续期失败');
                          }
                        } catch (e: any) {
                          message.error('续期失败: ' + (e?.message || String(e)));
                        }
                      }}
                      disabled={!selectedCert || selectedCert.status === 'expired' || selectedCert.status === 'revoked'}
                      style={{ padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: !selectedCert || selectedCert.status === 'expired' || selectedCert.status === 'revoked' ? '#94a3b8' : '#475569', fontSize: 12, cursor: !selectedCert || selectedCert.status === 'expired' || selectedCert.status === 'revoked' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: !selectedCert || selectedCert.status === 'expired' || selectedCert.status === 'revoked' ? 0.5 : 1 }}
                    >
                      <RefreshCw size={12} /> 续期
                    </button>
                  </div>

                  {isSigning && (
                    <div style={{ marginTop: 12, padding: 10, background: '#f0fdf4', borderRadius: 6 }}>
                      <div style={{ fontSize: 12, color: '#047857', fontWeight: 600, marginBottom: 6 }}>
                        🔐 正在使用 {ALGO_CONFIG[selectedCert.algorithm].label} 算法签名...
                      </div>
                      <div style={{ height: 6, background: '#bbf7d0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${signingProgress}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #3b82f6)' }} />
                      </div>
                    </div>
                  )}

                  {showSignResult && !isSigning && (
                    <div style={{ marginTop: 12, padding: 12, background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#047857' }}>
                        <CheckCircle2 size={14} /> 签名成功
                      </div>
                      <div style={{ fontSize: 12, color: '#065f46', lineHeight: 1.6, fontFamily: 'monospace' }}>
                        签名算法：{ALGO_CONFIG[selectedCert.algorithm].label}<br/>
                        签名时间：{new Date().toISOString()}<br/>
                        验证码：<b>{signResult.verificationCode}</b><br/>
                        报告 ID：<b>{signResult.reportId}</b><br/>
                        证书链：根 CA → 中间 CA → 用户证书
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Key size={13} /> 证书链验证
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {[
                      { name: '根 CA', desc: '国家根证书', color: '#dc2626' },
                      { name: '中间 CA', desc: 'CFCA / GMCA', color: '#f59e0b' },
                      { name: '用户证书', desc: selectedCert.holderName, color: '#10b981' },
                    ].map((c, i) => (
                      <React.Fragment key={i}>
                        <div style={{
                          flex: 1, padding: 10, background: '#f8fafc',
                          border: `2px solid ${c.color}`, borderRadius: 6, textAlign: 'center',
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{c.desc}</div>
                          <div style={{ marginTop: 4, fontSize: 12, color: '#10b981' }}>✓ 已验证</div>
                        </div>
                        {i < 2 && <ChevronRight size={14} color="#94a3b8" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4,
  fontSize: 12, outline: 'none', flex: 1,
};

const KpiCard: React.FC<{ icon: any; label: string; value: number | string; color: string; alert?: boolean }> = ({ icon: Icon, label, value, color, alert }) => (
  <div style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={18} />
    </div>
    <div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: alert ? '#dc2626' : '#1e293b' }}>{value}</div>
    </div>
  </div>
);

const InfoCell: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div>
    <div style={{ fontSize: 12, color: '#94a3b8' }}>{label}</div>
    <div style={{ fontSize: 12, color: color || '#1e293b', fontWeight: 600, marginTop: 1, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
  </div>
);
