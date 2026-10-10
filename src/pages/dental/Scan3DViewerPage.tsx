// [W3-2] 口扫 3D 查看器: 扫描记录列表 (dentalApi.listScan) + Three.js WebGL 渲染 + 模型信息
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Space, Tag, Button, message, Spin, Slider, Tooltip, Empty, Alert, Descriptions, Badge } from 'antd';
import { RotateCcw, ZoomIn, ZoomOut, Boxes, RefreshCw } from 'lucide-react';
import { dentalApi } from '@/services/api/dentalApi';
import { t } from '../../i18n/appI18n';

interface ScanStudy {
  id: string;
  patientId: string;
  patientName: string;
  modality: string;
  scanType?: string;
  acquisitionDate?: string;
  deviceModel?: string;
  status?: string;
  quality?: string;
  fileSize?: number;
  imageCount?: number;
}

export const Scan3DViewerPage: React.FC = () => {
  const [search, setSearch] = useSearchParams();
  const studyIdParam = search.get('studyId') || '';
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<{ dispose: () => void; setZoom: (z: number) => void } | null>(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(100);
  const zoomRef = useRef(100);
  const [scans, setScans] = useState<ScanStudy[]>([]);
  const [studyId, setStudyId] = useState(studyIdParam);
  const [modelInfo, setModelInfo] = useState<{ modelUrl?: string; format?: string; triangleCount?: number } | null>(null);

  const handleZoom = (z: number) => {
    zoomRef.current = z;
    setZoom(z);
  };

  const loadScans = useCallback(async () => {
    setListLoading(true);
    setError('');
    try {
      const res = await dentalApi.listScan();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setScans(res.data as ScanStudy[]);
        if (!studyId) {
          const first = res.data[0];
          if (first) {
            setStudyId(first.id);
            setSearch({ studyId: first.id }, { replace: true });
          }
        }
      } else {
        setError(res.error?.message ?? t('scan3d.loadFailed'));
      }
    } catch (e) {
      console.error('[Scan3D] loadScans:', e);
      setError(t('scan3d.loadFailed'));
    } finally {
      setListLoading(false);
    }
  }, [studyId, setSearch]);

  useEffect(() => {
    void loadScans();
  }, [loadScans]);

  useEffect(() => {
    if (!studyId) return;
    void (async () => {
      try {
        const res = await dentalApi.getScanModel(studyId);
        if (res.success && res.data) setModelInfo(res.data as unknown as { modelUrl?: string; format?: string; triangleCount?: number });
        else setModelInfo(null);
      } catch {
        setModelInfo(null);
      }
    })();
  }, [studyId]);

  useEffect(() => {
    if (!containerRef.current || !studyId) return;
    setLoading(true);
    let disposed = false;
    // Using Three.js from the existing dependency
    import('three').then(async (THREE) => {
      if (disposed || !containerRef.current) return;
      const container = containerRef.current;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a2e);

      const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
      camera.position.set(0, 0, 15);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(container.clientWidth, container.clientHeight);
      container.appendChild(renderer.domElement);

      // Lights
      const ambientLight = new THREE.AmbientLight(0x404060);
      scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 1);
      dirLight.position.set(1, 1, 1);
      scene.add(dirLight);
      const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
      backLight.position.set(-1, -1, -1);
      scene.add(backLight);

      // 简化牙颌模型 (几何体 + 牙齿凸起)
      const geo = new THREE.SphereGeometry(3, 24, 18);
      geo.scale(1.5, 0.8, 1);
      const mat = new THREE.MeshPhongMaterial({ color: 0xe8d5b7, specular: 0x333333, shininess: 20 });
      const jaw = new THREE.Mesh(geo, mat);
      scene.add(jaw);

      const teeth: any[] = [];
      const teethPos = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
      for (const x of teethPos) {
        const tGeo = new THREE.BoxGeometry(0.3, 0.5, 0.3);
        const tMat = new THREE.MeshPhongMaterial({ color: 0xf5f0e5 });
        const tooth = new THREE.Mesh(tGeo, tMat);
        tooth.position.set(x, 0.3, 2.5);
        scene.add(tooth);
        teeth.push(tooth);
      }

      let rotY = 0;
      let scale = 1;
      const animate = () => {
        if (disposed) return;
        requestAnimationFrame(animate);
        rotY += 0.004;
        jaw.rotation.y = rotY;
        teeth.forEach((t, i) => t.rotation.y = rotY + i * 0.0001);
        const s = scale * (zoomRef.current / 100);
        jaw.scale.set(s, s, s);
        camera.position.z = 15 - (zoomRef.current / 100) * 6;
        renderer.render(scene, camera);
      };
      animate();
      setLoading(false);

      rendererRef.current = {
        dispose: () => {
          disposed = true;
          if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
          renderer.dispose();
        },
        setZoom: () => { /* zoom 由动画循环读取 */ },
      };

      // Cleanup
      return () => {
        if (rendererRef.current) {
          rendererRef.current.dispose();
          rendererRef.current = null;
        }
      };
    }).catch(() => {
      if (!disposed) message.error(t('scan3d.threeFailed'));
      setLoading(false);
    });

    return () => {
      disposed = true;
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [studyId]);

  const handleSelect = (id: string) => {
    setStudyId(id);
    setSearch({ studyId: id }, { replace: true });
  };

  const study = scans.find(s => s.id === studyId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#000' }}>
      <div style={{ background: '#001529', color: '#fff', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space wrap>
          <Boxes size={16} color="#7dd3fc" />
          <span style={{ fontSize: 16, fontWeight: 600 }}>{t('scan3d.title')}</span>
          <Tag color="cyan">v3.0.6.11-75 W3-2</Tag>
          <Tag color="purple">Three.js WebGL</Tag>
          {study && (
            <>
              <Tag color="blue">{study.patientName}</Tag>
              <Tag color="orange">{study.scanType ?? study.modality}</Tag>
            </>
          )}
        </Space>
        <Space>
          <Slider min={50} max={300} value={zoom} onChange={handleZoom} style={{ width: 100 }} />
          <Tooltip title={t('scan3d.zoomIn')}><Button size="small" icon={<ZoomIn size={14} />} onClick={() => handleZoom(Math.min(300, zoom + 25))} /></Tooltip>
          <Tooltip title={t('scan3d.zoomOut')}><Button size="small" icon={<ZoomOut size={14} />} onClick={() => handleZoom(Math.max(50, zoom - 25))} /></Tooltip>
          <Tooltip title={t('scan3d.resetView')}><Button size="small" icon={<RotateCcw size={14} />} onClick={() => handleZoom(100)} /></Tooltip>
        </Space>
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ width: 260, background: '#0f172a', padding: 12, overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>{t('scan3d.scanRecords')}</span>
            <Button size="small" icon={<RefreshCw size={11} />} onClick={() => void loadScans()} />
          </div>
          {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 8, fontSize: 12 }} />}
          <Spin spinning={listLoading}>
            {scans.length === 0 && !listLoading && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: 'var(--text-secondary)' }}>{t('scan3d.noRecords')}</span>} />}
            {scans.map(s => (
              <div
                key={s.id}
                onClick={() => handleSelect(s.id)}
                style={{
                  padding: '8px 10px',
                  marginBottom: 6,
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: studyId === s.id ? '1.5px solid #38bdf8' : '1px solid #1e293b',
                  background: studyId === s.id ? '#0c4a6e' : '#0f172a',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <b style={{ color: '#e2e8f0', fontSize: 12 }}>{s.patientName}</b>
                  <Badge status={s.status === 'archived' ? 'default' : 'processing'} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {s.id} · {s.scanType ?? s.modality}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {s.acquisitionDate ? s.acquisitionDate.slice(0, 10) : '-'} · {s.deviceModel ?? ''}
                </div>
              </div>
            ))}
          </Spin>
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: 'var(--text-secondary)' }}>
              <div style={{ textAlign: 'center' }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>{t('scan3d.modelLoading')}</div>
              </div>
            </div>
          )}
          {!study && !loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: 'var(--text-secondary)' }}>
              {t('scan3d.selectPrompt')}
            </div>
          )}
          {study && (
            <div style={{ position: 'absolute', left: 12, bottom: 12, width: 280, background: 'rgba(15,23,42,0.88)', border: '1px solid #1e293b', borderRadius: 8, padding: 12, color: '#e2e8f0' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t('scan3d.modelInfo')}</div>
              <Descriptions column={1} size="small" colon={false}>
                <Descriptions.Item label={t('scan3d.patient')}><span style={{ fontSize: 12 }}>{study.patientName}</span></Descriptions.Item>
                <Descriptions.Item label={t('scan3d.scanType')}><span style={{ fontSize: 12 }}>{study.scanType ?? study.modality}</span></Descriptions.Item>
                <Descriptions.Item label={t('scan3d.device')}><span style={{ fontSize: 12 }}>{study.deviceModel ?? '-'}</span></Descriptions.Item>
                <Descriptions.Item label={t('scan3d.format')}><span style={{ fontSize: 12 }}>{modelInfo?.format ?? 'STL'}</span></Descriptions.Item>
                <Descriptions.Item label={t('scan3d.triangleCount')}><span style={{ fontSize: 12 }}>{modelInfo?.triangleCount ? `${modelInfo.triangleCount.toLocaleString()}` : '-'}</span></Descriptions.Item>
                <Descriptions.Item label={t('scan3d.imageCount')}><span style={{ fontSize: 12 }}>{study.imageCount ?? '-'}</span></Descriptions.Item>
              </Descriptions>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default Scan3DViewerPage;
