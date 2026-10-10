/**
 * G005 RIS v3.0.5.1 - R3.REVIEW.003 CosignSchedule Cosign 排程
 * 覆盖 10 大特性:
 *  - Cosign scheduling     (排班)
 *  - Emergency dual sign   (急诊双签)
 *  - Multi-signature mgmt  (多人签)
 *  - Sign conflict resolve (签冲突)
 *  - Auto-assign superior  (自动派主任)
 *  - Cosign SLA monitor    (SLA 监控)
 *  - Cosign history        (历史记录)
 *  - Skip Cosign config    (跳过配置)
 *  - Cosign temp auth      (临时授权)
 *  - Batch Cosign          (批量签)
 */
import { cosignService } from '../../../../services/review/cosignService';
import type {
  CosignCalendarEntry,
  CosignRecord,
  EmergencyCosign,
  MultiSignConfig,
  SignConflict,
  SuperiorAssignRule,
  CosignSLAConfig,
  CosignSkipConfig,
  TemporaryAuth,
  BatchCosignRequest,
  CosignDashboardKPI,
  CosignSLAMetric,
  ConflictResolution,
  SkipReason,
  TemporaryAuthScope,
  CosignStatus,
} from '../../../../types/R3/R3.COSIGN';
import type { Reviewer } from '../../../../types/R3/R3.REVIEW';
import {
  Card,
  Tag,
  Space,
  Button,
  Empty,
  Select,
  Row,
  Col,
  Statistic,
  message,
  Modal,
  List,
  Switch,
  Tabs,
  Progress,
  Badge,
  Table,
  Timeline,
  Alert,
  Input,
  Form,
  Popconfirm,
  Drawer,
} from 'antd';
import {
  Calendar as CalIcon,
  Users,
  Clock,
  Award,
  CheckCircle2,
  AlertTriangle,
  User,
  Settings,
  RefreshCw,
  Zap,
  ShieldCheck,
  History,
  Plus,
  UserPlus,
  Key,
  Send,
  CheckSquare,
  TrendingUp,
  Activity,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Inbox } from 'lucide-react'
import { t } from '../../../../i18n/appI18n';

const SHIFT_META: Record<string, { color: string; label: string; bg: string }> = {
  morning: { color: 'var(--color-warning-500)', label: 'reportReview.cosign.shift.morning', bg: '#fef3c7' },
  afternoon: { color: 'var(--color-primary-500)', label: 'reportReview.cosign.shift.afternoon', bg: '#dbeafe' },
  evening: { color: '#7c3aed', label: 'reportReview.cosign.shift.evening', bg: '#ede9fe' },
  night: { color: '#1e293b', label: 'reportReview.cosign.shift.night', bg: '#e2e8f0' },
};

const STATUS_META: Record<CosignStatus, { color: string; label: string; bg: string }> = {
  pending: { color: 'var(--color-warning-500)', label: 'reportReview.cosign.status.pending', bg: '#fef3c7' },
  scheduled: { color: 'var(--color-primary-500)', label: 'reportReview.cosign.status.scheduled', bg: '#dbeafe' },
  'in-progress': { color: 'var(--color-info-600)', label: 'reportReview.cosign.status.inProgress', bg: '#cffafe' },
  signed: { color: '#10b981', label: 'reportReview.cosign.status.signed', bg: '#d1fae5' },
  rejected: { color: 'var(--color-error-600)', label: 'reportReview.cosign.status.rejected', bg: '#fee2e2' },
  expired: { color: '#7f1d1d', label: 'reportReview.cosign.status.expired', bg: '#fecaca' },
  escalated: { color: '#7c3aed', label: 'reportReview.cosign.status.escalated', bg: '#ede9fe' },
  skipped: { color: '#6b7280', label: 'reportReview.cosign.status.skipped', bg: '#f3f4f6' },
  cancelled: { color: 'var(--text-primary)', label: 'reportReview.cosign.status.cancelled', bg: 'var(--border-color)' },
};

const CONFLICT_META: Record<string, { color: string; label: string }> = {
  'duplicate-signature': { color: 'red', label: 'reportReview.cosign.conflict.duplicateSignature' },
  'overlapping-cosigner': { color: 'orange', label: 'reportReview.cosign.conflict.overlappingCosigner' },
  'expired-cert': { color: 'volcano', label: 'reportReview.cosign.conflict.expiredCert' },
  'role-violation': { color: 'magenta', label: 'reportReview.cosign.conflict.roleViolation' },
  'time-window-violation': { color: 'gold', label: 'reportReview.cosign.conflict.timeWindowViolation' },
  'identity-mismatch': { color: 'purple', label: 'reportReview.cosign.conflict.identityMismatch' },
  'lock-conflict': { color: 'blue', label: 'reportReview.cosign.conflict.lockConflict' },
};

const TEMP_AUTH_SCOPE_LABEL: Record<TemporaryAuthScope, string> = {
  'single-cosign': 'reportReview.cosign.scope.single',
  'department-cosign': 'reportReview.cosign.scope.department',
  'modality-cosign': 'reportReview.cosign.scope.modality',
  'shift-window': 'reportReview.cosign.scope.shiftWindow',
};

const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  'chief-signed-by-resident': 'reportReview.cosign.skipReason.resident',
  'verified-by-ai': 'reportReview.cosign.skipReason.ai',
  'training-case': 'reportReview.cosign.skipReason.training',
  'legacy-migration': 'reportReview.cosign.skipReason.legacy',
  'director-authorized': 'reportReview.cosign.skipReason.director',
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return t('reportReview.justNow');
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

export const CosignSchedule: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [, setLoading] = useState(true);
  const [kpi, setKpi] = useState<CosignDashboardKPI | null>(null);
  const [records, setRecords] = useState<CosignRecord[]>([]);
  const [emergency, setEmergency] = useState<EmergencyCosign[]>([]);
  const [multiSigns, setMultiSigns] = useState<MultiSignConfig[]>([]);
  const [conflicts, setConflicts] = useState<SignConflict[]>([]);
  const [superiorRules, setSuperiorRules] = useState<SuperiorAssignRule[]>([]);
  const [slaConfig, setSlaConfig] = useState<CosignSLAConfig | null>(null);
  const [slaMetrics, setSlaMetrics] = useState<CosignSLAMetric[]>([]);
  const [skipConfig, setSkipConfig] = useState<CosignSkipConfig | null>(null);
  const [tempAuths, setTempAuths] = useState<TemporaryAuth[]>([]);
  const [batchReqs, setBatchReqs] = useState<BatchCosignRequest[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);

  // 排班
  const [calendar, setCalendar] = useState<CosignCalendarEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarForm] = Form.useForm();

  // 自动派主任
  const [autoAssignModal, setAutoAssignModal] = useState(false);
  const [autoAssignResult, setAutoAssignResult] = useState<{ assigned: Reviewer | null; reason: string } | null>(null);

  // 临时授权
  const [tempAuthModal, setTempAuthModal] = useState(false);
  const [tempAuthForm] = Form.useForm();

  // 批量签
  const [batchModal, setBatchModal] = useState(false);
  const [batchForm] = Form.useForm();

  // 跳过
  const [skipModal, setSkipModal] = useState<{ recordId: string } | null>(null);
  const [skipReason, setSkipReason] = useState<SkipReason>('chief-signed-by-resident');
  const [skipComment, setSkipComment] = useState('');

  // 历史
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyReportId, setHistoryReportId] = useState<string>('');
  const [historyList, setHistoryList] = useState<CosignRecord['history']>([]);

  // 冲突解决
  const [conflictResolveModal, setConflictResolveModal] = useState<{ conflict: SignConflict } | null>(null);
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>('reassign-cosigner');

  // 选中 cosign 记录(用于多签) — 预留
  // const [selectedMultiSignId, setSelectedMultiSignId] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [
        kpiData, recs, em, ms, cf, sr, sla, slm, sk, ta, br, cals, rvs,
      ] = await Promise.all([
        cosignService.getDashboardKPI(),
        cosignService.listRecords(),
        cosignService.listEmergency(),
        cosignService.listMultiSignConfigs(),
        cosignService.listConflicts(),
        cosignService.listSuperiorRules(),
        cosignService.getSLAConfig(),
        cosignService.listSLAMetrics(),
        cosignService.getSkipConfig(),
        cosignService.listTempAuths(),
        cosignService.listBatchRequests(),
        cosignService.listCalendar(),
        cosignService.listReviewers(),
      ]);
      setKpi(kpiData);
      setRecords(recs);
      setEmergency(em);
      setMultiSigns(ms);
      setConflicts(cf);
      setSuperiorRules(sr);
      setSlaConfig(sla);
      setSlaMetrics(slm);
      setSkipConfig(sk);
      setTempAuths(ta);
      setBatchReqs(br);
      setCalendar(cals);
      setReviewers(rvs);
    } catch (e) {
      message.error(t('reportReview.cosign.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // ============ 1. 排班 ============
  const daySchedules = useMemo(
    () => calendar.filter((c) => c.date === selectedDate),
    [calendar, selectedDate]
  );

  const calendarDays = useMemo(() => {
    const today = new Date();
    const days: { date: string; entries: CosignCalendarEntry[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().slice(0, 10);
      days.push({ date: ds, entries: calendar.filter((c) => c.date === ds) });
    }
    return days;
  }, [calendar]);

  const handleCreateCalendar = async () => {
    const values = await calendarForm.validateFields();
    try {
      await cosignService.createCalendarEntry({
        date: values.date,
        shiftType: values.shiftType,
        reviewerId: values.reviewerId,
        reviewerName: reviewers.find((r) => r.id === values.reviewerId)?.name ?? '',
        reviewerTitle: reviewers.find((r) => r.id === values.reviewerId)?.title ?? 'chief',
        startTime: values.startTime,
        endTime: values.endTime,
        maxCapacity: values.maxCapacity ?? 6,
        reserved: 0,
        status: 'scheduled',
      });
      message.success(t('reportReview.cosign.scheduleAdded'));
      setCalendarModalOpen(false);
      calendarForm.resetFields();
      loadAll();
    } catch (e: any) {
      message.error(e?.message ?? t('reportReview.cosign.addFailed'));
    }
  };

  // ============ 5. 自动派主任 ============
  const handleAutoAssign = async (ruleId: string) => {
    try {
      const r = await cosignService.autoAssignSuperior(ruleId, 'RP20260615020', 'CT', 'stat');
      setAutoAssignResult({ assigned: r.assigned, reason: r.reason });
      setAutoAssignModal(true);
    } catch (e: any) {
      message.error(e?.message ?? t('reportReview.cosign.assignFailed'));
    }
  };

  // ============ 9. 临时授权 ============
  const handleCreateTempAuth = async () => {
    const values = await tempAuthForm.validateFields();
    try {
      const grantee = reviewers.find((r) => r.id === values.granteeId);
      await cosignService.createTempAuth({
        granteeId: values.granteeId,
        granteeName: grantee?.name ?? '',
        granteeTitle: grantee?.title ?? 'associateChief',
        granterId: 'D001',
        granterName: '张明远',
        scope: values.scope,
        scopeDetail: {
          modality: values.modality,
          departmentId: values.departmentId,
          startAt: values.startAt.toISOString(),
          endAt: values.endAt.toISOString(),
        },
        reason: values.reason,
      });
      message.success(t('reportReview.cosign.tempAuthCreated'));
      setTempAuthModal(false);
      tempAuthForm.resetFields();
      loadAll();
    } catch (e: any) {
      message.error(e?.message ?? t('reportReview.cosign.createFailed'));
    }
  };

  // ============ 10. 批量签 ============
  const handleStartBatch = async () => {
    const values = await batchForm.validateFields();
    try {
      const cosigner = reviewers.find((r) => r.id === values.cosignerId);
      await cosignService.startBatchCosign({
        reportIds: values.reportIds.split(',').map((s: string) => s.trim()),
        cosignerId: values.cosignerId,
        cosignerName: cosigner?.name ?? '',
        decision: values.decision,
        comment: values.comment,
        requireCertCheck: values.requireCertCheck ?? true,
      });
      message.success(t('reportReview.cosign.batchStarted'));
      setBatchModal(false);
      batchForm.resetFields();
      loadAll();
    } catch (e: any) {
      message.error(e?.message ?? t('reportReview.cosign.startFailed'));
    }
  };

  // ============ 8. 跳过 ============
  const handleSkip = async () => {
    if (!skipModal) return;
    if (!skipComment.trim()) {
      message.warning(t('reportReview.cosign.skipCommentRequired'));
      return;
    }
    try {
      await cosignService.skipCosign(skipModal.recordId, skipReason, 'D001', '当前用户', skipComment);
      message.success(t('reportReview.cosign.skipped'));
      setSkipModal(null);
      setSkipComment('');
      loadAll();
    } catch (e: any) {
      message.error(e?.message ?? t('reportReview.cosign.skipFailed'));
    }
  };

  // ============ 7. 历史 ============
  const showHistory = async (reportId: string) => {
    setHistoryReportId(reportId);
    const h = await cosignService.getHistory(reportId);
    setHistoryList(h);
    setHistoryDrawerOpen(true);
  };

  // ============ 4. 冲突解决 ============
  const handleResolveConflict = async () => {
    if (!conflictResolveModal) return;
    try {
      await cosignService.resolveConflict(
        conflictResolveModal.conflict.id,
        conflictResolution,
        'D001',
        '当前用户'
      );
      message.success(t('reportReview.cosign.conflictResolved'));
      setConflictResolveModal(null);
      loadAll();
    } catch (e: any) {
      message.error(e?.message ?? t('reportReview.cosign.resolveFailed'));
    }
  };

  // ============ 6. SLA 监控 ============
  const handleRefreshSLA = async () => {
    try {
      const r = await cosignService.refreshSLA();
      message.success(t('reportReview.cosign.slaRefreshed', { breached: r.breached.length, warning: r.warning.length }));
      loadAll();
    } catch (e: any) {
      message.error(e?.message ?? t('reportReview.cosign.refreshFailed'));
    }
  };

  return (
    <div data-testid="cosign-schedule" role="region" aria-label={t('reportReview.cosign.title')}>
      <div style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #be185d 100%)', color: '#fff', padding: '12px 16px', borderRadius: 8, marginBottom: 'var(--space-3, 12px)' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space wrap>
            <Award size={18} />
            <strong style={{ fontSize: 16 }}>{t('reportReview.cosign.headerTitle')}</strong>
            <Tag color="purple">R3.REVIEW.003</Tag>
          </Space>
          <Space wrap>
            <Button size="small" icon={<Plus size={14} />} onClick={() => setCalendarModalOpen(true)} aria-label={t('reportReview.cosign.addSchedule')}>{t('reportReview.cosign.schedule')}</Button>
            <Button size="small" icon={<UserPlus size={14} />} onClick={() => setTempAuthModal(true)} aria-label={t('reportReview.cosign.tempAuth')}>{t('reportReview.cosign.tempAuth')}</Button>
            <Button size="small" icon={<CheckSquare size={14} />} onClick={() => setBatchModal(true)} aria-label={t('reportReview.cosign.batch')}>{t('reportReview.cosign.batch')}</Button>
            <Button size="small" icon={<RefreshCw size={14} />} onClick={loadAll}>{t('reportReview.common.refresh')}</Button>
          </Space>
        </Space>
        {kpi && (
          <Row gutter={12} style={{ marginTop: 'var(--space-3, 12px)' }}>
            <Col span={4}><Statistic title={<span style={{ color: '#fff' }}>{t('reportReview.cosign.kpiTriggered')}</span>} value={kpi.totalTriggered} styles={{ content: {  color: '#fff', fontSize: 18  } }} prefix={<Zap size={14} />} /></Col>
            <Col span={4}><Statistic title={<span style={{ color: '#fff' }}>{t('reportReview.cosign.status.signed')}</span>} value={kpi.totalSigned} styles={{ content: {  color: '#bbf7d0', fontSize: 18  } }} prefix={<CheckCircle2 size={14} />} /></Col>
            <Col span={4}><Statistic title={<span style={{ color: '#fff' }}>{t('reportReview.sla.onTimeRate')}</span>} value={kpi.onTimeRate} suffix="%" styles={{ content: {  color: '#bbf7d0', fontSize: 18  } }} prefix={<TrendingUp size={14} />} /></Col>
            <Col span={4}><Statistic title={<span style={{ color: '#fff' }}>{t('reportReview.cosign.kpiConflict')}</span>} value={kpi.conflictCount} styles={{ content: {  color: '#fca5a5', fontSize: 18  } }} prefix={<AlertTriangle size={14} />} /></Col>
            <Col span={4}><Statistic title={<span style={{ color: '#fff' }}>{t('reportReview.cosign.tempAuth')}</span>} value={kpi.tempAuthActive} styles={{ content: {  color: '#fff', fontSize: 18  } }} prefix={<Key size={14} />} /></Col>
            <Col span={4}><Statistic title={<span style={{ color: '#fff' }}>{t('reportReview.cosign.kpiAvgResponse')}</span>} value={kpi.avgResponseMinutes} suffix="m" styles={{ content: {  color: '#fff', fontSize: 18  } }} prefix={<Clock size={14} />} /></Col>
          </Row>
        )}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'overview',
            label: <Space><Activity size={14} />{t('reportReview.cosign.tabOverview')}</Space>,
            children: (
              <Row gutter={12}>
                <Col span={14}>
                  <Card title={<Space><CalIcon size={14} />{t('reportReview.cosign.sevenDaySchedule')}</Space>} size="small">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--space-2, 8px)' }}>
                      {calendarDays.map(({ date, entries }) => (
                        <div
                          key={date}
                          onClick={() => setSelectedDate(date)}
                          style={{
                            padding: 'var(--space-2, 8px)', borderRadius: 6, cursor: 'pointer',
                            background: date === selectedDate ? '#ede9fe' : '#f8fafc',
                            border: date === selectedDate ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                          }}
                          aria-label={t('reportReview.cosign.selectDate', { date })}
                        >
                          <div style={{ fontSize: 12, color: '#64748b' }}>{date.slice(5)}</div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{entries.length} {t('reportReview.cosign.shiftUnit')}</div>
                          <div style={{ marginTop: 'var(--space-1, 4px)' }}>
                            {entries.slice(0, 3).map((e) => {
                              const eSm: { color: string; label: string; bg: string } = SHIFT_META[e.shiftType] ?? { color: '#64748b', label: 'reportReview.cosign.unknown', bg: '#f1f5f9' };
                              const eLabel = t(eSm.label).split(' ')[0]?.slice(0, 2) ?? '';
                              return (
                                <Tag key={e.id} color={eSm.color === 'var(--color-warning-500)' ? 'gold' : eSm.color === 'var(--color-primary-500)' ? 'blue' : 'purple'} style={{ fontSize: 12, margin: 1 }}>
                                  {eLabel} {e.reviewerName.slice(0, 1)}
                                </Tag>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 'var(--space-3, 12px)' }}>
                      <strong style={{ fontSize: 12 }}>{selectedDate} {t('reportReview.cosign.scheduleDetail')}</strong>
                      <List
                        style={{ marginTop: 'var(--space-2, 8px)', maxHeight: 320, overflowY: 'auto' }}
                        size="small"
                        dataSource={daySchedules}
                        locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportReview.cosign.noScheduleToday')} /> }}
                        renderItem={(s) => {
                          const sm: { color: string; label: string; bg: string } = SHIFT_META[s.shiftType] ?? { color: '#64748b', label: 'reportReview.cosign.unknown', bg: '#f1f5f9' };
                          return (
                            <List.Item style={{ padding: '6px 0' }}>
                              <List.Item.Meta
                                avatar={<div style={{ width: 32, height: 32, borderRadius: 16, background: sm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={16} color={sm.color} /></div>}
                                title={<Space><strong>{s.reviewerName}</strong><Tag color="purple">{s.reviewerTitle === 'chief' ? t('reportReview.title.chief') : t('reportReview.title.associateChief')}</Tag><Tag color={s.status === 'on-duty' ? 'green' : 'blue'}>{s.status === 'on-duty' ? t('reportReview.cosign.onDuty') : t('reportReview.cosign.scheduled')}</Tag></Space>}
                                description={<span style={{ fontSize: 12, color: '#64748b' }}>{t(sm.label)} · {t('reportReview.cosign.capacity')} {s.reserved}/{s.maxCapacity}</span>}
                              />
                            </List.Item>
                          );
                        }}
                      />
                    </div>
                  </Card>
                </Col>
                <Col span={10}>
                  <Card title={<Space><Zap size={14} color="var(--color-error-600)" />{t('reportReview.cosign.emergencyCosign')}</Space>} size="small">
                    <List
                      size="small"
                      dataSource={emergency}
                      renderItem={(e) => (
                        <List.Item style={{ padding: '6px 0' }}>
                          <List.Item.Meta
                            title={<Space><strong>{e.patientName}</strong><Tag color="red">{e.modality}</Tag><Tag color="purple">{e.responseSeconds ? t('reportReview.cosign.respondedIn', { s: e.responseSeconds }) : t('reportReview.cosign.awaitingResponse')}</Tag></Space>}
                            description={<span style={{ fontSize: 12, color: '#64748b' }}>{t('reportReview.cosign.reportLabel')} {e.reportId} · {t('reportReview.cosign.triggered')} {timeAgo(e.triggeredAt)} · {e.smsSent && 'SMS'} {e.emailSent && 'Email'} {e.appPushed && 'APP'} {e.phoneCalled && t('reportReview.cosign.channelPhone')}</span>}
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                  <Card title={<Space><History size={14} />{t('reportReview.cosign.recentRecords')}</Space>} size="small" style={{ marginTop: 'var(--space-3, 12px)' }}>
                    <List
                      size="small"
                      dataSource={records.slice(0, 4)}
                      renderItem={(r) => {
                        const sm = STATUS_META[r.status];
                        return (
                          <List.Item
                            style={{ padding: '6px 0', cursor: 'pointer' }}
                            onClick={() => showHistory(r.reportId)}
                            aria-label={t('reportReview.cosign.viewHistory', { reportId: r.reportId })}
                          >
                            <List.Item.Meta
                              title={<Space><strong>{r.patientName}</strong><Tag color={r.priority === 'stat' ? 'red' : r.priority === 'urgent' ? 'orange' : 'blue'}>{r.priority}</Tag><Tag style={{ background: sm.bg, color: sm.color, border: 0 }}>{t(sm.label)}</Tag></Space>}
                              description={<span style={{ fontSize: 12, color: '#64748b' }}>{r.reportId} · {r.cosignerName} · {r.signedAt ? timeAgo(r.signedAt) : timeAgo(r.scheduledAt ?? '')}</span>}
                            />
                          </List.Item>
                        );
                      }}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'sla',
            label: <Space><Clock size={14} />{t('reportReview.sla.title')}</Space>,
            children: (
              <Card size="small" title={<Space><Clock size={14} />{t('reportReview.cosign.slaMonitor')}</Space>} extra={<Button size="small" icon={<RefreshCw size={14} />} onClick={handleRefreshSLA}>{t('reportReview.cosign.refreshSla')}</Button>}>
                {slaConfig && (
                  <Alert
                    style={{ marginBottom: 'var(--space-3, 12px)' }}
                    type="info"
                    showIcon
                    title={t('reportReview.cosign.slaDefault', { default: slaConfig.defaultMinutes, warn: slaConfig.warnMinutes, escalate: slaConfig.escalateToRole ?? 'director' })}
                  />
                )}
                <Table scroll={{ x: 'max-content' }}
                  size="small"
                  rowKey="recordId"
                  dataSource={slaMetrics}
                  pagination={false}
                  columns={[
                    { title: t('reportReview.cosign.colRecord'), dataIndex: 'recordId', width: 100 },
                    { title: t('reportReview.cosign.colReport'), dataIndex: 'reportId', width: 160 },
                    { title: t('reportReview.cosign.colCosigner'), dataIndex: 'cosignerName', width: 100 },
                    { title: t('reportReview.cosign.colPriority'), dataIndex: 'priority', width: 90, render: (p: string) => <Tag color={p === 'stat' ? 'red' : p === 'urgent' ? 'orange' : 'blue'}>{p}</Tag> },
                    { title: t('reportReview.cosign.colSlaMin'), dataIndex: 'slaMinutes', width: 80 },
                    { title: t('reportReview.cosign.colElapsedMin'), dataIndex: 'elapsedMinutes', width: 100 },
                    {
                      title: t('reportReview.cosign.colStatus'), dataIndex: 'status', width: 110,
                      render: (s: string) => {
                        const colors: Record<string, string> = { 'on-track': 'green', 'warning': 'gold', 'breached': 'red' };
                        const labels: Record<string, string> = { 'on-track': 'reportReview.cosign.slaNormal', 'warning': 'reportReview.status.warning', 'breached': 'reportReview.status.overdue' };
                        return <Space size={4}><Badge color={colors[s]} /><Tag color={colors[s]}>{t(labels[s] ?? '')}</Tag></Space>;
                      },
                    },
                    {
                      title: t('reportReview.cosign.colProgress'), dataIndex: 'slaMinutes', width: 200,
                      render: (_: any, r: CosignSLAMetric) => {
                        const pct = Math.min(100, (r.elapsedMinutes / r.slaMinutes) * 100);
                        const color = r.status === 'breached' ? 'var(--color-error-600)' : r.status === 'warning' ? 'var(--color-warning-500)' : '#10b981';
                        return <Progress percent={Math.round(pct)} strokeColor={color} format={() => `${r.remainingMinutes}m`} />;
                      },
                    },
                    { title: t('reportReview.cosign.colReminderCount'), dataIndex: 'reminderSentCount', width: 90 },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'conflicts',
            label: <Space><AlertTriangle size={14} />{t('reportReview.cosign.tabConflicts')}</Space>,
            children: (
              <Card size="small" title={<Space><AlertTriangle size={14} color="var(--color-error-600)" />{t('reportReview.cosign.conflictList')}</Space>}>
                <Table scroll={{ x: 'max-content' }}
                  size="small"
                  rowKey="id"
                  dataSource={conflicts}
                  pagination={false}
                  columns={[
                    { title: t('reportReview.cosign.colConflictId'), dataIndex: 'id', width: 100 },
                    { title: t('reportReview.cosign.colReport'), dataIndex: 'reportId', width: 160 },
                    {
                      title: t('reportReview.cosign.colType'), dataIndex: 'conflictType', width: 110,
                      render: (ct: string) => <Tag color={CONFLICT_META[ct]?.color}>{t(CONFLICT_META[ct]?.label ?? ct)}</Tag>,
                    },
                    { title: t('reportReview.cosign.colDescription'), dataIndex: 'description' },
                    {
                      title: t('reportReview.cosign.colStatus'), dataIndex: 'status', width: 100,
                      render: (s: string) => {
                        const m: Record<string, { c: string; l: string }> = {
                          open: { c: 'red', l: 'reportReview.cosign.conflictStatus.open' },
                          investigating: { c: 'orange', l: 'reportReview.cosign.conflictStatus.investigating' },
                          resolved: { c: 'green', l: 'reportReview.cosign.conflictStatus.resolved' },
                          unresolvable: { c: 'volcano', l: 'reportReview.cosign.conflictStatus.unresolvable' },
                        };
                        return <Tag color={m[s]?.c}>{t(m[s]?.l ?? '')}</Tag>;
                      },
                    },
                    {
                      title: t('reportReview.cosign.colAction'), width: 100,
                      render: (_: any, r: SignConflict) => (
                        <Button
                          size="small"
                          disabled={r.status === 'resolved'}
                          onClick={() => { setConflictResolveModal({ conflict: r }); setConflictResolution('reassign-cosigner'); }}
                          aria-label={t('reportReview.cosign.resolveConflictAria', { id: r.id })}
                        >{t('reportReview.cosign.resolve')}</Button>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'multi',
            label: <Space><Users size={14} />{t('reportReview.cosign.tabMultiSign')}</Space>,
            children: (
              <Card size="small" title={<Space><Users size={14} />{t('reportReview.cosign.multiSignConfig')}</Space>}>
                {multiSigns.map((m) => (
                  <Card key={m.id} size="small" type="inner" style={{ marginBottom: 'var(--space-2, 8px)' }} title={<Space>{t('reportReview.cosign.reportLabel')} {m.reportId} · {t('reportReview.cosign.signedCount')} {m.currentSignedCount}/{m.requiredSignerCount}<Tag color={m.status === 'completed' ? 'green' : m.status === 'partial' ? 'orange' : 'blue'}>{m.status}</Tag></Space>}>
                    <Timeline
                      items={m.signers.map((s) => ({
                        color: s.signed ? 'green' : 'gray',
                        children: (
                          <Space>
                            <strong>#{s.order} {s.signerName}</strong>
                            <Tag color="purple">{s.signerTitle}</Tag>
                            {s.signed ? <Tag color="green">{timeAgo(s.signedAt ?? '')}</Tag> : <Tag color="default">{t('reportReview.cosign.unsigned')}</Tag>}
                            {s.signed && !s.certificateId && (
                              <Button
                                size="small"
                                type="primary"
                                onClick={async () => {
                                  await cosignService.addMultiSignSignature(m.id, s.signerId, 'cert-' + s.signerId);
                                  loadAll();
                                  message.success(t('reportReview.cosign.signerSigned', { name: s.signerName }));
                                }}
                              >{t('reportReview.cosign.addSignature')}</Button>
                            )}
                          </Space>
                        ),
                      }))}
                    />
                  </Card>
                ))}
              </Card>
            ),
          },
          {
            key: 'rules',
            label: <Space><Settings size={14} />{t('reportReview.cosign.tabAutoAssign')}</Space>,
            children: (
              <Card size="small" title={<Space><Settings size={14} />{t('reportReview.cosign.superiorRules')}</Space>}>
                <List
                  size="small"
                  dataSource={superiorRules}
                  renderItem={(r) => (
                    <List.Item
                      style={{ padding: '8px 0' }}
                      actions={[
                        <Button key="assign" size="small" type="primary" icon={<Send size={14} />} onClick={() => handleAutoAssign(r.id)}>{t('reportReview.cosign.simulateAssign')}</Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={<Space><strong>{r.name}</strong><Tag color={r.enabled ? 'green' : 'default'}>{r.enabled ? t('reportReview.common.enabled') : t('reportReview.common.disabled')}</Tag><Tag color="purple">{r.fallbackStrategy}</Tag></Space>}
                        description={
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            <div>{t('reportReview.cosign.scopeLabel')}:{r.scope.modalities?.join('/') ?? t('reportReview.common.all')} {r.scope.bodyParts?.join('/') ?? ''} {t('reportReview.cosign.priorityLabel')}:{r.scope.priorities?.join('/') ?? t('reportReview.common.all')}</div>
                            <div>{t('reportReview.cosign.strategyLabel')}:{t('reportReview.cosign.minTitle')} {r.criteria.minTitle} · {t('reportReview.cosign.excludeSamePerson')}:{String(r.criteria.excludeSamePerson)} · {t('reportReview.cosign.preferOnline')}:{String(r.criteria.preferOnline)} · {t('reportReview.cosign.preferLowWorkload')}:{String(r.criteria.preferLowestWorkload)} · {t('reportReview.cosign.validCert')}:{String(r.criteria.requireValidCert)}</div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            ),
          },
          {
            key: 'skip',
            label: <Space><ShieldCheck size={14} />{t('reportReview.cosign.tabSkipConfig')}</Space>,
            children: skipConfig && (
              <Card size="small" title={<Space><ShieldCheck size={14} />{t('reportReview.cosign.skipConfig')}</Space>}>
                <Alert
                  style={{ marginBottom: 'var(--space-3, 12px)' }}
                  type={skipConfig.enabled ? 'success' : 'warning'}
                  showIcon
                  title={t('reportReview.cosign.skipConfigTitle', { status: skipConfig.enabled ? t('reportReview.common.enabled') : t('reportReview.common.disabled'), roles: skipConfig.authorizedRoles.join('/'), level: skipConfig.auditLevel })}
                />
                <Table scroll={{ x: 'max-content' }}
                  size="small"
                  rowKey="id"
                  dataSource={skipConfig.conditions}
                  pagination={false}
                  columns={[
                    { title: t('reportReview.cosign.colReason'), dataIndex: 'reason', width: 200, render: (r: SkipReason) => t(SKIP_REASON_LABEL[r] ?? r) },
                    { title: t('reportReview.cosign.colDescription'), dataIndex: 'description' },
                    {
                      title: t('reportReview.cosign.colEnabled'), dataIndex: 'enabled', width: 80,
                      render: (e: boolean, r) => (
                        <Switch
                          checked={e}
                          onChange={async (v) => {
                            await cosignService.toggleSkipCondition(r.id, v);
                            loadAll();
                          }}
                          aria-label={t('reportReview.cosign.toggleAria', { reason: r.reason })}
                        />
                      ),
                    },
                    { title: t('reportReview.cosign.colRequiresComment'), dataIndex: 'requiresComment', width: 90, render: (v: boolean) => v ? <Tag color="orange">{t('reportReview.common.yes')}</Tag> : <Tag>{t('reportReview.common.no')}</Tag> },
                  ]}
                />
                <div style={{ marginTop: 'var(--space-3, 12px)' }}>
                  <strong style={{ fontSize: 12 }}>{t('reportReview.cosign.skipForPending')}</strong>
                  <Space wrap style={{ marginTop: 6 }}>
                    {records.filter((r) => r.status === 'pending' || r.status === 'in-progress').map((record) => (
                      <Button
                        key={record.id}
                        size="small"
                        icon={<ShieldCheck size={14} />}
                        onClick={() => setSkipModal({ recordId: record.id })}
                        aria-label={t('reportReview.cosign.skipAria', { reportId: record.reportId })}
                      >{record.patientName} {record.reportId}</Button>
                    ))}
                  </Space>
                </div>
              </Card>
            ),
          },
          {
            key: 'tempauth',
            label: <Space><Key size={14} />{t('reportReview.cosign.tempAuth')}</Space>,
            children: (
              <Card size="small" title={<Space><Key size={14} />{t('reportReview.cosign.tempAuthList')}</Space>} extra={<Button size="small" icon={<Plus size={14} />} onClick={() => setTempAuthModal(true)}>{t('reportReview.cosign.addAuth')}</Button>}>
                <Table scroll={{ x: 'max-content' }}
                  size="small"
                  rowKey="id"
                  dataSource={tempAuths}
                  pagination={false}
                  columns={[
                    { title: t('reportReview.cosign.colGrantee'), dataIndex: 'granteeName', width: 100 },
                    { title: t('reportReview.cosign.colGranter'), dataIndex: 'granterName', width: 100 },
                    {
                      title: t('reportReview.cosign.colScope'), dataIndex: 'scope', width: 110,
                      render: (s: TemporaryAuthScope) => <Tag color="blue">{t(TEMP_AUTH_SCOPE_LABEL[s] ?? s)}</Tag>,
                    },
                    { title: t('reportReview.cosign.colReason'), dataIndex: 'reason' },
                    { title: t('reportReview.cosign.colStart'), dataIndex: 'scopeDetail', width: 160, render: (d: TemporaryAuth['scopeDetail']) => d.startAt.slice(0, 16).replace('T', ' ') },
                    { title: t('reportReview.cosign.colEnd'), dataIndex: 'scopeDetail', width: 160, render: (d: TemporaryAuth['scopeDetail']) => d.endAt.slice(0, 16).replace('T', ' ') },
                    {
                      title: t('reportReview.cosign.colStatus'), dataIndex: 'status', width: 90,
                      render: (s: string) => {
                        const m: Record<string, { c: string; l: string }> = {
                          active: { c: 'green', l: 'reportReview.cosign.authStatus.active' },
                          expired: { c: 'default', l: 'reportReview.cosign.authStatus.expired' },
                          revoked: { c: 'red', l: 'reportReview.cosign.authStatus.revoked' },
                        };
                        return <Tag color={m[s]?.c}>{t(m[s]?.l ?? '')}</Tag>;
                      },
                    },
                    { title: t('reportReview.cosign.colUsage'), dataIndex: 'usedCount', width: 60 },
                    {
                      title: t('reportReview.cosign.colAction'), width: 100,
                      render: (_: any, r: TemporaryAuth) => (
                        <Popconfirm
                          title={t('reportReview.cosign.confirmRevoke')}
                          onConfirm={async () => {
                            await cosignService.revokeTempAuth(r.id, 'D001', '管理');
                            message.success(t('reportReview.cosign.revoked'));
                            loadAll();
                          }}
                          disabled={r.status !== 'active'}
                        >
                          <Button size="small" danger disabled={r.status !== 'active'} aria-label={t('reportReview.cosign.revokeAria', { id: r.id })}>{t('reportReview.cosign.revoke')}</Button>
                        </Popconfirm>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'batch',
            label: <Space><CheckSquare size={14} />{t('reportReview.cosign.batch')}</Space>,
            children: (
              <Card size="small" title={<Space><CheckSquare size={14} />{t('reportReview.cosign.batchRecords')}</Space>} extra={<Button size="small" icon={<Plus size={14} />} onClick={() => setBatchModal(true)}>{t('reportReview.cosign.newBatch')}</Button>}>
                <List
                  size="small"
                  dataSource={batchReqs}
                  renderItem={(b) => (
                    <List.Item style={{ padding: '8px 0' }}>
                      <List.Item.Meta
                        title={<Space><Tag color="purple">{b.id}</Tag><strong>{b.cosignerName}</strong><Tag color={b.decision === 'approve' ? 'green' : 'red'}>{b.decision === 'approve' ? t('reportReview.cosign.approve') : t('reportReview.cosign.reject')}</Tag></Space>}
                        description={
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            <div>{b.totalCount} {t('reportReview.cosign.batchReports', { success: b.successCount, fail: b.failCount, skip: b.skipCount })}</div>
                            <div>{t('reportReview.cosign.batchStart')} {b.startedAt.slice(0, 16).replace('T', ' ')} {b.completedAt && `· ${t('reportReview.cosign.batchComplete')} ${b.completedAt.slice(0, 16).replace('T', ' ')}`}</div>
                          </div>
                        }
                      />
                      {!b.completedAt && (
                        <Button size="small" type="primary" icon={<Send size={14} />} onClick={async () => {
                          await cosignService.executeBatchCosign(b.id, 'D001', '当前用户');
                          message.success(t('reportReview.cosign.batchDone'));
                          loadAll();
                        }} aria-label={t('reportReview.cosign.executeAria', { id: b.id })}>{t('reportReview.cosign.execute')}</Button>
                      )}
                    </List.Item>
                  )}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* ============ Modals ============ */}
      <Modal
        title={t('reportReview.cosign.addSchedule')}
        open={calendarModalOpen}
        onCancel={() => setCalendarModalOpen(false)}
        onOk={handleCreateCalendar}
        okText={t('reportReview.common.save')}
        cancelText={t('reportReview.common.cancel')}
      >
        <Form form={calendarForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}><Form.Item name="date" label={t('reportReview.cosign.fieldDate')} rules={[{ required: true }]}><Input type="date" /></Form.Item></Col>
            <Col span={12}>
              <Form.Item name="shiftType" label={t('reportReview.cosign.fieldShift')} rules={[{ required: true }]} initialValue="morning">
                <Select options={Object.entries(SHIFT_META).map(([k, v]) => ({ value: k, label: t(v.label) }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="reviewerId" label={t('reportReview.title.chief')} rules={[{ required: true }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={reviewers.map((r) => ({ value: r.id, label: `${r.name} (${r.titleLabel})` }))}
                  placeholder={t('reportReview.cosign.selectChief')}
                />
              </Form.Item>
            </Col>
            <Col span={12}><Form.Item name="maxCapacity" label={t('reportReview.cosign.fieldCapacity')} initialValue={6}><Input type="number" min={1} max={20} /></Form.Item></Col>
            <Col span={12}><Form.Item name="startTime" label={t('reportReview.cosign.fieldStart')} initialValue="08:00"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="endTime" label={t('reportReview.cosign.fieldEnd')} initialValue="12:00"><Input /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={t('reportReview.cosign.autoAssignResult')}
        open={autoAssignModal}
        onCancel={() => setAutoAssignModal(false)}
        footer={<Button onClick={() => setAutoAssignModal(false)}>{t('reportReview.common.close')}</Button>}
      >
        {autoAssignResult && (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Alert type={autoAssignResult.assigned ? 'success' : 'warning'} title={autoAssignResult.reason} showIcon />
            {autoAssignResult.assigned && (
              <Card size="small" type="inner">
                <p><strong>{t('reportReview.cosign.fieldName')}</strong>{autoAssignResult.assigned.name}</p>
                <p><strong>{t('reportReview.cosign.fieldTitle')}</strong>{autoAssignResult.assigned.titleLabel}</p>
                <p><strong>{t('reportReview.cosign.fieldSpecialty')}</strong>{autoAssignResult.assigned.specialty.join('/')}</p>
                <p><strong>{t('reportReview.cosign.fieldCurrentLoad')}</strong>{autoAssignResult.assigned.currentLoad}/{autoAssignResult.assigned.maxLoad}</p>
                <p><strong>{t('reportReview.cosign.fieldStatus')}</strong><Tag color="green">{t('reportReview.assign.status.online')}</Tag></p>
              </Card>
            )}
          </Space>
        )}
      </Modal>

      <Modal
        title={t('reportReview.cosign.addTempAuth')}
        open={tempAuthModal}
        onCancel={() => setTempAuthModal(false)}
        onOk={handleCreateTempAuth}
        okText={t('reportReview.common.create')}
        cancelText={t('reportReview.common.cancel')}
      >
        <Form form={tempAuthForm} layout="vertical">
          <Form.Item name="granteeId" label={t('reportReview.cosign.fieldGrantee')} rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={reviewers.filter((r) => r.title === 'chief' || r.title === 'associateChief').map((r) => ({ value: r.id, label: `${r.name} (${r.titleLabel})` }))}
            />
          </Form.Item>
          <Form.Item name="scope" label={t('reportReview.cosign.fieldScope')} rules={[{ required: true }]} initialValue="modality-cosign">
            <Select options={Object.entries(TEMP_AUTH_SCOPE_LABEL).map(([k, v]) => ({ value: k, label: t(v) }))} />
          </Form.Item>
          <Form.Item name="modality" label={t('reportReview.cosign.fieldModalityOptional')}><Input placeholder="CT/MR/..." /></Form.Item>
          <Form.Item name="departmentId" label={t('reportReview.cosign.fieldDeptOptional')}><Input placeholder="DEPT-CT" /></Form.Item>
          <Form.Item name="reason" label={t('reportReview.cosign.fieldAuthReason')} rules={[{ required: true, min: 5 }]}><Input.TextArea rows={2} /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="startAt" label={t('reportReview.cosign.fieldStart')} rules={[{ required: true }]}><Input type="datetime-local" /></Form.Item></Col>
            <Col span={12}><Form.Item name="endAt" label={t('reportReview.cosign.fieldEnd')} rules={[{ required: true }]}><Input type="datetime-local" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={t('reportReview.cosign.newBatchTitle')}
        open={batchModal}
        onCancel={() => setBatchModal(false)}
        onOk={handleStartBatch}
        okText={t('reportReview.common.start')}
        cancelText={t('reportReview.common.cancel')}
      >
        <Form form={batchForm} layout="vertical">
          <Form.Item name="reportIds" label={t('reportReview.cosign.fieldReportIds')} rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="RP001,RP002,RP003" />
          </Form.Item>
          <Form.Item name="cosignerId" label={t('reportReview.cosign.colCosigner')} rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={reviewers.filter((r) => r.title === 'chief' || r.title === 'associateChief').map((r) => ({ value: r.id, label: `${r.name} (${r.titleLabel})` }))}
            />
          </Form.Item>
          <Form.Item name="decision" label={t('reportReview.cosign.fieldDecision')} rules={[{ required: true }]} initialValue="approve">
            <Select options={[{ value: 'approve', label: t('reportReview.cosign.batchApprove') }, { value: 'reject', label: t('reportReview.cosign.batchReject') }]} />
          </Form.Item>
          <Form.Item name="comment" label={t('reportReview.cosign.fieldComment')}><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="requireCertCheck" label={t('reportReview.cosign.fieldCertCheck')} valuePropName="checked" initialValue={true}><Switch /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('reportReview.cosign.skipCosignTitle')}
        open={!!skipModal}
        onCancel={() => setSkipModal(null)}
        onOk={handleSkip}
        okText={t('reportReview.cosign.confirmSkip')}
        cancelText={t('reportReview.common.cancel')}
      >
        <Form layout="vertical">
          <Form.Item label={t('reportReview.cosign.fieldSkipReason')}>
            <Select value={skipReason} onChange={setSkipReason} options={Object.entries(SKIP_REASON_LABEL).map(([k, v]) => ({ value: k, label: t(v) }))} />
          </Form.Item>
          <Form.Item label={t('reportReview.cosign.fieldNote')} required>
            <Input.TextArea rows={3} value={skipComment} onChange={(e) => setSkipComment(e.target.value)} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('reportReview.cosign.resolveConflictTitle', { id: conflictResolveModal?.conflict.id ?? '' })}
        open={!!conflictResolveModal}
        onCancel={() => setConflictResolveModal(null)}
        onOk={handleResolveConflict}
        okText={t('reportReview.common.apply')}
        cancelText={t('reportReview.common.cancel')}
      >
        {conflictResolveModal && (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Alert type="warning" title={`${t('reportReview.cosign.colType')}:${t(CONFLICT_META[conflictResolveModal.conflict.conflictType]?.label ?? '')} · ${conflictResolveModal.conflict.description}`} />
            <div>
              <strong>{t('reportReview.cosign.resolution')}</strong>
              <Select
                style={{ width: '100%', marginTop: 'var(--space-1, 4px)' }}
                value={conflictResolution}
                onChange={setConflictResolution}
                options={[
                  { value: 'reassign-cosigner', label: t('reportReview.cosign.resolution.reassign') },
                  { value: 'use-secondary-cert', label: t('reportReview.cosign.resolution.secondaryCert') },
                  { value: 'director-override', label: t('reportReview.cosign.resolution.directorOverride') },
                  { value: 'extend-window', label: t('reportReview.cosign.resolution.extendWindow') },
                  { value: 'reject-and-restart', label: t('reportReview.cosign.resolution.rejectRestart') },
                  { value: 'escalate-to-dean', label: t('reportReview.cosign.resolution.escalateDean') },
                ]}
              />
            </div>
          </Space>
        )}
      </Modal>

      <Drawer
        title={t('reportReview.cosign.historyTitle', { reportId: historyReportId })}
        open={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        width={520}
      >
        <Timeline
          items={historyList.map((h) => ({
            color:
              h.step === 'sign' ? 'green' :
              h.step === 'reject' ? 'red' :
              h.step === 'skip' ? 'gray' :
              h.step === 'escalate' ? 'purple' : 'blue',
            children: (
              <Space orientation="vertical" size={2}>
                <Space><strong>{h.action}</strong><Tag>{h.step}</Tag></Space>
                <span style={{ fontSize: 12, color: '#64748b' }}>{h.actorName} · {h.timestamp.slice(0, 16).replace('T', ' ')}</span>
                {h.detail && <span style={{ fontSize: 12 }}>{h.detail}</span>}
                {h.hash && <span style={{ fontSize: 12, color: '#94a3b8' }}>hash: {h.hash}</span>}
              </Space>
            ),
          }))}
        />
      </Drawer>
    </div>
  );
};

export default CosignSchedule;