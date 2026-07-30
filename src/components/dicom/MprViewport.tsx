// ============================================================
// G005 放射RIS系统 v2.1.0 - MPR 多平面重建
// Phase R10 W2: Axial + Coronal + Sagittal 三平面同步
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCornerstone3D } from '../../hooks/useCornerstone';

export interface MprPlane {
  axis: 'axial' | 'coronal' | 'sagittal';
  index: number;            // 当前切片索引
  windowWidth: number;
  windowCenter: number;
  zoom: number;
  pan: { x: number; y: number };
}

export interface MprViewportProps {
  imageIds: string[];        // 单个 3D volume 的所有切片
  modality?: string;
  defaultWw?: number;
  defaultWc?: number;
  syncCrosshair?: boolean;   // 十字线同步
  showAllPlanes?: boolean;   // 显示 3 个平面
  height?: number;
}

// 平面轴定义
const PLANE_DEFINITIONS = {
  axial:    { label: 'Axial (横断面)',     shortLabel: 'A', color: '#3b82f6' },
  coronal:  { label: 'Coronal (冠状面)',   shortLabel: 'C', color: '#10b981' },
  sagittal: { label: 'Sagittal (矢状面)',  shortLabel: 'S', color: '#f59e0b' },
};

export default function MprViewport({
  imageIds,
  modality = 'CT',
  defaultWw = 400,
  defaultWc = 40,
  syncCrosshair: initialSyncCrosshair = true,
  showAllPlanes = true,
  height = 500,
}: MprViewportProps) {
  const { ready: _ready } = useCornerstone3D();
  const [syncCrosshair, setSyncCrosshair] = useState(initialSyncCrosshair);
  const [planes, setPlanes] = useState<Record<'axial' | 'coronal' | 'sagittal', MprPlane>>({
    axial:    { axis: 'axial',    index: Math.floor(imageIds.length / 2), windowWidth: defaultWw, windowCenter: defaultWc, zoom: 1, pan: { x: 0, y: 0 } },
    coronal:  { axis: 'coronal',  index: Math.floor(imageIds.length / 2), windowWidth: defaultWw, windowCenter: defaultWc, zoom: 1, pan: { x: 0, y: 0 } },
    sagittal: { axis: 'sagittal', index: Math.floor(imageIds.length / 2), windowWidth: defaultWw, windowCenter: defaultWc, zoom: 1, pan: { x: 0, y: 0 } },
  });
  const [showPlanes, setShowPlanes] = useState<Record<'axial' | 'coronal' | 'sagittal', boolean>>({
    axial: true, coronal: showAllPlanes, sagittal: showAllPlanes,
  });
  const [crosshair, setCrosshair] = useState({ x: 256, y: 256 });

  // 滚动某平面
  const scroll = useCallback((axis: 'axial' | 'coronal' | 'sagittal', delta: number) => {
    setPlanes(prev => ({
      ...prev,
      [axis]: { ...prev[axis], index: Math.max(0, Math.min(imageIds.length - 1, prev[axis].index + delta)) },
    }));
  }, [imageIds.length]);

  // 窗宽窗位
  const setWWWC = useCallback((axis: 'axial' | 'coronal' | 'sagittal', ww: number, wc: number) => {
    setPlanes(prev => ({ ...prev, [axis]: { ...prev[axis], windowWidth: ww, windowCenter: wc } }));
  }, []);

  // 同步十字线
  const handleClick = useCallback((axis: 'axial' | 'coronal' | 'sagittal', x: number, y: number) => {
    setCrosshair({ x, y });
    if (syncCrosshair) {
      // 计算其他平面索引（基于点击位置）
      const idx = Math.floor((y / 512) * imageIds.length);
      if (axis !== 'axial') {
        setPlanes(prev => ({ ...prev, axial: { ...prev.axial, index: idx } }));
      }
      if (axis !== 'coronal') {
        setPlanes(prev => ({ ...prev, coronal: { ...prev.coronal, index: Math.floor((x / 512) * imageIds.length) } }));
      }
      if (axis !== 'sagittal') {
        setPlanes(prev => ({ ...prev, sagittal: { ...prev.sagittal, index: Math.floor((x / 512) * imageIds.length) } }));
      }
    }
  }, [imageIds.length, syncCrosshair]);

  // 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowUp') { e.preventDefault(); scroll('axial', 1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); scroll('axial', -1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); scroll('coronal', 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); scroll('coronal', -1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [scroll]);

  const visiblePlanes = (Object.keys(showPlanes) as Array<'axial' | 'coronal' | 'sagittal'>).filter(k => showPlanes[k]);

  return (
    <div style={{ background: '#0a0a0a', borderRadius: 8, padding: 8, height: isFullscreenHeight(height) }}>
      {/* 工具栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: '#cbd5e1' }}>
        <span>MPR 三平面重建 ({imageIds.length} 切片)</span>
        <div style={{ width: 1, height: 16, background: '#333' }} />
        {(Object.keys(PLANE_DEFINITIONS) as Array<keyof typeof PLANE_DEFINITIONS>).map(k => (
          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={showPlanes[k]} onChange={e => setShowPlanes(prev => ({ ...prev, [k]: e.target.checked }))} />
            <span style={{ color: PLANE_DEFINITIONS[k].color, fontWeight: 600 }}>{PLANE_DEFINITIONS[k].shortLabel}</span>
            {PLANE_DEFINITIONS[k].label}
          </label>
        ))}
        <div style={{ width: 1, height: 16, background: '#333' }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={syncCrosshair} onChange={e => setSyncCrosshair(e.target.checked)} />
          十字线同步
        </label>
        <div style={{ flex: 1 }} />
        <span style={{ color: '#64748b' }}>↑↓ 轴向 | ←→ 冠状 | ESC 关闭</span>
      </div>

      {/* 三平面网格 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: visiblePlanes.length === 3 ? 'repeat(3, 1fr)' : visiblePlanes.length === 2 ? 'repeat(2, 1fr)' : '1fr',
        gap: 4,
        height: 'calc(100% - 40px)',
      }}>
        {visiblePlanes.map(axis => (
          <PlanePanel
            key={axis}
            axis={axis}
            imageIds={imageIds}
            plane={planes[axis]}
            modality={modality}
            crosshair={crosshair}
            onClick={(x, y) => handleClick(axis, x, y)}
            onScroll={(delta) => scroll(axis, delta)}
            onWWWC={(ww, wc) => setWWWC(axis, ww, wc)}
          />
        ))}
      </div>
    </div>
  );
}

function isFullscreenHeight(h: number) { return h; }

interface PlanePanelProps {
  axis: 'axial' | 'coronal' | 'sagittal';
  imageIds: string[];
  plane: MprPlane;
  modality: string;
  crosshair: { x: number; y: number };
  onClick: (x: number, y: number) => void;
  onScroll: (delta: number) => void;
  onWWWC: (ww: number, wc: number) => void;
}

function PlanePanel({ axis, imageIds, plane, modality: _modality, crosshair, onClick, onScroll, onWWWC }: PlanePanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const def = PLANE_DEFINITIONS[axis];

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 512;
    canvas.height = 512;
    // 模拟绘制：灰度 + WW/WL 应用
    const imageData = ctx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const idx = (y * 512 + x) * 4;
        // 模拟组织灰度（不同平面不同）
        let value = 80 + Math.sin(x / 30 + plane.index * 0.3) * 30 + Math.cos(y / 25) * 20;
        if (axis === 'sagittal') value += Math.sin(x / 20) * 15;
        if (axis === 'coronal') value += Math.cos(y / 20) * 10;
        // 应用 WW/WL
        const gray = Math.max(0, Math.min(255, ((value - plane.windowCenter) / plane.windowWidth + 0.5) * 255));
        imageData.data[idx] = gray;
        imageData.data[idx + 1] = gray;
        imageData.data[idx + 2] = gray;
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [plane.index, plane.windowWidth, plane.windowCenter, axis]);

  return (
    <div style={{ position: 'relative', background: '#000', borderRadius: 4, overflow: 'hidden', border: `2px solid ${def.color}` }}>
      {/* 平面标签 */}
      <div style={{ position: 'absolute', top: 4, left: 4, padding: '2px 6px', background: def.color, color: '#fff', borderRadius: 3, fontSize: 12, fontWeight: 600, zIndex: 5 }}>
        {def.label}
      </div>
      <div style={{ position: 'absolute', top: 4, right: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.7)', color: '#fbbf24', borderRadius: 3, fontSize: 12, zIndex: 5 }}>
        {plane.index + 1}/{imageIds.length} | W:{plane.windowWidth} L:{plane.windowCenter}
      </div>

      <canvas
        ref={canvasRef}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onClick(e.clientX - rect.left, e.clientY - rect.top);
        }}
        onWheel={(e) => {
          e.preventDefault();
          onScroll(e.deltaY > 0 ? 1 : -1);
        }}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'crosshair',
          imageRendering: 'pixelated',
        }}
      />

      {/* 十字线 */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 512 512" preserveAspectRatio="none">
        <line x1={crosshair.x} y1="0" x2={crosshair.x} y2="512" stroke="#fbbf24" strokeWidth="0.5" strokeDasharray="4,2" />
        <line x1="0" y1={crosshair.y} x2="512" y2={crosshair.y} stroke="#fbbf24" strokeWidth="0.5" strokeDasharray="4,2" />
        <circle cx={crosshair.x} cy={crosshair.y} r="6" fill="none" stroke="#fbbf24" strokeWidth="1" />
      </svg>

      {/* WW/WL 控制 */}
      <div style={{ position: 'absolute', bottom: 4, left: 4, right: 4, display: 'flex', gap: 4, fontSize: 12, color: '#cbd5e1' }}>
        <label style={{ flex: 1 }}>
          W:
          <input type="range" min="1" max="3000" value={plane.windowWidth} onChange={e => onWWWC(parseInt(e.target.value), plane.windowCenter)} style={{ width: '60%' }} />
        </label>
        <label style={{ flex: 1 }}>
          L:
          <input type="range" min="-1000" max="1000" value={plane.windowCenter} onChange={e => onWWWC(plane.windowWidth, parseInt(e.target.value))} style={{ width: '60%' }} />
        </label>
      </div>
    </div>
  );
}
