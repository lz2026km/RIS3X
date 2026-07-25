// @ts-nocheck
// ============================================================
// G005 放射RIS系统 v2.0.0 - DICOM Viewer Lite (编辑器内嵌版)
// Phase R8 W2-C1: 轻量 DICOM 影像查看器
// 用于嵌入 ReportWriteV2Page 左侧 / ReportWriteV3Page
// ============================================================

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ZoomIn, Move, Sun, Ruler, Type, Square,
  ArrowRight, RotateCcw, Eye, Grid3X3,
  Maximize2, Minimize2, ChevronLeft, ChevronRight,
  Activity, Crosshair, Play, Pause, Info, Search,
} from 'lucide-react';

export interface DicomLiteSeries {
  id: string;
  modality: string;
  bodyPart: string;
  seriesDescription: string;
  sliceCount: number;
  thickness: number;
  imageUrl: string;
  acquiredAt: string;
  contrast?: 'non-contrast' | 'arterial' | 'portal' | 'delayed' | 'T1' | 'T2' | 'DWI';
}

export interface DicomLiteMeasurement {
  id: string;
  type: 'length' | 'angle' | 'roi' | 'arrow' | 'text';
  points: { x: number; y: number }[];
  value: string;
  unit: string;
  label: string;
}

export interface DicomLiteProps {
  series: DicomLiteSeries[];
  currentSlice?: number;
  showThumbnails?: boolean;
  showTools?: boolean;
  showMeasurementPanel?: boolean;
  height?: number;
  onMeasurementCreate?: (m: DicomLiteMeasurement) => void;
}

const WINDOW_PRESETS = [
  { label: '软组织', ww: 400, wc: 40, icon: '🫁', color: '#888' },
  { label: '肺窗',   ww: 1500, wc: -600, icon: '🫁', color: '#aac' },
  { label: '骨窗',   ww: 2000, wc: 400, icon: '🦴', color: '#ddd' },
  { label: '脑窗',   ww: 80, wc: 40, icon: '🧠', color: '#667' },
  { label: '肝窗',   ww: 150, wc: 50, icon: '🫀', color: '#966' },
  { label: '骨盆',   ww: 400, wc: 40, icon: '🦴', color: '#bbb' },
];

// 模拟 CT 影像（用 SVG 生成伪 CT 图像）
function generateMockCTImage(series: DicomLiteSeries, slice: number): string {
  const w = 512, h = 512;
  const hash = (series.id.charCodeAt(0) || 0) + slice * 17;
  let svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">`;
  svg += `<defs><radialGradient id="g1" cx="50%" cy="50%"><stop offset="0%" stop-color="#888"/><stop offset="100%" stop-color="#222"/></radialGradient></defs>`;
  svg += `<rect width="${w}" height="${h}" fill="url(#g1)"/>`;
  if (series.modality === 'CT' && series.bodyPart === '胸部') {
    for (let i = 0; i < 30; i++) {
      const x = (hash + i * 53) % w;
      const y = (hash + i * 89) % h;
      const r = 20 + (i % 5) * 10;
      svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(80,80,80,0.4)" stroke="rgba(120,120,120,0.6)" stroke-width="1"/>`;
    }
  } else if (series.modality === 'MR' && series.bodyPart === '头颅') {
    for (let i = 0; i < 20; i++) {
      const x = (hash + i * 47) % w;
      const y = (hash + i * 71) % h;
      const r = 30 + (i % 4) * 20;
      svg += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.7}" fill="rgba(60,60,60,0.5)" stroke="rgba(100,100,100,0.6)" stroke-width="1"/>`;
    }
  } else {
    for (let i = 0; i < 25; i++) {
      const x = (hash + i * 67) % w;
      const y = (hash + i * 97) % h;
      const r = 25 + (i % 6) * 8;
      svg += `<rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" fill="rgba(70,70,70,0.3)" stroke="rgba(110,110,110,0.5)" stroke-width="1"/>`;
    }
  }
  if (series.modality === 'CT' && series.bodyPart === '胸部') {
    for (let i = 0; i < 8; i++) {
      svg += `<ellipse cx="${100 + i * 50}" cy="${100}" rx="20" ry="8" fill="rgba(220,220,220,0.5)"/>`;
      svg += `<ellipse cx="${100 + i * 50}" cy="${400}" rx="20" ry="8" fill="rgba(220,220,220,0.5)"/>`;
    }
  }
  svg += `<text x="10" y="20" font-family="monospace" font-size="12" fill="white">${series.seriesDescription}</text>`;
  svg += `<text x="10" y="${h - 10}" font-family="monospace" font-size="12" fill="white">Slice ${slice + 1}/${series.sliceCount} | ${series.modality} | ${series.bodyPart}</text>`;
  svg += `</svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55;
}

export default function DicomViewerLite({
  series,
  currentSlice = 0,
  showThumbnails = true,
  showTools = true,
  showMeasurementPanel = true,
  height = 600,
  onMeasurementCreate,
}: DicomLiteProps) {
  const [activeSeries, setActiveSeries] = useState(0);
  const [slice, setSlice] = useState(currentSlice);
  const [preset, setPreset] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<'pan' | 'zoom' | 'ww' | 'measure-length' | 'measure-angle' | 'measure-roi' | 'arrow' | 'text' | 'magnifier'>('pan');
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showCrosshair, setShowCrosshair] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [measurements, setMeasurements] = useState<DicomLiteMeasurement[]>([]);
  const [drawing, setDrawing] = useState<DicomLiteMeasurement | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [cinePlaying, setCinePlaying] = useState(false);
  const [cineFps, setCineFps] = useState(1);
  const [showWwPanel, setShowWwPanel] = useState(false);
  const [showInfoHud, setShowInfoHud] = useState(true);
  const [mousePx, setMousePx] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMoveAtRef = useRef(0);
  const pendingMoveRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  const activeSer = (series[activeSeries] || series[0])!;
  const mockImage = useMemo(() => (
    activeSer ? generateMockCTImage(activeSer, slice) : ''
  ), [activeSer, slice]);

  const fpsOptions = [1, 2, 4, 8];

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const goToSlice = useCallback((n: number) => {
    setSlice(Math.max(0, Math.min(activeSer.sliceCount - 1, n)));
  }, [activeSer.sliceCount]);

  const goToPrevSlice = useCallback(() => {
    setCinePlaying(false);
    goToSlice(slice - 1);
  }, [slice, goToSlice]);

  const goToNextSlice = useCallback(() => {
    setCinePlaying(false);
    goToSlice(slice + 1);
  }, [slice, goToSlice]);

  // CINE play effect
  useEffect(() => {
    if (!cinePlaying || !activeSer) return;
    const interval = setInterval(() => {
      setSlice(prev => {
        if (prev >= activeSer.sliceCount - 1) {
          setCinePlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / cineFps);
    return () => clearInterval(interval);
  }, [cinePlaying, cineFps, activeSer]);

  // Fullscreen change detection
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      switch (e.key.toLowerCase()) {
        case 'p': setTool('pan'); break;
        case 'z': setTool('zoom'); break;
        case 'w': setTool('ww'); break;
        case 'l': setTool('measure-length'); break;
        case 'a': setTool('measure-angle'); break;
        case 'r': resetView(); break;
        case 'm': setTool(t => t === 'magnifier' ? 'pan' : 'magnifier'); break;
        case 'arrowleft': e.preventDefault(); goToPrevSlice(); break;
        case 'arrowright': e.preventDefault(); goToNextSlice(); break;
        case ' ': e.preventDefault(); setCinePlaying(p => !p); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
        case '1': setPreset(0); break;
        case '2': setPreset(1); break;
        case '3': setPreset(2); break;
        case '4': setPreset(3); break;
        case '5': setPreset(4); break;
        case '6': setPreset(5); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeSer, goToPrevSlice, goToNextSlice, resetView, slice]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * 100;
    const y = (e.clientY - rect.top) / rect.height * 100;

    if (tool === 'measure-length') {
      if (!drawing) {
        setDrawing({ id: `m-${Date.now()}`, type: 'length', points: [{ x, y }], value: '', unit: 'mm', label: '长度' });
      } else {
        const dx = (x - drawing.points[0].x) * 5;
        const dy = (y - drawing.points[0].y) * 5;
        const dist = Math.sqrt(dx * dx + dy * dy).toFixed(1);
        const newM: DicomLiteMeasurement = {
          ...drawing,
          points: [...drawing.points, { x, y }],
          value: dist,
        };
        setMeasurements(prev => [...prev, newM]);
        setDrawing(null);
        onMeasurementCreate?.(newM);
      }
    } else if (tool === 'measure-roi') {
      if (!drawing) {
        setDrawing({ id: `m-${Date.now()}`, type: 'roi', points: [{ x, y }], value: '', unit: 'mm²', label: 'ROI' });
      } else {
        const w = Math.abs(x - drawing.points[0].x) * 5;
        const h = Math.abs(y - drawing.points[0].y) * 5;
        const area = (w * h).toFixed(1);
        const newM: DicomLiteMeasurement = {
          ...drawing,
          points: [...drawing.points, { x, y }],
          value: area,
        };
        setMeasurements(prev => [...prev, newM]);
        setDrawing(null);
        onMeasurementCreate?.(newM);
      }
    } else if (tool === 'arrow') {
      const newM: DicomLiteMeasurement = {
        id: `m-${Date.now()}`,
        type: 'arrow',
        points: [{ x: x - 5, y }, { x: x + 5, y }],
        value: '',
        unit: '',
        label: '箭头',
      };
      setMeasurements(prev => [...prev, newM]);
    }
  }, [tool, drawing, onMeasurementCreate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pctX = (e.clientX - rect.left) / rect.width * 100;
    const pctY = (e.clientY - rect.top) / rect.height * 100;
    const pxX = e.clientX - rect.left;
    const pxY = e.clientY - rect.top;
    pendingMoveRef.current = { x: pctX, y: pctY };
    const now = performance.now();
    if (now - lastMoveAtRef.current < 33) {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          lastMoveAtRef.current = performance.now();
          const p = pendingMoveRef.current;
          if (!p) return;
          setHoverPos(p);
          setMousePx({ x: p.x * rect.width / 100, y: p.y * rect.height / 100 });
        });
      }
      return;
    }
    lastMoveAtRef.current = now;
    setHoverPos({ x: pctX, y: pctY });
    setMousePx({ x: pxX, y: pxY });
  }, []);

  if (!activeSer) {
    return (
      <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 40, textAlign: 'center', color: '#94a3b8', height }}>
        暂无影像
      </div>
    );
  }

  return (
    <div style={{ background: '#0a0a0a', borderRadius: 8, overflow: 'hidden', height: isFullscreen ? '100vh' : height, display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      {showTools && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', background: '#1a1a1a', borderBottom: '1px solid #333' }}>
          <ToolButton icon={Move} active={tool === 'pan'} onClick={() => setTool('pan')} title="Pan (P)" />
          <ToolButton icon={ZoomIn} active={tool === 'zoom'} onClick={() => setTool('zoom')} title="Zoom (Z)" />
          <ToolButton icon={Sun} active={tool === 'ww'} onClick={() => setTool('ww')} title="WW/WL (W)" />
          <div style={{ width: 1, height: 20, background: '#333', margin: '0 4px' }} />
          <ToolButton icon={Ruler} active={tool === 'measure-length'} onClick={() => setTool('measure-length')} title="Length (L)" />
          <ToolButton icon={Activity} active={tool === 'measure-angle'} onClick={() => setTool('measure-angle')} title="Angle (A)" />
          <ToolButton icon={Square} active={tool === 'measure-roi'} onClick={() => setTool('measure-roi')} title="ROI" />
          <ToolButton icon={ArrowRight} active={tool === 'arrow'} onClick={() => setTool('arrow')} title="Arrow" />
          <ToolButton icon={Type} active={tool === 'text'} onClick={() => setTool('text')} title="Text" />
          <div style={{ width: 1, height: 20, background: '#333', margin: '0 4px' }} />
          <ToolButton icon={Eye} active={showAnnotations} onClick={() => setShowAnnotations(!showAnnotations)} title="Toggle Annotations" />
          <ToolButton icon={Crosshair} active={showCrosshair} onClick={() => setShowCrosshair(!showCrosshair)} title="Crosshair" />
          <ToolButton icon={Grid3X3} active={showGrid} onClick={() => setShowGrid(!showGrid)} title="Grid" />
          <ToolButton icon={Search} active={tool === 'magnifier'} onClick={() => setTool(t => t === 'magnifier' ? 'pan' : 'magnifier')} title="Magnifier (M)" />
          <div style={{ width: 1, height: 20, background: '#333', margin: '0 4px' }} />
          <ToolButton icon={Info} active={showInfoHud} onClick={() => setShowInfoHud(!showInfoHud)} title="Toggle Info HUD" />
          <ToolButton
            icon={Sun}
            active={showWwPanel}
            onClick={() => setShowWwPanel(!showWwPanel)}
            title="Window Presets"
          />
          <div style={{ flex: 1 }} />
          {/* CINE controls */}
          <button
            onClick={() => setCinePlaying(p => !p)}
            style={{ ...iconBtnStyle, background: cinePlaying ? '#1e40af' : 'transparent' }}
            title="Play/Pause CINE (Space)"
          >
            {cinePlaying ? <Pause size={14} color="#fff" /> : <Play size={14} color="#94a3b8" />}
          </button>
          <select
            value={cineFps}
            onChange={e => setCineFps(Number(e.target.value))}
            style={{ ...selectStyle, width: 48 }}
            title="Frames per second"
          >
            {fpsOptions.map(fps => <option key={fps} value={fps}>{fps} FPS</option>)}
          </select>
          <button onClick={resetView} style={iconBtnStyle} title="Reset (R)"><RotateCcw size={14} color="#94a3b8" /></button>
          <button onClick={toggleFullscreen} style={iconBtnStyle} title="Fullscreen (F)">
            {isFullscreen ? <Minimize2 size={14} color="#94a3b8" /> : <Maximize2 size={14} color="#94a3b8" />}
          </button>
        </div>
      )}

      {/* CINE progress bar */}
      {cinePlaying && (
        <div style={{ height: 2, background: '#333' }}>
          <div style={{ height: '100%', width: `${((slice + 1) / activeSer.sliceCount) * 100}%`, background: '#22c55e', transition: 'width 0.1s' }} />
        </div>
      )}

      {/* Selector bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: '#1a1a1a', borderBottom: '1px solid #333', fontSize: 12, color: '#cbd5e1' }}>
        <select value={preset} onChange={e => setPreset(Number(e.target.value))} style={selectStyle}>
          {WINDOW_PRESETS.map((p, i) => <option key={i} value={i}>{p.icon} {p.label} (WW:{p.ww} WC:{p.wc})</option>)}
        </select>
        <span style={{ color: '#64748b' }}>W:{WINDOW_PRESETS[preset].ww} L:{WINDOW_PRESETS[preset].wc}</span>
        <div style={{ width: 1, height: 16, background: '#333' }} />
        <select value={activeSeries} onChange={e => setActiveSeries(Number(e.target.value))} style={selectStyle}>
          {series.map((s, i) => <option key={s.id} value={i}>{s.seriesDescription} ({s.sliceCount})</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={goToPrevSlice} style={iconBtnStyle}><ChevronLeft size={12} /></button>
        <span style={{ minWidth: 60, textAlign: 'center', fontFamily: 'monospace' }}>{slice + 1}/{activeSer.sliceCount}</span>
        <button onClick={goToNextSlice} style={iconBtnStyle}><ChevronRight size={12} /></button>
        <input type="range" min="0" max={activeSer.sliceCount - 1} value={slice} onChange={e => { setCinePlaying(false); setSlice(Number(e.target.value)); }} style={{ flex: 1, maxWidth: 120 }} />
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Thumbnails */}
        {showThumbnails && (
          <div style={{ width: 100, background: '#1a1a1a', borderRight: '1px solid #333', overflowY: 'auto', padding: 4 }}>
            <div style={{ fontSize: 12, color: '#64748b', padding: '4px 0', fontWeight: 700 }}>系列</div>
            {series.map((s, i) => (
              <div key={s.id} onClick={() => setActiveSeries(i)} style={{
                background: i === activeSeries ? '#1e3a5f' : '#0a0a0a',
                border: i === activeSeries ? '1px solid #3b82f6' : '1px solid #333',
                borderRadius: 4, padding: 4, marginBottom: 4, cursor: 'pointer', fontSize: 12, color: '#cbd5e1',
              }}>
                <img src={generateMockCTImage(s, 0)} alt={s.seriesDescription} loading="lazy" decoding="async" style={{ width: '100%', borderRadius: 2, marginBottom: 4 }} />
                <div style={{ fontWeight: 600 }}>{s.seriesDescription}</div>
                <div style={{ color: '#64748b' }}>{s.modality} | {s.sliceCount}片</div>
              </div>
            ))}
          </div>
        )}

        {/* Main image area */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => { setHoverPos(null); setMousePx(null); }}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            background: '#000',
            cursor: tool === 'pan' ? 'move' : tool === 'magnifier' ? 'none' : tool === 'measure-length' || tool === 'measure-roi' ? 'crosshair' : 'default',
          }}
        >
          {/* Image layer */}
          <div style={{
            position: 'absolute',
            inset: 0,
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transition: 'transform 0.1s',
          }}>
            <img src={mockImage} alt="CT slice" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: `brightness(${1 + (WINDOW_PRESETS[preset].wc / 1000)}) contrast(${WINDOW_PRESETS[preset].ww / 500})` }} />
          </div>

          {/* SVG overlay for measurements, crosshair, grid */}
          {showAnnotations && (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 100 100" preserveAspectRatio="none">
              {measurements.map(m => {
                if (m.type === 'length' && m.points.length === 2) {
                  const midX = (m.points[0].x + m.points[1].x) / 2;
                  const midY = (m.points[0].y + m.points[1].y) / 2 - 1;
                  const labelText = `${m.value} mm`;
                  const tw = estimateTextWidth(labelText, 2);
                  return (
                    <g key={m.id}>
                      <line x1={m.points[0].x} y1={m.points[0].y} x2={m.points[1].x} y2={m.points[1].y} stroke="#fbbf24" strokeWidth="0.3" />
                      <circle cx={m.points[0].x} cy={m.points[0].y} r="0.5" fill="#fbbf24" />
                      <circle cx={m.points[1].x} cy={m.points[1].y} r="0.5" fill="#fbbf24" />
                      <rect x={midX - tw / 2 - 0.3} y={midY - 1.2} width={tw + 0.6} height="2.4" rx="0.3" fill="rgba(0,0,0,0.7)" />
                      <text x={midX} y={midY + 0.7} fontSize="2" fill="#fff" textAnchor="middle">{labelText}</text>
                    </g>
                  );
                } else if (m.type === 'roi' && m.points.length === 2) {
                  const labelText = `${m.value} mm²`;
                  const tw = estimateTextWidth(labelText, 2);
                  return (
                    <g key={m.id}>
                      <rect x={Math.min(m.points[0].x, m.points[1].x)} y={Math.min(m.points[0].y, m.points[1].y)}
                            width={Math.abs(m.points[1].x - m.points[0].x)} height={Math.abs(m.points[1].y - m.points[0].y)}
                            fill="rgba(251, 191, 36, 0.1)" stroke="#fbbf24" strokeWidth="0.2" />
                      <rect x={m.points[0].x - 0.1} y={m.points[0].y - 2.2} width={tw + 0.6} height="2.4" rx="0.3" fill="rgba(0,0,0,0.7)" />
                      <text x={m.points[0].x + 0.2} y={m.points[0].y - 0.3} fontSize="2" fill="#fff">{labelText}</text>
                    </g>
                  );
                } else if (m.type === 'arrow' && m.points.length === 2) {
                  return (
                    <line key={m.id} x1={m.points[0].x} y1={m.points[0].y} x2={m.points[1].x} y2={m.points[1].y} stroke="#22c55e" strokeWidth="0.3" markerEnd="url(#arrowhead)" />
                  );
                }
                return null;
              })}
              {drawing && drawing.type === 'length' && (
                <line x1={drawing.points[0].x} y1={drawing.points[0].y}
                      x2={hoverPos?.x || drawing.points[0].x} y2={hoverPos?.y || drawing.points[0].y}
                      stroke="#fbbf24" strokeWidth="0.3" strokeDasharray="1,1" />
              )}
              {showCrosshair && hoverPos && (
                <>
                  <line x1={hoverPos.x} y1="0" x2={hoverPos.x} y2="100" stroke="#3b82f6" strokeWidth="0.1" strokeDasharray="0.5,0.5" />
                  <line x1="0" y1={hoverPos.y} x2="100" y2={hoverPos.y} stroke="#3b82f6" strokeWidth="0.1" strokeDasharray="0.5,0.5" />
                </>
              )}
              {showGrid && Array.from({ length: 10 }).map((_, i) => (
                <line key={`gh-${i}`} x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="0.05" />
              ))}
              {showGrid && Array.from({ length: 10 }).map((_, i) => (
                <line key={`gv-${i}`} x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="rgba(255,255,255,0.1)" strokeWidth="0.05" />
              ))}
            </svg>
          )}

          {/* Magnifying glass */}
          {tool === 'magnifier' && mousePx && (
            <div style={{
              position: 'absolute',
              left: mousePx.x - 60,
              top: mousePx.y - 60,
              width: 120,
              height: 120,
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid rgba(255,255,255,0.9)',
              pointerEvents: 'none',
              zIndex: 20,
              boxShadow: '0 0 12px rgba(0,0,0,0.6)',
            }}>
              <div style={{
                position: 'absolute',
                width: '200%',
                height: '200%',
                left: `${-mousePx.x * 2 + 60}px`,
                top: `${-mousePx.y * 2 + 60}px`,
              }}>
                <img src={mockImage} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: `brightness(${1 + (WINDOW_PRESETS[preset].wc / 1000)}) contrast(${WINDOW_PRESETS[preset].ww / 500})` }} />
              </div>
            </div>
          )}

          {/* Image info HUD - bottom left */}
          {showInfoHud && hoverPos && (
            <div style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              background: 'rgba(0,0,0,0.75)',
              color: '#e2e8f0',
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 3,
              fontFamily: 'monospace',
              lineHeight: 1.6,
              pointerEvents: 'none',
            }}>
              <div>系列: {activeSeries + 1}/{series.length}</div>
              <div>层: {slice + 1}/{activeSer.sliceCount}</div>
              <div>WW: {WINDOW_PRESETS[preset].ww} WL: {WINDOW_PRESETS[preset].wc}</div>
              <div>缩放: {zoom.toFixed(2)}x</div>
              <div>坐标: ({hoverPos.x.toFixed(1)}, {hoverPos.y.toFixed(1)})</div>
            </div>
          )}

          {/* Mouse coords (top-right) */}
          {hoverPos && (
            <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.7)', color: '#fbbf24', fontSize: 12, padding: '2px 6px', borderRadius: 2, fontFamily: 'monospace' }}>
              X: {hoverPos.x.toFixed(1)} Y: {hoverPos.y.toFixed(1)} | Zoom: {zoom.toFixed(2)}x
            </div>
          )}
        </div>

        {/* WW Presets Panel */}
        {showWwPanel && (
          <div style={{ width: 150, background: '#1a1a1a', borderLeft: '1px solid #333', padding: 8, overflowY: 'auto' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 700 }}>窗宽/窗位 预设</div>
            {WINDOW_PRESETS.map((p, i) => (
              <div
                key={i}
                onClick={() => { setPreset(i); }}
                style={{
                  background: i === preset ? '#1e3a5f' : '#0a0a0a',
                  border: i === preset ? '1px solid #3b82f6' : '1px solid #333',
                  borderRadius: 4,
                  padding: 6,
                  marginBottom: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#cbd5e1',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.icon} {p.label}</div>
                <div style={{ color: '#64748b' }}>WW: {p.ww} WL: {p.wc}</div>
                <div style={{
                  height: 6,
                  borderRadius: 2,
                  marginTop: 4,
                  background: `linear-gradient(to right, #222, ${p.color})`,
                }} />
              </div>
            ))}
          </div>
        )}

        {/* Measurement panel */}
        {showMeasurementPanel && measurements.length > 0 && (
          <div style={{ width: 160, background: '#1a1a1a', borderLeft: '1px solid #333', padding: 8, overflowY: 'auto' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 700 }}>测量 ({measurements.length})</div>
            {measurements.map(m => (
              <div key={m.id} style={{ background: '#0a0a0a', border: '1px solid #333', borderRadius: 4, padding: 6, marginBottom: 4, fontSize: 12, color: '#cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>{m.label}</span>
                  <button onClick={() => setMeasurements(prev => prev.filter(x => x.id !== m.id))} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}>×</button>
                </div>
                <div style={{ color: '#fbbf24', marginTop: 2 }}>{m.value} {m.unit}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
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
      <Icon size={14} color={active ? '#fff' : '#94a3b8'} />
    </button>
  );
}
