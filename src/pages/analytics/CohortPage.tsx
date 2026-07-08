import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, Modal, Select, Input, Tag, Space, Statistic, Row, Col, message, Empty, Descriptions, Badge, Typography,
} from 'antd';
import {
  Users, Plus, Trash2, Play, Search, Clock, BarChart3, Layers, GitBranch,
} from 'lucide-react';

interface Condition {
  id: string;
  field: string;
  operator: string;
  value: string;
  group: string;
}

interface Cohort {
  id: string;
  name: string;
  conditionCount: number;
  size: number;
  createdAt: string;
  lastRun: string;
  status: 'ready' | 'running' | 'completed' | 'failed';
}

const fieldOptions = [
  { label: '检查部位', value: 'bodyPart' },
  { label: '设备类型', value: 'deviceType' },
  { label: '性别', value: 'gender' },
  { label: '年龄', value: 'age' },
  { label: '诊断编码', value: 'diagnosisCode' },
  { label: '检查日期', value: 'examDate' },
  { label: '报告医生', value: 'reportDoctor' },
  { label: '质控结果', value: 'qcResult' },
];

const operatorOptions = [
  { label: '等于', value: 'eq' },
  { label: '不等于', value: 'ne' },
  { label: '包含', value: 'contains' },
  { label: '大于', value: 'gt' },
  { label: '小于', value: 'lt' },
  { label: '介于', value: 'between' },
  { label: '为空', value: 'isNull' },
  { label: '不为空', value: 'isNotNull' },
];

const mockCohorts: Cohort[] = [
  { id: 'C-001', name: '肺结节阳性患者', conditionCount: 4, size: 1280, createdAt: '2026-04-01', lastRun: '2026-05-03', status: 'completed' },
  { id: 'C-002', name: '急诊脑卒中待确认', conditionCount: 3, size: 345, createdAt: '2026-04-10', lastRun: '2026-05-02', status: 'completed' },
  { id: 'C-003', name: '乳腺BI-RADS 4类以上', conditionCount: 5, size: 567, createdAt: '2026-04-15', lastRun: '2026-04-30', status: 'completed' },
  { id: 'C-004', name: 'CT复查患者(3个月内)', conditionCount: 3, size: 2340, createdAt: '2026-04-20', lastRun: '2026-05-01', status: 'completed' },
  { id: 'C-005', name: '儿童骨折急诊队列', conditionCount: 4, size: 189, createdAt: '2026-04-25', lastRun: '2026-04-28', status: 'failed' },
  { id: 'C-006', name: '冠脉CTA阳性+糖尿病', conditionCount: 6, size: 423, createdAt: '2026-05-01', lastRun: '2026-05-03', status: 'running' },
];

const statusConfig: Record<string, { color: string; label: string }> = {
  ready: { color: 'default', label: '就绪' },
  running: { color: 'processing', label: '运行中' },
  completed: { color: 'success', label: '已完成' },
  failed: { color: 'error', label: '失败' },
};

let condCounter = 3;

export default function CohortPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>(mockCohorts);
  const [conditions, setConditions] = useState<Condition[]>([
    { id: 'c1', field: 'bodyPart', operator: 'eq', value: '胸部', group: 'A' },
    { id: 'c2', field: 'diagnosisCode', operator: 'contains', value: 'C78.0', group: 'A' },
    { id: 'c3', field: 'age', operator: 'gt', value: '50', group: 'B' },
  ]);
  const [groupId, setGroupId] = useState<'AND' | 'OR'>('AND');
  const [cohortName, setCohortName] = useState('');
  const [resultOpen, setResultOpen] = useState(false);
  const [resultData, setResultData] = useState<{ cohort: Cohort; count: number; summary: string } | null>(null);

  const addCondition = (group: string) => {
    condCounter++;
    setConditions(prev => [...prev, { id: `c${condCounter}`, field: 'bodyPart', operator: 'eq', value: '', group }]);
  };

  const removeCondition = (id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id));
  };

  const updateCondition = (id: string, key: keyof Condition, value: string) => {
    setConditions(prev => prev.map(c => c.id === id ? { ...c, [key]: value } : c));
  };

  const groupA = conditions.filter(c => c.group === 'A');
  const groupB = conditions.filter(c => c.group === 'B');

  const groupLogic = groupA.length > 0 && groupB.length > 0 ? groupId : null;

  const handleRunAnalysis = () => {
    if (!cohortName.trim()) { message.warning('请输入队列名称'); return; }
    const newCohort: Cohort = {
      id: `C-${String(cohorts.length + 1).padStart(3, '0')}`,
      name: cohortName,
      conditionCount: conditions.length,
      size: Math.floor(Math.random() * 3000) + 100,
      createdAt: new Date().toISOString().split('T')[0],
      lastRun: new Date().toISOString().split('T')[0],
      status: 'completed',
    };
    setCohorts(prev => [newCohort, ...prev]);
    setResultData({
      cohort: newCohort,
      count: newCohort.size,
      summary: `根据 ${conditions.length} 个条件，共匹配 ${newCohort.size} 条记录。其中A组 ${groupA.length} 个条件匹配 ${Math.floor(newCohort.size * 0.7)} 条${groupB.length ? `，B组 ${groupB.length} 个条件匹配 ${Math.floor(newCohort.size * 0.4)} 条` : ''}。`,
    });
    setResultOpen(true);
    message.success(`队列分析完成，共 ${newCohort.size} 条记录`);
    setCohortName('');
  };

  const columns = [
    {
      title: '队列名称', dataIndex: 'name', key: 'name',
      render: (n: string, r: Cohort) => (
        <Space>
          <Layers size={16} style={{ color: '#7c3aed' }} />
          <a onClick={() => { setResultData({ cohort: r, count: r.size, summary: `${r.name} 共 ${r.size} 条记录，基于 ${r.conditionCount} 个筛选条件` }); setResultOpen(true); }} style={{ fontWeight: 600 }}>{n}</a>
        </Space>
      ),
    },
    { title: '条件数', dataIndex: 'conditionCount', key: 'conditionCount', width: 80 },
    { title: '队列规模', dataIndex: 'size', key: 'size', render: (s: number) => s.toLocaleString(), width: 100 },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 110 },
    { title: '上次运行', dataIndex: 'lastRun', key: 'lastRun', width: 110 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => <Tag color={statusConfig[s]?.color}>{statusConfig[s]?.label || s}</Tag>,
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>患者队列分析</h2>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>构建和筛查患者队列</span>
          </div>
        </Space>
        <Badge count={cohorts.length} style={{ backgroundColor: '#7c3aed' }} />
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card
            title={<Space><GitBranch size={16} /> 队列构建器</Space>}
            bordered={false}
            style={{ borderRadius: 12 }}
            extra={
              <Input
                placeholder="队列名称"
                value={cohortName}
                onChange={e => setCohortName(e.target.value)}
                style={{ width: 160 }}
                prefix={<Search size={14} />}
              />
            }
          >
            {groupA.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {groupB.length > 0 && <div style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', marginBottom: 6 }}>A组条件</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {groupA.map(c => (
                    <Space key={c.id} style={{ display: 'flex' }}>
                      <Select value={c.field} onChange={v => updateCondition(c.id, 'field', v)} style={{ width: 120 }} size="small" options={fieldOptions} />
                      <Select value={c.operator} onChange={v => updateCondition(c.id, 'operator', v)} style={{ width: 100 }} size="small" options={operatorOptions} />
                      <Input value={c.value} onChange={e => updateCondition(c.id, 'value', e.target.value)} placeholder="值" size="small" style={{ width: 120 }} />
                      <Button type="text" size="small" danger icon={<Trash2 size={14} />} onClick={() => removeCondition(c.id)} />
                    </Space>
                  ))}
                </div>
                <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={() => addCondition('A')} style={{ marginTop: 6, width: '100%' }}>
                  添加条件
                </Button>
              </div>
            )}

            {groupA.length > 0 && groupB.length > 0 && (
              <div style={{ textAlign: 'center', margin: '8px 0' }}>
                <Select value={groupId} onChange={setGroupId} style={{ width: 80 }} size="small" options={[{ label: 'AND', value: 'AND' }, { label: 'OR', value: 'OR' }]} />
              </div>
            )}

            {groupB.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', marginBottom: 6 }}>B组条件</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {groupB.map(c => (
                    <Space key={c.id} style={{ display: 'flex' }}>
                      <Select value={c.field} onChange={v => updateCondition(c.id, 'field', v)} style={{ width: 120 }} size="small" options={fieldOptions} />
                      <Select value={c.operator} onChange={v => updateCondition(c.id, 'operator', v)} style={{ width: 100 }} size="small" options={operatorOptions} />
                      <Input value={c.value} onChange={e => updateCondition(c.id, 'value', e.target.value)} placeholder="值" size="small" style={{ width: 120 }} />
                      <Button type="text" size="small" danger icon={<Trash2 size={14} />} onClick={() => removeCondition(c.id)} />
                    </Space>
                  ))}
                </div>
                <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={() => addCondition('B')} style={{ marginTop: 6, width: '100%' }}>
                  添加条件
                </Button>
              </div>
            )}

            {groupA.length === 0 && groupB.length === 0 && (
              <div style={{ textAlign: 'center', padding: 16 }}>
                <Button type="dashed" icon={<Plus size={14} />} onClick={() => addCondition('A')}>添加第一个条件</Button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button type="primary" icon={<Play size={14} />} onClick={handleRunAnalysis} style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
                运行分析
              </Button>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title={<Space><BarChart3 size={16} /> 队列列表</Space>}
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            <Table
              dataSource={cohorts}
              columns={columns}
              rowKey="id"
              pagination={{ pageSize: 8, showTotal: t => `共 ${t} 个队列` }}
              size="small"
              locale={{ emptyText: <Empty description="暂无队列" /> }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={<Space><BarChart3 size={16} /> 分析结果 - {resultData?.cohort.name}</Space>}
        open={resultOpen}
        onCancel={() => setResultOpen(false)}
        footer={<Button onClick={() => setResultOpen(false)}>关闭</Button>}
        width={600}
      >
        {resultData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Card size="small"><Statistic title="匹配记录" value={resultData.count} suffix="条" valueStyle={{ color: '#7c3aed' }} /></Card>
              </Col>
              <Col span={8}>
                <Card size="small"><Statistic title="筛选条件" value={conditions.length} suffix="个" /></Card>
              </Col>
              <Col span={8}>
                <Card size="small"><Statistic title="分组逻辑" value={groupLogic || '单一'} /></Card>
              </Col>
            </Row>
            <Card size="small" title="结果摘要">
              <Typography.Paragraph>{resultData.summary}</Typography.Paragraph>
            </Card>
            <Descriptions column={1} bordered size="small" title="条件明细">
              {conditions.map((c, i) => (
                <Descriptions.Item key={c.id} label={`条件${i + 1} (${c.group}组)`}>
                  {fieldOptions.find(f => f.value === c.field)?.label || c.field} {operatorOptions.find(o => o.value === c.operator)?.label || c.operator} {c.value}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
}
