// [v3.0.6.8-56] CBCT MPR 多平面重建 (三平面联动)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Space, Tag, Button, InputNumber, Spin, Progress } from 'antd';
import { RotateCcw, Maximize2, Activity, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { dentalApi } from '../../services/api/dentalApi';
import { ErrorBanner } from '../../components/feedback';
import { t } from '../../i18n/appI18n';

const planeLabel = (plane: string) => t(`w9d.mprPlane.${plane}`);

export const MprViewerPage: React.FC = () => {
  const [search] = useSearchParams();
  const studyId = search.get('studyId') || '';
  const [loading, setLoading] = useState(true);
  const [activePlane, setActivePlane] = useState<'Axial' | 'Sagittal' | 'Coronal'>('Axial');
  const [slices, setSlices] = useState({ Axial: 50, Sagittal: 50, Coronal: 50 });
  const [totalSlices, setTotalSlices] = useState({ Axial: 100, Sagittal: 100, Coronal: 100 });
  const [ww, setWw] = useState(400);
  const [wc, setWc] = useState(40);
  const [study, setStudy] = useState<any>(null);
  // [G005 W8-Dose] MPR 元数据: 优先 dentalApi.getMpr, 端点不可用/返回空时回退本地合成 (100 层)
  const [mprMeta, setMprMeta] = useState<{ sliceCount: number; resolution: string; format: string } | null>(null);
  const [mprSource, setMprSource] = useState<'api' | 'demo'>('demo');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // [G005 Wave2A P1] 演示重建: 本地状态流转 (重建进度 → 结果占位)
  const [rebuild, setRebuild] = useState<{ running: boolean; progress: number; done: boolean }>({ running: false, progress: 0, done: false });
  const rebuildTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (rebuildTimerRef.current) clearInterval(rebuildTimerRef.current);
  }, []);

  const startRebuild = () => {
    if (rebuild.running) return;
    setRebuild({ running: true, progress: 0, done: false });
    rebuildTimerRef.current = setInterval(() => {
      setRebuild(prev => {
        const next = Math.min(100, prev.progress + 8 + Math.round(Math.random() * 10));
        if (next >= 100) {
          if (rebuildTimerRef.current) clearInterval(rebuildTimerRef.current);
          rebuildTimerRef.current = null;
          return { running: false, progress: 100, done: true };
        }
        return { ...prev, progress: next };
      });
    }, 350);
  };

  const axialRef = useRef<HTMLCanvasElement>(null);
  const sagittalRef = useRef<HTMLCanvasElement>(null);
  const coronalRef = useRef<HTMLCanvasElement>(null);useRef<HTMLCanvasElement>(null);

  // Load study + MPR metadata
  useEffect(() => {
    if (!studyId) { setLoading(false); return; }
    setLoadError(null);
    fetch(`/api/v1/dental/studies/${studyId}`).then(r=>r.json()).then(d => {
      if (d.success) setStudy(d.data);
      else setLoadError(t('w9.states.error'));
    }).catch((err) => { console.error('[F04]', err); setLoadError(t('w9.states.error')); }).finally(() => setLoading(false));
    let cancelled = false;
    (async () => {
      try {
        const res = await dentalApi.getMpr(studyId);
        if (!cancelled && res.success && res.data && Number(res.data.sliceCount) > 0) {
          const n = Number(res.data.sliceCount);
          setMprMeta({ sliceCount: n, resolution: res.data.resolution, format: 'DICOM' });
          setTotalSlices({ Axial: n, Sagittal: n, Coronal: n });
          setMprSource('api');
        } else if (!cancelled && !res.success) {
          setLoadError(t('w9.states.error'));
        }
      } catch {
        if (!cancelled) setLoadError(t('w9.states.error'));
      }
    })();
    return () => { cancelled = true; };
  }, [studyId, reloadTick]);

  // Generate simulated DICOM slice canvas
  const drawSlice = useCallback((canvas: HTMLCanvasElement | null, plane: string, sliceIdx: number) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    
    // Simulated DICOM pixels
    const imageData = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const dist = Math.sqrt(Math.pow(x - w/2, 2) + Math.pow(y - h/2, 2));
        const angle = Math.atan2(y - h/2, x - w/2);
        // Generate anatomical-like pattern based on plane
        let val;
        if (plane === 'Axial') {
          val = 120 + 80 * Math.sin(dist / 30 + sliceIdx / 10) * Math.cos(angle * 4) + 30 * Math.random();
          // Bone-like circle
          if (dist > 100 && dist < 150) val += 60;
        } else if (plane === 'Sagittal') {
          val = 100 + 60 * Math.sin(dist / 20 - sliceIdx / 15) + 40 * Math.cos(angle * 3);
          if (x > w * 0.3 && x < w * 0.7 && y > h * 0.2 && y < h * 0.8) val += 40;
        } else {
          val = 110 + 50 * Math.cos(dist / 25 + sliceIdx / 12) + 30 * Math.cos(angle * 2);
          if (y > h * 0.6) val += 30;
        }
        // Apply window width/center
        const min = wc - ww / 2, max = wc + ww / 2;
        val = ((val - min) / (max - min)) * 255;
        val = Math.max(0, Math.min(255, val));
        imageData.data[i] = val;
        imageData.data[i + 1] = val;
        imageData.data[i + 2] = val;
        imageData.data[i + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Draw crosshair
    ctx.strokeStyle = '#00ff8855';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h/2); ctx.lineTo(w, h/2); ctx.stroke();
  }, [ww, wc]);

  // Redraw all planes when slices/ww/wc change
  useEffect(() => {
    drawSlice(axialRef.current, 'Axial', slices.Axial);
    drawSlice(sagittalRef.current, 'Sagittal', slices.Sagittal);
    drawSlice(coronalRef.current, 'Coronal', slices.Coronal);
  }, [slices, ww, wc, drawSlice]);

  const changeSlice = (plane: 'Axial' | 'Sagittal' | 'Coronal', delta: number) => {
    setSlices(s => ({ ...s, [plane]: Math.max(0, Math.min(totalSlices[plane] - 1, s[plane] + delta)) }));
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;

  return (
    <div style={{ padding: 0, background: '#000', minHeight: '100vh', color: '#fff' }}>
      {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}
      {/* Top Bar */}
      <div style={{ background: '#001529', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Maximize2 size={18} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>{t('w9d.mprViewer.title')}</span>
          <Tag color="cyan">v3.0.6.8-56</Tag>
          <Tag color="purple">{t('w9d.mprViewer.benchmark')}</Tag>
          {mprMeta && <Tag color="geekblue">{mprMeta.resolution} · {mprMeta.format}</Tag>}
          {mprSource === 'demo' && <Tag color="orange">{t('w8Dose.demoBadge')}</Tag>}
          <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{study?.patientName || studyId}</span>
        </Space>
        <Space>
          <InputNumber size="small" value={ww} onChange={(v) => setWw(v ?? 400)} min={1} max={2000} style={{ width: 80 }} suffix="W" />
          <InputNumber size="small" value={wc} onChange={(v) => setWc(v ?? 40)} min={-500} max={500} style={{ width: 80 }} suffix="C" />
          <Button size="small" icon={<RotateCcw size={14} />} onClick={() => { setWw(400); setWc(40); }}>{t('w9d.mprViewer.reset')}</Button>
        </Space>
      </div>

      {/* MPR Grid: 3 views */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', height: 'calc(100vh - 50px)' }}>
        {(['Axial', 'Sagittal', 'Coronal'] as const).map(plane => (
          <div key={plane} role="button" tabIndex={0}
            aria-label={`${planeLabel(plane)} ${t('w9d.mprViewer.viewSuffix')}`}
            aria-pressed={activePlane === plane}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActivePlane(plane) } }}
            style={{ position: 'relative', border: activePlane === plane ? '1px solid #00ff88' : '1px solid #222', cursor: 'pointer' }}
            onClick={() => setActivePlane(plane)}>
            <div style={{ position: 'absolute', top: 4, left: 8, color: '#00ff88', fontSize: 12, fontWeight: 600, zIndex: 2 }}>
              {planeLabel(plane)}
              <Tag style={{ marginLeft: 8 }} color="blue">{slices[plane] + 1}/{totalSlices[plane]}</Tag>
            </div>
            <canvas ref={plane === 'Axial' ? axialRef : plane === 'Sagittal' ? sagittalRef : coronalRef}
              width={512} height={512} style={{ width: '100%', height: '100%', cursor: 'pointer', imageRendering: 'pixelated' }}
              aria-label={`${planeLabel(plane)} ${t('w9d.mprViewer.canvasSuffix')}`}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = Math.floor((e.clientX - rect.left) / rect.width * 512);
                const y = Math.floor((e.clientY - rect.top) / rect.height * 512);
                // Cross-link slices: Clicking in axial moves sagittal/coronal
                if (plane === 'Axial') setSlices(s => ({ ...s, Sagittal: Math.round(x / 512 * 100), Coronal: Math.round(y / 512 * 100) }));
              }} />
            <div style={{ position: 'absolute', bottom: 4, left: 8, color: 'var(--text-secondary)', fontSize: 10 }}>
              WW: {ww} WC: {wc}
            </div>
            <div style={{ position: 'absolute', bottom: 4, right: 8, display: 'flex', gap: 4 }}>
              <Button size="small" aria-label={`${planeLabel(plane)}-${t('w9d.mprViewer.prevSlice')}`} icon={<ChevronLeft size={10} />} onClick={(e) => { e.stopPropagation(); changeSlice(plane, -1); }} />
              <Button size="small" aria-label={`${planeLabel(plane)}-${t('w9d.mprViewer.nextSlice')}`} icon={<ChevronRight size={10} />} onClick={(e) => { e.stopPropagation(); changeSlice(plane, 1); }} />
            </div>
          </div>
        ))}
        {/* Bottom Right: 3D Volume Rendering */}
        <div style={{ border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a1a' }}>
          <div style={{ textAlign: 'center', width: '100%', padding: 16 }}>
            {rebuild.done ? (
              <>
                <CheckCircle2 size={40} color="#00ff88" />
                <div style={{ color: '#00ff88', marginTop: 8, fontSize: 13, fontWeight: 600 }}>{t('w9d.mprViewer.volumeDone')}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 4 }}>
                  {t('w9d.mprViewer.volumeInfo')}
                </div>
                <Tag color="orange" style={{ marginTop: 8 }}>{t('w9d.mprViewer.demoRebuildWebgl')}</Tag>
                <div style={{ marginTop: 8 }}>
                  <Button size="small" onClick={() => setRebuild({ running: false, progress: 0, done: false })}>{t('w9d.mprViewer.rebuildAgain')}</Button>
                </div>
              </>
            ) : rebuild.running ? (
              <>
                <Activity size={40} color="#00ff88" style={{ animation: 'pulse 1s infinite' }} />
                <div style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 12 }}>{t('w9d.mprViewer.rebuilding', { progress: rebuild.progress })}</div>
                <div style={{ width: 220, margin: '12px auto 0' }}>
                  <Progress percent={rebuild.progress} size="small" strokeColor="#00ff88" showInfo={false} />
                </div>
                <Tag color="orange" style={{ marginTop: 8 }}>{t('w9d.mprViewer.demoRebuild')}</Tag>
              </>
            ) : (
              <>
                <Activity size={48} color="var(--text-secondary)" />
                <div style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 12 }}>{t('w9d.mprViewer.volumeRender')}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 4 }}>{t('w9d.mprViewer.volumeHint')}</div>
                <Button size="small" style={{ marginTop: 8 }} onClick={startRebuild}>{t('w9d.mprViewer.startRebuild')}</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default MprViewerPage;
