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
import { t } from '../../i18n/appI18n';

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
      else setError(mapRes.error?.message ?? t('terminology.mappingLoadFailed'));
      if (sysRes.success && Array.isArray(sysRes.data)) setSystems(sysRes.data);
      if (statsRes.success && statsRes.data) setStats(statsRes.data as TerminologyStats);
    } catch {
      setError(t('terminology.serverLoadFailed'));
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
      else message.warning(res.error?.message ?? t('terminology.searchFailed'));
    } catch {
      message.error(t('terminology.searchServiceUnavailable'));
    } finally {
      setSearching(false);
    }
  }, []);

  const doEncode = useCallback(async () => {
    if (!query.trim()) { message.warning(t('terminology.encodeTextRequired')); return }
    setSearching(true);
    try {
      const res = await snomedApi.encode(query.trim(), 'CBCT');
      if (res.success && Array.isArray(res.data?.codes)) setResults(res.data.codes as SnomedCode[]);
      else message.warning(t('terminology.noConceptMatched'));
    } catch {
      message.error(t('terminology.encodeServiceUnavailable'));
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
      message.success(t('terminology.mappingCreated'));
      setMappingModal(false);
      mappingForm.resetFields();
      void loadMeta();
    } else {
      message.error(res.error?.message ?? t('terminology.createFailed'));
    }
  };

  const handleDeleteMapping = async (id: string) => {
    const res = await terminologyApi.deleteMapping(id);
    if (res.success) { message.success(t('terminology.mappingDeleted')); void loadMeta(); }
    else message.error(res.error?.message ?? t('terminology.deleteFailed'));
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <BookOpen size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('terminology.title')}</span>
        <Tag color="cyan">v3.0.6.11-60</Tag>
        <Tag color="blue">SNOMED-CT</Tag>
        <Tag color="volcano">ICD-11</Tag>
        <Tag color="green">LOINC</Tag>
        <Tag color="purple">RIDICOM</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void loadMeta()} loading={loading}>{t('terminology.refresh')}</Button>
      </Space>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => void loadMeta()}><RefreshCw size={14} /> {t('terminology.retry')}</Button>} />}

      <Spin spinning={loading}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} md={4}><Card size="small"><Statistic title={t('terminology.statTotalConcepts')} value={stats?.totalConcepts?.toLocaleString() ?? '-'} prefix={<Code size={14} />} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title={t('terminology.statMappings')} value={stats?.totalMappings ?? mappings.length} prefix={<Layers size={14} />} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title={t('terminology.statSystems')} value={stats?.systems ?? systems.length} prefix={<Globe size={14} />} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title={t('terminology.statActiveMappings')} value={stats?.activeMappings ?? 0} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title={t('terminology.statOnlineSystems')} value={stats?.onlineSystems ?? 0} styles={{ content: { color: '#2563eb' } }} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title={t('terminology.statResults')} value={results.length} prefix={<Search size={14} />} /></Card></Col>
        </Row>
      </Spin>

      <Card size="small" title={<Space><Search size={14} />{t('terminology.searchCardTitle')}</Space>} style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: '100%', maxWidth: 640, marginBottom: 12 }}>
          <Input.Search
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onSearch={() => void doSearch(query)}
            placeholder={t('terminology.searchPlaceholder')}
            loading={searching}
            enterButton={t('terminology.search')}
          />
        </Space.Compact>
        <Space style={{ marginBottom: 12 }}>
          <Button size="small" icon={<BookMarked size={12} />} loading={searching} onClick={() => void doEncode()}>{t('terminology.encodeSnomed')}</Button>
          <Button size="small" onClick={() => { setResults([]); setQuery('') }}>{t('terminology.clear')}</Button>
        </Space>
        <Table scroll={{ x: 'max-content' }}
          dataSource={resultsPage}
          rowKey="conceptId"
          pagination={resultsPagination}
          size="small"
          locale={{ emptyText: <EmptyState description={t('terminology.searchEmpty')} /> }}
          columns={[
            { title: t('terminology.colConceptId'), dataIndex: 'conceptId', render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
            { title: t('terminology.colPt'), dataIndex: 'pt', width: 220 },
            { title: t('terminology.colFsn'), dataIndex: 'fsn', width: 260, ellipsis: true },
            { title: t('terminology.colSemanticTag'), dataIndex: 'semanticTag', render: (tag: string) => <Tag>{tag}</Tag> },
            { title: t('terminology.colMatchType'), dataIndex: 'matchType', render: (m: string) => <Tag color={m === 'exact' ? 'green' : m === 'partial' ? 'orange' : 'default'}>{m === 'exact' ? t('terminology.matchExact') : m === 'partial' ? t('terminology.matchPartial') : m}</Tag> },
            { title: t('terminology.colConfidence'), dataIndex: 'confidence', render: (c: number) => `${Math.round((c ?? 0) * 100)}%` },
          ]}
        
        />
      </Card>

      {/* [v3.0.6.11-99 W10C] 本地征象词典（离线兜底检索） */}
      {query.trim() && (
        <Card size="small" title={<Space><Stethoscope size={14} />{t('terminology.localDictTitle')}</Space>} style={{ marginBottom: 16 }}>
          {localSigns.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('terminology.localDictEmpty')} />
          ) : (
            <Table
              dataSource={localSigns}
              rowKey="name"
              pagination={false}
              size="small"
              columns={[
                { title: t('terminology.colSign'), dataIndex: 'name', width: 120, render: (v: string) => <Tag color="purple">{v}</Tag> },
                { title: t('terminology.colEnglish'), dataIndex: 'english', width: 200 },
                { title: t('terminology.colDefinition'), dataIndex: 'definition', ellipsis: true },
                { title: t('terminology.colCommonSites'), dataIndex: 'commonSites', width: 130 },
                { title: t('terminology.colSignificance'), dataIndex: 'significance', ellipsis: true },
              ]}
            />
          )}
        </Card>
      )}

      <Row gutter={16}>
        <Col xs={24} md={14}>
          <Card
            size="small"
            title={<Space><Layers size={14} />{t('terminology.crossMapping')}</Space>}
            extra={<Button size="small" type="primary" icon={<Plus size={12} />} onClick={() => setMappingModal(true)}>{t('terminology.createMapping')}</Button>}
          >
            <Table scroll={{ x: 'max-content' }}
              dataSource={mappings}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: t('terminology.colSource'), dataIndex: 'source', render: (s: string, r: TerminologyMapping) => <Tag color="blue">{s} <span style={{ opacity: 0.6 }}>({r.sourceSystem})</span></Tag> },
                { title: t('terminology.colTarget'), dataIndex: 'target', render: (tgt: string, r: TerminologyMapping) => <Tag color="volcano">{tgt} <span style={{ opacity: 0.6 }}>({r.targetSystem})</span></Tag> },
                { title: t('terminology.colMapType'), dataIndex: 'mapType', render: (m: string) => <Tag color={m === 'equivalent' ? 'green' : m === 'broader' ? 'orange' : 'default'}>{m === 'equivalent' ? t('terminology.mapEquivalent') : m === 'broader' ? t('terminology.mapBroader') : m === 'narrower' ? t('terminology.mapNarrower') : m === 'related' ? t('terminology.mapRelated') : m}</Tag> },
                { title: t('terminology.colStatus'), dataIndex: 'status', render: (s: string) => <Badge status={s === 'active' ? 'success' : s === 'draft' ? 'processing' : 'default'} text={s === 'active' ? t('terminology.statusActive') : s === 'draft' ? t('terminology.statusDraft') : s} /> },
                {
                  title: t('terminology.colActions'), width: 60,
                  render: (_: unknown, r: TerminologyMapping) => (
                    <Popconfirm title={t('terminology.confirmDeleteMapping')} onConfirm={() => void handleDeleteMapping(r.id)}>
                      <Button size="small" danger icon={<Trash2 size={12} />} />
                    </Popconfirm>
                  ),
                },
              ]}
           
            />
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card size="small" title={<Space><Globe size={14} />{t('terminology.systemStatus')}</Space>}>
            <Table scroll={{ x: 'max-content' }}
              dataSource={systems}
              rowKey="system"
              pagination={false}
              size="small"
              columns={[
                { title: t('terminology.colSystem'), dataIndex: 'system', render: (s: string) => <Tag color={s === 'SNOMED-CT' ? 'blue' : s === 'ICD-11' ? 'volcano' : s === 'LOINC' ? 'green' : 'purple'}>{s}</Tag> },
                { title: t('terminology.colVersion'), dataIndex: 'version', ellipsis: true },
                { title: t('terminology.colConcepts'), dataIndex: 'concepts', render: (c: number) => c?.toLocaleString() },
                {
                  title: t('terminology.colStatus'), dataIndex: 'status',
                  render: (s: string) => <Badge status={s === 'online' ? 'success' : s === 'degraded' ? 'warning' : 'error'} text={s === 'online' ? t('terminology.systemOnline') : s === 'degraded' ? t('terminology.systemDegraded') : t('terminology.systemOffline')} />,
                },
              ]}
            />
            <div style={{ marginTop: 12 }}>
              <Alert type="warning" showIcon message={t('terminology.syncDelayTitle')} description={t('terminology.syncDelayDesc')} />
            </div>
          </Card>
        </Col>
      </Row>

      <Modal title={t('terminology.mappingModalTitle')} open={mappingModal} onOk={() => void handleCreateMapping()} onCancel={() => setMappingModal(false)} okText={t('terminology.create')}>
        <Form form={mappingForm} layout="vertical">
          <Form.Item name="sourceSystem" label={t('terminology.sourceSystem')} rules={[{ required: true }]}>
            <Input placeholder="SNOMED-CT / LOINC" />
          </Form.Item>
          <Form.Item name="sourceCode" label={t('terminology.sourceCode')} rules={[{ required: true }]}>
            <Input placeholder="如 122750008" />
          </Form.Item>
          <Form.Item name="targetSystem" label={t('terminology.targetSystem')} rules={[{ required: true }]}>
            <Input placeholder="ICD-11 / RIDICOM" />
          </Form.Item>
          <Form.Item name="targetCode" label={t('terminology.targetCode')} rules={[{ required: true }]}>
            <Input placeholder="如 K08.8" />
          </Form.Item>
          <Form.Item name="mapType" label={t('terminology.colMapType')} initialValue="equivalent">
            <Input placeholder={t('terminology.mapTypePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default TerminologyServerPage;
