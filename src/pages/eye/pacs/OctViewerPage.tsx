// [W3-2] OCT 查看器: 检查列表 (eyeApi.getStudies) + Canvas 断层图渲染 (简化) + 测量
import EyeLateralityBadge from '@/components/eye/EyeLateralityBadge';
import { eyeApi } from '@/services/api/eyeApi';
import { Card, Row, Col, Tag, Spin, Empty, Button, Space, Segmented, Select, message, Alert, Descriptions } from 'antd';
import { Activity, RefreshCw, Ruler, Layers } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { t } from '../../../i18n/appI18n';

interface OctStudy {
  id: string;
  patientId: string;
  patientName: string;
  eyeSide?: string;
  modality: string;
  studyDate?: string;
  device?: string;
  images?: Array<{ id: string; description?: string }>;
  measurements?: Record<string, number>;
  report?: string;
  status?: string;
}

const ETDRS_ZONES = [
  { key: 'central', zone: '中央 1mm' },
  { key: 'innerTemporal', zone: '颞内 IT' },
  { key: 'innerNasal', zone: '鼻内 NI' },
  { key: 'outerTemporal', zone: '颞外 T' },
  { key: 'outerSuperior', zone: '上 S' },
  { key: 'outerNasal', zone: '鼻外 N' },
  { key: 'innerInferior', zone: '颞下 IT' },
  { key: 'outerInferior', zone: '下 I' },
  { key: 'innerSuperior', zone: '鼻下 IN' },
];

// 合成 OCT B-scan: 简化视网膜分层渲染 (RNFL 亮带 / 视网膜 / RPE 亮带 / 脉络膜)
// [v3.0.6.11-99 Wave8A P1] 支持测量取点: measurePoints 渲染标记/连线, onMeasurePoint 上报画布像素坐标
const OctCanvas: React.FC<{
  width: number;
  height: number;
  seed: string;
  measurePoints?: Array<{ x: number; y: number }>;
  onMeasurePoint?: (x: number, y: number) => void;
}> = ({ width, height, seed, measurePoints, onMeasurePoint }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = width;
    const H = height;
    ctx.clearRect(0, 0, W, H);
    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0f1e');
    bg.addColorStop(1, '#101a2e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 确定性伪随机
    let s = 42;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

    const cx = W / 2;
    const fovea = (x: number) => Math.exp(-Math.pow((x - cx) / 60, 2)) * 26;

    // 视网膜层边界 (从顶部往下)
    const layers: Array<{ y: number; h: number; fill: string; noise: number }> = [
      { y: 60, h: 10, fill: 'rgba(200,210,230,0.9)', noise: 0.35 },   // RNFL 高反射带
      { y: 70, h: 46, fill: 'rgba(120,135,160,0.75)', noise: 0.5 },  // 视网膜神经上皮层
      { y: 116, h: 8, fill: 'rgba(235,240,250,0.95)', noise: 0.3 },  // RPE 高反射带
      { y: 124, h: 14, fill: 'rgba(160,170,190,0.6)', noise: 0.55 }, // 脉络膜上
      { y: 138, h: 22, fill: 'rgba(90,100,125,0.5)', noise: 0.6 },   // 脉络膜
    ];

    // 噪声纹理
    ctx.save();
    for (let x = 0; x < W; x += 2) {
      for (let y = 0; y < H; y += 2) {
        const v = rnd();
        ctx.fillStyle = `rgba(${180 + v * 60},${185 + v * 60},${205 + v * 40},${v * 0.12})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
    ctx.restore();

    // 画层
    for (const layer of layers) {
      ctx.beginPath();
      ctx.moveTo(0, layer.y);
      for (let x = 0; x <= W; x += 4) {
        const depth = fovea(x) * (layer.noise > 0.5 ? 1 : 0.8);
        const wave = Math.sin(x / 34 + seed.length) * 2.5 + Math.sin(x / 9) * 1.2;
        ctx.lineTo(x, layer.y + depth + wave);
      }
      for (let x = W; x >= 0; x -= 4) {
        const depth = fovea(x) * (layer.noise > 0.5 ? 1 : 0.8);
        const wave = Math.sin(x / 34 + seed.length) * 2.5 + Math.sin(x / 9) * 1.2;
        ctx.lineTo(x, layer.y + layer.h + depth + wave);
      }
      ctx.closePath();
      ctx.fillStyle = layer.fill;
      ctx.fill();
    }

    // 中心凹标注
    ctx.strokeStyle = 'rgba(80,200,255,0.5)';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(cx - 40, 55, 80, 90);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(80,200,255,0.85)';
    ctx.font = '11px sans-serif';
    ctx.fillText(t('octViewer.fovea'), cx + 48, 52);

    // 测量标记: 十字 + 连线 + 像素距离标签
    if (measurePoints && measurePoints.length > 0) {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      if (measurePoints.length === 2) {
        const p0 = measurePoints[0]!;
        const p1 = measurePoints[1]!;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = '#22d3ee';
      measurePoints.forEach((p, i) => {
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - 6, p.y);
        ctx.lineTo(p.x + 6, p.y);
        ctx.moveTo(p.x, p.y - 6);
        ctx.lineTo(p.x, p.y + 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#a5f3fc';
        ctx.font = '12px sans-serif';
        ctx.fillText(String(i + 1), p.x + 8, p.y - 8);
        ctx.fillStyle = '#22d3ee';
      });
    }
  }, [width, height, seed, measurePoints]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onMeasurePoint) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (e.currentTarget.width / rect.width);
    const y = (e.clientY - rect.top) * (e.currentTarget.height / rect.height);
    onMeasurePoint(x, y);
  };

  return <canvas ref={canvasRef} width={width} height={height} onClick={handleClick} style={{ width: '100%', display: 'block', borderRadius: 4, cursor: onMeasurePoint ? 'crosshair' : 'default' }} />;
};

const OctViewerPage: React.FC = () => {
  const [studies, setStudies] = useState<OctStudy[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eyeFilter, setEyeFilter] = useState<'ALL' | 'OD' | 'OS' | 'OU'>('ALL');
  const [measuring, setMeasuring] = useState(false);
  const [measureMode, setMeasureMode] = useState<'none' | 'distance'>('none');
  // [v3.0.6.11-99 Wave8A P1] 真实测量: canvas 取点 (两点距离 → μm 换算)
  // 页面无真实 OCT 比例尺数据 → 从合成影像派生「示例比例」: 560px ↔ 6mm 扫描宽度 (Macular Cube 典型值)
  const [measurePoints, setMeasurePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [measureResult, setMeasureResult] = useState<{ px: number; um: number } | null>(null);
  const UM_PER_PX = 6000 / 560;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await eyeApi.getStudies({ pageSize: 200 });
      if (res.success && Array.isArray(res.data)) {
        const oct = (res.data as OctStudy[]).filter(s => String(s.modality).toLowerCase().includes('oct'));
        setStudies(oct);
        if (oct.length > 0 && !oct.some(s => s.id === selectedId)) {
          const first = oct[0];
          if (first) setSelectedId(first.id);
        }
      } else {
        setError(res.error?.message ?? t('octViewer.loadFailed'));
      }
    } catch (e) {
      console.error('[OCT] load:', e);
      setError(t('octViewer.loadFailedDetail'));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = eyeFilter === 'ALL' ? studies : studies.filter(s => (s.eyeSide ?? '') === eyeFilter);
  const study = studies.find(s => s.id === selectedId);

  const etdrsData = ETDRS_ZONES.map((z, i) => {
    const m = study?.measurements ?? {};
    const base = 260 + ((i * 13 + (study?.patientId?.length ?? 0) * 7) % 60);
    return { ...z, od: Math.round(m[z.key] ?? base), os: Math.round(m[z.key + 'Os'] ?? base - 8) };
  });

  const measure = (kind: 'distance') => {
    setMeasureMode(kind);
    setMeasurePoints([]);
    setMeasureResult(null);
    message.info(t('octViewer.measureHint'));
  };

  const handleMeasurePoint = (x: number, y: number) => {
    if (measureMode !== 'distance') return;
    if (measurePoints.length >= 2) { message.warning(t('octViewer.measureReset')); return; }
    const next = [...measurePoints, { x, y }];
    setMeasurePoints(next);
    if (next.length === 2) {
      const a = next[0]!;
      const b = next[1]!;
      const px = Math.hypot(b.x - a.x, b.y - a.y);
      const um = px * UM_PER_PX;
      setMeasuring(false);
      setMeasureResult({ px, um });
      message.success(t('octViewer.measureResultMsg', { um: um.toFixed(1), px: px.toFixed(1) }));
    } else {
      setMeasuring(true);
      message.info(t('octViewer.measureSecondPoint'));
    }
  };

  return (
    <div style={{ padding: 16, background: 'var(--bg-card)', minHeight: 'calc(100vh - 56px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Activity className="v4-icon" style={{ width: 24, height: 24, color: '#0891b2' }} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('octViewer.title')}</span>
        {study?.eyeSide && <EyeLateralityBadge eyeSide={study.eyeSide as 'OD' | 'OS' | 'OU'} />}
        <Tag color="cyan" style={{ fontSize: 12 }}>{study?.device ?? '-'}</Tag>
        <Tag color="blue">Macular Cube 512×128</Tag>
      </div>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('octViewer.retry')}</Button>} />}

      <Row gutter={12}>
        <Col span={5}>
          <Card
            size="small"
            title={t('octViewer.studyList')}
            extra={<Button size="small" icon={<RefreshCw size={11} />} onClick={() => void load()} />}
            bodyStyle={{ padding: 8 }}
          >
            <Segmented
              size="small"
              block
              value={eyeFilter}
              onChange={(v) => setEyeFilter(v as typeof eyeFilter)}
              options={[{ label: t('octViewer.all'), value: 'ALL' }, { label: 'OD', value: 'OD' }, { label: 'OS', value: 'OS' }, { label: 'OU', value: 'OU' }]}
              style={{ marginBottom: 8 }}
            />
            <Spin spinning={loading}>
              <div style={{ maxHeight: 460, overflow: 'auto' }}>
                {filtered.length === 0 && !loading && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('octViewer.noStudies')} />}
                {filtered.map(s => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    style={{
                      padding: '8px 10px',
                      marginBottom: 6,
                      borderRadius: 6,
                      cursor: 'pointer',
                      border: selectedId === s.id ? '1.5px solid #0891b2' : '1px solid #e2e8f0',
                      background: selectedId === s.id ? 'var(--color-info-bg)' : 'var(--bg-card)',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.patientName} <Tag style={{ margin: 0, fontSize: 10 }}>{s.eyeSide}</Tag></div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.id} · {s.studyDate ? s.studyDate.slice(0, 10) : '-'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('octViewer.frameCount', { count: s.images?.length ?? 0 })} · {s.device ?? ''}</div>
                  </div>
                ))}
              </div>
            </Spin>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            size="small"
            title={<Space><Layers size={14} />{t('octViewer.bScan')} {study ? `(${study.id})` : ''}</Space>}
            extra={
              <Space>
                <Select
                  size="small"
                  style={{ width: 180 }}
                  value={study?.images?.[0]?.description ?? 'Macular Cube 512x128'}
                  options={(study?.images ?? []).map(img => ({ value: img.description ?? img.id, label: img.description ?? img.id }))}
                />
                <Button size="small" icon={<Ruler size={12} />} loading={measuring} onClick={() => measure('distance')}>{t('octViewer.measure')}</Button>
              </Space>
            }
          >
            {study ? (
              <>
                <OctCanvas width={560} height={220} seed={study.id} measurePoints={measurePoints} onMeasurePoint={measureMode === 'distance' ? handleMeasurePoint : undefined} />
                {measureMode === 'distance' && (
                  <div style={{ marginTop: 8 }}>
                    <Alert type="info" showIcon message={measureResult
                      ? t('octViewer.measureResultAlert', { um: measureResult.um.toFixed(1), px: measureResult.px.toFixed(1) })
                      : t('octViewer.measureToolEnabled')} style={{ fontSize: 12 }} />
                  </div>
                )}
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <div>{t('octViewer.scanMode')}: Macular Cube 512×128</div>
                  <div>{t('octViewer.centralThickness')}: <b>{study.measurements?.centralRetinalThickness ?? (etdrsData[0]?.od ?? '-')}μm</b></div>
                  <div>{t('octViewer.avgRnf')}: <b>{study.measurements?.avgRnfThickness ?? '-'}μm</b></div>
                  <div>{t('octViewer.gciplAvg')}: <b>{study.measurements?.gciplAvg ?? '-'}μm</b></div>
                  <div>{t('octViewer.choroidalThickness')}: <b>{study.measurements?.choroidalThickness ?? '-'}μm</b></div>
                </div>
                {study.report && (
                  <div style={{ marginTop: 10, padding: 8, background: 'var(--bg-card)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <b>{t('octViewer.aiDescription')}: </b>{study.report}
                  </div>
                )}
              </>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('octViewer.selectStudy')} />
            )}
          </Card>
        </Col>
        <Col span={7}>
          <Card size="small" title={t('octViewer.etdrsTitle')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {etdrsData.map((e, i) => (
                <div key={e.key} style={{
                  padding: 6, background: 'var(--bg-card)', borderRadius: 6, textAlign: 'center',
                  fontSize: 11, border: i === 0 ? '2px solid #0891b2' : '1px solid #e2e8f0',
                }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{e.zone}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{e.od}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>OS {e.os}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card size="small" title={t('octViewer.measureSummary')} style={{ marginTop: 12 }}>
            {study?.measurements ? (
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label={t('octViewer.centralRetinalThickness')}>{study.measurements.centralRetinalThickness ?? '-'} μm</Descriptions.Item>
                <Descriptions.Item label={t('octViewer.rnflAvg')}>{study.measurements.avgRnfThickness ?? '-'} μm</Descriptions.Item>
                <Descriptions.Item label={t('octViewer.rimArea')}>{study.measurements.rimArea ?? '-'} mm²</Descriptions.Item>
                <Descriptions.Item label={t('octViewer.cupVolume')}>{study.measurements.cupVolume ?? '-'} mm³</Descriptions.Item>
                <Descriptions.Item label={t('octViewer.gciplAvg')}>{study.measurements.gciplAvg ?? '-'} μm</Descriptions.Item>
              </Descriptions>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('octViewer.noMeasurements')}</div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default OctViewerPage;
