// [v3.0.6.8-73] 术语服务器/数据字典
// [v3.0.6.11-60] Batch 3: snomedApi 概念检索 + terminologyApi 映射/系统状态
import { snomedApi, type SnomedCode } from '../../services/api/snomedApi';
import { terminologyApi, type TerminologyMapping, type TerminologySystemStatus, type TerminologyStats } from '../../services/api/terminologyApi';
import { usePagination } from '../../hooks/usePagination';
import { Card, Space, Tag, Table, Button, Row, Col, Statistic, Input, Badge, Alert, Spin, Popconfirm, Modal, Form, message, Empty } from 'antd';
import { EmptyState } from '../../components/common/EmptyState';
import { BookOpen, Search, Globe, Code, Layers, BookMarked, RefreshCw, Plus, Trash2, Stethoscope } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
// [v3.0.6.11-99 W10C] 本地征象词典（离线兜底检索）: radiologyTerminology.ts
import { searchSigns } from '../../data/radiologyTerminology';

export const TerminologyServerPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SnomedCode[]>([]);
  const [mappings, setMappings] = useState<TerminologyMapping[]>([]);
  const [systems, setSystems] = useState<TerminologySystemStatus[]>([]);
  const [stats, setStats] = useState<TerminologyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mappingModal, setMappingModal] = useState(false);
  const [mappingForm] = Form.useForm();
  // [v3.0.6.11-99 W10C] 本地征象词典检索（离线，不依赖后端）
  const localSigns = useMemo(() => searchSigns(query).slice(0, 8), [query]);
  // [v3.0.6.11-92] 概念检索结果受控分页
  const { pageData: resultsPage, pagination: resultsPagination } = usePagination(results, 10);

  const loadMeta = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mapRes, sysRes, statsRes] = await Promise.all([
        terminologyApi.listMappings(),
        terminologyApi.listSystems(),
        terminologyApi.getStats(),
      ]);
      if (mapRes.success && Array.isArray(mapRes.data)) setMappings(mapRes.data);
      else setError(mapRes.error?.message ?? '映射加载失败');
      if (sysRes.success && Array.isArray(sysRes.data)) setSystems(sysRes.data);
      if (statsRes.success && statsRes.data) setStats(statsRes.data as TerminologyStats);
    } catch {
      setError('术语服务器数据加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true);
    try {
      const res = await snomedApi.search(q.trim());
      if (res.success && Array.isArray(res.data)) setResults(res.data as SnomedCode[]);
      else message.warning(res.error?.message ?? '检索失败');
    } catch {
      message.error('检索服务不可用');
    } finally {
      setSearching(false);
    }
  }, []);

  const doEncode = useCallback(async () => {
    if (!query.trim()) { message.warning('请输入待编码文本'); return }
    setSearching(true);
    try {
      const res = await snomedApi.encode(query.trim(), 'CBCT');
      if (res.success && Array.isArray(res.data?.codes)) setResults(res.data.codes as SnomedCode[]);
      else message.warning('未匹配到概念');
    } catch {
      message.error('编码服务不可用');
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleCreateMapping = async () => {
    const values = await mappingForm.validateFields();
    const res = await terminologyApi.createMapping({
      source: `${values.sourceSystem}:${values.sourceCode}`,
      sourceSystem: values.sourceSystem,
      target: `${values.targetSystem}:${values.targetCode}`,
      targetSystem: values.targetSystem,
      mapType: values.mapType ?? 'equivalent',
      status: 'active',
    });
    if (res.success) {
      message.success('映射已创建');
      setMappingModal(false);
      mappingForm.resetFields();
      void loadMeta();
    } else {
      message.error(res.error?.message ?? '创建失败');
    }
  };

  const handleDeleteMapping = async (id: string) => {
    const res = await terminologyApi.deleteMapping(id);
    if (res.success) { message.success('映射已删除'); void loadMeta(); }
    else message.error(res.error?.message ?? '删除失败');
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <BookOpen size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>术语服务器</span>
        <Tag color="cyan">v3.0.6.11-60</Tag>
        <Tag color="blue">SNOMED-CT</Tag>
        <Tag color="volcano">ICD-11</Tag>
        <Tag color="green">LOINC</Tag>
        <Tag color="purple">RIDICOM</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void loadMeta()} loading={loading}>刷新</Button>
      </Space>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => void loadMeta()}><RefreshCw size={14} /> 重试</Button>} />}

      <Spin spinning={loading}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} md={4}><Card size="small"><Statistic title="概念总数" value={stats?.totalConcepts?.toLocaleString() ?? '-'} prefix={<Code size={14} />} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="映射数" value={stats?.totalMappings ?? mappings.length} prefix={<Layers size={14} />} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="系统数" value={stats?.systems ?? systems.length} prefix={<Globe size={14} />} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="活跃映射" value={stats?.activeMappings ?? 0} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="在线系统" value={stats?.onlineSystems ?? 0} styles={{ content: { color: '#2563eb' } }} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="检索结果" value={results.length} prefix={<Search size={14} />} /></Card></Col>
        </Row>
      </Spin>

      <Card size="small" title={<Space><Search size={14} />概念检索 / 编码</Space>} style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: '100%', maxWidth: 640, marginBottom: 12 }}>
          <Input.Search
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onSearch={() => void doSearch(query)}
            placeholder="输入代码、术语或概念 ID 搜索..."
            loading={searching}
            enterButton="搜索"
          />
        </Space.Compact>
        <Space style={{ marginBottom: 12 }}>
          <Button size="small" icon={<BookMarked size={12} />} loading={searching} onClick={() => void doEncode()}>编码 (SNOMED)</Button>
          <Button size="small" onClick={() => { setResults([]); setQuery('') }}>清空</Button>
        </Space>
        <Table scroll={{ x: 'max-content' }}
          dataSource={resultsPage}
          rowKey="conceptId"
          pagination={resultsPagination}
          size="small"
          locale={{ emptyText: <EmptyState description="输入关键词检索 SNOMED-CT 概念" /> }}
          columns={[
            { title: '概念 ID', dataIndex: 'conceptId', render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
            { title: '首选术语 (PT)', dataIndex: 'pt', width: 220 },
            { title: '全称 (FSN)', dataIndex: 'fsn', width: 260, ellipsis: true },
            { title: '语义标签', dataIndex: 'semanticTag', render: (t: string) => <Tag>{t}</Tag> },
            { title: '匹配方式', dataIndex: 'matchType', render: (m: string) => <Tag color={m === 'exact' ? 'green' : m === 'partial' ? 'orange' : 'default'}>{m === 'exact' ? '精确' : m === 'partial' ? '部分' : m}</Tag> },
            { title: '置信度', dataIndex: 'confidence', render: (c: number) => `${Math.round((c ?? 0) * 100)}%` },
          ]}
        
        />
      </Card>

      {/* [v3.0.6.11-99 W10C] 本地征象词典（离线兜底检索） */}
      {query.trim() && (
        <Card size="small" title={<Space><Stethoscope size={14} />本地征象词典（离线）</Space>} style={{ marginBottom: 16 }}>
          {localSigns.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本地词典无匹配项，可继续检索 SNOMED-CT" />
          ) : (
            <Table
              dataSource={localSigns}
              rowKey="name"
              pagination={false}
              size="small"
              columns={[
                { title: '征象', dataIndex: 'name', width: 120, render: (v: string) => <Tag color="purple">{v}</Tag> },
                { title: '英文', dataIndex: 'english', width: 200 },
                { title: '定义', dataIndex: 'definition', ellipsis: true },
                { title: '常见部位', dataIndex: 'commonSites', width: 130 },
                { title: '意义', dataIndex: 'significance', ellipsis: true },
              ]}
            />
          )}
        </Card>
      )}

      <Row gutter={16}>
        <Col xs={24} md={14}>
          <Card
            size="small"
            title={<Space><Layers size={14} />跨系统映射</Space>}
            extra={<Button size="small" type="primary" icon={<Plus size={12} />} onClick={() => setMappingModal(true)}>新建映射</Button>}
          >
            <Table scroll={{ x: 'max-content' }}
              dataSource={mappings}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: '来源', dataIndex: 'source', render: (s: string, r: TerminologyMapping) => <Tag color="blue">{s} <span style={{ opacity: 0.6 }}>({r.sourceSystem})</span></Tag> },
                { title: '目标', dataIndex: 'target', render: (t: string, r: TerminologyMapping) => <Tag color="volcano">{t} <span style={{ opacity: 0.6 }}>({r.targetSystem})</span></Tag> },
                { title: '映射类型', dataIndex: 'mapType', render: (m: string) => <Tag color={m === 'equivalent' ? 'green' : m === 'broader' ? 'orange' : 'default'}>{m === 'equivalent' ? '等价' : m === 'broader' ? '更宽' : m === 'narrower' ? '更窄' : m === 'related' ? '相关' : m}</Tag> },
                { title: '状态', dataIndex: 'status', render: (s: string) => <Badge status={s === 'active' ? 'success' : s === 'draft' ? 'processing' : 'default'} text={s === 'active' ? '启用' : s === 'draft' ? '草稿' : s} /> },
                {
                  title: '操作', width: 60,
                  render: (_: unknown, r: TerminologyMapping) => (
                    <Popconfirm title="确认删除该映射？" onConfirm={() => void handleDeleteMapping(r.id)}>
                      <Button size="small" danger icon={<Trash2 size={12} />} />
                    </Popconfirm>
                  ),
                },
              ]}
           
            />
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card size="small" title={<Space><Globe size={14} />系统状态</Space>}>
            <Table scroll={{ x: 'max-content' }}
              dataSource={systems}
              rowKey="system"
              pagination={false}
              size="small"
              columns={[
                { title: '系统', dataIndex: 'system', render: (s: string) => <Tag color={s === 'SNOMED-CT' ? 'blue' : s === 'ICD-11' ? 'volcano' : s === 'LOINC' ? 'green' : 'purple'}>{s}</Tag> },
                { title: '版本', dataIndex: 'version', ellipsis: true },
                { title: '概念数', dataIndex: 'concepts', render: (c: number) => c?.toLocaleString() },
                {
                  title: '状态', dataIndex: 'status',
                  render: (s: string) => <Badge status={s === 'online' ? 'success' : s === 'degraded' ? 'warning' : 'error'} text={s === 'online' ? '在线' : s === 'degraded' ? '降级' : '离线'} />,
                },
              ]}
            />
            <div style={{ marginTop: 12 }}>
              <Alert type="warning" showIcon message="RIDICOM 同步延迟" description="最近同步：2026-07-28，建议检查数据源连接。" />
            </div>
          </Card>
        </Col>
      </Row>

      <Modal title="新建跨系统映射" open={mappingModal} onOk={() => void handleCreateMapping()} onCancel={() => setMappingModal(false)} okText="创建">
        <Form form={mappingForm} layout="vertical">
          <Form.Item name="sourceSystem" label="来源系统" rules={[{ required: true }]}>
            <Input placeholder="SNOMED-CT / LOINC" />
          </Form.Item>
          <Form.Item name="sourceCode" label="来源代码" rules={[{ required: true }]}>
            <Input placeholder="如 122750008" />
          </Form.Item>
          <Form.Item name="targetSystem" label="目标系统" rules={[{ required: true }]}>
            <Input placeholder="ICD-11 / RIDICOM" />
          </Form.Item>
          <Form.Item name="targetCode" label="目标代码" rules={[{ required: true }]}>
            <Input placeholder="如 K08.8" />
          </Form.Item>
          <Form.Item name="mapType" label="映射类型" initialValue="equivalent">
            <Input placeholder="等价 / 更宽 / 更窄 / 相关" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default TerminologyServerPage;
