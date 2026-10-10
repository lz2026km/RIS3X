// [v3.0.6.8-76] 多模态AI融合工作台
// [v3.0.6.11-60] Batch 3: 增强 - loading/error + 融合研究列表 + AI 洞察卡片 + 操作
import { usePagination } from '../../hooks/usePagination';
import { aiFusionWorkspaceApi, type FusionStudy, type AiInsight } from '../../services/api/aiFusionWorkspaceApi';
import { fusionApi } from '../../services/api/fusionApi';
import {
  Card,
  Space,
  Tag,
  Button,
  Row,
  Col,
  Badge,
  Progress,
  List,
  Tooltip,
  Segmented,
  message,
  Spin,
  Empty,
  Alert,
  Modal,
  Descriptions,
  Timeline,
} from "antd";
import { Brain, Eye, Activity, Layers, BarChart3, Crosshair, FileText, Image, Share2, Download, Sparkles, RefreshCw, PlayCircle, CheckCircle2, Clock } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { t } from '../../i18n/appI18n';
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";

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
  const header = [t('w9d.aiFusion.csvPatient'), t('w9d.aiFusion.csvModality'), t('w9d.aiFusion.csvScore'), t('w9d.aiFusion.csvFindings'), t('w9d.aiFusion.csvAlerts'), t('w9d.aiFusion.csvStatus'), t('w9d.aiFusion.csvDate')];
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
    message.success(t('w9d.aiFusion.layerModeSwitched', { modality, mode: layerMode === '融合' ? t('w9d.aiFusion.modeFusion') : layerMode === '差值' ? t('w9d.aiFusion.modeDiff') : t('w9d.aiFusion.modeCheckerboard') }));
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
      else setError(studiesRes.error?.message ?? t('aiFusion.errLoadStudies'))
      if (insightsRes.success && Array.isArray(insightsRes.data)) setAiInsights(insightsRes.data)
    } catch (err) {
      console.error('[AiFusion] fetchData failed:', err)
      setError(t('aiFusion.errLoadData'))
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
        message.success(t('aiFusion.fusionDone'))
      } else {
        message.error(res.error?.message ?? t('aiFusion.errFusion'))
      }
    } catch {
      message.error(t('aiFusion.errService'))
    } finally {
      setRunning(false)
    }
  }

  const handleRegister = async (study: FusionStudy) => {
    const fixed = study.modalities.split(' + ')[0] ?? 'CBCT'
    const moving = study.modalities.split(' + ')[1] ?? 'OPG'
    const res = await fusionApi.register({ fixedSeriesUid: fixed, movingSeriesUid: moving, transformType: 'rigid' })
    if (res.success) message.success(t('w9d.aiFusion.registered', { dice: res.data?.metrics?.dice ?? '-' }))
    else message.error(res.error?.message ?? t('aiFusion.errRegister'))
  }

  const actionableInsights = aiInsights.filter((i) => i.actionable).length
  const avgScore = studies.length > 0 ? Math.round((studies.reduce((a, s) => a + s.fusionScore, 0) / studies.length) * 100) : 0

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Brain size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('aiFusion.title')}</span>
        <Tag color="cyan">v3.0.6.11-60</Tag>
        <Tag color="purple">{t('aiFusion.tagLateFusion')}</Tag>
        <Tag color="volcano">Cross-Attention</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void fetchData()} loading={loading}>{t('aiFusion.refresh')}</Button>
        <Button type="primary" size="small" icon={<PlayCircle size={12} />} loading={running} onClick={() => void handleRunFusion()}>{t('aiFusion.runFusion')}</Button>
        {loading && <Spin size="small" />}
      </Space>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => void fetchData()}><RefreshCw size={14} /> {t('aiFusion.retry')}</Button>} />}

      <Spin spinning={initialLoading}>
        <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
          <StatCard title={t('aiFusion.statStudies')} value={studies.length} icon={<Layers size={18} />} color="primary" />
          <StatCard title={t('aiFusion.statInsights')} value={aiInsights.length} icon={<Sparkles size={18} />} color="primary" />
          <StatCard title={t('aiFusion.statActionable')} value={actionableInsights} color="error" />
          <StatCard title={t('aiFusion.statAvgScore')} value={studies.length > 0 ? avgScore : '0'} suffix="%" color="primary" />
          <StatCard title={t('aiFusion.statPending')} value={studies.filter((s) => s.status === 'pending').length} color="warning" icon={<Clock size={18} />} />
        </StatCardGrid>
      </Spin>

      <Segmented
        value={modality}
        onChange={setModality as never}
        options={[
          { value: 'cbct', label: ' CBCT' }, { value: 'oct', label: ' OCT' }, { value: 'fundus', label: ' Fundus' },
          { value: 'fusion', label: t('aiFusion.fusionOverlay') },
        ]}
        style={{ marginBottom: 16 }}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card
            size="small"
            title={<Space><Crosshair size={14} />{t('aiFusion.fusionCanvas')}</Space>}
            extra={<Space><Button size="small" icon={<Image size={12} />} onClick={toggleLayer}>{t('aiFusion.toggleLayer')}</Button><Tag color={layerVisible ? 'green' : 'default'}>{layerMode}{layerVisible ? ` · ${t('aiFusion.visible')}` : ` · ${t('aiFusion.hidden')}`}</Tag></Space>}
            style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff', flexDirection: 'column', gap: 8 }}
            styles={{ body: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 } }}
          >
            <Activity size={36} color="#2563eb" />
            <span style={{ opacity: 0.8, fontSize: 13 }}>[ {t('aiFusion.canvasArea')} {modality.toUpperCase()} ]</span>
            <span style={{ opacity: 0.5, fontSize: 12 }}>{t('aiFusion.canvasSubtitle')}</span>
            {layerVisible && (
              <span style={{ padding: '3px 12px', background: 'rgba(255,255,255,0.15)', borderRadius: 12, fontSize: 12 }}>
                {t('aiFusion.overlayLayer')} {layerMode} {t('aiFusion.modeUnit')}
              </span>
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={<Space><BarChart3 size={14} />{t('aiFusion.insights')}</Space>} extra={<Tag color="purple">{aiInsights.length} {t('aiFusion.itemsUnit')}</Tag>} style={{ height: 320 }} styles={{ body: { height: 'calc(100% - 38px)', overflow: 'auto' } }}>
            {aiInsights.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('aiFusion.noInsights')} />
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
        title={<Space><FileText size={14} />{t('aiFusion.studies')}</Space>}
        extra={<Space><Button size="small" icon={<Share2 size={12} />} onClick={() => { if (studies.length === 0) { message.warning(t('aiFusion.nothingToExport')); return } downloadBlob(studiesToCSV(studies), `${t('w9d.aiFusion.reportFile')}_${new Date().toISOString().slice(0, 10)}.csv`); message.success(t('w9d.aiFusion.exported', { count: studies.length })) }}>{t('aiFusion.exportReport')}</Button></Space>}
      >
        <DataTable
          dataSource={studyPageData}
          rowKey="id"
          pagination={studyPagination}
          columns={[
            { title: t('aiFusion.colPatient'), dataIndex: 'patient' },
            { title: t('aiFusion.colModalities'), dataIndex: 'modalities' },
            {
              title: t('aiFusion.colFusionScore'), dataIndex: 'fusionScore',
              render: (s: number) => <Progress percent={Math.round(s * 100)} size="small" strokeColor={s > 0.9 ? '#52c41a' : s > 0.8 ? '#faad14' : '#ff4d4f'} />,
            },
            { title: t('aiFusion.colFindings'), dataIndex: 'findings', render: (v: number) => <Tag>{v} {t('aiFusion.itemsUnit')}</Tag> },
            { title: t('aiFusion.colAiAlerts'), dataIndex: 'aiAlerts', render: (a: number) => <Badge count={a} size="small" /> },
            {
              title: t('aiFusion.colStatus'), dataIndex: 'status',
              render: (s: string) => <Badge status={s === 'complete' ? 'success' : 'processing'} text={s === 'complete' ? t('aiFusion.complete') : t('aiFusion.processing')} />,
            },
            { title: t('aiFusion.colDate'), dataIndex: 'date' },
            {
              title: t('aiFusion.colAction'),
              render: (_: unknown, r: FusionStudy) => (
                <Space>
                  <Button size="small" icon={<Eye size={10} />} onClick={() => setDetail(r)}>{t('aiFusion.view')}</Button>
                  <Button size="small" icon={<Crosshair size={10} />} loading={running} onClick={() => void handleRegister(r)}>{t('aiFusion.register')}</Button>
                  <Button size="small" icon={<Download size={10} />} onClick={() => downloadBlob(studiesToCSV([r]), `${t('w9d.aiFusion.studyFile')}_${r.patient}_${r.id}.csv`)}>{t('aiFusion.download')}</Button>
                </Space>
              ),
            },
          ]}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={`${t('aiFusion.detailTitle')} - ${detail?.patient ?? ''}`}
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={<Button type="primary" onClick={() => void handleRunFusion(detail ?? undefined)} icon={<PlayCircle size={12} />}>{t('aiFusion.rerunFusion')}</Button>}
        width={520}
      >
        {detail && (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label={t('aiFusion.colPatient')}>{detail.patient}</Descriptions.Item>
              <Descriptions.Item label={t('aiFusion.colModalities')}>{detail.modalities}</Descriptions.Item>
              <Descriptions.Item label={t('aiFusion.colFusionScore')}><Progress percent={Math.round(detail.fusionScore * 100)} size="small" /></Descriptions.Item>
              <Descriptions.Item label={t('aiFusion.colAiAlerts')}><Badge count={detail.aiAlerts} /></Descriptions.Item>
              <Descriptions.Item label={t('aiFusion.findingsCount')}>{detail.findings}</Descriptions.Item>
              <Descriptions.Item label={t('aiFusion.colDate')}>{detail.date}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 8 }}>{t('aiFusion.timeline')}</h4>
              <Timeline
                items={[
                  { children: <><CheckCircle2 size={12} color="#52c41a" /> {t('aiFusion.tlPreprocess')}</>, color: 'green' },
                  { children: <><CheckCircle2 size={12} color="#52c41a" /> {t('aiFusion.tlRegister')}</>, color: 'green' },
                  detail.status === 'complete'
                    ? { children: <><CheckCircle2 size={12} color="#52c41a" /> {t('aiFusion.tlFusionDone')}</>, color: 'green' }
                    : { children: <><Clock size={12} /> {t('aiFusion.tlFusionRunning')}</>, color: 'blue' },
                ]}
              />
            </div>
          </>
        )}
      </Modal>
    </PageContainer>
  );
};
export default AiFusionWorkspacePage;
