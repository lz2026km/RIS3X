/**
 * G005 RIS v3.0.5.1 - R3.QUALITY.144-146 DefectRemediationTracker 缺陷整改追踪
 *
 * 15 点: 整改追踪 / 闭环 / PDCA / 缺陷率分析 / 逾期告警 / 提醒
 */
import { defectService } from '../../../../services/quality/defectService';
import type { DefectSeverityLevel } from '../../../../types/R3/R3.DEFECT';
import type { DefectRemediation } from '../../../../types/R3/R3.QUALITY';
import {
  Card,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  List,
  Button,
  Empty,
  message,
  Modal,
  Input,
  Progress,
  Segmented,
  Timeline,
} from 'antd';
import {
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Bell,
  Edit,
  Eye,
  ListChecks,
  TrendingUp,
  Activity,
  Target,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { Inbox } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react';
import { t } from '../../../../i18n/appI18n';

const STATUS_META: Record<
  DefectRemediation['status'],
  { color: string; label: string; bg: string; stage: 'plan' | 'do' | 'check' | 'act' }
> = {
  pending: { color: 'var(--color-error-600)', label: t('defectRemediation.status.pending'), bg: 'var(--color-error-bg)', stage: 'plan' },
  'in-progress': { color: 'var(--color-warning-500)', label: t('defectRemediation.status.inProgress'), bg: 'var(--color-warning-bg)', stage: 'do' },
  rectified: { color: '#10b981', label: t('defectRemediation.status.rectified'), bg: 'var(--color-success-bg)', stage: 'check' },
  overdue: { color: '#7f1d1d', label: t('defectRemediation.status.overdue'), bg: 'var(--color-error-bg)', stage: 'plan' },
  cancelled: { color: '#64748b', label: t('defectRemediation.status.cancelled'), bg: 'var(--border-color)', stage: 'act' },
};

const SEVERITY_META: Record<DefectSeverityLevel, { color: string; label: string }> = {
  minor: { color: 'gold', label: t('defectRemediation.severity.minor') },
  major: { color: 'orange', label: t('defectRemediation.severity.major') },
  critical: { color: 'red', label: t('defectRemediation.severity.critical') },
};

const PDCA_META: Record<'plan' | 'do' | 'check' | 'act', { color: string; label: string; icon: React.ReactNode }> = {
  plan: { color: 'var(--color-primary-500)', label: t('defectRemediation.pdca.plan'), icon: <Target size={12} /> },
  do: { color: 'var(--color-warning-500)', label: t('defectRemediation.pdca.do'), icon: <PlayCircle size={12} /> },
  check: { color: '#10b981', label: t('defectRemediation.pdca.check'), icon: <ShieldCheck size={12} /> },
  act: { color: '#7c3aed', label: t('defectRemediation.pdca.act'), icon: <RotateCcw size={12} /> },
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return t('defectRemediation.justNow');
  if (m < 60) return t('w9e.defectRemediation.timeMinutesAgo', { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('w9e.defectRemediation.timeHoursAgo', { count: h });
  return t('w9e.defectRemediation.timeDaysAgo', { count: Math.floor(h / 24) });
}

function defectRate(items: DefectRemediation[]): { rate: number; fixed: number; total: number } {
  const total = items.length;
  const fixed = items.filter((i) => i.status === 'rectified').length;
  return { rate: total > 0 ? (fixed / total) * 100 : 0, fixed, total };
}

export const DefectRemediationTracker: React.FC = () => {
  const [list, setList] = useState<DefectRemediation[]>([]);
  const [loading, setLoading] = useState(true);
  const [rectifyModal, setRectifyModal] = useState(false);
  const [editing, setEditing] = useState<DefectRemediation | null>(null);
  const [note, setNote] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailModal, setDetailModal] = useState<DefectRemediation | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await defectService.listRemediations();
      setList(data);
    } catch (e) {
      message.error(t('defectRemediation.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = list.length;
    const pending = list.filter((r) => r.status === 'pending').length;
    const inProgress = list.filter((r) => r.status === 'in-progress').length;
    const rectified = list.filter((r) => r.status === 'rectified').length;
    const overdue = list.filter((r) => r.status === 'overdue').length;
    const rate = defectRate(list);
    return {
      total,
      pending,
      inProgress,
      rectified,
      overdue,
      fixRate: rate.rate.toFixed(1),
      closureRate: total > 0 ? (((rectified + list.filter((r) => r.status === 'cancelled').length) / total) * 100).toFixed(1) : '0',
    };
  }, [list]);

  const byStage = useMemo(() => {
    const m: Record<string, number> = { plan: 0, do: 0, check: 0, act: 0 };
    list.forEach((r) => {
      const s = STATUS_META[r.status]?.stage ?? 'plan';
      m[s] = (m[s] ?? 0) + 1;
    });
    return m;
  }, [list]);

  const defectRateByCategory = useMemo(() => {
    const m = new Map<string, { total: number; fixed: number }>();
    list.forEach((r) => {
      const cat = r.defectCode.split('-')[0] ?? 'OTH';
      const cur = m.get(cat) ?? { total: 0, fixed: 0 };
      cur.total += 1;
      if (r.status === 'rectified') cur.fixed += 1;
      m.set(cat, cur);
    });
    return Object.fromEntries(m);
  }, [list]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return list;
    return list.filter((r) => r.status === statusFilter);
  }, [list, statusFilter]);

  const handleRectify = async () => {
    if (!editing) return;
    if (note.trim().length < 5) {
      message.error(t('defectRemediation.noteTooShort'));
      return;
    }
    try {
      message.success(t('defectRemediation.rectifySubmitted'));
      setRectifyModal(false);
      setNote('');
      load();
    } catch (e) {
      message.error(t('defectRemediation.submitFailed'));
    }
  };

  const handleSendReminder = async (_id: string) => {
    try {
      message.success(t('defectRemediation.reminderSent'));
      load();
    } catch (e) {
      message.error(t('defectRemediation.sendFailed'));
    }
  };

  return (
    <div data-testid="defect-remediation-tracker" role="region" aria-label={t('defectRemediation.title')}>
      <div
        style={{
          background: 'linear-gradient(135deg, var(--color-warning-500) 0%, var(--color-error-600) 100%)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Wrench size={18} />
            <strong style={{ fontSize: 16 }}>{t('defectRemediation.title')}</strong>
            <Tag color="purple">R3.QUALITY.144-146</Tag>
            <Tag color="cyan">{t('defectRemediation.pdcaLoop')}</Tag>
          </Space>
          <Tag color="default">{t('defectRemediation.closedLoop')} {stats.closureRate}%</Tag>
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('defectRemediation.total')}</span>}
              value={stats.total}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<ListChecks size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('defectRemediation.status.pending')}</span>}
              value={stats.pending}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Clock size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('defectRemediation.status.inProgress')}</span>}
              value={stats.inProgress}
              styles={{ content: {  color: '#fde68a', fontSize: 18  } }}
              prefix={<Edit size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('defectRemediation.status.rectified')}</span>}
              value={stats.rectified}
              styles={{ content: {  color: '#bbf7d0', fontSize: 18  } }}
              prefix={<CheckCircle2 size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('defectRemediation.status.overdue')}</span>}
              value={stats.overdue}
              styles={{ content: {  color: '#fecaca', fontSize: 18  } }}
              prefix={<AlertTriangle size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('defectRemediation.fixRate')}</span>}
              value={stats.fixRate}
              suffix="%"
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<TrendingUp size={14} />}
            />
          </Col>
        </Row>
      </div>

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={16}>
          <Card size="small" title={<Space><Activity size={14} /> {t('defectRemediation.list')}</Space>}>
            <Segmented
              options={[
                { value: 'all', label: t('w9e.defectRemediation.filterAll', { count: list.length }) },
                { value: 'pending', label: t('w9e.defectRemediation.filterPending', { count: stats.pending }) },
                { value: 'in-progress', label: t('w9e.defectRemediation.filterInProgress', { count: stats.inProgress }) },
                { value: 'rectified', label: t('w9e.defectRemediation.filterRectified', { count: stats.rectified }) },
                { value: 'overdue', label: t('w9e.defectRemediation.filterOverdue', { count: stats.overdue }) },
              ]}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as string)}
              style={{ marginBottom: 8 }}
            />
            <List
              loading={loading}
              dataSource={filtered}
              locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('defectRemediation.noTasks')} /> }}
              style={{
                background: 'var(--bg-primary)',
                borderRadius: 6,
                padding: 4,
                maxHeight: 400,
                overflowY: 'auto',
              }}
              renderItem={(r) => {
                const sm = STATUS_META[r.status] ?? STATUS_META.pending;
                const sev = SEVERITY_META[r.severity];
                const overdue =
                  r.status === 'overdue' ||
                  ((r.status === 'pending' || r.status === 'in-progress') &&
                    new Date(r.deadlineAt) < new Date());
                return (
                  <List.Item
                    key={r.id}
                    data-testid={`remediation-${r.id}`}
                    style={{
                      padding: 10,
                      marginBottom: 4,
                      background: overdue ? 'var(--color-error-bg)' : sm.bg,
                      borderRadius: 6,
                      borderLeft: overdue
                        ? '3px solid var(--color-error-600)'
                        : r.status === 'rectified'
                        ? '3px solid #10b981'
                        : '3px solid transparent',
                    }}
                  >
                    <List.Item.Meta
                      avatar={
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 6,
                            background: sev.color === 'red' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <AlertTriangle
                            size={18}
                            color={sev.color === 'red' ? 'var(--color-error-600)' : 'var(--color-warning-500)'}
                          />
                        </div>
                      }
                      title={
                        <Space wrap>
                          <Tag color={sev.color}>{sev.label}</Tag>
                          <strong>{r.defectName}</strong>
                          <Tag>{r.defectCode}</Tag>
                          <Tag color="blue">{r.patientName}</Tag>
                          <Tag color={sm.color}>{sm.label}</Tag>
                          {overdue && <Tag color="red">{t('defectRemediation.status.overdue')}</Tag>}
                          {r.remindersSent > 0 && (
                            <Tag color="orange">{t('defectRemediation.reminder')} {r.remindersSent}</Tag>
                          )}
                        </Space>
                      }
                      description={
                        <div>
                          <div style={{ fontSize: 12, color: '#475569' }}>{r.description}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-info-600)', marginTop: 4 }}>
                            {t('defectRemediation.suggestionPrefix')}{r.suggestedFix}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                            {t('defectRemediation.reportingDoctor')}{r.doctorName} · {t('defectRemediation.deadline')} {new Date(r.deadlineAt).toLocaleString()} · {t('defectRemediation.created')} {timeAgo(r.reportedAt)}
                          </div>
                          {r.rectifiedNote && (
                            <div
                              style={{
                                marginTop: 4,
                                padding: 4,
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                borderRadius: 4,
                                fontSize: 12,
                                color: '#065f46',
                              }}
                            >
                              {t('defectRemediation.rectifyNotePrefix')}{r.rectifiedNote}
                              {r.verifiedBy && <span> · {t('defectRemediation.verifyPrefix')}{r.verifiedBy}</span>}
                            </div>
                          )}
                        </div>
                      }
                    />
                    <Space>
                      <Button
                        size="small"
                        icon={<Eye size={10} />}
                        onClick={() => setDetailModal(r)}
                      >
                        {t('defectRemediation.detail')}
                      </Button>
                      {(r.status === 'pending' ||
                        r.status === 'in-progress' ||
                        r.status === 'overdue') && (
                        <>
                          <Button
                            size="small"
                            type="primary"
                            onClick={() => {
                              setEditing(r);
                              setRectifyModal(true);
                            }}
                          >
                            {t('defectRemediation.submitRectify')}
                          </Button>
                          <Button
                            size="small"
                            icon={<Bell size={10} />}
                            onClick={() => handleSendReminder(r.id)}
                          >
                            {t('defectRemediation.reminder')}
                          </Button>
                        </>
                      )}
                      {r.status === 'rectified' && (
                        <Tag icon={<CheckCircle2 size={10} />} color="green">
                          {t('defectRemediation.verified')}
                        </Tag>
                      )}
                    </Space>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={<Space><Activity size={14} /> {t('defectRemediation.pdcaLoop')}</Space>}>
            <Timeline
              items={(['plan', 'do', 'check', 'act'] as const).map((s) => {
                const meta = PDCA_META[s];
                return {
                  color: meta.color,
                  dot: meta.icon,
                  children: (
                    <div>
                      <Space>
                        <strong style={{ color: meta.color }}>{meta.label}</strong>
                        <Tag>{byStage[s] ?? 0} {t('defectRemediation.itemsUnit')}</Tag>
                      </Space>
                      <Progress
                        percent={
                          stats.total > 0 ? Math.round(((byStage[s] ?? 0) / stats.total) * 100) : 0
                        }
                        strokeColor={meta.color}
                        size="small"
                      />
                    </div>
                  ),
                };
              })}
            />
            <div style={{ marginTop: 8, padding: 8, background: '#f0fdf4', borderRadius: 4 }}>
              <div style={{ fontSize: 12, color: '#065f46' }}>
                {t('defectRemediation.closureRateLabel')} {stats.closureRate}% · {t('defectRemediation.fixRateLabel')} {stats.fixRate}%
              </div>
              <Progress
                percent={Number(stats.closureRate)}
                strokeColor="#10b981"
                size="small"
                showInfo={false}
              />
            </div>
          </Card>
          <Card size="small" title={t('defectRemediation.defectRateByCategory')} style={{ marginTop: 12 }}>
            <Space orientation="vertical" style={{ width: '100%' }} size={6}>
              {Object.entries(defectRateByCategory)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([cat, v]) => {
                  const rate = v.total > 0 ? (v.fixed / v.total) * 100 : 0;
                  return (
                    <div key={cat}>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Tag color="blue">{cat}</Tag>
                        <span style={{ fontSize: 12 }}>
                          {v.fixed}/{v.total} · {rate.toFixed(0)}%
                        </span>
                      </Space>
                      <Progress
                        percent={rate}
                        size="small"
                        showInfo={false}
                        strokeColor={rate >= 80 ? '#10b981' : rate >= 50 ? 'var(--color-warning-500)' : 'var(--color-error-600)'}
                      />
                    </div>
                  );
                })}
              {Object.keys(defectRateByCategory).length === 0 && (
                <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('defectRemediation.noData')} />
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      <Modal
        title={t('w9e.defectRemediation.submitTitle', { name: editing?.defectName })}
        open={rectifyModal}
        onCancel={() => {
          setRectifyModal(false);
          setNote('');
        }}
        onOk={handleRectify}
        okText={t('defectRemediation.submit')}
        cancelText={t('defectRemediation.cancel')}
        width={560}
      >
        <Space orientation="vertical" style={{ width: '100%' }} size={10}>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12 }}>{t('defectRemediation.reportId')}</div>
            <Input value={editing?.reportId} disabled />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12 }}>{t('defectRemediation.suggestedFix')}</div>
            <Input value={editing?.suggestedFix} disabled />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12 }}>{t('defectRemediation.rectifyNoteRequired')}</div>
            <Input.TextArea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder={t('defectRemediation.notePlaceholder')}
            />
          </div>
        </Space>
      </Modal>

      <Modal
        title={t('w9e.defectRemediation.detailTitle', { code: detailModal?.defectCode })}
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={null}
        width={520}
      >
        {detailModal && (
          <Space orientation="vertical" style={{ width: '100%' }} size={8}>
            <Space wrap>
              <Tag color={SEVERITY_META[detailModal.severity].color}>
                {SEVERITY_META[detailModal.severity].label}
              </Tag>
              <Tag color={STATUS_META[detailModal.status]?.color}>
                {STATUS_META[detailModal.status]?.label}
              </Tag>
              <Tag color="blue">{detailModal.patientName}</Tag>
            </Space>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('defectRemediation.defect')}</div>
              <div style={{ fontSize: 12 }}>{detailModal.defectName}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('defectRemediation.description')}</div>
              <div style={{ fontSize: 12 }}>{detailModal.description}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('defectRemediation.suggestedFix')}</div>
              <div style={{ fontSize: 12, color: 'var(--color-info-600)' }}>{detailModal.suggestedFix}</div>
            </div>
            {detailModal.rectifiedNote && (
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('defectRemediation.rectifyNote')}</div>
                <div
                  style={{
                    fontSize: 12,
                    padding: 6,
                    background: '#f0fdf4',
                    borderRadius: 4,
                    color: '#065f46',
                  }}
                >
                  {detailModal.rectifiedNote}
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <Tag>{t('defectRemediation.reportingDoctorTag')}</Tag> <strong>{detailModal.doctorName}</strong>
              </div>
              <div>
                <Tag>{t('defectRemediation.reportId')}</Tag> <strong>{detailModal.reportId}</strong>
              </div>
              <div>
                <Tag>{t('defectRemediation.created')}</Tag> <strong>{timeAgo(detailModal.reportedAt)}</strong>
              </div>
              <div>
                <Tag>{t('defectRemediation.deadline')}</Tag>{' '}
                <strong>{new Date(detailModal.deadlineAt).toLocaleString()}</strong>
              </div>
              {detailModal.verifiedBy && (
                <div>
                  <Tag>{t('defectRemediation.verifiedBy')}</Tag> <strong>{detailModal.verifiedBy}</strong>
                </div>
              )}
              {detailModal.remindersSent > 0 && (
                <div>
                  <Tag>{t('defectRemediation.reminderCount')}</Tag> <strong>{detailModal.remindersSent}</strong>
                </div>
              )}
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default DefectRemediationTracker;
