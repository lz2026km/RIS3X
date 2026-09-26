// ============================================================
// G005 放射科RIS系统 v1.0.3 - 报告修订链与版本对比
// Phase R3：修订链 / 版本对比 (Diff) / 补发 / 患者告知
// [W2-A] 修订链由 reportApi.auditTrail + reportApi.diff 真实渲染 (失败回退演示数据)
// ============================================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { message, Modal, Input, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getCurrentUser } from '../utils/auth';
import { notificationsApi } from '../services/api/notificationsApi';
import {
  History, GitCompare, ChevronRight, Plus, Edit2, Eye, X,
  FileText, Bell, ArrowLeftRight, RotateCcw, Search, Layers, GitBranch,
  ShieldCheck, BadgeCheck,
} from 'lucide-react';
import {
  REPORT_REVISIONS,
  REPORT_REVISIONS_044,
  type ReportRevision,
} from '../data/reviewRevisionCollabMock';
import { extendedReportMock } from '../data/reportSubsystemMock';
import { reportApi, type ReportRevisionContentDto, type ReportSignatureDto } from '../services/api/reportApi';
import { DataTable } from '../components/common/DataTable';
import { t } from '../i18n/appI18n';

// ============================================================
// 修订动作配置
// ============================================================
const ACTION_CONFIG = {
  initial:  { label: t('reportRev.action.initial'), color: '#3b82f6', bg: '#3b82f622', icon: FileText },
  revise:   { label: t('reportRev.action.revise'),     color: '#f59e0b', bg: '#f59e0b22', icon: Edit2 },
  addendum: { label: t('reportRev.action.addendum'),     color: '#7c3aed', bg: '#8b5cf622', icon: Plus },
  recall:   { label: t('reportRev.action.recall'),     color: '#ef4444', bg: '#ef444422', icon: RotateCcw },
};

// ============================================================
// 变更类型配置
// ============================================================
const CHANGE_CONFIG = {
  modified: { label: t('reportRev.change.modified'), color: '#f59e0b', bg: '#f59e0b22', icon: Edit2 },
  added:    { label: t('reportRev.change.added'), color: '#10b981', bg: '#22c55e22', icon: Plus },
  deleted:  { label: t('reportRev.change.deleted'), color: '#ef4444', bg: '#ef444422', icon: X },
};

// ============================================================
// 简易 Diff 文本对比算法
// ============================================================
function diffText(before: string, after: string): { type: 'same' | 'removed' | 'added'; text: string }[] {
  if (!before && !after) return [];
  if (!before) return [{ type: 'added', text: after }];
  if (!after) return [{ type: 'removed', text: before }];
  if (before === after) return [{ type: 'same', text: before }];

  // 简单逐句对比
  const beforeSentences = before.split(/([。！？；\n])/).filter(s => s.trim());
  const afterSentences = after.split(/([。！？；\n])/).filter(s => s.trim());

  const result: { type: 'same' | 'removed' | 'added'; text: string }[] = [];
  const beforeSet = new Set(beforeSentences);
  const afterSet = new Set(afterSentences);

  for (const s of beforeSentences) {
    if (!afterSet.has(s)) {
      result.push({ type: 'removed', text: s });
    }
  }
  for (const s of afterSentences) {
    if (!beforeSet.has(s)) {
      result.push({ type: 'added', text: s });
    }
  }
  return result;
}

function mapAction(fromState: string, toState: string): ReportRevision['action'] {
  const s = `${fromState}|${toState}`.toUpperCase();
  if (s.includes('WITHDRAWN')) return 'recall';
  if (s.includes('SUPPLEMENT')) return 'addendum';
  if (s.includes('AMEND')) return 'revise';
  return 'initial';
}

// ============================================================
// 主组件
// ============================================================
export default function ReportRevisionsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // [W2-3] 支持 /report-revisions?reportId= 直达

  // [W2-A] 真实数据源 (auditTrail + diff), 失败回退演示
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'api' | 'demo'>('demo');
  const [allRevisions, setAllRevisions] = useState<ReportRevision[]>(() =>
    [...REPORT_REVISIONS, ...REPORT_REVISIONS_044].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );
  const [reportMeta, setReportMeta] = useState<Record<string, { patientName: string; modality: string; bodyPart: string }>>(() => {
    const m: Record<string, { patientName: string; modality: string; bodyPart: string }> = {};
    for (const r of extendedReportMock) {
      m[r.id] = { patientName: r.patientName, modality: r.modality, bodyPart: r.bodyPart };
    }
    return m;
  });
  // [G005 W8-Report] 真实内容版本快照 + 数据签名状态
  const [revContents, setRevContents] = useState<Record<string, ReportRevisionContentDto[]>>({});
  const [signatures, setSignatures] = useState<Record<string, ReportSignatureDto | null>>({});
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const loadRevisions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportApi.list({ take: '50' });
      const reports = Array.isArray(res.data) ? res.data : Array.isArray((res.data as any)?.items) ? (res.data as any).items : [];
      if (!Array.isArray(reports) || reports.length === 0) {
        setSource('demo');
        setError(t('reportRev.apiUnavailable'));
        return;
      }
      const meta: Record<string, { patientName: string; modality: string; bodyPart: string }> = {};
      for (const r of reports) {
        const rr = (r ?? {}) as Record<string, any>;
        meta[String(rr.id)] = {
          patientName: String(rr.patientName ?? rr.reportId ?? rr.id),
          modality: String(rr.modality ?? ''),
          bodyPart: String(rr.bodyPart ?? ''),
        };
      }
      const contentMap: Record<string, ReportRevisionContentDto[]> = {};
      const sigMap: Record<string, ReportSignatureDto | null> = {};
      const batch = reports.slice(0, 12).map(async (r: any) => {
        const id = String(r.id);
        const [trailRes, diffRes, revRes, sigRes] = await Promise.allSettled([
          reportApi.auditTrail(id),
          reportApi.diff(id),
          reportApi.getRevisions(id),
          reportApi.getSignature(id),
        ]);
        const events = trailRes.status === 'fulfilled' && Array.isArray(trailRes.value.data?.events)
          ? trailRes.value.data.events
          : [];
        const diff = diffRes.status === 'fulfilled' ? diffRes.value.data : null;
        const oldV = (diff?.oldVersion ?? {}) as Record<string, any>;
        const newV = (diff?.newVersion ?? {}) as Record<string, any>;
        // [G005 W8-Report] 真实内容版本快照 (按版本号匹配)
        const contents = revRes.status === 'fulfilled' && Array.isArray(revRes.value.data?.data) ? revRes.value.data.data : [];
        contentMap[id] = contents;
        sigMap[id] = sigRes.status === 'fulfilled' ? (sigRes.value.data?.signature ?? null) : null;
        // 无审计事件时, 由内容快照合成修订链 (保证真实版本内容可见)
        const effectiveEvents = events.length > 0
          ? events
          : contents.map((c) => ({ actor: c.actorId, fromState: c.fromState, toState: c.toState, reason: c.reason, timestamp: c.createdAt }));
        if (effectiveEvents.length === 0) return null;
        return effectiveEvents.map((ev: any, i: number) => {
          const isLastTwo = i >= effectiveEvents.length - 2;
          const isNewest = i === effectiveEvents.length - 1;
          const fallback = isNewest ? newV : isLastTwo ? oldV : {};
          const snapshot = contents.find((c) => c.versionNumber === i + 1);
          const content = snapshot ? { findings: snapshot.findings, conclusion: snapshot.conclusion || snapshot.impression, diagnosis: snapshot.diagnosis, impression: snapshot.impression } : fallback;
          return {
            id: snapshot?.id ?? `rev-${id}-${i}`,
            reportId: id,
            versionNumber: i + 1,
            versionLabel: `v1.${i}`,
            authorId: String(snapshot?.actorId ?? ev.actor ?? 'unknown'),
            authorName: String(snapshot?.actorId ?? ev.actor ?? t('reportRev.unknownUser')),
            authorTitle: '—',
            action: mapAction(String(ev.fromState ?? ''), String(ev.toState ?? '')),
            reason: String(snapshot?.reason ?? ev.reason ?? `${ev.fromState ?? ''} → ${ev.toState ?? ''}`),
            changes: [],
            findings: String(content?.findings ?? ''),
            diagnosis: String(content?.conclusion ?? ''),
            impression: String(content?.impression ?? ''),
            createdAt: String(snapshot?.createdAt ?? ev.timestamp ?? '').replace('T', ' ').slice(0, 19),
            patientNotified: false,
          } as ReportRevision;
        });
      });
      const results = (await Promise.all(batch)).filter((x): x is ReportRevision[] => Array.isArray(x) && x.length > 0);
      if (results.length > 0) {
        const flat = results.flat().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        setAllRevisions(flat);
        setReportMeta(prev => ({ ...prev, ...meta }));
        setRevContents(contentMap);
        setSignatures(sigMap);
        setSource('api');
      } else {
        setSource('demo');
        setError(t('reportRev.noTrail'));
      }
    } catch (e) {
      setSource('demo');
      setError(e instanceof Error ? e.message : t('reportRev.loadFail'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRevisions(); }, [loadRevisions]);

  // 分组按报告 ID
  const revisionsByReport = useMemo(() => {
    const map: Record<string, ReportRevision[]> = {};
    for (const r of allRevisions) {
      if (!map[r.reportId]) map[r.reportId] = [];
      map[r.reportId]!.push(r);
    }
    return map;
  }, [allRevisions]);

  // 报告 ID 列表
  const reportIds = Object.keys(revisionsByReport);

  // 选中报告 ([W2-3] 支持从报告列表带 ?reportId= 直达)
  const [selectedReportId, setSelectedReportId] = useState<string>(() => {
    const fromUrl = searchParams.get('reportId');
    if (fromUrl) return fromUrl;
    return 'rpt-043';
  });
  const [leftVersion, setLeftVersion] = useState<number>(1);
  const [rightVersion, setRightVersion] = useState<number>(2);
  const [diffField, setDiffField] = useState<'findings' | 'diagnosis' | 'impression'>('impression');
  const [showDiff, setShowDiff] = useState(true);
  const [showAddendumModal, setShowAddendumModal] = useState(false);
  const [addendumNote, setAddendumNote] = useState('');
  const [addendumLoading, setAddendumLoading] = useState(false);
  const [search, setSearch] = useState('');
  // [v3.0.6.11-98 Wave3B P1] 终版预览 / 通知患者 / 撤回报告
  const [previewFinal, setPreviewFinal] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  // 当前选中的报告的修订链
  const currentRevisions = revisionsByReport[selectedReportId] || [];
  const report = reportMeta[selectedReportId] || extendedReportMock.find(r => r.id === selectedReportId);

  // 选中的左右版本
  const leftRev = currentRevisions.find(r => r.versionNumber === leftVersion);
  const rightRev = currentRevisions.find(r => r.versionNumber === rightVersion);
  // [G005 W8-Report] 当前报告的真实内容版本快照 (按版本号索引)
  const selectedContents = useMemo(() => revContents[selectedReportId] ?? [], [revContents, selectedReportId]);

  // [v3.0.6.11-98 Wave3B P1] 通知患者: notificationsApi.create 真实发送 (失败回退提示)
  const handleNotifyPatient = async () => {
    if (!rightRev || !report) return;
    setNotifyLoading(true);
    try {
      const res = await notificationsApi.create({
        userId: `patient-${selectedReportId}`,
        type: 'REPORT',
        severity: 'INFO',
        title: t('w9c.reportRev.notifyTitle'),
        content: t('w9c.reportRev.notifyContent', { patient: report.patientName, reportId: selectedReportId, version: rightRev.versionLabel, action: ACTION_CONFIG[rightRev.action].label }),
        targetId: selectedReportId,
      });
      setAllRevisions(prev => prev.map(r => r.id === rightRev.id ? { ...r, patientNotified: true } : r));
      if (res.success) {
        message.success(t('w9c.reportRev.notifySentTo', { name: report.patientName }));
      } else {
        message.warning(t('reportRev.notifyUnavailable'));
      }
    } catch {
      setAllRevisions(prev => prev.map(r => r.id === rightRev.id ? { ...r, patientNotified: true } : r));
      message.warning(t('reportRev.notifyUnavailable'));
    } finally {
      setNotifyLoading(false);
    }
  };

  // [v3.0.6.11-98 Wave3B P1] 撤回报告: reportApi.remove → 后端置 WITHDRAWN (DELETE /reports/:id, -88 状态链支持)
  const handleWithdrawReport = () => {
    if (!report) return;
    Modal.confirm({
      title: t('reportRev.withdrawTitle'),
      content: t('w9c.reportRev.withdrawConfirm', { reportId: selectedReportId }),
      okText: t('reportRev.withdrawOk'),
      okButtonProps: { danger: true },
      cancelText: t('reportRev.cancel'),
      onOk: async () => {
        setWithdrawing(true);
        try {
          const res = await reportApi.remove(selectedReportId, t('w9c.reportRev.withdrawReason'));
          if (res.success) {
            message.success(t('w9c.reportRev.withdrawSuccess', { reportId: selectedReportId }));
            await loadRevisions();
          } else {
            message.error(res.error?.message ?? t('reportRev.withdrawFail'));
          }
        } catch {
          message.error(t('reportRev.withdrawFailRetry'));
        } finally {
          setWithdrawing(false);
        }
      },
    });
  };

  // [G005 W8-Report] 数据签名验签
  const handleVerifySignature = async () => {
    if (!selectedReportId) return;
    setVerifying(true);
    setVerifyMsg(null);
    try {
      const res = await reportApi.verifySignature(selectedReportId);
      if (res.success && res.data) {
        setVerifyMsg(res.data.valid ? t('w8Report.sig.verifyPass') : `${t('w8Report.sig.verifyFail')}: ${res.data.reasons.join('; ')}`);
      } else {
        setVerifyMsg(t('w8Report.sig.verifyFail'));
      }
    } catch {
      setVerifyMsg(t('w8Report.sig.verifyFail'));
    } finally {
      setVerifying(false);
    }
  };

  // [v3.0.6.11-99 Wave8A P1] 创建修订/补发: reportApi.revise → AMENDING (修订说明本地记录, 随修订链展示)
  const handleCreateAddendum = async () => {
    if (!addendumNote.trim()) { message.warning(t('reportRev.addendumNoteRequired')); return; }
    setAddendumLoading(true);
    try {
      const res = await reportApi.revise(selectedReportId);
      if (!res.success) { message.error(res.error?.message ?? t('reportRev.addendumFail')); return; }
      const user = getCurrentUser();
      const latest = currentRevisions[currentRevisions.length - 1];
      const newRev: ReportRevision = {
        id: `rev-add-${Date.now()}`,
        reportId: selectedReportId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        versionLabel: `v1.${(latest?.versionNumber ?? 0) + 1}`,
        authorId: user?.id ?? 'unknown',
        authorName: (user as any)?.name ?? t('reportRev.currentUser'),
        authorTitle: '—',
        action: 'addendum',
        reason: addendumNote.trim(),
        changes: [],
        findings: latest?.findings ?? '',
        diagnosis: latest?.diagnosis ?? '',
        impression: latest?.impression ?? '',
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        patientNotified: false,
      };
      setAllRevisions(prev => [...prev, newRev]);
      setAddendumNote('');
      setShowAddendumModal(false);
      message.success(t('w9c.reportRev.addendumSuccess', { reportId: selectedReportId }));
    } catch {
      message.error(t('reportRev.addendumFailRetry'));
    } finally {
      setAddendumLoading(false);
    }
  };

  const filteredReportIds = reportIds.filter(rid => {
    if (!search) return true;
    const meta = reportMeta[rid];
    return rid.includes(search) || (meta?.patientName || '').includes(search);
  });
  const reportListData = filteredReportIds.map(id => ({ id }));

  const revisionReportColumns: ColumnsType<{ id: string }> = [
    {
      title: t('w3tables.col.patient'), dataIndex: 'id', key: 'patient',
      render: (rid: string) => {
        const r = reportMeta[rid];
        return (
          <div style={{ minWidth: 130 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{r?.patientName || rid}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r?.modality}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{rid} · {t('reportRev.versionCount', { count: (revisionsByReport[rid] ?? []).length })}</div>
          </div>
        );
      },
    },
    {
      title: t('reportRev.timeline'), key: 'actions',
      render: (_: unknown, row) => {
        const revs = revisionsByReport[row.id] ?? [];
        return (
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {revs.map(rev => {
              const aConf = ACTION_CONFIG[rev.action];
              return <span key={rev.id} style={{ fontSize: 12, padding: '1px 5px', borderRadius: 3, background: aConf.bg, color: aConf.color, fontWeight: 600 }}>{rev.versionLabel} {aConf.label}</span>;
            })}
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={20} color="#f59e0b" /> {t('reportRev.title')}
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R3</span>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 10,
              background: source === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
              color: source === 'api' ? '#16a34a' : '#92400e',
              border: `1px solid ${source === 'api' ? '#bbf7d0' : '#fde68a'}`,
              fontWeight: 500,
            }}>
              {loading ? t('reportRev.syncing') : source === 'api' ? t('reportRev.sourceApi') : t('reportRev.sourceDemo')}
            </span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {t('reportRev.subtitle')}
            {error && <span style={{ color: '#dc2626', marginLeft: 8 }}>{error}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowAddendumModal(true)}
            disabled={currentRevisions.length === 0}
            style={{
              padding: '6px 12px', border: 'none', borderRadius: 6,
              background: currentRevisions.length > 0 ? '#7c3aed' : '#cbd5e1',
              color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Plus size={12} /> {t('reportRev.createRevision')}
          </button>
          <button
            onClick={() => navigate('/reports')}
            style={{
              padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 6,
              background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
            }}
          >
            {t('reportRev.backToList')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12 }}>
        {/* 左：报告列表 */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)',
          overflow: 'hidden', alignSelf: 'flex-start',
        }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={12} /> {t('reportRev.revisedReports', { count: reportIds.length })}
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={11} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-secondary)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('reportRev.searchPlaceholder')}
                style={{
                  width: '100%', padding: '5px 8px 5px 26px',
                  border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, outline: 'none',
                }}
              />
            </div>
          </div>
          <DataTable<{ id: string }>
            columns={revisionReportColumns}
            dataSource={reportListData}
            rowKey="id"
            showPagination={false}
            emptyText={t('reportRev.emptyRevisions')}
            onRow={(row) => ({
              onClick: () => {
                const revs = revisionsByReport[row.id] ?? [];
                setSelectedReportId(row.id);
                if (revs[0]) setLeftVersion(revs[0].versionNumber);
                const last = revs[revs.length - 1];
                if (last) setRightVersion(last.versionNumber);
              },
              style: {
                cursor: 'pointer',
                background: row.id === selectedReportId ? 'var(--color-info-bg)' : undefined,
              },
            })}
            scroll={{ x: 'max-content' }}
          />
        </div>

        {/* 右：详情 + 版本对比 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {currentRevisions.length > 0 ? (
            <>
              {/* 报告信息 */}
              {report && (
                <div style={{
                  background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {report.patientName} · {report.modality} {report.bodyPart}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t('reportRev.reportIdLabel')}{selectedReportId}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('reportRev.revisionCount')}</span>
                        <span style={{ marginLeft: 6, fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>{currentRevisions.length}</span>
                      </div>
                      {/* [G005 W8-Report] 数据签名与证书状态 */}
                      {(() => {
                        const sig = signatures[selectedReportId] ?? null;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <ShieldCheck size={13} color="#0891b2" />
                            {sig ? (
                              <span>
                                <Tag color={sig.algorithm === 'SM3' ? 'purple' : 'blue'} style={{ fontSize: 11 }}>{sig.algorithm}</Tag>
                                <Tag color={sig.status === 'valid' ? 'green' : sig.status === 'superseded' ? 'orange' : 'red'} style={{ fontSize: 11 }}>{t(`w8Report.sig.status.${sig.status}`)}</Tag>
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>{t('w8Report.sig.noSignature')}</span>
                            )}
                            <button onClick={() => void handleVerifySignature()} disabled={verifying} style={{ padding: '2px 8px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)', color: '#0891b2', fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <BadgeCheck size={11} /> {verifying ? '...' : t('w8Report.sig.verify')}
                            </button>
                          </div>
                        );
                      })()}
                      {verifyMsg && <span style={{ fontSize: 11, color: verifyMsg.startsWith(t('w8Report.sig.verifyPass')) ? '#16a34a' : '#b45309' }}>{verifyMsg}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* 修订链时间线 */}
              <div style={{
                background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <GitBranch size={14} /> {t('reportRev.timeline')}
                </div>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                  {currentRevisions.map((rev, idx) => {
                    const aConf = ACTION_CONFIG[rev.action];
                    const Icon = aConf.icon;
                    const isLeft = rev.versionNumber === leftVersion;
                    const isRight = rev.versionNumber === rightVersion;
                    return (
                      <React.Fragment key={rev.id}>
                        <div
                          onClick={() => {
                            if (isRight) setLeftVersion(rev.versionNumber);
                            else setRightVersion(rev.versionNumber);
                          }}
                          style={{
                            minWidth: 200, padding: 12,
                            background: (isLeft || isRight) ? 'var(--color-info-bg)' : 'var(--bg-card)',
                            border: `2px solid ${isLeft ? '#f59e0b' : isRight ? '#10b981' : '#e2e8f0'}`,
                            borderRadius: 8, cursor: 'pointer',
                            position: 'relative',
                          }}
                        >
                          {isLeft &&                     <span style={{ position: 'absolute', top: -8, left: 8, fontSize: 12, padding: '1px 5px', background: '#f59e0b', color: '#fff', borderRadius: 3, fontWeight: 700 }}>{t('reportRev.left')}</span>}
                          {isRight && <span style={{ position: 'absolute', top: -8, right: 8, fontSize: 12, padding: '1px 5px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>{t('reportRev.right')}</span>}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                            <Icon size={12} color={aConf.color} />
                            <strong style={{ fontSize: 12, color: aConf.color }}>{rev.versionLabel}</strong>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{aConf.label}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>
                            {rev.authorTitle} {rev.authorName}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{rev.createdAt}</div>
                          {rev.publishedAt && (
                            <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>{t('reportRev.published')} {rev.publishedAt}</div>
                          )}
                          {rev.patientNotified && (
                            <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>{t('reportRev.notified')}</div>
                          )}
                          <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4, fontStyle: 'italic' }}>{rev.reason}</div>
                        </div>
                        {idx < currentRevisions.length - 1 && (
                          <div style={{ display: 'flex', alignItems: 'center', color: '#cbd5e1' }}>
                            <ChevronRight size={20} />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* 对比控制栏 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('reportRev.compare')}</span>
                  <select value={leftVersion} onChange={e => setLeftVersion(Number(e.target.value))} style={selectStyle}>
                    {currentRevisions.map(r => <option key={r.id} value={r.versionNumber}>{r.versionLabel} {ACTION_CONFIG[r.action].label}</option>)}
                  </select>
                  <ArrowLeftRight size={14} color="var(--text-secondary)" />
                  <select value={rightVersion} onChange={e => setRightVersion(Number(e.target.value))} style={selectStyle}>
                    {currentRevisions.map(r => <option key={r.id} value={r.versionNumber}>{r.versionLabel} {ACTION_CONFIG[r.action].label}</option>)}
                  </select>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('reportRev.field')}</span>
                  <select value={diffField} onChange={e => setDiffField(e.target.value as any)} style={selectStyle}>
                    <option value="findings">{t('reportRev.field.findings')}</option>
                    <option value="diagnosis">{t('reportRev.field.diagnosis')}</option>
                    <option value="impression">{t('reportRev.field.impression')}</option>
                  </select>
                  <button
                    onClick={() => setShowDiff(!showDiff)}
                    style={{
                      padding: '4px 10px', border: '1px solid var(--border-color)', borderRadius: 4,
                      background: showDiff ? 'var(--color-info-bg)' : 'var(--bg-card)',
                      color: showDiff ? '#1e40af' : '#475569',
                      fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <GitCompare size={11} /> {showDiff ? t('reportRev.hideDiff') : t('reportRev.showDiff')}
                  </button>
                </div>
              </div>

              {/* Diff 对比视图 */}
              {showDiff && leftRev && rightRev && (
                <div style={{
                  background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1, padding: 8, background: '#f9731622', border: '1px solid #fed7aa', borderRadius: 4 }}>
                      <div style={{ fontSize: 12, color: '#9a3412', fontWeight: 600 }}>{t('reportRev.leftVersion')}{leftRev.versionLabel} {ACTION_CONFIG[leftRev.action].label}</div>
                      <div style={{ fontSize: 12, color: '#7c2d12' }}>{leftRev.authorName} · {leftRev.createdAt}</div>
                    </div>
                    <ArrowLeftRight size={16} color="var(--text-secondary)" />
                    <div style={{ flex: 1, padding: 8, background: 'var(--color-success-bg)', border: '1px solid #bbf7d0', borderRadius: 4 }}>
                      <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>{t('reportRev.rightVersion')}{rightRev.versionLabel} {ACTION_CONFIG[rightRev.action].label}</div>
                      <div style={{ fontSize: 12, color: '#166534' }}>{rightRev.authorName} · {rightRev.createdAt}</div>
                    </div>
                  </div>

                  {/* Diff 内容 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <DiffPanel
                      title={t('reportRev.before')}
                      text={leftRev[diffField] || ''}
                      variant="before"
                    />
                    <DiffPanel
                      title={t('reportRev.after')}
                      text={rightRev[diffField] || ''}
                      variant="after"
                    />
                  </div>

                  {/* 合并视图 */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>{t('reportRev.mergedView')}</div>
                    <div style={{
                      padding: 12, background: 'var(--bg-card)', borderRadius: 6,
                      border: '1px solid var(--border-color)', fontSize: 12, lineHeight: 1.8,
                    }}>
                      {diffText(leftRev[diffField] || '', rightRev[diffField] || '').map((seg, i) => (
                        <span
                          key={i}
                          style={{
background: seg.type === 'removed' ? 'var(--color-error-bg)' : seg.type === 'added' ? 'var(--color-success-bg)' : 'transparent',
color: seg.type === 'removed' ? '#b91c1c' : seg.type === 'added' ? '#047857' : 'var(--text-primary)',
                            textDecoration: seg.type === 'removed' ? 'line-through' : 'none',
                            padding: '0 2px',
                          }}
                        >
                          {seg.text}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 修订变更列表 */}
                  {rightRev.changes && rightRev.changes.length > 0 && (
                    <div style={{ marginTop: 12, padding: 10, background: 'var(--color-warning-bg)', borderRadius: 6, border: '1px solid #fcd34d' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
                        {t('reportRev.changesList', { count: rightRev.changes.length })}
                      </div>
                      {rightRev.changes.map((change, i) => {
                        const cConf = CHANGE_CONFIG[change.changeType];
                        const CIcon = cConf.icon;
                        const fieldLabel = { findings: t('reportRev.field.findings'), diagnosis: t('reportRev.field.diagnosis'), impression: t('reportRev.field.impression'), recommendation: t('reportRev.field.recommendation'), critical: t('reportRev.field.critical') }[change.field] || change.field;
                        return (
                          <div key={i} style={{ marginBottom: 8, padding: 8, background: 'var(--bg-card)', borderRadius: 4, fontSize: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                              <span style={{
                                fontSize: 12, padding: '1px 5px', borderRadius: 2,
                                background: cConf.bg, color: cConf.color, fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: 2,
                              }}>
                                <CIcon size={9} /> {cConf.label}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{fieldLabel}</span>
                            </div>
                            {change.before && (
                              <div style={{ padding: 4, background: 'var(--color-error-bg)', color: '#7f1d1d', textDecoration: 'line-through', borderRadius: 3, marginBottom: 2 }}>
                                − {change.before}
                              </div>
                            )}
                            {change.after && (
                              <div style={{ padding: 4, background: 'var(--color-success-bg)', color: '#065f46', borderRadius: 3 }}>
                                + {change.after}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => rightRev && setPreviewFinal(true)}
                  disabled={!rightRev}
                  style={{
                    padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 4,
                    background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: rightRev ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Eye size={11} /> {t('reportRev.previewFinal')}
                </button>
                <button
                  onClick={() => void handleNotifyPatient()}
                  disabled={!rightRev || notifyLoading}
                  style={{
                    padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 4,
                    background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: rightRev && !notifyLoading ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Bell size={11} /> {notifyLoading ? t('reportRev.sending') : t('reportRev.notifyPatient')}
                </button>
                <button
                  onClick={handleWithdrawReport}
                  disabled={withdrawing}
                  style={{
                    padding: '6px 12px', border: '1px solid #dc2626', borderRadius: 4,
                    background: 'var(--bg-card)', color: '#dc2626', fontSize: 12, cursor: withdrawing ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <RotateCcw size={11} /> {withdrawing ? t('reportRev.withdrawing') : t('reportRev.withdrawReport')}
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: 8 }}>
              {t('reportRev.selectReportHint')}
            </div>
          )}
        </div>
      </div>

      {/* [v3.0.6.11-98 Wave3B P1] 终版预览 Modal */}
      <Modal
        title={rightRev ? t('w9c.reportRev.finalPreviewTitle', { reportId: selectedReportId, version: rightRev.versionLabel, action: ACTION_CONFIG[rightRev.action].label }) : t('reportRev.finalPreview')}
        open={previewFinal}
        onCancel={() => setPreviewFinal(false)}
        footer={null}
        width={720}
      >
        {rightRev && (
          <div style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--text-primary)' }}>
            {report && (
              <div style={{ marginBottom: 12, padding: 10, background: 'var(--color-info-bg)', borderRadius: 6, fontSize: 12 }}>
                {t('reportRev.patient')}{report.patientName} · {report.modality} · {report.bodyPart} · {t('reportRev.reviser')}{rightRev.authorName} · {rightRev.createdAt}
              </div>
            )}
            {['findings', 'diagnosis', 'impression'].map((field) => (
              <div key={field} style={{ marginBottom: 10 }}>
                <strong style={{ color: '#1e40af' }}>{field === 'findings' ? t('reportRev.findingsBracket') : field === 'diagnosis' ? t('reportRev.diagnosisBracket') : t('reportRev.impressionBracket')}</strong>
                <div style={{ marginTop: 2, padding: 8, background: 'var(--content-bg)', borderRadius: 4, whiteSpace: 'pre-wrap' }}>
                  {(selectedContents.find((c) => c.versionNumber === rightRev.versionNumber)?.[field as 'findings' | 'diagnosis' | 'impression']) || (rightRev as any)[field] || t('reportRev.noContent')}
                </div>
              </div>
            ))}
            {rightRev.reason && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>{t('reportRev.revisionReason')}{rightRev.reason}</div>
            )}
          </div>
        )}
      </Modal>

      {/* [v3.0.6.11-99 Wave8A P1] 创建修订/补发 Modal: 修订说明 → reportApi.revise (AMENDING) */}
      <Modal
        title={t('w9c.reportRev.createAddendumTitle', { reportId: selectedReportId })}
        open={showAddendumModal}
        onCancel={() => setShowAddendumModal(false)}
        onOk={() => void handleCreateAddendum()}
        confirmLoading={addendumLoading}
        okText={t('reportRev.confirmAddendum')}
        cancelText={t('reportRev.cancel')}
        width={480}
      >
        <div style={{ fontSize: 13 }}>
          <p style={{ marginBottom: 10, color: 'var(--text-secondary)' }}>
            {t('w9c.reportRev.createAddendumBody', { reportId: selectedReportId, count: currentRevisions.length })}
          </p>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{t('reportRev.addendumNoteLabel')}</label>
          <Input.TextArea
            rows={4}
            value={addendumNote}
            onChange={e => setAddendumNote(e.target.value)}
            placeholder={t('reportRev.addendumPlaceholder')}
            maxLength={200}
            showCount
          />
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// 样式
// ============================================================
const selectStyle: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 4,
  fontSize: 12, outline: 'none', minWidth: 100,
};

// ============================================================
// Diff 面板
// ============================================================
const DiffPanel: React.FC<{ title: string; text: string; variant: 'before' | 'after' }> = ({ title, text, variant }) => {
  const isBefore = variant === 'before';
  return (
    <div style={{
      background: isBefore ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
      border: `1px solid ${isBefore ? '#fed7aa' : '#bbf7d0'}`,
      borderRadius: 6, padding: 10,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: isBefore ? '#9a3412' : '#15803d', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.7, color: isBefore ? '#7c2d12' : '#166534', whiteSpace: 'pre-wrap' }}>
        {text || <em style={{ color: 'var(--text-secondary)' }}>{t('reportRev.empty')}</em>}
      </div>
    </div>
  );
};
