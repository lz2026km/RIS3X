import React, { useState } from 'react';
import {
  Table, Card, Button, Modal, Input, Select, Tag, Tabs, message, Descriptions, Space, Badge, Empty,
} from 'antd';
import {
  Cpu, Plus, Play, Square, Trash2, Eye, GitBranch, CheckCircle, XCircle,
  Clock, Activity, Zap, TrendingUp,
} from 'lucide-react';

interface Pipeline {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'deploying' | 'failed';
  models: string[];
  accuracy: number;
  uptime: number;
  createdAt: string;
  chain: string[];
}

const mockPipelines: Pipeline[] = [
  { id: 'PL-001', name: '肺结节检测流水线', status: 'running', models: ['LungNet v2.3', 'NoduleClassifier v1.1'], accuracy: 94.7, uptime: 99.8, createdAt: '2026-05-01', chain: ['图像预处理', '肺部分割', '结节检测', '良恶性分类', '报告生成'] },
  { id: 'PL-002', name: '骨折AI辅助诊断', status: 'running', models: ['FractureDetect v3.0', 'BoneSegment v2.0'], accuracy: 92.3, uptime: 99.5, createdAt: '2026-04-28', chain: ['DR图像增强', '骨骼分割', '骨折检测', '定位标注'] },
  { id: 'PL-003', name: '冠脉CTA分析', status: 'stopped', models: ['CoronarySeg v1.8', 'StenosisGrade v2.1'], accuracy: 89.6, uptime: 97.2, createdAt: '2026-04-20', chain: ['冠脉提取', '血管追踪', '狭窄检测', '钙化评分'] },
  { id: 'PL-004', name: '乳腺钼靶AI筛查', status: 'deploying', models: ['MammoDetect v4.0', 'BI-RADS Classifier v3.2'], accuracy: 91.2, uptime: 0, createdAt: '2026-05-03', chain: ['钼靶预处理', '病灶检测', 'BI-RADS分级', '风险评估'] },
  { id: 'PL-005', name: '脑卒中急诊评估', status: 'failed', models: ['StrokeASPECT v1.5', 'CTPerfusion v2.0'], accuracy: 85.4, uptime: 88.3, createdAt: '2026-04-15', chain: ['NCCT分析', 'CTA血管评估', 'CBF/CBV计算', 'ASPECTS评分'] },
];

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  running: { color: 'success', icon: <Activity size={14} />, label: '运行中' },
  stopped: { color: 'default', icon: <Square size={14} />, label: '已停止' },
  deploying: { color: 'processing', icon: <Zap size={14} />, label: '部署中' },
  failed: { color: 'error', icon: <XCircle size={14} />, label: '失败' },
};

export default function AIOrchestrationPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>(mockPipelines);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerPipeline, setDrawerPipeline] = useState<Pipeline | null>(null);
  const [formName, setFormName] = useState('');
  const [formModels, setFormModels] = useState<string[]>([]);

  const handleCreate = () => {
    if (!formName.trim()) { message.warning('请输入流水线名称'); return; }
    const newPipeline: Pipeline = {
      id: `PL-${String(pipelines.length + 1).padStart(3, '0')}`,
      name: formName,
      status: 'stopped',
      models: formModels.length ? formModels : ['默认模型'],
      accuracy: 0,
      uptime: 0,
      createdAt: new Date().toISOString().split('T')[0],
      chain: ['输入', '预处理', '推理', '后处理'],
    };
    setPipelines([newPipeline, ...pipelines]);
    message.success(`流水线 ${formName} 创建成功`);
    setModalOpen(false);
    setFormName('');
    setFormModels([]);
  };

  const handleDeploy = (id: string) => {
    setPipelines(prev => prev.map(p => p.id === id ? { ...p, status: 'deploying' as const } : p));
    message.loading({ content: '部署中...', key: id });
    setTimeout(() => {
      setPipelines(prev => prev.map(p => p.id === id ? { ...p, status: 'running' as const, uptime: 99.9 } : p));
      message.success({ content: '部署成功', key: id });
    }, 2000);
  };

  const handleStop = (id: string) => {
    setPipelines(prev => prev.map(p => p.id === id ? { ...p, status: 'stopped' as const } : p));
    message.success('流水线已停止');
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除该流水线吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setPipelines(prev => prev.filter(p => p.id !== id));
        message.success('流水线已删除');
      },
    });
  };

  const columns = [
    {
      title: '流水线名称', dataIndex: 'name', key: 'name',
      render: (_: string, r: Pipeline) => (
        <Space>
          <Cpu size={16} style={{ color: '#8b5cf6' }} />
          <a onClick={() => setDrawerPipeline(r)} style={{ fontWeight: 600 }}>{r.name}</a>
        </Space>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => {
        const cfg = statusConfig[s];
        return <Tag icon={cfg.icon} color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '关联模型', dataIndex: 'models', key: 'models',
      render: (models: string[]) => (
        <Space size={4} wrap>
          {models.map(m => <Tag key={m} style={{ fontSize: 11 }}>{m}</Tag>)}
        </Space>
      ),
    },
    {
      title: '准确率', dataIndex: 'accuracy', key: 'accuracy',
      render: (v: number) => v > 0 ? <span style={{ color: v >= 90 ? '#52c41a' : '#faad14', fontWeight: 600 }}>{v}%</span> : <span style={{ color: '#999' }}>--</span>,
    },
    {
      title: '运行时间', dataIndex: 'uptime', key: 'uptime',
      render: (v: number) => v > 0 ? <span style={{ color: '#1890ff' }}>{v}%</span> : <span style={{ color: '#999' }}>--</span>,
    },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt',
    },
    {
      title: '操作', key: 'action',
      render: (_: unknown, r: Pipeline) => (
        <Space>
          {r.status === 'stopped' && (
            <Button type="link" size="small" icon={<Play size={14} />} onClick={() => handleDeploy(r.id)}>部署</Button>
          )}
          {r.status === 'running' && (
            <Button type="link" size="small" icon={<Square size={14} />} onClick={() => handleStop(r.id)}>停止</Button>
          )}
          {r.status === 'deploying' && <Tag color="processing">部署中...</Tag>}
          <Button type="link" size="small" danger icon={<Trash2 size={14} />} onClick={() => handleDelete(r.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <Card variant="borderless" style={{ borderRadius: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>AI 流水线编排</h2>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>管理和部署AI推理流水线</span>
            </div>
          </Space>
          <Badge count={pipelines.length} style={{ backgroundColor: '#8b5cf6' }} />
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)} style={{ background: '#8b5cf6', borderColor: '#8b5cf6' }}>
            新建流水线
          </Button>
        </div>
        <Table
          dataSource={pipelines}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
          locale={{ emptyText: <Empty description="暂无流水线，点击上方按钮创建" /> }}
        />
      </Card>

      <Modal
        title={<Space><Plus size={16} /> 新建流水线</Space>}
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => { setModalOpen(false); setFormName(''); setFormModels([]); }}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>流水线名称</div>
            <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="输入流水线名称" />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>选择模型</div>
            <Select
              mode="multiple"
              value={formModels}
              onChange={setFormModels}
              placeholder="选择关联AI模型"
              style={{ width: '100%' }}
              options={[
                { label: 'LungNet v2.3', value: 'LungNet v2.3' },
                { label: 'NoduleClassifier v1.1', value: 'NoduleClassifier v1.1' },
                { label: 'FractureDetect v3.0', value: 'FractureDetect v3.0' },
                { label: 'CoronarySeg v1.8', value: 'CoronarySeg v1.8' },
                { label: 'MammoDetect v4.0', value: 'MammoDetect v4.0' },
              ]}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title={<Space><GitBranch size={16} /> 流水线详情 - {drawerPipeline?.name}</Space>}
        open={!!drawerPipeline}
        onCancel={() => setDrawerPipeline(null)}
        footer={<Button onClick={() => setDrawerPipeline(null)}>关闭</Button>}
        width={600}
      >
        {drawerPipeline && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="ID">{drawerPipeline.id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag icon={statusConfig[drawerPipeline.status].icon} color={statusConfig[drawerPipeline.status].color}>
                  {statusConfig[drawerPipeline.status].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="准确率">{drawerPipeline.accuracy > 0 ? `${drawerPipeline.accuracy}%` : '--'}</Descriptions.Item>
              <Descriptions.Item label="运行时间">{drawerPipeline.uptime > 0 ? `${drawerPipeline.uptime}%` : '--'}</Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>{drawerPipeline.createdAt}</Descriptions.Item>
            </Descriptions>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>模型调用链</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                {drawerPipeline.chain.map((step, i) => (
                  <React.Fragment key={step}>
                    <Tag color="purple" style={{ padding: '4px 12px', margin: 0 }}>{step}</Tag>
                    {i < drawerPipeline.chain.length - 1 && <TrendingUp size={14} color="#8b5cf6" />}
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>关联模型</div>
              <Space wrap>
                {drawerPipeline.models.map(m => <Tag key={m} color="geekblue">{m}</Tag>)}
              </Space>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
