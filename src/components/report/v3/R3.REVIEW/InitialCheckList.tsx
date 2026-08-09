/**
 * G005 RIS v3.0.5.1 - R3.REVIEW.001 InitialCheckList 初核清单
 */
import { reviewService } from '../../../../services/review/reviewService';
import type { ReviewTask, ReviewStage, ReviewFilter } from '../../../types/R3/R3.REVIEW';
import { List, Tag, Space, Button, Empty, Input, Select, Statistic, Row, Col, Tooltip, message } from 'antd';
import { Eye, AlertTriangle, Search, FileText, Filter, Clock, User, AlertCircle, ListChecks, Sparkles, ChevronRight } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Inbox } from 'lucide-react'

const STAGE_META: Record<ReviewStage, { color: string; label: string; bg: string }> = {
  initial: { color: '#f59e0b', label: '初审', bg: '#fef3c7' },
  final: { color: '#7c2d12', label: '终审', bg: '#fed7aa' },
  cosign: { color: '#7c3aed', label: '双签', bg: '#ede9fe' },
  sign: { color: '#be185d', label: '签发', bg: '#fce7f3' },
};

const STATUS_META: Record<string, { color: string; label: string; bg: string }> = {
  pending: { color: '#f59e0b', label: '待审', bg: '#fef3c7' },
  'in-progress': { color: '#0891b2', label: '审核中', bg: '#cffafe' },
  completed: { color: '#10b981', label: '已完成', bg: '#d1fae5' },
  rejected: { color: '#dc2626', label: '已驳回', bg: '#fee2e2' },
  overdue: { color: '#7f1d1d', label: '已超时', bg: '#fecaca' },
  escalated: { color: '#7c3aed', label: '已升级', bg: '#ede9fe' },
  'cosign-required': { color: '#7c3aed', label: '需双签', bg: '#ede9fe' },
};

const PRIORITY_META: Record<string, { color: string; label: string; rank: number }> = {
  stat: { color: 'red', label: '急诊', rank: 0 },
  critical: { color: 'volcano', label: '危急', rank: 0 },
  urgent: { color: 'orange', label: '加急', rank: 1 },
  routine: { color: 'default', label: '常规', rank: 2 },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

function deadlineInfo(
  _deadline: string,
  isOverdue: boolean,
  hoursToDeadline: number,
): { label: string; color: string } {
  if (isOverdue) return { label: `超时 ${Math.abs(hoursToDeadline)}h`, color: '#dc2626' };
  if (hoursToDeadline < 2) return { label: `${hoursToDeadline}h 内`, color: '#f59e0b' };
  return { label: `${hoursToDeadline}h 后`, color: '#64748b' };
}

export interface InitialCheckListProps {
  onSelect?: (t: ReviewTask) => void;
  selectedId?: string | null;
  limit?: number;
}

export const InitialCheckList: React.FC<InitialCheckListProps> = ({
  onSelect,
  selectedId,
  limit = 200,
}) => {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReviewFilter>({ stage: 'initial' });
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await reviewService.listTasks({ ...filter, search });
      const sorted = data.sort(
        (a, b) =>
          PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank ||
          a.hoursToDeadline - b.hoursToDeadline,
      );
      setTasks(sorted.slice(0, limit));
    } catch (e) {
      message.error('加载初核清单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.stage, filter.status, filter.priority]);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      inProgress: tasks.filter((t) => t.status === 'in-progress').length,
      overdue: tasks.filter((t) => t.isOverdue).length,
      critical: tasks.filter((t) => t.criticalFinding).length,
    };
  }, [tasks]);

  return (
    <div data-testid="initial-check-list" role="region" aria-label="初核清单">
      <div
        style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <ListChecks size={18} />
            <strong style={{ fontSize: 16 }}>初核清单</strong>
            <Tag color="purple" style={{ marginLeft: 8 }}>
              R3.REVIEW.001
            </Tag>
          </Space>
          <Space>
            <Input
              size="small"
              prefix={<Search size={12} />}
              placeholder="搜索患者/报告ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={load}
              style={{ width: 200 }}
              aria-label="搜索初核任务"
            />
            <Button size="small" onClick={load}>
              刷新
            </Button>
          </Space>
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={5}>
            <Statistic
              title={<span style={{ color: '#fff' }}>总数</span>}
              value={stats.total}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<FileText size={14} />}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title={<span style={{ color: '#fff' }}>待审</span>}
              value={stats.pending}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Clock size={14} />}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title={<span style={{ color: '#fff' }}>审核中</span>}
              value={stats.inProgress}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Eye size={14} />}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title={<span style={{ color: '#fff' }}>超时</span>}
              value={stats.overdue}
              styles={{ content: {  color: '#fca5a5', fontSize: 18  } }}
              prefix={<AlertCircle size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>危急</span>}
              value={stats.critical}
              styles={{ content: {  color: '#fca5a5', fontSize: 18  } }}
              prefix={<AlertTriangle size={14} />}
            />
          </Col>
        </Row>
      </div>

      <div
        style={{
          background: '#fff',
          padding: '8px 12px',
          borderRadius: 6,
          marginBottom: 8,
          border: '1px solid #e2e8f0',
        }}
      >
        <Space wrap>
          <Filter size={14} color="#64748b" />
          <Select
            size="small"
            value={filter.status || 'all'}
            onChange={(v) => setFilter({ ...filter, status: v })}
            style={{ width: 110 }}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'pending', label: '待审' },
              { value: 'in-progress', label: '审核中' },
              { value: 'overdue', label: '超时' },
              { value: 'rejected', label: '驳回' },
            ]}
            aria-label="状态筛选"
          />
          <Select
            size="small"
            value={filter.priority || 'all'}
            onChange={(v) => setFilter({ ...filter, priority: v })}
            style={{ width: 110 }}
            options={[
              { value: 'all', label: '全部优先' },
              { value: 'stat', label: '急诊' },
              { value: 'critical', label: '危急' },
              { value: 'urgent', label: '加急' },
              { value: 'routine', label: '常规' },
            ]}
            aria-label="优先级筛选"
          />
          <span style={{ color: '#94a3b8', fontSize: 12 }}>显示 {tasks.length} 条</span>
        </Space>
      </div>

      <List
        loading={loading}
        dataSource={tasks}
        locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="无初核任务" /> }}
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 4,
          maxHeight: 600,
          overflowY: 'auto',
        }}
        renderItem={(t) => {
          const stageConf = STAGE_META[t.stage];
          const statusConf = STATUS_META[t.status] ?? STATUS_META.pending;
          const priConf = PRIORITY_META[t.priority] ?? PRIORITY_META.routine;
          const dl = deadlineInfo(t.deadline, t.isOverdue, t.hoursToDeadline);
          return (
            <List.Item
              key={t.id}
              onClick={() => onSelect?.(t)}
              style={{
                cursor: 'pointer',
                padding: '10px 12px',
                borderRadius: 6,
                background:
                  t.id === selectedId ? '#eff6ff' : t.isOverdue ? '#fef2f2' : 'transparent',
                borderLeft:
                  t.id === selectedId
                    ? '3px solid #3b82f6'
                    : t.isOverdue
                      ? '3px solid #dc2626'
                      : '3px solid transparent',
                marginBottom: 4,
                transition: 'all 0.15s',
              }}
              data-testid={`initial-check-item-${t.id}`}
              role="button"
              aria-label={`初核任务 ${t.patientName} ${t.modality} ${t.bodyPart}`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSelect?.(t);
              }}
            >
              <List.Item.Meta
                avatar={
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      background: t.criticalFinding ? '#fee2e2' : stageConf.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {t.criticalFinding ? (
                      <AlertTriangle size={18} color="#dc2626" />
                    ) : (
                      <FileText size={18} color={stageConf.color} />
                    )}
                  </div>
                }
                title={
                  <Space wrap>
                    <span style={{ fontWeight: 600 }}>{t.patientName}</span>
                    <Tag color="blue">{t.modality}</Tag>
                    <Tag>{t.bodyPart}</Tag>
                    <Tag color={priConf.color}>{priConf.label}</Tag>
                    <Tag color={statusConf.color}>{statusConf.label}</Tag>
                    {t.criticalFinding && (
                      <Tag color="red" icon={<AlertTriangle size={10} />}>
                        危急
                      </Tag>
                    )}
                    {t.needsCosign && (
                      <Tag color="purple" icon={<Sparkles size={10} />}>
                        需双签
                      </Tag>
                    )}
                    {t.rectifyCount > 0 && <Tag color="orange">整改 {t.rectifyCount}/3</Tag>}
                  </Space>
                }
                description={
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      <User size={10} /> 报告医生：{t.authorTitle} {t.authorName} · 质量评分{' '}
                      <strong
                        style={{
                          color:
                            t.qualityScore >= 90 ? '#10b981' : t.qualityScore >= 75 ? '#f59e0b' : '#dc2626',
                        }}
                      >
                        {t.qualityScore}
                      </strong>{' '}
                      · 提交 {timeAgo(t.submittedAt)}
                    </div>
                    <div
                      style={{ fontSize: 12, color: dl.color, marginTop: 2, fontWeight: 600 }}
                    >
                      <Clock size={10} /> {dl.label} · 报告ID: {t.reportId}
                    </div>
                  </div>
                }
              />
              <Tooltip title="查看详情">
                <Button
                  type="text"
                  size="small"
                  icon={<ChevronRight size={14} />}
                  aria-label="查看详情"
                />
              </Tooltip>
            </List.Item>
          );
        }}
      />
    </div>
  );
};

export default InitialCheckList;
