import { useState, useMemo } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Filter, Calendar, Search, X, ShieldAlert } from 'lucide-react';
import { Table, Tabs, Tag, Button, Select, DatePicker, Space, message, Card, Badge } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

interface AlertItem {
  id: string;
  severity: string;
  patientName: string;
  type: string;
  message: string;
  time: string;
  status: string;
}

const MOCK_ALERTS: AlertItem[] = [
  { id: 'a1', severity: 'HIGH', patientName: '张三', type: '危急值', message: '血钾 6.8mmol/L 危急', time: '2026-07-08 09:15', status: 'active' },
  { id: 'a2', severity: 'HIGH', patientName: '李四', type: '药物交互', message: '二甲双胍与造影剂存在相互作用风险', time: '2026-07-08 08:50', status: 'active' },
  { id: 'a3', severity: 'MEDIUM', patientName: '王五', type: '剂量预警', message: 'CT辐射累积剂量接近阈值', time: '2026-07-08 08:30', status: 'active' },
  { id: 'a4', severity: 'LOW', patientName: '赵六', type: '适宜性', message: '头痛患者建议首选CT而非MRI', time: '2026-07-08 08:00', status: 'acknowledged' },
  { id: 'a5', severity: 'HIGH', patientName: '孙七', type: '过敏预警', message: '患者碘造影剂过敏史', time: '2026-07-07 16:45', status: 'active' },
  { id: 'a6', severity: 'MEDIUM', patientName: '周八', type: '临床路径', message: '肺结节路径步骤超期', time: '2026-07-07 14:20', status: 'active' },
  { id: 'a7', severity: 'LOW', patientName: '吴九', type: '知识库', message: '指南更新: 肺结节管理指南v2.1', time: '2026-07-07 10:00', status: 'dismissed' },
  { id: 'a8', severity: 'HIGH', patientName: '郑十', type: '危急值', message: 'PT>100s 出血风险', time: '2026-07-07 09:30', status: 'active' },
];

const SEVERITY_TABS = [
  { key: 'ALL', label: '全部' },
  { key: 'HIGH', label: '高危', color: '#ef4444' },
  { key: 'MEDIUM', label: '中危', color: '#f59e0b' },
  { key: 'LOW', label: '低危', color: '#3b82f6' },
];

const ALERT_TYPES = ['全部', '危急值', '药物交互', '剂量预警', '过敏预警', '适宜性', '临床路径', '知识库'];

const SEVERITY_COLORS: Record<string, string> = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#3b82f6' };
const SEVERITY_LABELS: Record<string, string> = { HIGH: '高危', MEDIUM: '中危', LOW: '低危' };

export default function AlertCenterPage() {
  const [tab, setTab] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('全部');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [searchText, setSearchText] = useState('');
  const [alerts, setAlerts] = useState(MOCK_ALERTS);

  const filtered = useMemo(() => {
    let items = alerts;
    if (tab !== 'ALL') items = items.filter(a => a.severity === tab);
    if (typeFilter !== '全部') items = items.filter(a => a.type === typeFilter);
    if (dateRange?.[0] && dateRange?.[1]) {
      const start = dateRange[0].format('YYYY-MM-DD');
      const end = dateRange[1].format('YYYY-MM-DD');
      items = items.filter(a => a.time >= start && a.time <= end + ' 23:59');
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      items = items.filter(a => a.patientName.toLowerCase().includes(q) || a.message.toLowerCase().includes(q) || a.type.toLowerCase().includes(q));
    }
    return items;
  }, [tab, typeFilter, dateRange, searchText, alerts]);

  const handleAcknowledge = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' } : a));
    message.success('已确认告警');
  };

  const handleDismiss = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'dismissed' } : a));
    message.success('已忽略告警');
  };

  const columns: ColumnsType<AlertItem> = [
    {
      title: '严重程度', dataIndex: 'severity', key: 'severity', width: 90,
      render: (s: string) => <Tag color={SEVERITY_COLORS[s]} icon={<AlertTriangle size={12} />}>{SEVERITY_LABELS[s]}</Tag>,
    },
    { title: '患者', dataIndex: 'patientName', key: 'patientName', width: 100 },
    { title: '告警类型', dataIndex: 'type', key: 'type', width: 110 },
    { title: '消息', dataIndex: 'message', key: 'message', ellipsis: true },
    { title: '时间', dataIndex: 'time', key: 'time', width: 160 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => {
        const map: Record<string, { color: string; label: string }> = {
          active: { color: 'red', label: '待处理' },
          acknowledged: { color: 'orange', label: '已确认' },
          dismissed: { color: 'default', label: '已忽略' },
        };
        return <Tag color={map[s]?.color}>{map[s]?.label}</Tag>;
      },
    },
    {
      title: '操作', key: 'action', width: 160,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'active' && (
            <Button size="small" type="primary" icon={<CheckCircle2 size={12} />} onClick={() => handleAcknowledge(record.id)}>确认</Button>
          )}
          {record.status !== 'dismissed' && (
            <Button size="small" icon={<X size={12} />} onClick={() => handleDismiss(record.id)}>忽略</Button>
          )}
        </Space>
      ),
    },
  ];

  const counts = useMemo(() => ({
    HIGH: alerts.filter(a => a.severity === 'HIGH' && a.status === 'active').length,
    MEDIUM: alerts.filter(a => a.severity === 'MEDIUM' && a.status === 'active').length,
    LOW: alerts.filter(a => a.severity === 'LOW' && a.status === 'active').length,
    ALL: alerts.filter(a => a.status === 'active').length,
  }), [alerts]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontSize: 14 }}>
      <header style={{ background: 'linear-gradient(135deg,#dc2626 0%,#ef4444 100%)', color: '#fff', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Bell size={20} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>告警中心</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>CDS 实时告警 · 分级处理 · 闭环管理</div>
        </div>
      </header>
      <div style={{ padding: 16 }}>
        <Card bordered={false} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <Tabs
              activeKey={tab}
              onChange={setTab}
              style={{ marginBottom: 0 }}
              items={SEVERITY_TABS.map(t => ({
                key: t.key,
                label: <Badge count={counts[t.key]} size="small" offset={[6, -4]}><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{t.key !== 'ALL' && <ShieldAlert size={14} style={{ color: t.color }} />}{t.label}</span></Badge>,
              }))}
            />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Select value={typeFilter} onChange={setTypeFilter} style={{ width: 130 }} options={ALERT_TYPES.map(t => ({ value: t, label: t }))} />
              <DatePicker.RangePicker
                onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
                style={{ width: 240 }}
              />
              <Input placeholder="搜索患者/消息..." prefix={<Search size={14} />} value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: 200 }} allowClear />
            </div>
          </div>
          <Table columns={columns} dataSource={filtered} rowKey="id" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条告警` }} size="middle" />
        </Card>
      </div>
    </div>
  );
}
