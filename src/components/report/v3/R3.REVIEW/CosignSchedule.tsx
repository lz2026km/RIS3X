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
import React, { useEffect, useMemo, useState } from 'react';
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

const SHIFT_META: Record<string, { color: string; label: string; bg: string }> = {
  morning: { color: '#f59e0b', label: '上午 (08-12)', bg: '#fef3c7' },
  afternoon: { color: '#3b82f6', label: '下午 (14-18)', bg: '#dbeafe' },
  evening: { color: '#7c3aed', label: '傍晚 (18-22)', bg: '#ede9fe' },
  night: { color: '#1e293b', label: '夜间 (22-08)', bg: '#e2e8f0' },
};

const STATUS_META: Record<CosignStatus, { color: string; label: string; bg: string }> = {
  pending: { color: '#f59e0b', label: '待签', bg: '#fef3c7' },
  scheduled: { color: '#3b82f6', label: '已排', bg: '#dbeafe' },
  'in-progress': { color: '#0891b2', label: '签中', bg: '#cffafe' },
  signed: { color: '#10b981', label: '已签', bg: '#d1fae5' },
  rejected: { color: '#dc2626', label: '已拒', bg: '#fee2e2' },
  expired: { color: '#7f1d1d', label: '超时', bg: '#fecaca' },
  escalated: { color: '#7c3aed', label: '升级', bg: '#ede9fe' },
  skipped: { color: '#6b7280', label: '跳过', bg: '#f3f4f6' },
  cancelled: { color: '#374151', label: '撤签', bg: '#e5e7eb' },
};

const CONFLICT_META: Record<string, { color: string; label: string }> = {
  'duplicate-signature': { color: 'red', label: '重复签' },
  'overlapping-cosigner': { color: 'orange', label: '同主任' },
  'expired-cert': { color: 'volcano', label: '证书过期' },
  'role-violation': { color: 'magenta', label: '角色越权' },
  'time-window-violation': { color: 'gold', label: '时窗越界' },
  'identity-mismatch': { color: 'purple', label: '身份不符' },
  'lock-conflict': { color: 'blue', label: '锁冲突' },
};

const TEMP_AUTH_SCOPE_LABEL: Record<TemporaryAuthScope, string> = {
  'single-cosign': '单次签',
  'department-cosign': '科室签',
  'modality-cosign': '设备签',
  'shift-window': '班次窗',
};

const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  'chief-signed-by-resident': '住院代签',
  'verified-by-ai': 'AI 验证',
  'training-case': '教学案例',
  'legacy-migration': '历史迁移',
  'director-authorized': '主任特批',
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return '刚刚';
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
      message.error('加载失败');
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
      message.success('排班已添加');
      setCalendarModalOpen(false);
      calendarForm.resetFields();
      loadAll();
    } catch (e: any) {
      message.error(e?.message ?? '添加失败');
    }
  };

  // ============ 5. 自动派主任 ============
  const handleAutoAssign = async (ruleId: string) => {
    try {
      const r = await cosignService.autoAssignSuperior(ruleId, 'RP20260615020', 'CT', 'stat');
      setAutoAssignResult({ assigned: r.assigned, reason: r.reason });
      setAutoAssignModal(true);
    } catch (e: any) {
      message.error(e?.message ?? '派单失败');
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
      message.success('临时授权已创建');
      setTempAuthModal(false);
      tempAuthForm.resetFields();
      loadAll();
    } catch (e: any) {
      message.error(e?.message ?? '创建失败');
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
      message.success('批量签已启动');
      setBatchModal(false);
      batchForm.resetFields();
      loadAll();
    } catch (e: any) {
      message.error(e?.message ?? '启动失败');
    }
  };

  // ============ 8. 跳过 ============
  const handleSkip = async () => {
    if (!skipModal) return;
    if (!skipComment.trim()) {
      message.warning('请填写跳过说明');
      return;
    }
    try {
      await cosignService.skipCosign(skipModal.recordId, skipReason, 'D001', '当前用户', skipComment);
      message.success('已跳过');
      setSkipModal(null);
      setSkipComment('');
      loadAll();
    } catch (e: any) {
      message.error(e?.message ?? '跳过失败');
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
      message.success('冲突已解决');
      setConflictResolveModal(null);
      loadAll();
    } catch (e: any) {
      message.error(e?.message ?? '解决失败');
    }
  };

  // ============ 6. SLA 监控 ============
  const handleRefreshSLA = async () => {
    try {
      const r = await cosignService.refreshSLA();
      message.success(`已刷新:超时 ${r.breached.length} 条,警告 ${r.warning.length} 条`);
      loadAll();
    } catch (e: any) {
      message.error(e?.message ?? '刷新失败');
    }
  };

  return (
    <div data-testid="cosign-schedule" role="region" aria-label="Cosign 排程">
      <div style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #be185d 100%)', color: '#fff', padding: '12px 16px', borderRadius: 8, marginBottom: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space wrap>
            <Award size={18} />
            <strong style={{ fontSize: 16 }}>Cosign 排程与高级管理</strong>
            <Tag color="purple">R3.REVIEW.003</Tag>
          </Space>
          <Space wrap>
            <Button size="small" icon={<Plus size={12} />} onClick={() => setCalendarModalOpen(true)} aria-label="新增排班">排班</Button>
            <Button size="small" icon={<UserPlus size={12} />} onClick={() => setTempAuthModal(true)} aria-label="临时授权">临时授权</Button>
            <Button size="small" icon={<CheckSquare size={12} />} onClick={() => setBatchModal(true)} aria-label="批量签">批量签</Button>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={loadAll}>刷新</Button>
          </Space>
        </Space>
        {kpi && (
          <Row gutter={12} style={{ marginTop: 12 }}>
            <Col span={4}><Statistic title={<span style={{ color: '#fff' }}>已触发</span>} value={kpi.totalTriggered} styles={{ content: {  color: '#fff', fontSize: 18  } }} prefix={<Zap size={14} />} /></Col>
            <Col span={4}><Statistic title={<span style={{ color: '#fff' }}>已签</span>} value={kpi.totalSigned} styles={{ content: {  color: '#bbf7d0', fontSize: 18  } }} prefix={<CheckCircle2 size={14} />} /></Col>
            <Col span={4}><Statistic title={<span style={{ color: '#fff' }}>按时率</span>} value={kpi.onTimeRate} suffix="%" styles={{ content: {  color: '#bbf7d0', fontSize: 18  } }} prefix={<TrendingUp size={14} />} /></Col>
            <Col span={4}><Statistic title={<span style={{ color: '#fff' }}>冲突</span>} value={kpi.conflictCount} styles={{ content: {  color: '#fca5a5', fontSize: 18  } }} prefix={<AlertTriangle size={14} />} /></Col>
            <Col span={4}><Statistic title={<span style={{ color: '#fff' }}>临时授权</span>} value={kpi.tempAuthActive} styles={{ content: {  color: '#fff', fontSize: 18  } }} prefix={<Key size={14} />} /></Col>
            <Col span={4}><Statistic title={<span style={{ color: '#fff' }}>平均响应</span>} value={kpi.avgResponseMinutes} suffix="m" styles={{ content: {  color: '#fff', fontSize: 18  } }} prefix={<Clock size={14} />} /></Col>
          </Row>
        )}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'overview',
            label: <Space><Activity size={14} />总览</Space>,
            children: (
              <Row gutter={12}>
                <Col span={14}>
                  <Card title={<Space><CalIcon size={14} />7 天排班</Space>} size="small">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                      {calendarDays.map(({ date, entries }) => (
                        <div
                          key={date}
                          onClick={() => setSelectedDate(date)}
                          style={{
                            padding: 8, borderRadius: 6, cursor: 'pointer',
                            background: date === selectedDate ? '#ede9fe' : '#f8fafc',
                            border: date === selectedDate ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                          }}
                          aria-label={`选择日期 ${date}`}
                        >
                          <div style={{ fontSize: 12, color: '#64748b' }}>{date.slice(5)}</div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{entries.length} 班</div>
                          <div style={{ marginTop: 4 }}>
                            {entries.slice(0, 3).map((e) => {
                              const eSm: { color: string; label: string; bg: string } = SHIFT_META[e.shiftType] ?? { color: '#64748b', label: '未知', bg: '#f1f5f9' };
                              const eLabel = String(eSm.label).split(' ')[0]?.slice(0, 2) ?? '';
                              return (
                                <Tag key={e.id} color={eSm.color === '#f59e0b' ? 'gold' : eSm.color === '#3b82f6' ? 'blue' : 'purple'} style={{ fontSize: 12, margin: 1 }}>
                                  {eLabel} {e.reviewerName.slice(0, 1)}
                                </Tag>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <strong style={{ fontSize: 12 }}>{selectedDate} 排班详情</strong>
                      <List
                        style={{ marginTop: 8, maxHeight: 320, overflowY: 'auto' }}
                        size="small"
                        dataSource={daySchedules}
                        locale={{ emptyText: <Empty description="当日无排班" /> }}
                        renderItem={(s) => {
                          const sm: { color: string; label: string; bg: string } = SHIFT_META[s.shiftType] ?? { color: '#64748b', label: '未知', bg: '#f1f5f9' };
                          return (
                            <List.Item style={{ padding: '6px 0' }}>
                              <List.Item.Meta
                                avatar={<div style={{ width: 32, height: 32, borderRadius: 16, background: sm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={16} color={sm.color} /></div>}
                                title={<Space><strong>{s.reviewerName}</strong><Tag color="purple">{s.reviewerTitle === 'chief' ? '主任' : '副主'}</Tag><Tag color={s.status === 'on-duty' ? 'green' : 'blue'}>{s.status === 'on-duty' ? '值班中' : '已排'}</Tag></Space>}
                                description={<span style={{ fontSize: 12, color: '#64748b' }}>{sm.label} · 容量 {s.reserved}/{s.maxCapacity}</span>}
                              />
                            </List.Item>
                          );
                        }}
                      />
                    </div>
                  </Card>
                </Col>
                <Col span={10}>
                  <Card title={<Space><Zap size={14} color="#dc2626" />急诊双签</Space>} size="small">
                    <List
                      size="small"
                      dataSource={emergency}
                      renderItem={(e) => (
                        <List.Item style={{ padding: '6px 0' }}>
                          <List.Item.Meta
                            title={<Space><strong>{e.patientName}</strong><Tag color="red">{e.modality}</Tag><Tag color="purple">{e.responseSeconds ? `${e.responseSeconds}s 已响应` : '等待响应'}</Tag></Space>}
                            description={<span style={{ fontSize: 12, color: '#64748b' }}>报告 {e.reportId} · 触发 {timeAgo(e.triggeredAt)} · {e.smsSent && 'SMS'} {e.emailSent && 'Email'} {e.appPushed && 'APP'} {e.phoneCalled && '电话'}</span>}
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                  <Card title={<Space><History size={14} />最近双签记录</Space>} size="small" style={{ marginTop: 12 }}>
                    <List
                      size="small"
                      dataSource={records.slice(0, 4)}
                      renderItem={(r) => {
                        const sm = STATUS_META[r.status];
                        return (
                          <List.Item
                            style={{ padding: '6px 0', cursor: 'pointer' }}
                            onClick={() => showHistory(r.reportId)}
                            aria-label={`查看历史 ${r.reportId}`}
                          >
                            <List.Item.Meta
                              title={<Space><strong>{r.patientName}</strong><Tag color={r.priority === 'stat' ? 'red' : r.priority === 'urgent' ? 'orange' : 'blue'}>{r.priority}</Tag><Tag style={{ background: sm.bg, color: sm.color, border: 0 }}>{sm.label}</Tag></Space>}
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
            label: <Space><Clock size={14} />SLA 监控</Space>,
            children: (
              <Card size="small" title={<Space><Clock size={14} />Cosign SLA 实时监控</Space>} extra={<Button size="small" icon={<RefreshCw size={12} />} onClick={handleRefreshSLA}>刷新 SLA</Button>}>
                {slaConfig && (
                  <Alert
                    style={{ marginBottom: 12 }}
                    type="info"
                    showIcon
                    title={`默认 SLA: ${slaConfig.defaultMinutes}m · 警告 ${slaConfig.warnMinutes}m · 超时升级到 ${slaConfig.escalateToRole ?? 'director'}`}
                  />
                )}
                <Table
                  size="small"
                  rowKey="recordId"
                  dataSource={slaMetrics}
                  pagination={false}
                  columns={[
                    { title: '记录', dataIndex: 'recordId', width: 100 },
                    { title: '报告', dataIndex: 'reportId', width: 160 },
                    { title: '签人', dataIndex: 'cosignerName', width: 100 },
                    { title: '优先级', dataIndex: 'priority', width: 90, render: (p: string) => <Tag color={p === 'stat' ? 'red' : p === 'urgent' ? 'orange' : 'blue'}>{p}</Tag> },
                    { title: 'SLA (m)', dataIndex: 'slaMinutes', width: 80 },
                    { title: '已耗时 (m)', dataIndex: 'elapsedMinutes', width: 100 },
                    {
                      title: '状态', dataIndex: 'status', width: 110,
                      render: (s: string) => {
                        const colors: Record<string, string> = { 'on-track': 'green', 'warning': 'gold', 'breached': 'red' };
                        const labels: Record<string, string> = { 'on-track': '正常', 'warning': '警告', 'breached': '超时' };
                        return <Space size={4}><Badge color={colors[s]} /><Tag color={colors[s]}>{labels[s]}</Tag></Space>;
                      },
                    },
                    {
                      title: '进度', dataIndex: 'slaMinutes', width: 200,
                      render: (_: any, r: CosignSLAMetric) => {
                        const pct = Math.min(100, (r.elapsedMinutes / r.slaMinutes) * 100);
                        const color = r.status === 'breached' ? '#dc2626' : r.status === 'warning' ? '#f59e0b' : '#10b981';
                        return <Progress percent={Math.round(pct)} strokeColor={color} format={() => `${r.remainingMinutes}m`} />;
                      },
                    },
                    { title: '提醒次数', dataIndex: 'reminderSentCount', width: 90 },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'conflicts',
            label: <Space><AlertTriangle size={14} />签冲突</Space>,
            children: (
              <Card size="small" title={<Space><AlertTriangle size={14} color="#dc2626" />签冲突列表</Space>}>
                <Table
                  size="small"
                  rowKey="id"
                  dataSource={conflicts}
                  pagination={false}
                  columns={[
                    { title: '冲突 ID', dataIndex: 'id', width: 100 },
                    { title: '报告', dataIndex: 'reportId', width: 160 },
                    {
                      title: '类型', dataIndex: 'conflictType', width: 110,
                      render: (t: string) => <Tag color={CONFLICT_META[t]?.color}>{CONFLICT_META[t]?.label ?? t}</Tag>,
                    },
                    { title: '描述', dataIndex: 'description' },
                    {
                      title: '状态', dataIndex: 'status', width: 100,
                      render: (s: string) => {
                        const m: Record<string, { c: string; l: string }> = {
                          open: { c: 'red', l: '待处理' },
                          investigating: { c: 'orange', l: '调查中' },
                          resolved: { c: 'green', l: '已解决' },
                          unresolvable: { c: 'volcano', l: '不可解决' },
                        };
                        return <Tag color={m[s]?.c}>{m[s]?.l}</Tag>;
                      },
                    },
                    {
                      title: '操作', width: 100,
                      render: (_: any, r: SignConflict) => (
                        <Button
                          size="small"
                          disabled={r.status === 'resolved'}
                          onClick={() => { setConflictResolveModal({ conflict: r }); setConflictResolution('reassign-cosigner'); }}
                          aria-label={`解决冲突 ${r.id}`}
                        >解决</Button>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'multi',
            label: <Space><Users size={14} />多人签</Space>,
            children: (
              <Card size="small" title={<Space><Users size={14} />多人签配置</Space>}>
                {multiSigns.map((m) => (
                  <Card key={m.id} size="small" type="inner" style={{ marginBottom: 8 }} title={<Space>报告 {m.reportId} · 已签 {m.currentSignedCount}/{m.requiredSignerCount}<Tag color={m.status === 'completed' ? 'green' : m.status === 'partial' ? 'orange' : 'blue'}>{m.status}</Tag></Space>}>
                    <Timeline
                      items={m.signers.map((s) => ({
                        color: s.signed ? 'green' : 'gray',
                        children: (
                          <Space>
                            <strong>#{s.order} {s.signerName}</strong>
                            <Tag color="purple">{s.signerTitle}</Tag>
                            {s.signed ? <Tag color="green">{timeAgo(s.signedAt ?? '')}</Tag> : <Tag color="default">未签</Tag>}
                            {s.signed && !s.certificateId && (
                              <Button
                                size="small"
                                type="primary"
                                onClick={async () => {
                                  await cosignService.addMultiSignSignature(m.id, s.signerId, 'cert-' + s.signerId);
                                  loadAll();
                                  message.success(`${s.signerName} 已签`);
                                }}
                              >补充签名</Button>
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
            label: <Space><Settings size={14} />自动派单</Space>,
            children: (
              <Card size="small" title={<Space><Settings size={14} />自动派主任规则</Space>}>
                <List
                  size="small"
                  dataSource={superiorRules}
                  renderItem={(r) => (
                    <List.Item
                      style={{ padding: '8px 0' }}
                      actions={[
                        <Button key="assign" size="small" type="primary" icon={<Send size={12} />} onClick={() => handleAutoAssign(r.id)}>模拟派单</Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={<Space><strong>{r.name}</strong><Tag color={r.enabled ? 'green' : 'default'}>{r.enabled ? '启用' : '停用'}</Tag><Tag color="purple">{r.fallbackStrategy}</Tag></Space>}
                        description={
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            <div>范围:{r.scope.modalities?.join('/') ?? '全部'} {r.scope.bodyParts?.join('/') ?? ''} 优先级:{r.scope.priorities?.join('/') ?? '全部'}</div>
                            <div>策略:最低职级 {r.criteria.minTitle} · 排除同人:{String(r.criteria.excludeSamePerson)} · 优选在线:{String(r.criteria.preferOnline)} · 优选低负载:{String(r.criteria.preferLowestWorkload)} · 证书有效:{String(r.criteria.requireValidCert)}</div>
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
            label: <Space><ShieldCheck size={14} />跳过配置</Space>,
            children: skipConfig && (
              <Card size="small" title={<Space><ShieldCheck size={14} />跳过双签配置</Space>}>
                <Alert
                  style={{ marginBottom: 12 }}
                  type={skipConfig.enabled ? 'success' : 'warning'}
                  showIcon
                  title={`跳过功能 ${skipConfig.enabled ? '已启用' : '已停用'} · 需 ${skipConfig.authorizedRoles.join('/')} 授权 · 审计等级 ${skipConfig.auditLevel}`}
                />
                <Table
                  size="small"
                  rowKey="id"
                  dataSource={skipConfig.conditions}
                  pagination={false}
                  columns={[
                    { title: '原因', dataIndex: 'reason', width: 200, render: (r: SkipReason) => SKIP_REASON_LABEL[r] ?? r },
                    { title: '描述', dataIndex: 'description' },
                    {
                      title: '启用', dataIndex: 'enabled', width: 80,
                      render: (e: boolean, r) => (
                        <Switch
                          checked={e}
                          onChange={async (v) => {
                            await cosignService.toggleSkipCondition(r.id, v);
                            loadAll();
                          }}
                          aria-label={`切换 ${r.reason}`}
                        />
                      ),
                    },
                    { title: '需评论', dataIndex: 'requiresComment', width: 90, render: (v: boolean) => v ? <Tag color="orange">是</Tag> : <Tag>否</Tag> },
                  ]}
                />
                <div style={{ marginTop: 12 }}>
                  <strong style={{ fontSize: 12 }}>对当前待签记录执行跳过:</strong>
                  <Space wrap style={{ marginTop: 6 }}>
                    {records.filter((r) => r.status === 'pending' || r.status === 'in-progress').map((record) => (
                      <Button
                        key={record.id}
                        size="small"
                        icon={<ShieldCheck size={12} />}
                        onClick={() => setSkipModal({ recordId: record.id })}
                        aria-label={`跳过 ${record.reportId}`}
                      >{record.patientName} {record.reportId}</Button>
                    ))}
                  </Space>
                </div>
              </Card>
            ),
          },
          {
            key: 'tempauth',
            label: <Space><Key size={14} />临时授权</Space>,
            children: (
              <Card size="small" title={<Space><Key size={14} />临时授权列表</Space>} extra={<Button size="small" icon={<Plus size={12} />} onClick={() => setTempAuthModal(true)}>新增授权</Button>}>
                <Table
                  size="small"
                  rowKey="id"
                  dataSource={tempAuths}
                  pagination={false}
                  columns={[
                    { title: '受让人', dataIndex: 'granteeName', width: 100 },
                    { title: '授权人', dataIndex: 'granterName', width: 100 },
                    {
                      title: '范围', dataIndex: 'scope', width: 110,
                      render: (s: TemporaryAuthScope) => <Tag color="blue">{TEMP_AUTH_SCOPE_LABEL[s] ?? s}</Tag>,
                    },
                    { title: '原因', dataIndex: 'reason' },
                    { title: '开始', dataIndex: 'scopeDetail', width: 160, render: (d: TemporaryAuth['scopeDetail']) => d.startAt.slice(0, 16).replace('T', ' ') },
                    { title: '结束', dataIndex: 'scopeDetail', width: 160, render: (d: TemporaryAuth['scopeDetail']) => d.endAt.slice(0, 16).replace('T', ' ') },
                    {
                      title: '状态', dataIndex: 'status', width: 90,
                      render: (s: string) => {
                        const m: Record<string, { c: string; l: string }> = {
                          active: { c: 'green', l: '生效中' },
                          expired: { c: 'default', l: '已过期' },
                          revoked: { c: 'red', l: '已撤销' },
                        };
                        return <Tag color={m[s]?.c}>{m[s]?.l}</Tag>;
                      },
                    },
                    { title: '使用', dataIndex: 'usedCount', width: 60 },
                    {
                      title: '操作', width: 100,
                      render: (_: any, r: TemporaryAuth) => (
                        <Popconfirm
                          title="撤销该授权?"
                          onConfirm={async () => {
                            await cosignService.revokeTempAuth(r.id, 'D001', '管理');
                            message.success('已撤销');
                            loadAll();
                          }}
                          disabled={r.status !== 'active'}
                        >
                          <Button size="small" danger disabled={r.status !== 'active'} aria-label={`撤销 ${r.id}`}>撤销</Button>
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
            label: <Space><CheckSquare size={14} />批量签</Space>,
            children: (
              <Card size="small" title={<Space><CheckSquare size={14} />批量签记录</Space>} extra={<Button size="small" icon={<Plus size={12} />} onClick={() => setBatchModal(true)}>新建批量</Button>}>
                <List
                  size="small"
                  dataSource={batchReqs}
                  renderItem={(b) => (
                    <List.Item style={{ padding: '8px 0' }}>
                      <List.Item.Meta
                        title={<Space><Tag color="purple">{b.id}</Tag><strong>{b.cosignerName}</strong><Tag color={b.decision === 'approve' ? 'green' : 'red'}>{b.decision === 'approve' ? '通过' : '拒绝'}</Tag></Space>}
                        description={
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            <div>{b.totalCount} 个报告 · 成功 {b.successCount} · 失败 {b.failCount} · 跳过 {b.skipCount}</div>
                            <div>开始 {b.startedAt.slice(0, 16).replace('T', ' ')} {b.completedAt && `· 完成 ${b.completedAt.slice(0, 16).replace('T', ' ')}`}</div>
                          </div>
                        }
                      />
                      {!b.completedAt && (
                        <Button size="small" type="primary" icon={<Send size={12} />} onClick={async () => {
                          await cosignService.executeBatchCosign(b.id, 'D001', '当前用户');
                          message.success('批量签完成');
                          loadAll();
                        }} aria-label={`执行 ${b.id}`}>执行</Button>
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
        title="新增排班"
        open={calendarModalOpen}
        onCancel={() => setCalendarModalOpen(false)}
        onOk={handleCreateCalendar}
        okText="保存"
        cancelText="取消"
      >
        <Form form={calendarForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}><Form.Item name="date" label="日期" rules={[{ required: true }]}><Input type="date" /></Form.Item></Col>
            <Col span={12}>
              <Form.Item name="shiftType" label="班次" rules={[{ required: true }]} initialValue="morning">
                <Select options={Object.entries(SHIFT_META).map(([k, v]) => ({ value: k, label: v.label }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="reviewerId" label="主任" rules={[{ required: true }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={reviewers.map((r) => ({ value: r.id, label: `${r.name} (${r.titleLabel})` }))}
                  placeholder="选择主任"
                />
              </Form.Item>
            </Col>
            <Col span={12}><Form.Item name="maxCapacity" label="容量" initialValue={6}><Input type="number" min={1} max={20} /></Form.Item></Col>
            <Col span={12}><Form.Item name="startTime" label="开始" initialValue="08:00"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="endTime" label="结束" initialValue="12:00"><Input /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="自动派主任结果"
        open={autoAssignModal}
        onCancel={() => setAutoAssignModal(false)}
        footer={<Button onClick={() => setAutoAssignModal(false)}>关闭</Button>}
      >
        {autoAssignResult && (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Alert type={autoAssignResult.assigned ? 'success' : 'warning'} title={autoAssignResult.reason} showIcon />
            {autoAssignResult.assigned && (
              <Card size="small" type="inner">
                <p><strong>姓名:</strong>{autoAssignResult.assigned.name}</p>
                <p><strong>职级:</strong>{autoAssignResult.assigned.titleLabel}</p>
                <p><strong>专长:</strong>{autoAssignResult.assigned.specialty.join('/')}</p>
                <p><strong>当前负载:</strong>{autoAssignResult.assigned.currentLoad}/{autoAssignResult.assigned.maxLoad}</p>
                <p><strong>状态:</strong><Tag color="green">在线</Tag></p>
              </Card>
            )}
          </Space>
        )}
      </Modal>

      <Modal
        title="新增临时授权"
        open={tempAuthModal}
        onCancel={() => setTempAuthModal(false)}
        onOk={handleCreateTempAuth}
        okText="创建"
        cancelText="取消"
      >
        <Form form={tempAuthForm} layout="vertical">
          <Form.Item name="granteeId" label="受让人" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={reviewers.filter((r) => r.title === 'chief' || r.title === 'associateChief').map((r) => ({ value: r.id, label: `${r.name} (${r.titleLabel})` }))}
            />
          </Form.Item>
          <Form.Item name="scope" label="授权范围" rules={[{ required: true }]} initialValue="modality-cosign">
            <Select options={Object.entries(TEMP_AUTH_SCOPE_LABEL).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item name="modality" label="设备(可选)"><Input placeholder="CT/MR/..." /></Form.Item>
          <Form.Item name="departmentId" label="科室 ID(可选)"><Input placeholder="DEPT-CT" /></Form.Item>
          <Form.Item name="reason" label="授权原因" rules={[{ required: true, min: 5 }]}><Input.TextArea rows={2} /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="startAt" label="开始" rules={[{ required: true }]}><Input type="datetime-local" /></Form.Item></Col>
            <Col span={12}><Form.Item name="endAt" label="结束" rules={[{ required: true }]}><Input type="datetime-local" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="新建批量签"
        open={batchModal}
        onCancel={() => setBatchModal(false)}
        onOk={handleStartBatch}
        okText="启动"
        cancelText="取消"
      >
        <Form form={batchForm} layout="vertical">
          <Form.Item name="reportIds" label="报告 ID 列表(逗号分隔)" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="RP001,RP002,RP003" />
          </Form.Item>
          <Form.Item name="cosignerId" label="签人" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={reviewers.filter((r) => r.title === 'chief' || r.title === 'associateChief').map((r) => ({ value: r.id, label: `${r.name} (${r.titleLabel})` }))}
            />
          </Form.Item>
          <Form.Item name="decision" label="决策" rules={[{ required: true }]} initialValue="approve">
            <Select options={[{ value: 'approve', label: '批量通过' }, { value: 'reject', label: '批量拒绝' }]} />
          </Form.Item>
          <Form.Item name="comment" label="备注"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="requireCertCheck" label="需证书校验" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title="跳过双签"
        open={!!skipModal}
        onCancel={() => setSkipModal(null)}
        onOk={handleSkip}
        okText="确认跳过"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item label="跳过原因">
            <Select value={skipReason} onChange={setSkipReason} options={Object.entries(SKIP_REASON_LABEL).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item label="说明" required>
            <Input.TextArea rows={3} value={skipComment} onChange={(e) => setSkipComment(e.target.value)} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`解决冲突 ${conflictResolveModal?.conflict.id ?? ''}`}
        open={!!conflictResolveModal}
        onCancel={() => setConflictResolveModal(null)}
        onOk={handleResolveConflict}
        okText="应用"
        cancelText="取消"
      >
        {conflictResolveModal && (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Alert type="warning" title={`类型:${CONFLICT_META[conflictResolveModal.conflict.conflictType]?.label} · ${conflictResolveModal.conflict.description}`} />
            <div>
              <strong>解决方案:</strong>
              <Select
                style={{ width: '100%', marginTop: 4 }}
                value={conflictResolution}
                onChange={setConflictResolution}
                options={[
                  { value: 'reassign-cosigner', label: '重新派主任' },
                  { value: 'use-secondary-cert', label: '使用备用证书' },
                  { value: 'director-override', label: '院长覆盖' },
                  { value: 'extend-window', label: '延长时窗' },
                  { value: 'reject-and-restart', label: '拒绝重启' },
                  { value: 'escalate-to-dean', label: '升级到院长' },
                ]}
              />
            </div>
          </Space>
        )}
      </Modal>

      <Drawer
        title={`报告 ${historyReportId} 的双签历史`}
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