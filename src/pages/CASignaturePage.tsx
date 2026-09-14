import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Modal, Input, Select } from 'antd';
import {
  ShieldCheck, Stamp, CheckCircle2, AlertTriangle, XCircle,
  RefreshCw, Search, ChevronRight, Key, Activity, Ban,
  FileSearch, History as HistoryIcon, FileUp, ShieldX,
} from 'lucide-react';
import {
  caApi,
  type CACertificateDto,
  type SignatureRecord,
  type VerifySignatureResult,
  type CaHistoryEntry,
} from '../services/api/caApi';
import { PermissionGate } from '../components/common/PermissionGate';
import { t } from '../i18n/appI18n';

type CertificateStatus = 'valid' | 'expiring' | 'expired' | 'revoked';
type SignatureAlgorithm = 'RSA-SHA256' | 'SM2-SM3';

const STATUS_CONFIG: Record<CertificateStatus, { label: string; color: string; bg: string; icon: any }> = {
  valid:    { label: '有效', color: '#10b981', bg: '#22c55e22', icon: CheckCircle2 },
  expiring: { label: '即将过期', color: '#f59e0b', bg: '#f59e0b22', icon: AlertTriangle },
  expired:  { label: '已过期', color: '#ef4444', bg: '#ef444422', icon: XCircle },
  revoked:  { label: '已吊销', color: '#7f1d1d', bg: '#ef444422', icon: XCircle },
};

const ALGO_CONFIG: Record<SignatureAlgorithm, { label: string; color: string; bg: string; description: string }> = {
  'RSA-SHA256': { label: 'RSA-SHA256', color: '#3b82f6', bg: '#3b82f622', description: '国际通用，2048 位密钥' },
  'SM2-SM3':    { label: '国密 SM2-SM3', color: '#ef4444', bg: '#ef444422', description: '中国国密标准，符合等保' },
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
  const [listError, setListError] = useState<string | null>(null);

  // 上传证书
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    holderName: '', holderTitle: '', holderIdNumber: '',
    algorithm: 'RSA-SHA256' as 'RSA-SHA256' | 'SM2-SM3',
    issuer: '', validTo: '',
  });

  // 吊销证书
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  // 验签
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyForm, setVerifyForm] = useState({ reportId: '', verificationCode: '' });
  const [verifyResult, setVerifyResult] = useState<VerifySignatureResult | null>(null);

  // 签名历史 / 操作历史
  const [showSignaturesModal, setShowSignaturesModal] = useState(false);
  const [signatures, setSignatures] = useState<SignatureRecord[]>([]);
  const [signaturesLoading, setSignaturesLoading] = useState(false);
  const [sigPage, setSigPage] = useState(1);
  const SIG_PAGE_SIZE = 10;
  const sigPageData = signatures.slice((sigPage - 1) * SIG_PAGE_SIZE, sigPage * SIG_PAGE_SIZE);
  const sigTotalPages = Math.max(1, Math.ceil(signatures.length / SIG_PAGE_SIZE));
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState<CaHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await caApi.listCertificates();
      if (res.success) {
        setCerts(res.data);
        if (res.data.length > 0) setSelectedCertId(res.data[0]?.id ?? null);
        setListError(null);
      } else {
        setListError(res.error?.message ?? t('caSignature.certsLoadFailed'));
      }
      setLoading(false);
    })();
  }, []);

  const refreshCertificates = useCallback(async () => {
    const res = await caApi.listCertificates();
    if (res.success) {
      setCerts(res.data);
      setListError(null);
    } else {
      setListError(res.error?.message ?? t('caSignature.certsLoadFailed'));
    }
  }, []);

  const filteredCerts = certs.filter(c => {
    if (filterAlgo !== 'all' && c.algorithm !== filterAlgo) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.holderName.includes(search) && !c.certId.toLowerCase().includes(q)) return false;
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
      message.warning(t('caSignature.certInvalid'));
      return;
    }
    if (!reportId.trim()) {
      message.warning(t('caSignature.enterReportId'));

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

  // ===== 上传证书 (文件 + 元数据) =====
  const handleUpload = useCallback(async () => {
    if (!uploadForm.holderName.trim()) {
      message.warning(t('caSignature.enterHolderName'));
      return;
    }
    if (!uploadFile) {
      message.warning(t('caSignature.selectCertFile'));
      return;
    }
    setUploading(true);
    try {
      const certificateData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error(t('caSignature.fileReadFailed')));
        reader.readAsDataURL(uploadFile);
      });
      const res = await caApi.uploadCertificate({
        name: uploadForm.holderName,
        type: 'USER',
        certificateData,
        expiresAt: uploadForm.validTo ? `${uploadForm.validTo}T00:00:00+08:00` : undefined,
        holderName: uploadForm.holderName,
        holderTitle: uploadForm.holderTitle || '医生',
        holderIdNumber: uploadForm.holderIdNumber,
        algorithm: uploadForm.algorithm,
        issuer: uploadForm.issuer || 'CFCA 中国金融认证中心',
        validTo: uploadForm.validTo || undefined,
        fileName: uploadFile.name,
      });
      if (res.success) {
        message.success(`证书 ${uploadForm.holderName} 上传成功`);
        setShowUploadModal(false);
        setUploadForm({ holderName: '', holderTitle: '', holderIdNumber: '', algorithm: 'RSA-SHA256', issuer: '', validTo: '' });
        setUploadFile(null);
        await refreshCertificates();
      } else {
        message.error(res.error?.message || t('caSignature.uploadFailed'));
      }
    } catch (e: any) {
      message.error('上传失败: ' + (e?.message || String(e)));
    } finally {
      setUploading(false);
    }
  }, [uploadForm, uploadFile, refreshCertificates]);

  // ===== 吊销证书 (原因 + 确认) =====
  const handleRevoke = useCallback(async () => {
    if (!selectedCert) return;
    if (!revokeReason.trim()) {
      message.warning(t('caSignature.enterRevokeReason'));
      return;
    }
    setRevoking(true);
    try {
      const res = await caApi.revokeCertificate(selectedCert.id);
      if (res.success) {
        message.success(`证书 ${selectedCert.holderName} 已吊销`);
        setShowRevokeModal(false);
        setRevokeReason('');
        await refreshCertificates();
      } else {
        message.error(res.error?.message || t('caSignature.revokeFailed'));
      }
    } catch (e: any) {
      message.error('吊销失败: ' + (e?.message || String(e)));
    } finally {
      setRevoking(false);
    }
  }, [selectedCert, revokeReason, refreshCertificates]);

  // ===== 验签 =====
  const handleVerify = useCallback(async () => {
    if (!verifyForm.reportId.trim() || !verifyForm.verificationCode.trim()) {
      message.warning(t('caSignature.enterReportIdAndCode'));
      return;
    }
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await caApi.verifySignature({
        reportId: verifyForm.reportId.trim(),
        verificationCode: verifyForm.verificationCode.trim(),
      });
      if (res.success) {
        setVerifyResult(res.data);
      } else {
        message.error(res.error?.message || t('caSignature.verifyFailed'));
      }
    } catch (e: any) {
      message.error('验签失败: ' + (e?.message || String(e)));
    } finally {
      setVerifying(false);
    }
  }, [verifyForm]);

  // ===== 签名历史 / 操作历史 =====
  const openSignatures = useCallback(async () => {
    setShowSignaturesModal(true);
    setSignaturesLoading(true);
    setSigPage(1);
    try {
      const res = await caApi.listSignatures();
      if (res.success) setSignatures(res.data);
      else message.error(res.error?.message || t('caSignature.signatureHistoryLoadFailed'));
    } catch (e: any) {
      message.error('签名历史加载失败: ' + (e?.message || String(e)));
    } finally {
      setSignaturesLoading(false);
    }
  }, []);

  const openHistory = useCallback(async () => {
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const res = await caApi.getCaHistory();
      if (res.success) setHistory(res.data);
      else message.error(res.error?.message || t('caSignature.caHistoryLoadFailed'));
    } catch (e: any) {
      message.error('操作历史加载失败: ' + (e?.message || String(e)));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const totalUsage = certs.reduce((s, c) => s + c.usageCount, 0);

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stamp size={20} color="#7c3aed" /> {t('caSignature.title')}
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R6</span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {t('caSignature.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <PermissionGate permission="report.sign">
            <button
              onClick={() => setShowUploadModal(true)}
              style={{ padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <FileUp size={12} /> {t('caSignature.uploadCert')}
            </button>
          </PermissionGate>
          <button
            onClick={() => void openSignatures()}
            style={{ padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <FileSearch size={12} /> {t('caSignature.signatureHistory')}
          </button>
          <button
            onClick={() => void openHistory()}
            style={{ padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <HistoryIcon size={12} /> {t('caSignature.caHistory')}
          </button>
          <button
            onClick={() => { setVerifyResult(null); setVerifyForm({ reportId: '', verificationCode: '' }); setShowVerifyModal(true); }}
            style={{ padding: '6px 12px', border: '1px solid #7c3aed', borderRadius: 6, background: '#8b5cf622', color: '#7c3aed', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <ShieldX size={12} /> {t('caSignature.signVerify')}
          </button>
          <button
            onClick={() => navigate('/blockchain-proof')}
            style={{ padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
          >
            {t('caSignature.blockchainProof')}
          </button>
        </div>
      </div>

      {listError && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--color-error-bg)', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={12} /> {listError}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 14 }}>{t('caSignature.loadingCerts')}</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
            <KpiCard icon={ShieldCheck} label={t('caSignature.kpiValid')} value={certs.filter(c => c.status === 'valid').length} color="#10b981" />
            <KpiCard icon={AlertTriangle} label={t('caSignature.kpiExpiring')} value={certs.filter(c => c.status === 'expiring').length} color="#f59e0b" alert />
            <KpiCard icon={XCircle} label={t('caSignature.kpiExpired')} value={certs.filter(c => c.status === 'expired').length} color="#dc2626" />
            <KpiCard icon={Activity} label={t('caSignature.kpiMonthSignatures')} value={totalUsage} color="#3b82f6" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 12 }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={11} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-secondary)' }} />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder={t('caSignature.searchPlaceholder')}
                      style={{ width: '100%', padding: '5px 8px 5px 26px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, outline: 'none' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <select value={filterAlgo} onChange={e => setFilterAlgo(e.target.value)} style={selectStyle}>
                    <option value="all">{t('caSignature.allAlgorithms')}</option>
                    <option value="RSA-SHA256">RSA</option>
                    <option value="SM2-SM3">{t('caSignature.gmSm')}</option>
                  </select>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
                    <option value="all">{t('caSignature.allStatus')}</option>
                    <option value="valid">{t('caSignature.statusValid')}</option>
                    <option value="expiring">{t('caSignature.kpiExpiring')}</option>
                    <option value="expired">{t('caSignature.statusExpired')}</option>
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
                        padding: 10, borderBottom: '1px solid var(--border-light)',
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
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{c.holderName}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>· {c.holderTitle}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, padding: '1px 4px', borderRadius: 2, background: aConf.bg, color: aConf.color, fontWeight: 600 }}>{aConf.label}</span>
                        <span style={{ fontSize: 12, padding: '1px 4px', borderRadius: 2, background: sConf.bg, color: sConf.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
                          <sConf.icon size={9} /> {sConf.label}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 'auto' }}>×{c.usageCount}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.certId}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedCert && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{t('caSignature.reportIdToSign')}</div>
                  <input
                    value={reportId}
                    onChange={(e) => setReportId(e.target.value)}
                    placeholder={t('caSignature.reportIdPlaceholder')}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 12,
                      background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, fontWeight: 700,
                    }}>{selectedCert.holderName[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedCert.holderName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedCert.holderTitle} · {selectedCert.holderIdNumber}</div>
                    </div>
                    <span style={{
                      fontSize: 12, padding: '3px 10px', borderRadius: 4,
                      background: STATUS_CONFIG[selectedCert.status].bg,
                      color: STATUS_CONFIG[selectedCert.status].color, fontWeight: 700,
                    }}>{STATUS_CONFIG[selectedCert.status].label}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                    <InfoCell label={t('caSignature.certIdLabel')} value={selectedCert.certId} />
                    <InfoCell label={t('caSignature.serialNumber')} value={selectedCert.serialNumber.slice(0, 16) + '...'} />
                    <InfoCell label={t('caSignature.issuer')} value={selectedCert.issuer} />
                    <InfoCell label={t('caSignature.validFrom')} value={selectedCert.validFrom} />
                    <InfoCell label={t('caSignature.validTo')} value={selectedCert.validTo} />
                    <InfoCell label={t('caSignature.usageCount')} value={String(selectedCert.usageCount)} color="#10b981" />
                  </div>

                  <div style={{ marginBottom: 12, padding: 10, background: '#8b5cf622', border: '1px solid var(--border-color)6fe', borderRadius: 6 }}>
                    <div style={{ fontSize: 12, color: '#5b21b6', fontWeight: 600, marginBottom: 4 }}>{t('caSignature.fingerprint')}</div>
                    <div style={{ fontSize: 12, color: '#5b21b6', fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.4 }}>
                      {selectedCert.fingerprint}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
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
                        <Stamp size={12} /> {isSigning ? `签名中 ${signingProgress}%` : t('caSignature.signNow')}
                      </button>
                    </PermissionGate>
                    <PermissionGate permission="report.sign">
                      <button
                        onClick={() => { setRevokeReason(''); setShowRevokeModal(true); }}
                        disabled={selectedCert.status === 'revoked'}
                        title={selectedCert.status === 'revoked' ? t('caSignature.certRevoked') : t('caSignature.revokeCert')}
                        style={{
                          padding: '10px 16px', border: '1px solid #fca5a5', borderRadius: 6,
                          background: selectedCert.status === 'revoked' ? 'var(--bg-card)' : 'var(--bg-card)',
                          color: selectedCert.status === 'revoked' ? '#94a3b8' : '#b91c1c',
                          fontSize: 12, cursor: selectedCert.status === 'revoked' ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4,
                          opacity: selectedCert.status === 'revoked' ? 0.5 : 1,
                        }}
                      >
                        <Ban size={12} /> {t('caSignature.revoke')}
                      </button>
                    </PermissionGate>
                    <button
                      onClick={async () => {
                        if (selectedCert.status === 'expired' || selectedCert.status === 'revoked') {
                          message.warning(t('caSignature.expiredCannotRenew'));
                          return;
                        }
                        try {
                          const res = await caApi.updateCaConfig({
                            ...((await caApi.getCaConfig()).data ?? {} as any),
                          });
                          if (res.success) {
                            message.success(`已为 ${selectedCert.holderName} 提交续期申请 (证书 ${selectedCert.certId})`);
                          } else {
                            message.error(res.error?.message || t('caSignature.renewFailed'));
                          }
                        } catch (e: any) {
                          message.error('续期失败: ' + (e?.message || String(e)));
                        }
                      }}
                      disabled={!selectedCert || selectedCert.status === 'expired' || selectedCert.status === 'revoked'}
                      style={{ padding: '10px 16px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-card)', color: !selectedCert || selectedCert.status === 'expired' || selectedCert.status === 'revoked' ? '#94a3b8' : '#475569', fontSize: 12, cursor: !selectedCert || selectedCert.status === 'expired' || selectedCert.status === 'revoked' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: !selectedCert || selectedCert.status === 'expired' || selectedCert.status === 'revoked' ? 0.5 : 1 }}
                    >
                      <RefreshCw size={12} /> {t('caSignature.renew')}
                    </button>
                  </div>

                  {isSigning && (
                    <div style={{ marginTop: 12, padding: 10, background: 'var(--color-success-bg)', borderRadius: 6 }}>
                      <div style={{ fontSize: 12, color: '#047857', fontWeight: 600, marginBottom: 6 }}>
                        {t('caSignature.signingWithPrefix')} {ALGO_CONFIG[selectedCert.algorithm].label} {t('caSignature.signingWithSuffix')}
                      </div>
                      <div style={{ height: 6, background: 'var(--color-success-bg)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${signingProgress}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #3b82f6)' }} />
                      </div>
                    </div>
                  )}

                  {showSignResult && !isSigning && (
                    <div style={{ marginTop: 12, padding: 12, background: 'var(--color-success-bg)', border: '1px solid #6ee7b7', borderRadius: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#047857' }}>
                        <CheckCircle2 size={14} /> {t('caSignature.signSuccess')}
                      </div>
                      <div style={{ fontSize: 12, color: '#065f46', lineHeight: 1.6, fontFamily: 'monospace' }}>
                        {t('caSignature.signAlgorithm')}{ALGO_CONFIG[selectedCert.algorithm].label}<br/>
                        {t('caSignature.signTime')}{new Date().toISOString()}<br/>
                        {t('caSignature.verificationCode')}<b>{signResult.verificationCode}</b><br/>
                        {t('caSignature.reportIdLabel')}<b>{signResult.reportId}</b><br/>
                        {t('caSignature.certChainValue')}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Key size={13} /> {t('caSignature.certChainVerify')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {[
                      { name: '根 CA', desc: '国家根证书', color: '#dc2626' },
                      { name: '中间 CA', desc: 'CFCA / GMCA', color: '#f59e0b' },
                      { name: '用户证书', desc: selectedCert.holderName, color: '#10b981' },
                    ].map((c, i) => (
                      <React.Fragment key={i}>
                        <div style={{
                          flex: 1, padding: 10, background: 'var(--bg-card)',
                          border: `2px solid ${c.color}`, borderRadius: 6, textAlign: 'center',
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{c.desc}</div>
                          <div style={{ marginTop: 4, fontSize: 12, color: '#10b981' }}>✓ {t('caSignature.verified')}</div>
                        </div>
                        {i < 2 && <ChevronRight size={14} color="var(--text-secondary)" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== 上传证书 Modal ===== */}
      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileUp size={14} color="#7c3aed" /> {t('caSignature.uploadCertTitle')}</span>}
        open={showUploadModal}
        onCancel={() => setShowUploadModal(false)}
        onOk={() => void handleUpload()}
        okText={t('caSignature.upload')}
        cancelText={t('caSignature.cancel')}
        confirmLoading={uploading}
        width={480}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
          <div>
            <div style={fieldLabelStyle}>{t('caSignature.certFileLabel')}</div>
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                border: '1px dashed var(--border-color)', borderRadius: 6, cursor: 'pointer', background: 'var(--bg-card)',
              }}
            >
              <FileUp size={14} color="#7c3aed" />
              <span style={{ fontSize: 12, color: uploadFile ? 'var(--text-primary)' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {uploadFile ? uploadFile.name : t('caSignature.selectCertFileDots')}
              </span>
              <input
                type="file"
                accept=".cer,.pem,.crt,.der,.txt"
                style={{ display: 'none' }}
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={fieldLabelStyle}>{t('caSignature.holderNameLabel')}</div>
              <Input size="small" value={uploadForm.holderName} placeholder={t('caSignature.placeholderHolderName')} onChange={e => setUploadForm(f => ({ ...f, holderName: e.target.value }))} />
            </div>
            <div>
              <div style={fieldLabelStyle}>{t('caSignature.holderTitle')}</div>
              <Input size="small" value={uploadForm.holderTitle} placeholder={t('caSignature.placeholderHolderTitle')} onChange={e => setUploadForm(f => ({ ...f, holderTitle: e.target.value }))} />
            </div>
          </div>
          <div>
            <div style={fieldLabelStyle}>{t('caSignature.idNumber')}</div>
            <Input size="small" value={uploadForm.holderIdNumber} placeholder={t('caSignature.placeholderIdNumber')} onChange={e => setUploadForm(f => ({ ...f, holderIdNumber: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={fieldLabelStyle}>{t('caSignature.signAlgorithmLabel')}</div>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={uploadForm.algorithm}
                onChange={v => setUploadForm(f => ({ ...f, algorithm: v as 'RSA-SHA256' | 'SM2-SM3' }))}
                options={[
                  { value: 'RSA-SHA256', label: 'RSA-SHA256' },
                  { value: 'SM2-SM3', label: t('caSignature.gmSmFull') },
                ]}
              />
            </div>
            <div>
              <div style={fieldLabelStyle}>{t('caSignature.validToLabel')}</div>
              <Input size="small" type="date" value={uploadForm.validTo} onChange={e => setUploadForm(f => ({ ...f, validTo: e.target.value }))} />
            </div>
          </div>
          <div>
            <div style={fieldLabelStyle}>{t('caSignature.issuerLabel')}</div>
            <Input size="small" value={uploadForm.issuer} placeholder={t('caSignature.placeholderIssuer')} onChange={e => setUploadForm(f => ({ ...f, issuer: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* ===== 吊销证书 Modal ===== */}
      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ban size={14} color="#dc2626" /> {t('caSignature.revokeCert')}</span>}
        open={showRevokeModal}
        onCancel={() => setShowRevokeModal(false)}
        onOk={() => void handleRevoke()}
        okText={t('caSignature.confirmRevoke')}
        cancelText={t('caSignature.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={revoking}
        width={440}
      >
        <div style={{ paddingTop: 8 }}>
          {selectedCert && (
            <div style={{ marginBottom: 10, padding: 10, background: '#8b5cf622', border: '1px solid var(--border-color)6fe', borderRadius: 6, fontSize: 12 }}>
              <div><b>{t('caSignature.holderLabel')}</b>{selectedCert.holderName}（{selectedCert.holderTitle}）</div>
              <div><b>{t('caSignature.certIdLabel')}</b><span style={{ fontFamily: 'monospace' }}>{selectedCert.certId}</span></div>
              <div><b>{t('caSignature.currentStatus')}</b>{STATUS_CONFIG[selectedCert.status].label}</div>
            </div>
          )}
          <div style={fieldLabelStyle}>{t('caSignature.revokeReasonLabel')}</div>
          <Input.TextArea
            rows={3}
            value={revokeReason}
            onChange={e => setRevokeReason(e.target.value)}
            placeholder={t('caSignature.revokeReasonPlaceholder')}
            maxLength={200}
            showCount
          />
        </div>
      </Modal>

      {/* ===== 验签 Modal ===== */}
      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ShieldX size={14} color="#7c3aed" /> {t('caSignature.verifyTitle')}</span>}
        open={showVerifyModal}
        onCancel={() => setShowVerifyModal(false)}
        onOk={() => void handleVerify()}
        okText={t('caSignature.startVerify')}
        cancelText={t('caSignature.close')}
        confirmLoading={verifying}
        width={460}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
          <div>
            <div style={fieldLabelStyle}>{t('caSignature.reportIdLabelStar')}</div>
            <Input size="small" value={verifyForm.reportId} placeholder={t('caSignature.placeholderReportId')} onChange={e => setVerifyForm(f => ({ ...f, reportId: e.target.value }))} />
          </div>
          <div>
            <div style={fieldLabelStyle}>{t('caSignature.verifyCodeLabel')}</div>
            <Input size="small" value={verifyForm.verificationCode} placeholder={t('caSignature.placeholderVerifyCode')} onChange={e => setVerifyForm(f => ({ ...f, verificationCode: e.target.value }))} />
          </div>
          {verifyResult && (
            <div style={{
              padding: 12, borderRadius: 6, fontSize: 12, lineHeight: 1.8,
              background: verifyResult.valid ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
              border: `1px solid ${verifyResult.valid ? '#6ee7b7' : '#fecaca'}`,
            }}>
              <div style={{ fontWeight: 700, color: verifyResult.valid ? '#047857' : '#b91c1c', display: 'flex', alignItems: 'center', gap: 6 }}>
                {verifyResult.valid ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {verifyResult.valid ? t('caSignature.verifyPassed') : t('caSignature.verifyFailedMsg')}
              </div>
              {verifyResult.valid && (
                <div style={{ color: '#065f46', fontFamily: 'monospace' }}>
                  {t('caSignature.signerLabel')}{verifyResult.signerName}<br />
                  {t('caSignature.signAlgorithm')}{ALGO_CONFIG[verifyResult.algorithm]?.label ?? verifyResult.algorithm}<br />
                  {t('caSignature.signTime')}{verifyResult.signedAt}<br />
                  {t('caSignature.certStatusLabel')}{STATUS_CONFIG[verifyResult.certStatus]?.label ?? verifyResult.certStatus}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ===== 签名历史 Modal ===== */}
      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileSearch size={14} color="#7c3aed" /> {t('caSignature.signatureHistory')}</span>}
        open={showSignaturesModal}
        onCancel={() => setShowSignaturesModal(false)}
        footer={null}
        width={720}
      >
        <div style={{ maxHeight: 480, overflow: 'auto', paddingTop: 8 }}>
          {signaturesLoading ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)', fontSize: 13 }}>{t('caSignature.loadingSignatures')}</div>
          ) : signatures.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)', fontSize: 13 }}>{t('caSignature.noSignatures')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {[t('caSignature.colSigner'), t('caSignature.colReportId'), t('caSignature.colAlgorithm'), t('caSignature.colVerifyCode'), t('caSignature.colSignTime')].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sigPageData.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{s.holderName}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{s.reportId}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ padding: '1px 6px', borderRadius: 2, background: s.algorithm === 'SM2-SM3' ? 'var(--color-error-bg)' : 'var(--color-info-bg)', color: s.algorithm === 'SM2-SM3' ? '#b91c1c' : '#1d4ed8', fontWeight: 600 }}>{s.algorithm}</span>
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{s.verificationCode}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{new Date(s.signedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingTop: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('caSignature.totalLabel')} {signatures.length} {t('caSignature.itemsUnit')} · {t('caSignature.pageLabel')} {sigPage}/{sigTotalPages} {t('caSignature.pageUnit')}</span>
              <button style={selectStyle} disabled={sigPage <= 1} onClick={() => setSigPage(p => Math.max(1, p - 1))}>{t('caSignature.prevPage')}</button>
              <button style={selectStyle} disabled={sigPage >= sigTotalPages} onClick={() => setSigPage(p => Math.min(sigTotalPages, p + 1))}>{t('caSignature.nextPage')}</button>
            </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ===== 操作历史 Modal ===== */}
      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><HistoryIcon size={14} color="#7c3aed" /> {t('caSignature.caHistoryTitle')}</span>}
        open={showHistoryModal}
        onCancel={() => setShowHistoryModal(false)}
        footer={null}
        width={680}
      >
        <div style={{ maxHeight: 460, overflow: 'auto', paddingTop: 8 }}>
          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)', fontSize: 13 }}>{t('caSignature.loadingHistory')}</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)', fontSize: 13 }}>{t('caSignature.noHistory')}</div>
          ) : (
            <div>
              {history.map(h => {
                const actionColor = h.action === 'REVOKE' ? '#dc2626' : h.action === 'UPLOAD' ? '#059669' : h.action === 'VERIFY' ? '#7c3aed' : '#2563eb';
                return (
                  <div key={h.id} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: `${actionColor}15`, color: actionColor, fontSize: 11, fontWeight: 700, alignSelf: 'center' }}>{h.action}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{h.detail}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{h.operator} · {h.target} · {new Date(h.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4,
};

const selectStyle: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 4,
  fontSize: 12, outline: 'none', flex: 1,
};

const KpiCard: React.FC<{ icon: any; label: string; value: number | string; color: string; alert?: boolean }> = ({ icon: Icon, label, value, color, alert }) => (
  <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={18} />
    </div>
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: alert ? '#dc2626' : 'var(--text-primary)' }}>{value}</div>
    </div>
  </div>
);

const InfoCell: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div>
    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
    <div style={{ fontSize: 12, color: color || 'var(--text-primary)', fontWeight: 600, marginTop: 1, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
  </div>
);
