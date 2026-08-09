// [v3.0.6.8-76] 多模态AI融合工作台
// [v3.0.6.11-60] Batch 3: 增强 - loading/error + 融合研究列表 + AI 洞察卡片 + 操作
import { usePagination } from '../../hooks/usePagination';
import { aiFusionWorkspaceApi, type FusionStudy, type AiInsight } from '../../services/api/aiFusionWorkspaceApi';
import { fusionApi } from '../../services/api/fusionApi';
import { Card, Space, Tag, Table, Button, Row, Col, Statistic, Badge, Progress, List, Tooltip, Segmented, message, Spin, Empty, Alert, Modal, Descriptions, Timeline } from 'antd';
import { Brain, Eye, Activity, Layers, BarChart3, Crosshair, FileText, Image, Share2, Download, Sparkles, RefreshCw, PlayCircle, CheckCircle2, Clock } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

function downloadBlob(content: string, filename: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob(['\uFEFF' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function studiesToCSV(rows: FusionStudy[]): string {
  const header = ['患者', '设备', '融合评分', '发现数', 'AI告警', '状态', '日期'];
  const lines = rows.map((s) => [
    s.patient, s.modalities, Math.round(s.fusionScore * 100), s.findings, s.aiAlerts, s.status, s.date,
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  return [header.join(','), ...lines].join('\n');
}

const INSIGHT_COLORS: Record<string, string> = {
  lesion: 'red', vessel: 'blue', measurement: 'green', classification: 'orange',
};

export const AiFusionWorkspacePage: React.FC = () => {
  const [modality, setModality] = useState('cbct');
  const [studies, setStudies] = useState<FusionStudy[]>([]);
  const [aiInsights, setAiInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [detail, setDetail] = useState<FusionStudy | null>(null);
  const { pageData: studyPageData, pagination: studyPagination } = usePagination(studies, 8);
  // [W3-C] 切换图层: 真实状态切换 (叠加层显示/隐藏 + 图层模式轮换)
  const [layerVisible, setLayerVisible] = useState(true);
  const [layerMode, setLayerMode] = useState<'融合' | '差值' | '棋盘格'>('融合');

  const toggleLayer = () => {
    setLayerMode((m) => (m === '融合' ? '差值' : m === '差值' ? '棋盘格' : '融合'));
    setLayerVisible(true);
    message.success(`画布模式: ${modality} · 图层模式切换为「${layerMode === '融合' ? '差值' : layerMode === '差值' ? '棋盘格' : '融合'}」`);
  };

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [studiesRes, insightsRes] = await Promise.all([
        aiFusionWorkspaceApi.getStudies(),
        aiFusionWorkspaceApi.getInsights(),
      ])
      if (studiesRes.success && Array.isArray(studiesRes.data)) setStudies(studiesRes.data)
      else setError(studiesRes.error?.message ?? '融合研究加载失败')
      if (insightsRes.success && Array.isArray(insightsRes.data)) setAiInsights(insightsRes.data)
    } catch (err) {
      console.error('[AiFusion] fetchData failed:', err)
      setError('融合工作台数据加载失败')
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleRunFusion = async (study?: FusionStudy) => {
    setRunning(true)
    try {
      const res = await aiFusionWorkspaceApi.runFusion(study?.id)
      if (res.success && res.data) {
        setStudies((prev) => [res.data as FusionStudy, ...prev])
        message.success('融合任务完成，已生成新研究')
      } else {
        message.error(res.error?.message ?? '融合失败')
      }
    } catch {
      message.error('融合服务不可用')
    } finally {
      setRunning(false)
    }
  }

  const handleRegister = async (study: FusionStudy) => {
    const fixed = study.modalities.split(' + ')[0] ?? 'CBCT'
    const moving = study.modalities.split(' + ')[1] ?? 'OPG'
    const res = await fusionApi.register({ fixedSeriesUid: fixed, movingSeriesUid: moving, transformType: 'rigid' })
    if (res.success) message.success(`配准完成 (Dice ${res.data?.metrics?.dice ?? '-'})`)
    else message.error(res.error?.message ?? '配准失败')
  }

  const actionableInsights = aiInsights.filter((i) => i.actionable).length
  const avgScore = studies.length > 0 ? Math.round((studies.reduce((a, s) => a + s.fusionScore, 0) / studies.length) * 100) : 0

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Brain size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>多模态 AI 融合工作台</span>
        <Tag color="cyan">v3.0.6.11-60</Tag>
        <Tag color="purple">晚期融合</Tag>
        <Tag color="volcano">Cross-Attention</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void fetchData()} loading={loading}>刷新</Button>
        <Button type="primary" size="small" icon={<PlayCircle size={12} />} loading={running} onClick={() => void handleRunFusion()}>运行融合</Button>
        {loading && <Spin size="small" />}
      </Space>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => void fetchData()}><RefreshCw size={14} /> 重试</Button>} />}

      <Spin spinning={initialLoading}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} md={4}><Card size="small"><Statistic title="融合研究" value={studies.length} prefix={<Layers size={14} />} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="AI 洞察" value={aiInsights.length} prefix={<Sparkles size={14} />} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="可操作告警" value={actionableInsights} styles={{ content: { color: '#ff4d4f' } }} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="平均融合评分" value={studies.length > 0 ? avgScore : '0'} suffix="%" /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="待处理研究" value={studies.filter((s) => s.status === 'pending').length} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        </Row>
      </Spin>

      <Segmented
        value={modality}
        onChange={setModality as never}
        options={[
          { value: 'cbct', label: ' CBCT' }, { value: 'oct', label: ' OCT' }, { value: 'fundus', label: ' Fundus' },
          { value: 'fusion', label: ' 融合叠加' },
        ]}
        style={{ marginBottom: 16 }}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card
            size="small"
            title={<Space><Crosshair size={14} />融合画布</Space>}
            extra={<Space><Button size="small" icon={<Image size={12} />} onClick={toggleLayer}>切换图层</Button><Tag color={layerVisible ? 'green' : 'default'}>{layerMode}{layerVisible ? ' · 显示' : ' · 隐藏'}</Tag></Space>}
            style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff', flexDirection: 'column', gap: 8 }}
            styles={{ body: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 } }}
          >
            <Activity size={36} color="#2563eb" />
            <span style={{ opacity: 0.8, fontSize: 13 }}>[ 多模态融合画布区域 · {modality.toUpperCase()} ]</span>
            <span style={{ opacity: 0.5, fontSize: 12 }}>CBCT + OPG + 口扫 多模态融合渲染</span>
            {layerVisible && (
              <span style={{ padding: '3px 12px', background: 'rgba(255,255,255,0.15)', borderRadius: 12, fontSize: 12 }}>
                叠加图层: {layerMode} 模式
              </span>
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={<Space><BarChart3 size={14} />AI 洞察</Space>} extra={<Tag color="purple">{aiInsights.length} 条</Tag>} style={{ height: 320 }} styles={{ body: { height: 'calc(100% - 38px)', overflow: 'auto' } }}>
            {aiInsights.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 AI 洞察" />
            ) : (
              <List
                dataSource={aiInsights}
                renderItem={(item: AiInsight) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <Tooltip title={`${item.source}: ${(item.confidence * 100).toFixed(0)}%`}>
                      <Space align="start">
                        <Tag color={INSIGHT_COLORS[item.type] ?? 'orange'}>{item.type}</Tag>
                        <div>
                          <div style={{ fontSize: 12 }}>{item.finding}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.modality} · {(item.confidence * 100).toFixed(0)}%</div>
                        </div>
                        {item.actionable && <Badge status="error" />}
                      </Space>
                    </Tooltip>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={<Space><FileText size={14} />融合研究</Space>}
        extra={<Space><Button size="small" icon={<Share2 size={12} />} onClick={() => { if (studies.length === 0) { message.warning('暂无融合研究可导出'); return } downloadBlob(studiesToCSV(studies), `融合报告_${new Date().toISOString().slice(0, 10)}.csv`); message.success(`已导出 ${studies.length} 条融合研究记录`) }}>导出融合报告</Button></Space>}
      >
        <Table
          dataSource={studyPageData}
          rowKey="id"
          pagination={studyPagination}
          columns={[
            { title: '患者', dataIndex: 'patient' },
            { title: '设备', dataIndex: 'modalities' },
            {
              title: '融合评分', dataIndex: 'fusionScore',
              render: (s: number) => <Progress percent={Math.round(s * 100)} size="small" strokeColor={s > 0.9 ? '#52c41a' : s > 0.8 ? '#faad14' : '#ff4d4f'} />,
            },
            { title: '所见', dataIndex: 'findings', render: (v: number) => <Tag>{v} 项</Tag> },
            { title: 'AI 告警', dataIndex: 'aiAlerts', render: (a: number) => <Badge count={a} size="small" /> },
            {
              title: '状态', dataIndex: 'status',
              render: (s: string) => <Badge status={s === 'complete' ? 'success' : 'processing'} text={s === 'complete' ? '已完成' : '处理中'} />,
            },
            { title: '日期', dataIndex: 'date' },
            {
              title: '操作',
              render: (_: unknown, r: FusionStudy) => (
                <Space>
                  <Button size="small" icon={<Eye size={10} />} onClick={() => setDetail(r)}>查看</Button>
                  <Button size="small" icon={<Crosshair size={10} />} loading={running} onClick={() => void handleRegister(r)}>配准</Button>
                  <Button size="small" icon={<Download size={10} />} onClick={() => downloadBlob(studiesToCSV([r]), `融合研究_${r.patient}_${r.id}.csv`)}>下载</Button>
                </Space>
              ),
            },
          ]}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={`融合研究详情 - ${detail?.patient ?? ''}`}
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={<Button type="primary" onClick={() => void handleRunFusion(detail ?? undefined)} icon={<PlayCircle size={12} />}>重新融合</Button>}
        width={520}
      >
        {detail && (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="患者">{detail.patient}</Descriptions.Item>
              <Descriptions.Item label="设备">{detail.modalities}</Descriptions.Item>
              <Descriptions.Item label="融合评分"><Progress percent={Math.round(detail.fusionScore * 100)} size="small" /></Descriptions.Item>
              <Descriptions.Item label="AI 告警"><Badge count={detail.aiAlerts} /></Descriptions.Item>
              <Descriptions.Item label="发现数">{detail.findings}</Descriptions.Item>
              <Descriptions.Item label="日期">{detail.date}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 8 }}>处理时间线</h4>
              <Timeline
                items={[
                  { children: <><CheckCircle2 size={12} color="#52c41a" /> 影像预处理完成</>, color: 'green' },
                  { children: <><CheckCircle2 size={12} color="#52c41a" /> 多模态配准完成 (Rigid)</>, color: 'green' },
                  detail.status === 'complete'
                    ? { children: <><CheckCircle2 size={12} color="#52c41a" /> AI 融合分析完成</>, color: 'green' }
                    : { children: <><Clock size={12} /> AI 融合分析进行中</>, color: 'blue' },
                ]}
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};
export default AiFusionWorkspacePage;
