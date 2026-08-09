// [v3.0.6.11-54] Phase 2: 审计合规中心 (真实审计事件 + 筛选 + 详情抽屉)
import React, { useCallback, useEffect, useState } from 'react';
import {
  Card, Space, Tag, Table, Button, Row, Col, Statistic, Badge, Drawer,
  Form, Select, Input, message, Descriptions, Alert, Spin, Typography,
} from 'antd';
import {
  Shield, FileSearch, UserCheck, AlertTriangle, Download, Filter,
} from 'lucide-react';
import { auditApi, type AuditEventDto, type AuditAggregationDto } from '../../services/api/auditApi';

const ACTION_COLOR: Record<string, string> = {
  CREATE: 'green', UPDATE: 'blue', DELETE: 'red', LOGIN: 'cyan', LOGOUT: 'cyan',
  EXPORT: 'orange', VIEW: 'default',
};

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: 'success', FAILURE: 'error', DENIED: 'warning',
};

export const AuditCompliancePage: React.FC = () => {
  const [events, setEvents] = useState<AuditEventDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agg, setAgg] = useState<AuditAggregationDto | null>(null);
  const [detail, setDetail] = useState<AuditEventDto | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<{ user?: string; action?: string; status?: string; search?: string }>({});
  const [form] = Form.useForm();

  const load = useCallback(async (p = 1, ps = pageSize, f = filters) => {
    setLoading(true);
    setError('');
    try {
      const [listRes, aggRes] = await Promise.allSettled([
        auditApi.list({ page: p, pageSize: ps, userId: f.user, action: f.action, status: f.status, search: f.search }),
        auditApi.getAggregation(),
      ]);
      if (listRes.status === 'fulfilled' && listRes.value.success) {
        const data = listRes.value.data as { items: AuditEventDto[]; total: number };
        setEvents(data.items ?? []);
        setTotal(data.total ?? 0);
      } else {
        setEvents([]);
        if (listRes.status === 'fulfilled') setError(listRes.value.error?.message ?? '');
      }
      if (aggRes.status === 'fulfilled' && aggRes.value.success) setAgg(aggRes.value.data);
    } catch (e) {
      setError((e as Error)?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, [pageSize, filters]);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const onSearch = () => {
    const v = form.getFieldsValue();
    setFilters({
      user: v.user,
      action: v.action,
      status: v.status,
      search: v.search,
    });
    setPage(1);
  };

  const onReset = () => {
    form.resetFields();
    setFilters({});
    setPage(1);
  };

  const topActions = Object.entries(agg?.byAction ?? {}).slice(0, 3);
  const topUsers = (agg?.byUser ?? []).slice(0, 3);

  const columns = [
    { title: '编号', dataIndex: 'id', width: 110 },
    { title: '用户', key: 'user', width: 130, render: (_: unknown, r: AuditEventDto) =>
      <Space size={4}><UserCheck size={11} color="#2563eb" />{r.username ?? r.userId}</Space> },
    { title: '操作', dataIndex: 'action', width: 120, render: (a: string) =>
      <Tag color={ACTION_COLOR[a] ?? 'default'}>{a}</Tag> },
    { title: '资源', key: 'resource', render: (_: unknown, r: AuditEventDto) =>
      <span style={{ fontSize: 12 }}>{r.resource}{r.resourceId ? ` (${r.resourceId})` : ''}</span> },
    { title: 'IP 地址', dataIndex: 'ip', width: 130 },
    { title: '时间', dataIndex: 'createdAt', width: 170, render: (v: string) =>
      v ? new Date(v).toLocaleString() : '-' },
    { title: '结果', dataIndex: 'status', width: 110, render: (s: string) =>
      <Badge status={(STATUS_COLOR[s] ?? 'default') as any} text={s ?? '-'} /> },
    { title: '操作', key: 'action2', width: 80, render: (_: unknown, r: AuditEventDto) =>
      <Button size="small" onClick={() => setDetail(r)}>详情</Button> },
  ];

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Shield size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>审计与合规中心</span>
        <Tag color="red" icon={<AlertTriangle size={10} />}>HIPAA</Tag>
        <Tag color="orange">三甲等级</Tag>
      </Space>

      {error && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message={error}
          action={<Button size="small" onClick={() => void load(page)}>重试</Button>} />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="事件总数" value={agg?.total ?? total} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="近 24 小时" value={agg?.last24h ?? '-'} styles={{ content: { color: '#2563eb' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="已拒绝" value={agg?.byAction?.['DENIED'] ?? (events.filter(e => e.status === 'DENIED').length)} styles={{ content: { color: '#ff4d4f' } }} /></Card></Col>
        <Col span={6}><Card size="small" title="高频操作">
          {topActions.length === 0 ? <span style={{ fontSize: 12, color: '#999' }}>暂无</span> :
            <Space wrap>{topActions.map(([k, v]) => <Tag key={k}>{k} {v}</Tag>)}</Space>}
        </Card></Col>
        <Col span={6}><Card size="small" title="活跃用户">
          {topUsers.length === 0 ? <span style={{ fontSize: 12, color: '#999' }}>暂无</span> :
            <Space wrap>{topUsers.map(u => <Tag key={u.userId} color="blue">{u.userId} ({u.count})</Tag>)}</Space>}
        </Card></Col>
      </Row>

      <Card
        size="small"
        title={<Space><FileSearch size={14} />审计轨迹</Space>}
        extra={<Button icon={<Download size={12} />} loading={exporting} onClick={async () => {
          setExporting(true);
          try {
            const blob = await auditApi.export({ userId: filters.user, action: filters.action, status: filters.status, search: filters.search });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `审计轨迹_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            message.success('审计轨迹已导出');
          } catch (e) {
            message.error((e as Error)?.message ?? '导出失败');
          } finally {
            setExporting(false);
          }
        }}>导出</Button>}
      >
        <Form form={form} layout="inline" size="small" style={{ marginBottom: 12 }}>
          <Form.Item name="user" label="用户"><Input placeholder="用户 ID" allowClear /></Form.Item>
          <Form.Item name="action" label="操作">
            <Select allowClear placeholder="全部" style={{ width: 120 }}
              options={['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'VIEW'].map(a => ({ value: a, label: a }))} />
          </Form.Item>
          <Form.Item name="status" label="结果">
            <Select allowClear placeholder="全部" style={{ width: 110 }}
              options={['SUCCESS', 'FAILURE', 'DENIED'].map(s => ({ value: s, label: s }))} />
          </Form.Item>
          <Form.Item name="search" label="关键词"><Input placeholder="资源/详情搜索" allowClear /></Form.Item>
          <Form.Item><Button type="primary" icon={<Filter size={12} />} onClick={onSearch}>筛选</Button></Form.Item>
          <Form.Item><Button onClick={onReset}>重置</Button></Form.Item>
        </Form>
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            size="small"
            dataSource={events}
            columns={columns}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            }}
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>

      <Drawer
        title={<Space><Shield size={14} />审计事件详情</Space>}
        open={detail != null}
        onClose={() => setDetail(null)}
        size={520}
      >
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="事件编号">{detail.id}</Descriptions.Item>
            <Descriptions.Item label="用户">{detail.username ?? detail.userId} ({detail.userRole ?? '未知角色'})</Descriptions.Item>
            <Descriptions.Item label="操作">
              <Tag color={ACTION_COLOR[detail.action] ?? 'default'}>{detail.action}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="资源">
              <Typography.Text style={{ fontSize: 12, wordBreak: 'break-all' }}>{detail.resource}</Typography.Text>
            </Descriptions.Item>
            {detail.resourceId && <Descriptions.Item label="资源 ID">{detail.resourceId}</Descriptions.Item>}
            <Descriptions.Item label="结果"><Badge status={(STATUS_COLOR[detail.status] ?? 'default') as any} text={detail.status} /></Descriptions.Item>
            <Descriptions.Item label="IP / User-Agent">
              {detail.ip ?? '-'}<br /><span style={{ fontSize: 11, color: '#999' }}>{detail.userAgent ?? ''}</span>
            </Descriptions.Item>
            <Descriptions.Item label="时间">{new Date(detail.createdAt).toLocaleString()}</Descriptions.Item>
            {detail.details && <Descriptions.Item label="详情">{detail.details}</Descriptions.Item>}
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};
export default AuditCompliancePage;
