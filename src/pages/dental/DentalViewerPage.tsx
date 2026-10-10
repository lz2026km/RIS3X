// [v3.0.6.8-54] 口腔 DICOM 查看器 (CBCT/全景/根尖/口扫)
// [v3.0.6.8-81] 修复: 复用 shared constants
import { MODALITY_LABELS } from '../../data/dental/constants';
import { dentalApi } from '../../services/api/dentalApi';
import { ErrorBanner } from '../../components/feedback';
import { Card, Space, Tag, Button, Row, Col, Descriptions, message, Spin, Tabs, Empty, Divider, InputNumber, Slider, Tooltip } from 'antd';
import { ZoomIn, ZoomOut, RotateCcw, Activity, Layers, Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { Inbox, SearchX } from 'lucide-react'
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { t } from '../../i18n/appI18n';

export const DentalViewerPage: React.FC = () => {
  const [search] = useSearchParams();
  const studyId = search.get('studyId') || '';
  const modParam = search.get('modality') || 'Panoramic';
  const [study, setStudy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [currentSlice, setCurrentSlice] = useState(0);
  const [ww, setWw] = useState(400); // window width
  const [wc, setWc] = useState(40); // window center
  const [zoom, setZoom] = useState(1);
  const [activeTab, setActiveTab] = useState('info');
  const [aiRunning, setAiRunning] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const r = await fetch(`/api/v1/dental/studies/${studyId}`);
        const d = await r.json();
        if (d.success) setStudy(d.data);
        else setLoadError(t("w9.states.error"));
      }
      catch { setLoadError(t("w9.states.error")); message.error(t("dViewer.loadFailed")); }
      finally { setLoading(false); }
    })();
  }, [studyId, reloadTick]);

  const handleRunAi = async () => {
    setAiRunning(true);
    try {
      const res = await dentalApi.detectCaries({ modality });
      if (res.success && res.data) {
        setAiResult(res.data);
        message.success(t("dViewer.aiDone"));
      } else {
        message.warning(t("dViewer.aiUnavailable"));
        setAiResult({ cariesDetected: 2, boneLossLevel: '中', periapicalLesions: 1, confidence: 0.87, modelVersion: 'demo-v1' });
      }
    } catch {
      message.warning(t("dViewer.aiUnavailable"));
      setAiResult({ cariesDetected: 2, boneLossLevel: '中', periapicalLesions: 1, confidence: 0.87, modelVersion: 'demo-v1' });
    } finally {
      setAiRunning(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  if (!study) return (
    <div style={{ padding: 'var(--space-6, 24px)' }}>
      {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t("w9.states.retry")} />}
      <Card><Empty image={<SearchX size={48} style={{opacity:0.4}}/>} description={t("dViewer.notFound")} /></Card>
    </div>
  );

  const modality = study.modality || modParam;
  const isCBCT = modality === 'CBCT';
  const isPanoramic = modality === 'Panoramic';
  const isPeriapical = modality === 'Periapical';
  const isScan = modality === 'Scan';
  const imageCount = study.imageCount || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#000' }}>
      {/* Top Bar */}
      <div style={{ background: '#001529', color: '#fff', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{t("dViewer.title")}</span>
          <Tag color="blue">{MODALITY_LABELS[modality]}</Tag>
          <Tag color="cyan">{study.id}</Tag>
          <Tag color="purple">v3.0.6.8-54</Tag>
        </Space>
        <Space>
          <Tooltip title={t("dViewer.windowWidth")}><InputNumber size="small" value={ww} onChange={(v) => setWw(v ?? 400)} min={1} max={2000} style={{ width: 80 }} suffix="W" /></Tooltip>
          <Tooltip title={t("dViewer.windowCenter")}><InputNumber size="small" value={wc} onChange={(v) => setWc(v ?? 40)} min={-500} max={500} style={{ width: 80 }} suffix="C" /></Tooltip>
          <Slider min={50} max={300} value={zoom} onChange={setZoom} style={{ width: 100 }} />
          <Tooltip title={t("dViewer.zoomIn")}><Button aria-label="放大" size="small" icon={<ZoomIn size={14} />} onClick={() => setZoom(z => Math.min(300, z + 20))} /></Tooltip>
          <Tooltip title={t("dViewer.zoomOut")}><Button aria-label="缩小" size="small" icon={<ZoomOut size={14} />} onClick={() => setZoom(z => Math.max(50, z - 20))} /></Tooltip>
          <Tooltip title={t("dViewer.reset")}><Button aria-label="逆时针旋转" size="small" icon={<RotateCcw size={14} />} onClick={() => { setZoom(1); setWw(400); setWc(40); }} /></Tooltip>
        </Space>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Image Display */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', position: 'relative' }}>
          {isCBCT ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 480, height: 360, background: '#1a1a1a', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', transform: `scale(${zoom / 100})` }}>
                <Layers size={48} color="var(--text-secondary)" />
                <div style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-3, 12px)', fontSize: 14 }}>{t("dViewer.cbctAxial")}{currentSlice + 1}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 'var(--space-1, 4px)' }}>WW: {ww} WC: {wc} | 512×512 | 16bit</div>
                {/* Simulated CBCT MPR grid */}
                <div style={{ display: 'flex', gap: 2, marginTop: 'var(--space-5, 20px)' }}>
                  <div style={{ width: 100, height: 80, background: '#222', borderRadius: 2 }} />
                  <div style={{ width: 100, height: 80, background: '#222', borderRadius: 2 }} />
                  <div style={{ width: 100, height: 80, background: '#222', borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ marginTop: 'var(--space-2, 8px)' }}>
                <Button aria-label="上一页" size="small" icon={<ChevronLeft size={12} />} onClick={() => setCurrentSlice(s => Math.max(0, s-1))} disabled={currentSlice === 0} />
                <span style={{ color: 'var(--text-secondary)', margin: '0 12px' }}>{currentSlice + 1} / {imageCount}</span>
                <Button aria-label="下一页" size="small" icon={<ChevronRight size={12} />} onClick={() => setCurrentSlice(s => Math.min(imageCount-1, s+1))} disabled={currentSlice >= imageCount-1} />
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 480, height: isPanoramic ? 240 : 320, background: '#1a1a1a', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', transform: `scale(${zoom / 100})` }}>
                <Camera size={48} color="var(--text-secondary)" />
                <div style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-3, 12px)', fontSize: 14 }}>{MODALITY_LABELS[modality]}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 'var(--space-1, 4px)' }}>WW: {ww} WC: {wc} | {study.imageCount || 1} frame</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 'var(--space-5, 20px)', border: '1px solid #333', padding: '4px 12px', borderRadius: 4 }}>
                  {/* Simulated dental arch outline for panoramic */}
                  {isPanoramic && t("dViewer.panoramicHint")}
                  {isPeriapical && t("dViewer.periapicalHint")}
                  {isScan && t("dViewer.scanHint")}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Info Panel */}
        <div style={{ width: 380, background: 'var(--bg-card)', overflowY: 'auto', borderLeft: '1px solid #1f1f1f' }}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} size="small" tabBarStyle={{ padding: '0 8px', margin: 0 }}
            items={[
              { key: 'info', label: t("dViewer.tabInfo"), children: <Card size="small" styles={{ body: { padding: 'var(--space-2, 8px)' } }}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label={t("dViewer.patient")}>{study.patientName}</Descriptions.Item>
                    <Descriptions.Item label="ID">{study.id}</Descriptions.Item>
                    <Descriptions.Item label={t("dViewer.modality")}>{MODALITY_LABELS[study.modality]}</Descriptions.Item>
                    <Descriptions.Item label={t("dViewer.device")}>{study.deviceModel}</Descriptions.Item>
                    <Descriptions.Item label={t("dViewer.fov")}>{study.fieldOfView}</Descriptions.Item>
                    <Descriptions.Item label={t("dViewer.resolution")}>{study.voxelSize}mm</Descriptions.Item>
                    {study.radiationDose && <Descriptions.Item label={t("dViewer.dose")}>{study.radiationDose} mGy</Descriptions.Item>}
                    <Descriptions.Item label={t("dViewer.acquisitionDate")}>{study.acquisitionDate}</Descriptions.Item>
                    <Descriptions.Item label={t("dViewer.indications")}>{study.indications}</Descriptions.Item>
                    <Descriptions.Item label={t("dViewer.doctor")}>{study.referringDentist}</Descriptions.Item>
                    <Descriptions.Item label={t("dViewer.quality")}><Tag color={study.quality === 'Diagnostic' ? 'green' : 'orange'}>{study.quality}</Tag></Descriptions.Item>
                  </Descriptions>
                </Card>
              },
              { key: 'measurements', label: t("dViewer.tabMeasurements"), children: <Card size="small" styles={{ body: { padding: 'var(--space-2, 8px)' } }}>
                  {(study.measurements && study.measurements.length > 0) ? study.measurements.map((m: any, i: number) => (
                    <div key={i} style={{ marginBottom: 'var(--space-2, 8px)', padding: 'var(--space-2, 8px)', background: 'var(--bg-card)', borderRadius: 4 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{m.value}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 'var(--space-1, 4px)' }}>{m.unit}</span></div>
                    </div>
                  )) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("dViewer.noMeasurements")} />}
                </Card>
              },
              { key: 'segments', label: t("dViewer.tabSegments"), children: <Card size="small" styles={{ body: { padding: 'var(--space-2, 8px)' } }}>
                  {(study.segments && study.segments.length > 0) ? <Row gutter={[8,8]}>
                    {study.segments.map((s: any, i: number) => <Col key={i} span={12}>
                      <div style={{ padding: 'var(--space-2, 8px)', background: s.color || 'var(--bg-primary, #f8fafc)', borderRadius: 4, fontSize: 12, fontWeight: 600, color: '#fff' }}>{s.label} ({s.volume}mm³)</div>
                    </Col>)}
                  </Row> : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("dViewer.noSegments")} />}
                </Card>
              },
              { key: 'ai', label: t("dViewer.tabAi"), children: (study.aiAnalysis || aiResult) ? (
                <Card size="small" styles={{ body: { padding: 'var(--space-2, 8px)' } }}>
                  <div>{t("dViewer.cariesDetected")}<Tag color="red">{aiResult?.cariesDetected ?? study.aiAnalysis.cariesDetected}</Tag></div>
                  <div>{t("dViewer.boneLoss")}<Tag color="orange">{aiResult?.boneLossLevel ?? study.aiAnalysis.boneLossLevel}</Tag></div>
                  <div>{t("dViewer.periapical")}<Tag color="purple">{aiResult?.periapicalLesions ?? study.aiAnalysis.periapicalLesions}</Tag></div>
                  <div>{t("dViewer.confidence")}{((aiResult?.confidence ?? study.aiAnalysis.confidence) * 100).toFixed(0)}%</div>
                  <div>{t("dViewer.model")}{aiResult?.modelVersion ?? study.aiAnalysis.modelVersion}</div>
                  <Divider style={{ margin: '8px 0' }} />
                  <Button size="small" icon={<Activity size={12} />} loading={aiRunning} onClick={() => void handleRunAi()}>{t("dViewer.runAi")}</Button>
                </Card>
              ) : <Card><Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("dViewer.noAi")} /></Card>,
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
};
export default DentalViewerPage;
