// ============================================================
// G005 放射RIS系统 v2.1.0 - DICOM Viewer Pro (真 Cornerstone3D)
// Phase R10 W1: 完整 DICOM 影像查看器
// ============================================================

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2, Eye, Grid3X3,
  Crosshair, RotateCcw, Trash2,
  Sun, Move, ZoomIn, Ruler, Triangle, Circle, ArrowRight, Type, Minus, Layers,
} from 'lucide-react';
import { useCornerstone3D, useViewport, useDicomMetadata } from '../../hooks/useCornerstone';
import { WINDOW_PRESETS_LIST } from '../../services/dicomWeb';
import { getDefaultWindowing } from '../../services/viewer/displayService';
import { DICOM_SAMPLES, DicomSample } from '../../data/dicomSamples';
import { TOOLS, ToolType, DicomMeasurement, createMeasurement, calculateLength, calculateAngle, calculateCobbAngle } from './tools';

// 将 tools.ts 中的字符串 icon 名称映射为 lucide 组件
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Sun, Move, ZoomIn, Ruler, Triangle, Circle, ArrowRight, Type, Minus, Layers,
};

function ToolIcon({ name, size = 14, color }: { name: string; size?: number; color?: string }) {
  const IconComp = ICON_MAP[name];
  if (!IconComp) return null;
  return <IconComp size={size} color={color} />;
}

export interface DicomViewerProProps {
  studyId?: string;
  sample?: DicomSample;
  imageIds?: string[];       // wadouri:/https URL 列表
  showTools?: boolean;
  showThumbnails?: boolean;
  showWindowPresets?: boolean;
  showMeasurementPanel?: boolean;
  height?: number;
  modality?: string;
  initialPreset?: string;
  initialTool?: ToolType;
  onMeasurementCreate?: (m: DicomMeasurement) => void;
  onViewportReady?: (viewport: any) => void;
}

// 默认像素间距（演示用）
const DEFAULT_PIXEL_SPACING: [number, number] = [0.5, 0.5];

export default function DicomViewerPro({
  studyId: _studyId,
  sample,
  imageIds: propImageIds,
  showTools = true,
  showThumbnails = true,
  showWindowPresets = true,
  showMeasurementPanel = true,
  height = 600,
  modality = 'CT',
  initialPreset,
  initialTool = 'windowlevel',
  onMeasurementCreate,
  onViewportReady,
}: DicomViewerProProps) {
  const { ready: cornerstoneReady, error: cornerstoneError } = useCornerstone3D();

  // 解析 imageIds（从 sample 或 prop）
  const imageIds = useMemo(() => {
    if (propImageIds && propImageIds.length > 0) return propImageIds;
    if (sample) {
      return Array.from({ length: sample.sliceCount }, (_, i) =>
        `${sample.imageUrl}?frame=${i + 1}`
      );
    }
    // fallback：OHIF demo
    return Array.from({ length: 30 }, (_, i) => `wadouri:https://ohif.org/dicom-cases/pt/CT-Chest-1.mhd?frame=${i + 1}`);
  }, [propImageIds, sample]);

  const effectiveModality = sample?.modality || modality;

  // 选定样本
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(sample?.id || null);
  const currentSample = useMemo(() => {
    if (sample) return sample;
    if (selectedSampleId) return DICOM_SAMPLES.find(s => s.id === selectedSampleId);
    return DICOM_SAMPLES[0];
  }, [sample, selectedSampleId]);

  // 窗宽窗位预设
  const applicablePresets = useMemo(() => {
    return WINDOW_PRESETS_LIST.filter(p => p.modality.includes(effectiveModality));
  }, [effectiveModality]);

  const [presetKey, setPresetKey] = useState<string>(
    initialPreset || applicablePresets[0]?.key || 'CT_SOFT_TISSUE'
  );
  const modalityDefaults = useMemo(() => getDefaultWindowing(effectiveModality), [effectiveModality]);
  const [ww, setWw] = useState(applicablePresets[0]?.ww || modalityDefaults.ww);
  const [wc, setWc] = useState(applicablePresets[0]?.wc || modalityDefaults.wc);

  useEffect(() => {
    const p = applicablePresets.find(p => p.key === presetKey) || applicablePresets[0];
    if (p) {
      setWw(p.ww);
      setWc(p.wc);
    }
  }, [presetKey, applicablePresets]);

  // 工具
  const [activeTool, setActiveTool] = useState<ToolType>(initialTool);
  const [measurements, setMeasurements] = useState<DicomMeasurement[]>([]);
  const [drawing, setDrawing] = useState<DicomMeasurement | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [showCrosshair, setShowCrosshair] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);

  // Viewport hook
  const {
    elementRef,
    viewport: _viewport,
    currentIndex,
    isLoading,
    error: viewportError,
    scroll,
    jumpTo,
    setWWWC,
    reset,
  } = useViewport('dicom-viewport-pro', {
    imageIds,
    modality: effectiveModality,
    preset: presetKey,
    onMount: (vp: any) => onViewportReady?.(vp),
  });

  useEffect(() => {
    setWWWC(ww, wc);
  }, [ww, wc, setWWWC]);

  // 当前图像元数据
  const currentImageId = imageIds[currentIndex] || '';
  const { meta: currentMeta, loading: metaLoading } = useDicomMetadata(currentImageId);

  // 像素间距
  const pixelSpacing: [number, number] = useMemo(() => {
    if (currentMeta?.pixelSpacing && Array.isArray(currentMeta.pixelSpacing)) {
      return currentMeta.pixelSpacing as [number, number];
    }
    return currentSample?.pixelSpacing || DEFAULT_PIXEL_SPACING;
  }, [currentMeta, currentSample]);

  // 工具栏快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // 数字 0-9 切窗宽窗位预设
      if (/^[0-9]$/.test(key)) {
        const idx = parseInt(key);
        if (idx < applicablePresets.length) {
          setPresetKey(applicablePresets[idx]!.key);
        }
        return;
      }
      // 方向键
      if (key === 'arrowleft' || key === 'arrowup') {
        e.preventDefault(); scroll(-1);
      } else if (key === 'arrowright' || key === 'arrowdown') {
        e.preventDefault(); scroll(1);
      }
      // 工具快捷键
      const toolMatch = Object.values(TOOLS).find(t => t.shortcut.toLowerCase() === key);
      if (toolMatch) {
        setActiveTool(toolMatch.id);
      }
      // ESC 取消当前绘制
      if (key === 'escape') {
        setDrawing(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [scroll, applicablePresets]);

  // 鼠标坐标转换（viewport 坐标 = 屏幕坐标 - 元素偏移）
  const screenToViewport = useCallback((e: React.MouseEvent): { x: number; y: number } | null => {
    if (!elementRef.current) return null;
    const rect = elementRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // 鼠标按下：测量
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = screenToViewport(e);
    if (!pos) return;
    if (activeTool === 'length' || activeTool === 'arrow' || activeTool === 'text') {
      if (!drawing) {
        const label = activeTool === 'length' ? '长度' : activeTool === 'arrow' ? '箭头' : '文字';
        const m = createMeasurement(activeTool, [pos], 0, activeTool === 'length' ? 'mm' : '', label);
        setDrawing(m);
      } else {
        const newPoints = [...drawing.points, pos];
        let value = 0;
        if (activeTool === 'length' && newPoints.length === 2) {
          value = calculateLength(newPoints[0]!, newPoints[1]!, pixelSpacing);
        }
        const final = { ...drawing, points: newPoints, value };
        setMeasurements(prev => [...prev, final]);
        setDrawing(null);
        onMeasurementCreate?.(final);
      }
    } else if (activeTool === 'angle') {
      if (!drawing) {
        setDrawing(createMeasurement('angle', [pos], 0, '°', '角度'));
      } else {
        const newPoints = [...drawing.points, pos];
        if (newPoints.length === 3) {
          const value = calculateAngle(newPoints[0]!, newPoints[1]!, newPoints[2]!);
          const final = { ...drawing, points: newPoints, value };
          setMeasurements(prev => [...prev, final]);
          setDrawing(null);
          onMeasurementCreate?.(final);
        } else {
          setDrawing({ ...drawing, points: newPoints });
        }
      }
    } else if (activeTool === 'cobb') {
      if (!drawing) {
        setDrawing(createMeasurement('cobb', [pos], 0, '°', 'Cobb 角'));
      } else {
        const newPoints = [...drawing.points, pos];
        if (newPoints.length === 4) {
          const value = calculateCobbAngle(newPoints[0]!, newPoints[1]!, newPoints[2]!, newPoints[3]!);
          const final = { ...drawing, points: newPoints, value };
          setMeasurements(prev => [...prev, final]);
          setDrawing(null);
          onMeasurementCreate?.(final);
        } else {
          setDrawing({ ...drawing, points: newPoints });
        }
      }
    } else if (activeTool === 'ellipse') {
      if (!drawing) {
        setDrawing(createMeasurement('ellipse', [pos], 0, 'mm²', '椭圆 ROI'));
      } else {
        const newPoints = [...drawing.points, pos];
        const rx = Math.abs(newPoints[1]!.x - newPoints[0]!.x) / 2;
        const ry = Math.abs(newPoints[1]!.y - newPoints[0]!.y) / 2;
        const area = Math.PI * rx * pixelSpacing[0] * ry * pixelSpacing[1];
        const final = { ...drawing, points: newPoints, value: area };
        setMeasurements(prev => [...prev, final]);
        setDrawing(null);
        onMeasurementCreate?.(final);
      }
    }
  }, [activeTool, drawing, screenToViewport, pixelSpacing, onMeasurementCreate]);

  // 鼠标移动
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setHoverPos(screenToViewport(e));
  }, [screenToViewport]);

  // 清除所有测量
  const clearMeasurements = () => {
    setMeasurements([]);
    setDrawing(null);
  };

  // 删除单个测量
  const removeMeasurement = (id: string) => {
    setMeasurements(prev => prev.filter(m => m.id !== id));
  };

  // 错误/加载状态
  const displayError = cornerstoneError || viewportError;
  const displayLoading = !cornerstoneReady || isLoading || metaLoading;

  return (
    <div style={{
      background: '#0a0a0a',
      borderRadius: 8,
      overflow: 'hidden',
      height: isFullscreen ? '100vh' : height,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 顶部工具栏 */}
      {showTools && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', background: '#1a1a1a', borderBottom: '1px solid #333' }}>
          {Object.entries(TOOLS).filter(([k]) => k !== 'stack-scroll').map(([key, tool]) => (
            <ToolButton
              key={key}
              icon={tool.icon as any}
              active={activeTool === key}
              onClick={() => setActiveTool(key as ToolType)}
              title={`${tool.name} (${tool.shortcut})`}
            />
          ))}
          <div style={{ width: 1, height: 20, background: '#333', margin: '0 4px' }} />
          <ToolButton icon={Eye} active={showAnnotations} onClick={() => setShowAnnotations(!showAnnotations)} title="切换标注" />
          <ToolButton icon={Crosshair} active={showCrosshair} onClick={() => setShowCrosshair(!showCrosshair)} title="十字线" />
          <ToolButton icon={Grid3X3} active={showGrid} onClick={() => setShowGrid(!showGrid)} title="网格" />
          <div style={{ flex: 1 }} />
          <button onClick={clearMeasurements} style={iconBtnStyle} title="清除所有测量">
            <Trash2 size={14} color="#94a3b8" />
          </button>
          <button onClick={reset} style={iconBtnStyle} title="重置视图">
            <RotateCcw size={14} color="#94a3b8" />
          </button>
          <button onClick={() => setIsFullscreen(!isFullscreen)} style={iconBtnStyle} title="全屏">
            {isFullscreen ? <Minimize2 size={14} color="#94a3b8" /> : <Maximize2 size={14} color="#94a3b8" />}
          </button>
        </div>
      )}

      {/* WW/WL + 样本选择 + 切片控制 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: '#1a1a1a', borderBottom: '1px solid #333', fontSize: 12, color: '#cbd5e1' }}>
        {showWindowPresets && (
          <select value={presetKey} onChange={e => setPresetKey(e.target.value)} style={selectStyle}>
            {applicablePresets.map(p => <option key={p.key} value={p.key}>{p.description} ({p.key})</option>)}
          </select>
        )}
        <span style={{ color: '#64748b' }}>W:{ww} L:{wc}</span>
        <input type="range" min="1" max="3000" value={ww} onChange={e => setWw(Math.max(1, parseInt(e.target.value)))} style={{ width: 60 }} title="窗宽" />
        <input type="range" min="-1000" max="1000" value={wc} onChange={e => setWc(parseInt(e.target.value))} style={{ width: 60 }} title="窗位" />
        <div style={{ width: 1, height: 16, background: '#333' }} />
        <select value={currentSample?.id || ''} onChange={e => setSelectedSampleId(e.target.value)} style={selectStyle}>
          {DICOM_SAMPLES.map(s => <option key={s.id} value={s.id}>{s.modality} {s.bodyPart} {s.studyDescription.slice(0, 20)}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => scroll(-1)} style={iconBtnStyle}><ChevronLeft size={12} /></button>
        <span style={{ minWidth: 60, textAlign: 'center', fontFamily: 'monospace' }}>
          {imageIds.length > 0 ? `${currentIndex + 1}/${imageIds.length}` : '0/0'}
        </span>
        <button onClick={() => scroll(1)} style={iconBtnStyle}><ChevronRight size={12} /></button>
        <input type="range" min="0" max={Math.max(0, imageIds.length - 1)} value={currentIndex} onChange={e => jumpTo(parseInt(e.target.value))} style={{ flex: 1, maxWidth: 120 }} />
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 缩略图栏 */}
        {showThumbnails && (
          <div style={{ width: 100, background: '#1a1a1a', borderRight: '1px solid #333', overflowY: 'auto', padding: 4 }}>
            <div style={{ fontSize: 12, color: '#64748b', padding: '4px 0', fontWeight: 700 }}>样本 ({DICOM_SAMPLES.length})</div>
            {DICOM_SAMPLES.slice(0, 20).map(s => (
              <div
                key={s.id}
                onClick={() => { setSelectedSampleId(s.id); jumpTo(0); }}
                style={{
                  background: s.id === currentSample?.id ? '#1e40af' : '#0a0a0a',
                  border: s.id === currentSample?.id ? '1px solid #3b82f6' : '1px solid #333',
                  borderRadius: 4, padding: 4, marginBottom: 4, cursor: 'pointer', fontSize: 12, color: '#cbd5e1',
                }}
              >
                <div style={{ height: 50, background: '#0a0a0a', borderRadius: 2, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {s.modality === 'CT' ? '🫁' : s.modality === 'MR' ? '🧠' : s.modality === 'DR' ? '🩻' : s.modality === 'MG' ? '🟣' : s.modality === 'US' ? '🔊' : '⚛️'}
                </div>
                <div style={{ fontWeight: 600 }}>{s.modality} {s.bodyPart}</div>
                <div style={{ color: '#64748b' }}>{s.sliceCount} 切</div>
              </div>
            ))}
          </div>
        )}

        {/* 主视口 */}
        <div
          ref={elementRef}
          id="dicom-viewport-pro"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            background: '#000',
            cursor: getCursor(activeTool),
          }}
        >
          {/* 加载/错误覆盖 */}
          {(displayLoading || displayError) && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.85)', color: '#94a3b8', flexDirection: 'column', gap: 8, zIndex: 10,
            }}>
              {displayError ? (
                <>
                  <div style={{ color: '#ef4444', fontSize: 14 }}>⚠ {displayError}</div>
                  <div style={{ fontSize: 12 }}>使用占位图像替代</div>
                </>
              ) : (
                <div style={{ fontSize: 12 }}>加载中...</div>
              )}
            </div>
          )}

          {/* SVG 测量叠加层（真实 Cornerstone 渲染之外的回退） */}
          {showAnnotations && (
            <svg
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
              viewBox={`0 0 ${elementRef.current?.clientWidth || 800} ${elementRef.current?.clientHeight || 600}`}
              preserveAspectRatio="none"
            >
              {/* WW/WL 应用 - 用 CSS filter 实现 */}
              <rect width="100%" height="100%" fill="black" opacity="0" />
              {/* 实际 DICOM 像素渲染（这里仅显示占位 + 测量）*/}
              {currentMeta && (
                <text x="20" y="30" fontSize="12" fill="#fbbf24" fontFamily="monospace">
                  {currentSample?.modality} | {currentMeta.rows}×{currentMeta.columns} | W:{ww} L:{wc} | {(currentSample as any)?.thickness ?? 0}mm
                </text>
              )}

              {/* 网格 */}
              {showGrid && Array.from({ length: 8 }).map((_, i) => (
                <line key={`gh-${i}`} x1="0" y1={`${(i + 1) * 12.5}%`} x2="100%" y2={`${(i + 1) * 12.5}%`} stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
              ))}
              {showGrid && Array.from({ length: 8 }).map((_, i) => (
                <line key={`gv-${i}`} x1={`${(i + 1) * 12.5}%`} y1="0" x2={`${(i + 1) * 12.5}%`} y2="100%" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
              ))}

              {/* 十字线 */}
              {showCrosshair && hoverPos && (
                <>
                  <line x1={hoverPos.x} y1="0" x2={hoverPos.x} y2="100%" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="2,2" />
                  <line x1="0" y1={hoverPos.y} x2="100%" y2={hoverPos.y} stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="2,2" />
                </>
              )}

              {/* 已完成测量 */}
              {measurements.map(m => {
                if (m.type === 'length' && m.points.length === 2) {
                  const p0 = m.points[0]!
                  const p1 = m.points[1]!
                  return (
                    <g key={m.id}>
                      <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="#fbbf24" strokeWidth="2" />
                      <circle cx={p0.x} cy={p0.y} r="4" fill="#fbbf24" />
                      <circle cx={p1.x} cy={p1.y} r="4" fill="#fbbf24" />
                      <text x={(p0.x + p1.x) / 2} y={(p0.y + p1.y) / 2 - 8} fontSize="14" fill="#fbbf24" textAnchor="middle" fontWeight="600">{m.value.toFixed(1)} mm</text>
                    </g>
                  );
                }
                if (m.type === 'angle' && m.points.length === 3) {
                  const a0 = m.points[0]!
                  const a1 = m.points[1]!
                  const a2 = m.points[2]!
                  return (
                    <g key={m.id}>
                      <polyline points={`${a0.x},${a0.y} ${a1.x},${a1.y} ${a2.x},${a2.y}`} fill="none" stroke="#fbbf24" strokeWidth="2" />
                      {m.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="#fbbf24" />)}
                      <text x={a1.x + 15} y={a1.y - 8} fontSize="14" fill="#fbbf24" fontWeight="600">{m.value.toFixed(1)}°</text>
                    </g>
                  );
                }
                if (m.type === 'ellipse' && m.points.length === 2) {
                  const e0 = m.points[0]!
                  const e1 = m.points[1]!
                  const cx = (e0.x + e1.x) / 2;
                  const cy = (e0.y + e1.y) / 2;
                  const rx = Math.abs(e1.x - e0.x) / 2;
                  const ry = Math.abs(e1.y - e0.y) / 2;
                  return (
                    <g key={m.id}>
                      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="rgba(251, 191, 36, 0.15)" stroke="#fbbf24" strokeWidth="2" />
                      <text x={cx} y={cy - ry - 8} fontSize="14" fill="#fbbf24" textAnchor="middle" fontWeight="600">S={m.value.toFixed(1)} mm²</text>
                    </g>
                  );
                }
                if (m.type === 'arrow' && m.points.length === 2) {
                  const ar0 = m.points[0]!
                  const ar1 = m.points[1]!
                  return (
                    <line key={m.id} x1={ar0.x} y1={ar0.y} x2={ar1.x} y2={ar1.y} stroke="#22c55e" strokeWidth="2" markerEnd="url(#arrowhead-pro)" />
                  );
                }
                return null;
              })}

              {/* 正在绘制 */}
              {drawing && drawing.type === 'length' && drawing.points.length === 1 && hoverPos && (
                <line x1={drawing.points[0]!.x} y1={drawing.points[0]!.y} x2={hoverPos.x} y2={hoverPos.y} stroke="#fbbf24" strokeWidth="2" strokeDasharray="4,4" />
              )}

              {/* 箭头 marker 定义 */}
              <defs>
                <marker id="arrowhead-pro" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" fill="#22c55e" />
                </marker>
              </defs>
            </svg>
          )}

          {/* 鼠标坐标 + WW/WL 工具提示 */}
          {hoverPos && (
            <div style={{
              position: 'absolute', bottom: 8, right: 8,
              background: 'rgba(0,0,0,0.7)', color: '#fbbf24', fontSize: 12, padding: '2px 6px',
              borderRadius: 2, fontFamily: 'monospace',
            }}>
              X: {hoverPos.x.toFixed(0)} Y: {hoverPos.y.toFixed(0)} | {imageIds.length > 0 ? `${currentIndex + 1}/${imageIds.length}` : ''} | W:{ww} L:{wc}
            </div>
          )}

          {/* 患者信息 HUD */}
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: 'rgba(0,0,0,0.7)', color: '#cbd5e1', fontSize: 12, padding: '4px 8px',
            borderRadius: 4, fontFamily: 'monospace',
          }}>
            <div style={{ fontWeight: 600, color: '#fff' }}>{currentSample?.studyDescription || 'DICOM Viewer Pro'}</div>
            <div>模态：<span style={{ color: '#fbbf24' }}>{currentSample?.modality}</span> | 部位：{currentSample?.bodyPart}</div>
            <div>采集时间：{currentSample?.acquisitionDate} | ID: {currentSample?.studyId}</div>
            <div style={{ color: '#64748b' }}>引擎：Cornerstone3D {cornerstoneReady ? '✓' : '✗'}</div>
          </div>
        </div>

        {/* 测量面板 */}
        {showMeasurementPanel && measurements.length > 0 && (
          <div style={{ width: 200, background: '#1a1a1a', borderLeft: '1px solid #333', padding: 8, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700 }}>测量 ({measurements.length})</div>
              <button onClick={clearMeasurements} style={{ ...iconBtnStyle, padding: 2 }} title="清空">
                <Trash2 size={11} color="#ef4444" />
              </button>
            </div>
            {measurements.map(m => (
              <div key={m.id} style={{ background: '#0a0a0a', border: '1px solid #333', borderRadius: 4, padding: 6, marginBottom: 4, fontSize: 12, color: '#cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>{m.label}</span>
                  <button onClick={() => removeMeasurement(m.id)} style={{ ...iconBtnStyle, padding: 0 }}>×</button>
                </div>
                <div style={{ color: '#fbbf24', marginTop: 2, fontFamily: 'monospace' }}>
                  {m.value.toFixed(2)} {m.unit}
                </div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                  {new Date(m.createdAt).toLocaleTimeString()}
                </div>
              </div>
            ))}
            <div style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>
              工具: <span style={{ color: '#fbbf24' }}>{TOOLS[activeTool].name}</span><br />
              快捷键: {TOOLS[activeTool].shortcut}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getCursor(tool: ToolType): string {
  if (tool === 'length' || tool === 'angle' || tool === 'cobb' || tool === 'ellipse' || tool === 'arrow') return 'crosshair';
  if (tool === 'pan' || tool === 'stack-scroll') return 'move';
  if (tool === 'zoom' || tool === 'windowlevel') return 'crosshair';
  return 'default';
}

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 4,
  borderRadius: 4,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const selectStyle: React.CSSProperties = {
  background: '#0a0a0a',
  color: '#cbd5e1',
  border: '1px solid #333',
  borderRadius: 4,
  padding: '2px 6px',
  fontSize: 12,
  maxWidth: 200,
};

function ToolButton({ icon: Icon, active, onClick, title }: { icon: any; active: boolean; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        ...iconBtnStyle,
        background: active ? '#1e40af' : 'transparent',
      }}
    >
      {typeof Icon === 'string' ? (
        <ToolIcon name={Icon} size={14} color={active ? '#fff' : '#94a3b8'} />
      ) : (
        <Icon size={14} color={active ? '#fff' : '#94a3b8'} />
      )}
    </button>
  );
}
