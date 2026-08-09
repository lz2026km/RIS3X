// [v3.0.6.8-53] 口腔 AI 辅助诊断页面
// [v3.0.6.11-60] Batch 3: dentalApi 检测 + AI 检测记录列表 + 结果卡片
import React, { useCallback, useEffect, useState } from 'react';
import { Card, Space, Tag, Button, Row, Col, Statistic, message, Divider, Alert, Tabs, Empty, Modal, Table, Spin, Progress, Badge, Descriptions } from 'antd';
import { Brain, CheckCircle2, Scan, Eye, RefreshCw, History, Sparkles } from 'lucide-react';
import { dentalApi } from '../../services/api/dentalApi';
import { usePagination } from '../../hooks/usePagination';

interface AiFindingRecord {
  id: string;
  patientName?: string;
  type?: string;
  toothNo?: string;
  finding?: string;
  confidence?: number;
  status?: string;
  createdAt?: string;
}

interface DetectionResult {
  type: string;
  label: string;
  tags: React.ReactNode[];
  summary: string;
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  caries: { label: '龋齿检测', color: 'orange' },
  periapical: { label: '根尖周炎分级', color: 'gold' },
  boneloss: { label: '牙周骨丧失', color: 'lime' },
  rootcanal: { label: '根管检测', color: 'purple' },
  oral: { label: '口腔黏膜筛查', color: 'cyan' },
};

const TYPE_ORDER = ['caries', 'periapical', 'boneloss', 'rootcanal', 'oral'];

export const DentalAIPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('caries');
  const [loading, setLoading] = useState(false);
  const [findings, setFindings] = useState<AiFindingRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Record<string, DetectionResult | null>>({});
  const [detail, setDetail] = useState<AiFindingRecord | null>(null);
  const { pageData: findingPageData, pagination: findingPagination } = usePagination(findings, 8);

  const loadFindings = useCallback(async () => {
    setListLoading(true);
    setError('');
    try {
      const res = await dentalApi.listAiFindings();
      if (res.success && Array.isArray(res.data)) setFindings(res.data);
      else setError(res.error?.message ?? '检测记录加载失败');
    } catch (err) {
      console.error('[DentalAI] loadFindings:', err);
      setError('检测记录加载失败');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFindings();
  }, [loadFindings]);

  const buildResult = (key: string, data: any): DetectionResult => {
    const meta = TYPE_META[key] ?? { label: key, color: 'default' };
    if (key === 'caries') {
      const tags = (data?.detections ?? []).map((d: any, i: number) => (
        <Tag key={i} color="orange">{d.toothNo}-{d.surface} ({(d.confidence * 100).toFixed(0)}%)</Tag>
      ));
      return { type: key, label: meta.label, tags, summary: `检测到 ${tags.length} 处龋损，模型 ${data?.model ?? '-'}` };
    }
    if (key === 'periapical') {
      return {
        type: key, label: meta.label,
        tags: [<Tag key="pi" color="orange">PI: {data?.periapicalIndex}</Tag>, <Tag key="rcp" color="blue">RCP: {data?.rcpScore}</Tag>],
        summary: `根尖周指数 ${data?.periapicalIndex ?? '-'}，置信度 ${((data?.confidence ?? 0) * 100).toFixed(0)}%`,
      };
    }
    if (key === 'boneloss') {
      return {
        type: key, label: meta.label,
        tags: [<Tag key="mx" color="orange">上颌: {data?.boneLoss?.maxilla}%</Tag>, <Tag key="md" color="blue">下颌: {data?.boneLoss?.mandible}%</Tag>],
        summary: `牙周骨丧失评估，置信度 ${((data?.confidence ?? 0) * 100).toFixed(0)}%`,
      };
    }
    if (key === 'rootcanal') {
      const tags = (data?.canals ?? []).map((c: any, i: number) => (
        <Tag key={i} color="purple">{c.toothNo} ({c.canalCount}根管)</Tag>
      ));
      return { type: key, label: meta.label, tags, summary: `检查 ${tags.length} 颗牙根管状态` };
    }
    const tags = (data?.findings ?? []).map((f: any, i: number) => (
      <Tag key={i} color={f.risk === 'moderate' ? 'orange' : f.risk === 'high' ? 'red' : 'green'}>{f.location}: {f.type}</Tag>
    ));
    return { type: key, label: meta.label, tags, summary: `筛查 ${tags.length} 处黏膜区域` };
  };

  const handleInfer = async (key: string) => {
    setActiveTab(key);
    setLoading(true);
    try {
      let res;
      if (key === 'caries') res = await dentalApi.detectCaries({});
      else if (key === 'periapical') res = await dentalApi.gradePeriapical({});
      else if (key === 'boneloss') res = await dentalApi.measureBoneLoss({});
      else if (key === 'rootcanal') res = await dentalApi.detectRootCanal({});
      else res = await dentalApi.screenOralCavity({});
      if (res.success && res.data) {
        setResults((prev) => ({ ...prev, [key]: buildResult(key, res.data) }));
        const finding = await dentalApi.createAiFinding({
          type: key,
          patientName: '当前患者',
          finding: buildResult(key, res.data).summary,
          confidence: 0.85,
          status: 'pending',
        });
        if (finding.success) void loadFindings();
        message.success(`${TYPE_META[key]?.label ?? key} 完成`);
      } else {
        message.error(res.error?.message ?? 'AI 检测失败');
      }
    } catch (e: any) {
      message.error(e?.message ?? 'AI 服务不可用');
    } finally {
      setLoading(false);
    }
  };

  const confirmedCount = findings.filter((f) => f.status === 'confirmed').length;

  // [W3-C] 复核/确认: 接 dentalApi.updateAiFinding (PATCH /dental/ai-findings/:id)
  const updateFindingStatus = async (r: AiFindingRecord, status: 'confirmed' | 'rejected' | 'pending') => {
    try {
      const res = await dentalApi.updateAiFinding(r.id, {
        status,
        reviewedBy: '当前医生',
        note: status === 'confirmed' ? '医生确认 AI 发现' : status === 'rejected' ? '医生驳回 AI 发现' : '提交复核',
      });
      if (res.success) {
        setFindings((prev) => prev.map((f) => f.id === r.id ? { ...f, status } : f));
        message.success(status === 'confirmed' ? '已确认该 AI 发现' : status === 'rejected' ? '已驳回该 AI 发现' : '已提交复核');
        setDetail(null);
      } else {
        message.error(res.error?.message ?? '操作失败');
      }
    } catch (e: any) {
      message.error(e?.message ?? '服务不可用');
    }
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Brain size={20} color="#722ed1" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>口腔 AI 辅助诊断</span>
        <Tag color="cyan">v3.0.6.11-60</Tag>
        <Tag color="magenta">混合推理 (ONNX + API)</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void loadFindings()} loading={listLoading}>刷新记录</Button>
      </Space>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="检测记录" value={findings.length} prefix={<History size={14} />} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="已确认" value={confirmedCount} styles={{ content: { color: '#52c41a' } }} prefix={<CheckCircle2 size={14} />} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="待复核" value={findings.filter((f) => f.status !== 'confirmed').length} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="平均置信度" value={findings.length ? `${Math.round((findings.reduce((s, f) => s + (f.confidence ?? 0), 0) / findings.length) * 100)}%` : '-'} prefix={<Sparkles size={14} />} /></Card></Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'detect', label: 'AI 检测' },
          { key: 'records', label: `检测记录 (${findings.length})` },
        ]}
        style={{ marginBottom: 16 }}
      />

      {activeTab === 'detect' && (
        <Row gutter={16}>
          {TYPE_ORDER.map((key) => {
            const meta = TYPE_META[key] ?? { label: key, color: 'default' };
            const result = results[key];
            return (
              <Col span={8} key={key} style={{ marginBottom: 16 }}>
                <Card
                  size="small"
                  title={<Space><Scan size={12} color={meta.color} />{meta.label}</Space>}
                  extra={<Button size="small" type="primary" loading={loading && activeTab === key} icon={<Scan size={12} />} onClick={() => void handleInfer(key)}>运行</Button>}
                >
                  {result ? (
                    <>
                      <div style={{ marginBottom: 8 }}>{result.tags}</div>
                      <Alert type="success" showIcon message={result.summary} style={{ fontSize: 12 }} />
                    </>
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未运行检测" style={{ margin: '8px 0' }} />
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {activeTab === 'records' && (
        <Card size="small" title={<Space><History size={14} />AI 检测记录</Space>}>
          <Spin spinning={listLoading}>
            <Table
              dataSource={findingPageData}
              rowKey="id"
              pagination={findingPagination}
              columns={[
                { title: 'ID', dataIndex: 'id', render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
                { title: '患者', dataIndex: 'patientName', render: (v?: string) => v ?? '—' },
                { title: '类型', dataIndex: 'type', render: (t: string) => <Tag color={TYPE_META[t]?.color ?? 'default'}>{TYPE_META[t]?.label ?? t}</Tag> },
                { title: '牙位', dataIndex: 'toothNo', render: (v?: string) => v && v !== '-' ? <Tag color="blue">#{v}</Tag> : '—' },
                { title: '发现', dataIndex: 'finding', ellipsis: true },
                {
                  title: '置信度', dataIndex: 'confidence',
                  render: (c: number) => <Progress percent={Math.round((c ?? 0) * 100)} size="small" />,
                },
                { title: '状态', dataIndex: 'status', render: (s: string) => <Badge status={s === 'confirmed' ? 'success' : 'processing'} text={s === 'confirmed' ? '已确认' : '待复核'} /> },
                { title: '时间', dataIndex: 'createdAt', render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? v.replace('T', ' ').slice(0, 19) : '-'}</span> },
                { title: '操作', render: (_, r: AiFindingRecord) => <Button size="small" icon={<Eye size={12} />} onClick={() => setDetail(r)}>查看</Button> },
              ]}
            scroll={{ x: 'max-content' }}
            />
          </Spin>
        </Card>
      )}

      <Modal title={`检测详情 - ${detail?.id ?? ''}`} open={!!detail} onCancel={() => setDetail(null)} footer={null}>
        {detail && (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="类型"><Tag color={TYPE_META[detail.type ?? '']?.color ?? 'default'}>{TYPE_META[detail.type ?? '']?.label ?? detail.type}</Tag></Descriptions.Item>
              <Descriptions.Item label="患者">{detail.patientName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="牙位">{detail.toothNo && detail.toothNo !== '-' ? `#${detail.toothNo}` : '—'}</Descriptions.Item>
              <Descriptions.Item label="置信度">{(detail.confidence ?? 0) * 100}%</Descriptions.Item>
              <Descriptions.Item label="发现" span={2}>{detail.finding ?? '—'}</Descriptions.Item>
            </Descriptions>
            <Divider style={{ margin: '12px 0' }} />
            <Space>
              <Button type="primary" size="small" onClick={() => void updateFindingStatus(detail, 'confirmed')}>确认</Button>
              <Button size="small" onClick={() => void updateFindingStatus(detail, 'pending')}>复核</Button>
              <Button size="small" danger onClick={() => void updateFindingStatus(detail, 'rejected')}>驳回</Button>
            </Space>
          </>
        )}
      </Modal>
    </div>
  );
};
export default DentalAIPage;
