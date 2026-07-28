// [v3.0.6.8-54] 口腔 DICOM 查看器 (CBCT/全景/根尖/口扫)
// [v3.0.6.8-81] 修复: 复用 shared constants
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Space, Tag, Button, Row, Col, Descriptions, message, Spin, Tabs, Empty, Divider, InputNumber, Slider, Tooltip, Alert } from 'antd';
import { Eye, Maximize2, ZoomIn, ZoomOut, RotateCcw, Activity, Layers, Monitor, Camera, Scan, ChevronLeft, ChevronRight, Download, Ruler } from 'lucide-react';
import { MODALITY_LABELS } from '../../data/dental/constants';

export const DentalViewerPage: React.FC = () => {
  const [search] = useSearchParams();
  const studyId = search.get('studyId') || '';
  const modParam = search.get('modality') || 'Panoramic';
  const [study, setStudy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlice, setCurrentSlice] = useState(0);
  const [ww, setWw] = useState(400); // window width
  const [wc, setWc] = useState(40); // window center
  const [zoom, setZoom] = useState(1);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const r = await fetch(`/api/v1/dental/studies/${studyId}`); const d = await r.json(); if (d.success) setStudy(d.data); }
      catch { message.error('加载失败'); }
      finally { setLoading(false); }
    })();
  }, [studyId]);

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  if (!study) return <div style={{ padding: 24 }}><Card><Empty description="Study not found" /></Card></div>;

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
          <span style={{ fontSize: 16, fontWeight: 600 }}>口腔影像查看器</span>
          <Tag color="blue">{MODALITY_LABELS[modality]}</Tag>
          <Tag color="cyan">{study.id}</Tag>
          <Tag color="purple">v3.0.6.8-54</Tag>
        </Space>
        <Space>
          <Tooltip title="窗宽"><InputNumber size="small" value={ww} onChange={setWw} min={1} max={2000} style={{ width: 80 }} addonAfter="W" /></Tooltip>
          <Tooltip title="窗位"><InputNumber size="small" value={wc} onChange={setWc} min={-500} max={500} style={{ width: 80 }} addonAfter="C" /></Tooltip>
          <Slider min={50} max={300} value={zoom} onChange={setZoom} style={{ width: 100 }} />
          <Tooltip title="放大"><Button size="small" icon={<ZoomIn size={14} />} onClick={() => setZoom(z => Math.min(300, z + 20))} /></Tooltip>
          <Tooltip title="缩小"><Button size="small" icon={<ZoomOut size={14} />} onClick={() => setZoom(z => Math.max(50, z - 20))} /></Tooltip>
          <Tooltip title="重置"><Button size="small" icon={<RotateCcw size={14} />} onClick={() => { setZoom(1); setWw(400); setWc(40); }} /></Tooltip>
        </Space>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Image Display */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', position: 'relative' }}>
          {isCBCT ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 480, height: 360, background: '#1a1a1a', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', transform: `scale(${zoom / 100})` }}>
                <Layers size={48} color="#666" />
                <div style={{ color: '#888', marginTop: 12, fontSize: 14 }}>CBCT 轴向切片 #{currentSlice + 1}</div>
                <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>WW: {ww} WC: {wc} | 512×512 | 16bit</div>
                {/* Simulated CBCT MPR grid */}
                <div style={{ display: 'flex', gap: 2, marginTop: 20 }}>
                  <div style={{ width: 100, height: 80, background: '#222', borderRadius: 2 }} />
                  <div style={{ width: 100, height: 80, background: '#222', borderRadius: 2 }} />
                  <div style={{ width: 100, height: 80, background: '#222', borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <Button size="small" icon={<ChevronLeft size={12} />} onClick={() => setCurrentSlice(s => Math.max(0, s-1))} disabled={currentSlice === 0} />
                <span style={{ color: '#888', margin: '0 12px' }}>{currentSlice + 1} / {imageCount}</span>
                <Button size="small" icon={<ChevronRight size={12} />} onClick={() => setCurrentSlice(s => Math.min(imageCount-1, s+1))} disabled={currentSlice >= imageCount-1} />
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 480, height: isPanoramic ? 240 : 320, background: '#1a1a1a', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', transform: `scale(${zoom / 100})` }}>
                <Camera size={48} color="#666" />
                <div style={{ color: '#888', marginTop: 12, fontSize: 14 }}>{MODALITY_LABELS[modality]}</div>
                <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>WW: {ww} WC: {wc} | {study.imageCount || 1} frame</div>
                <div style={{ color: '#555', fontSize: 12, marginTop: 20, border: '1px solid #333', padding: '4px 12px', borderRadius: 4 }}>
                  {/* Simulated dental arch outline for panoramic */}
                  {isPanoramic && '⌣ (下颌骨轮廓示意)'}
                  {isPeriapical && '🦷 (牙根及根尖周示意)'}
                  {isScan && '🦷 (口扫 3D 模型待渲染)'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Info Panel */}
        <div style={{ width: 380, background: '#fff', overflowY: 'auto', borderLeft: '1px solid #1f1f1f' }}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} size="small" tabBarStyle={{ padding: '0 8px', margin: 0 }}
            items={[
              { key: 'info', label: '信息', children: <Card size="small" styles={{ body: { padding: 8 } }}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="患者">{study.patientName}</Descriptions.Item>
                    <Descriptions.Item label="ID">{study.id}</Descriptions.Item>
                    <Descriptions.Item label="模态">{MODALITY_LABELS[study.modality]}</Descriptions.Item>
                    <Descriptions.Item label="设备">{study.deviceModel}</Descriptions.Item>
                    <Descriptions.Item label="视野">{study.fieldOfView}</Descriptions.Item>
                    <Descriptions.Item label="分辨率">{study.voxelSize}mm</Descriptions.Item>
                    {study.radiationDose && <Descriptions.Item label="剂量">{study.radiationDose} mGy</Descriptions.Item>}
                    <Descriptions.Item label="检查日期">{study.acquisitionDate}</Descriptions.Item>
                    <Descriptions.Item label="检查指征">{study.indications}</Descriptions.Item>
                    <Descriptions.Item label="医生">{study.referringDentist}</Descriptions.Item>
                    <Descriptions.Item label="质量"><Tag color={study.quality === 'Diagnostic' ? 'green' : 'orange'}>{study.quality}</Tag></Descriptions.Item>
                  </Descriptions>
                </Card>
              },
              { key: 'measurements', label: '测量', children: <Card size="small" styles={{ body: { padding: 8 } }}>
                  {(study.measurements && study.measurements.length > 0) ? study.measurements.map((m: any, i: number) => (
                    <div key={i} style={{ marginBottom: 8, padding: 8, background: '#fafafa', borderRadius: 4 }}>
                      <div style={{ fontSize: 12, color: '#666' }}>{m.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{m.value}<span style={{ fontSize: 12, fontWeight: 400, color: '#999', marginLeft: 4 }}>{m.unit}</span></div>
                    </div>
                  )) : <Empty description="暂无测量" />}
                </Card>
              },
              { key: 'segments', label: '分割', children: <Card size="small" styles={{ body: { padding: 8 } }}>
                  {(study.segments && study.segments.length > 0) ? <Row gutter={[8,8]}>
                    {study.segments.map((s: any, i: number) => <Col key={i} span={12}>
                      <div style={{ padding: 8, background: s.color || '#f0f0f0', borderRadius: 4, fontSize: 12, fontWeight: 600, color: '#fff' }}>{s.label} ({s.volume}mm³)</div>
                    </Col>)}
                  </Row> : <Empty description="暂无分割" />}
                </Card>
              },
              { key: 'ai', label: 'AI 分析', children: study.aiAnalysis ? (
                <Card size="small" styles={{ body: { padding: 8 } }}>
                  <div>龋齿检出: <Tag color="red">{study.aiAnalysis.cariesDetected}</Tag></div>
                  <div>骨丧失: <Tag color="orange">{study.aiAnalysis.boneLossLevel}</Tag></div>
                  <div>根尖周病变: <Tag color="purple">{study.aiAnalysis.periapicalLesions}</Tag></div>
                  <div>置信度: {(study.aiAnalysis.confidence * 100).toFixed(0)}%</div>
                  <div>模型: {study.aiAnalysis.modelVersion}</div>
                  <Divider style={{ margin: '8px 0' }} />
                  <Button size="small" icon={<Activity size={12} />} onClick={() => message.warning('功能建设中')}>运行 AI 分析</Button>
                </Card>
              ) : <Card><Empty description="无 AI 分析" /></Card>,
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
};
export default DentalViewerPage;
