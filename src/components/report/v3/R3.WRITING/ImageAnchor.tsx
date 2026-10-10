/**
 * G005 放射RIS系统 v3.0.5.1 - 影像锚定
 * R3.WRITING 组 D:关键图像与影像引用
 * 10 升级点:标记 / 测量 / 引用 / 缩略图 / 关键标识
 */
import { IMAGE_ANCHORS_MOCK } from '@data/reportWritingMock';
import { pinImageAnchor, uploadImageToReport } from '@services/writing/writingService';
import type { ImageAnchor } from '@/types/R3/R3.WRITING';
import { Card, Space, Button, Tag, Tooltip, message, Empty, Switch, Select } from 'antd';
import { Image as ImageIcon, Star, ArrowUpRight, Circle as CircleIcon, Ruler, Pin, Copy, Move, ZoomIn, ZoomOut, Maximize2, Layers, Square, ArrowDown, Pen, Box, Activity, Info, Play, Pause, Cog , Type} from 'lucide-react';
import { Inbox } from 'lucide-react'
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { uniqueId } from '@utils/uniqueId';
import { t } from '../../../../i18n/appI18n';

let dicomUidSeq = 0;
/** 生成仅含数字与点的唯一 DICOM UID 后缀 (Date.now + 自增 + 随机数字), 满足 ^[0-9.]{1,64}$ */
function dicomUidSuffix(): string {
  dicomUidSeq = (dicomUidSeq + 1) % 1_000_000;
  const rand = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
  return `${Date.now()}${dicomUidSeq.toString().padStart(6, '0')}${rand}`;
}

interface Props {
  reportId: string;
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  onInsertAnchor?: (anchor: ImageAnchor) => void;
  readOnly?: boolean;
}

type AnnotationCategory = 'finding' | 'lesion' | 'organ' | 'measurement' | 'critical' | 'reference' | 'comparison';

interface AnnotationItem {
  type: string;
  color: string;
  label: string;
  coords: { x: number; y: number }[];
  measurement?: { value: number | string; unit: string };
}

const CATEGORY_COLORS: Record<AnnotationCategory, string> = {
  finding: 'var(--color-primary-500)',
  lesion: 'var(--color-error-500)',
  organ: '#10b981',
  measurement: '#8b5cf6',
  critical: 'var(--color-error-600)',
  reference: 'var(--color-warning-500)',
  comparison: 'var(--color-info-500)',
};

const CATEGORY_LABELS: Record<AnnotationCategory, string> = {
  finding: t('w9e.imageAnchor.catFinding'), lesion: t('w9e.imageAnchor.catLesion'), organ: t('w9e.imageAnchor.catOrgan'), measurement: t('w9e.imageAnchor.catMeasurement'),
  critical: t('w9e.imageAnchor.catCritical'), reference: t('w9e.imageAnchor.catReference'), comparison: t('w9e.imageAnchor.catComparison'),
};

const ANNOTATION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  arrow: ArrowUpRight,
  circle: CircleIcon,
  rect: Square,
  text: Type,
  point: Pin,
  line: Ruler,
  angle: Ruler,
  area: Square,
};

const TOOLS_PANEL = [
  { key: 'Arrow', icon: ArrowUpRight, label: t('w9e.imageAnchor.toolArrow') },
  { key: 'Rectangle', icon: Square, label: t('w9e.imageAnchor.toolRectangle') },
  { key: 'Ellipse', icon: CircleIcon, label: t('w9e.imageAnchor.toolEllipse') },
  { key: 'ArrowDown', icon: ArrowDown, label: t('w9e.imageAnchor.toolArrowDown') },
  { key: 'Pen', icon: Pen, label: t('w9e.imageAnchor.toolPen') },
  { key: 'Text', icon: Type, label: t('w9e.imageAnchor.toolText') },
  { key: 'CobbAngle', icon: Cog, label: t('w9e.imageAnchor.toolCobbAngle') },
  { key: 'Length', icon: Ruler, label: t('w9e.imageAnchor.toolLength') },
  { key: 'Area', icon: Box, label: t('w9e.imageAnchor.toolArea') },
  { key: 'Volume', icon: Box, label: t('w9e.imageAnchor.toolVolume') },
  { key: 'HU', icon: Activity, label: t('w9e.imageAnchor.toolHU') },
];

const MOCK_CATEGORIES: AnnotationCategory[] = ['finding', 'lesion', 'organ', 'measurement', 'reference', 'critical', 'comparison'];

function guessCategory(index: number): AnnotationCategory {
  return MOCK_CATEGORIES[index % MOCK_CATEGORIES.length]!;
}

function guessVersion(createdAt: string, index: number): string {new Date(createdAt);
  const major = Math.floor(index / 3) + 1;
  const minor = index % 3;
  return `v${major}.${minor}`;
}

const DICOM_SR_MOCK = {
  templateId: 'TID 1500 - Imaging Measurement Report',
  observationContext: 'Current study (1.2.840.10008.5.1.4.1.1.2.1.1)',
  measurementCount: 12,
};

export const ImageAnchorComponent: React.FC<Props> = ({ reportId, studyInstanceUID, seriesInstanceUID, onInsertAnchor, readOnly = false }) => {
  const [anchors, setAnchors] = useState<ImageAnchor[]>(IMAGE_ANCHORS_MOCK);
  const [selectedId, setSelectedId] = useState<string | null>(anchors[0]?.id ?? null);
  const [showOnlyKey, setShowOnlyKey] = useState(false);
  const [activeTool, setActiveTool] = useState<'select' | 'arrow' | 'circle' | 'line' | 'text'>('select');
  const [zoom, setZoom] = useState(1);
  const [frameMode, setFrameMode] = useState<'single' | 'cine'>('single');
  const [cineFrame, setCineFrame] = useState(1);
  // [G005 W1-Controls P0-3] cine 播放/暂停 (定时器循环帧)
  const [cinePlaying, setCinePlaying] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const selected = useMemo(() => anchors.find((a) => a.id === selectedId) ?? null, [anchors, selectedId]);

  const filtered = useMemo(() => {
    if (!showOnlyKey) return anchors;
    return anchors.filter((a) => a.keyImage);
  }, [anchors, showOnlyKey]);

  // [G005 W1-Controls P0-3] cine 播放: 每 300ms 循环推进帧号 (1..frameCount)
  useEffect(() => {
    if (!cinePlaying || frameMode !== 'cine') return;
    const frameCount = Math.max(1, Number(selected?.frameNumber ?? 1) || 1);
    const timer = setInterval(() => {
      setCineFrame((f) => (f >= frameCount ? 1 : f + 1));
    }, 300);
    return () => clearInterval(timer);
  }, [cinePlaying, frameMode, selected?.frameNumber]);

  // 切回单帧模式时停止播放
  useEffect(() => {
    if (frameMode !== 'cine') setCinePlaying(false);
  }, [frameMode]);

  const toggleFullscreen = useCallback(() => {
    const el = viewerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handlePin = useCallback(async (id: string) => {
    const updated = await pinImageAnchor(id, 'u-001');
    if (updated) {
      setAnchors((arr) => arr.map((a) => a.id === id ? updated : a));
      message.success(t('w9e.imageAnchor.pinned'));
    }
  }, []);

  const handleInsert = useCallback((anchor: ImageAnchor) => {
    onInsertAnchor?.(anchor);
    message.success(t('w9e.imageAnchor.inserted'));
  }, [onInsertAnchor]);

  const handleUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const data = ev.target?.result as string;await uploadImageToReport(reportId, { name: file.name, size: file.size, data });
        const newAnchor: ImageAnchor = {
          id: uniqueId('ia'), reportId,
          studyInstanceUID: studyInstanceUID ?? '1.2.840.10008.5.1.4.1.1.2.1.1',
          seriesInstanceUID: seriesInstanceUID ?? '1.2.840.10008.5.1.4.1.1.2.1.1.1',
          sopInstanceUID: `1.2.840.10008.5.1.4.1.1.2.1.1.1.${dicomUidSuffix()}`,
          frameNumber: 1, annotation: [],
          keyImage: false, thumbnail: data,
          status: 'active', createdBy: '陈医师', createdAt: new Date().toISOString(), usageCount: 0,
        };
        setAnchors((arr) => [...arr, newAnchor]);
        message.success(t('w9e.imageAnchor.uploaded', { name: file.name }));
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [reportId, studyInstanceUID, seriesInstanceUID]);

  return (
    <Card
      size="small"
      className="shadow-sm"
      title={
        <div className="flex items-center justify-between">
          <Space>
            <ImageIcon className="w-4 h-4" style={{ color: 'var(--color-info-600)' }} />
            <span className="font-semibold">{t('w9e.imageAnchor.title')}</span>
            <Tag color="blue">{t('w9e.imageAnchor.countTag', { count: filtered.length })}</Tag>
            <Tag color="amber" icon={<Star className="w-3 h-3" />}>{t('w9e.imageAnchor.keyTag', { count: anchors.filter((a) => a.keyImage).length })}</Tag>
          </Space>
          <Space>
            <Tooltip title={t('w9e.imageAnchor.onlyKeyTip')}><Switch size="small" checked={showOnlyKey} onChange={setShowOnlyKey} /></Tooltip>
            <Button size="small" type="primary" icon={<ImageIcon className="w-3 h-3" />} onClick={handleUpload} disabled={readOnly}>{t('w9e.imageAnchor.upload')}</Button>
          </Space>
        </div>
      }
    >
      <div className="space-y-3">
        {/* 工具栏 */}
        <div className="flex items-center gap-1 p-1 bg-slate-50 rounded">
          <Tooltip title={t('w9e.imageAnchor.toolSelect')}><Button size="small" type={activeTool === 'select' ? 'primary' : 'text'} icon={<Move className="w-3 h-3" />} onClick={() => setActiveTool('select')} /></Tooltip>
          <Tooltip title={t('w9e.imageAnchor.toolArrow')}><Button size="small" type={activeTool === 'arrow' ? 'primary' : 'text'} icon={<ArrowUpRight className="w-3 h-3" />} onClick={() => setActiveTool('arrow')} /></Tooltip>
          <Tooltip title={t('w9e.imageAnchor.toolCircleTip')}><Button size="small" type={activeTool === 'circle' ? 'primary' : 'text'} icon={<CircleIcon className="w-3 h-3" />} onClick={() => setActiveTool('circle')} /></Tooltip>
          <Tooltip title={t('w9e.imageAnchor.toolLineTip')}><Button size="small" type={activeTool === 'line' ? 'primary' : 'text'} icon={<Ruler className="w-3 h-3" />} onClick={() => setActiveTool('line')} /></Tooltip>
          <Tooltip title={t('w9e.imageAnchor.toolTextTip')}><Button size="small" type={activeTool === 'text' ? 'primary' : 'text'} icon={<Type className="w-3 h-3" />} onClick={() => setActiveTool('text')} /></Tooltip>
          <div className="flex-1" />
          <Select
            size="small"
            value={frameMode}
            onChange={setFrameMode}
            style={{ width: 110 }}
            options={[
              { value: 'single', label: t('w9e.imageAnchor.frameSingle') },
              { value: 'cine', label: t('w9e.imageAnchor.frameCine') },
            ]}
          />
          <div className="w-1" />
          <Space.Compact>
            <Button size="small" icon={<ZoomOut className="w-3 h-3" />} onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} />
            <Button size="small">{(zoom * 100).toFixed(0)}%</Button>
            <Button size="small" icon={<ZoomIn className="w-3 h-3" />} onClick={() => setZoom((z) => Math.min(3, z + 0.1))} />
          </Space.Compact>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* 图像区 */}
          <div className="col-span-2 border border-slate-200 rounded bg-slate-900 relative overflow-hidden" style={{ minHeight: isFullscreen ? '100vh' : 360 }} ref={viewerRef}>
            {selected ? (
              <>
                <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
                  <Tag color="blue">{selected.sopInstanceUID.slice(-12)}</Tag>
                  {selected.keyImage && <Tag color="amber" icon={<Star className="w-3 h-3 fill-amber-500" />}>{t('w9e.imageAnchor.keyImage')}</Tag>}
                  {selected.windowing && <Tag color="cyan">W:{selected.windowing.width}/C:{selected.windowing.center}</Tag>}
                  {frameMode === 'cine' && (
                    <Tag color="purple" icon={<Play className="w-3 h-3" />}>{t('w9e.imageAnchor.cineFrame', { frame: cineFrame })}</Tag>
                  )}
                </div>
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                  <Button size="small" icon={<Pin className="w-3 h-3" />} onClick={() => handlePin(selected.id)} />
                  <Button size="small" icon={<Copy className="w-3 h-3" />} onClick={() => handleInsert(selected)} />
                  <Button size="small" type={isFullscreen ? 'primary' : 'default'} icon={<Maximize2 className="w-3 h-3" />} onClick={toggleFullscreen} />
                  {frameMode === 'cine' && (
                    <>
                      {/* [G005 W1-Controls P0-3] 真实播放/暂停 (每 300ms 循环帧) */}
                      <Tooltip title={cinePlaying ? t('w1Controls.imageAnchor.pause') : t('w1Controls.imageAnchor.playTip')}>
                        <Button
                          size="small"
                          type={cinePlaying ? 'primary' : 'default'}
                          icon={cinePlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                          onClick={() => setCinePlaying((p) => !p)}
                          data-testid="cine-toggle"
                        />
                      </Tooltip>
                    </>
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-center text-slate-400" style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s' }}>
                  <div className="text-center">
                    <ImageIcon className="w-20 h-20 mx-auto mb-2 opacity-30" />
                    <div className="text-xs font-mono opacity-60">{selected.thumbnail || '/mock/ct-001.png'}</div>
                    <div className="text-xs opacity-60 mt-1">
                      {frameMode === 'cine' ? t('w9e.imageAnchor.cineFrame', { frame: cineFrame }) : `Frame ${selected.frameNumber}`}
                    </div>
                  </div>
                </div>
                {/* 标注可视化 */}
                {selected.annotation.map((a: AnnotationItem, i: number) => {
                  const Icon = ANNOTATION_ICONS[a.type] ?? Pin;
                  const cat = guessCategory(i);
                  return (
                    <div key={i} className="absolute" style={{ left: `${a.coords[0]?.x ?? 50}%`, top: `${a.coords[0]?.y ?? 50}%`, color: a.color }}>
                      <Icon className="w-5 h-5" />
                      <div className="flex items-center gap-1 text-xs whitespace-nowrap bg-black/50 text-white px-1 rounded">
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                        {a.label}
                      </div>
                    </div>
                  );
                })}
                {/* 工具预览 */}
                {activeTool !== 'select' && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-1 rounded z-10">
                    {activeTool === 'arrow' && t('w9e.imageAnchor.tipArrow')}
                    {activeTool === 'circle' && t('w9e.imageAnchor.tipCircle')}
                    {activeTool === 'line' && t('w9e.imageAnchor.tipLine')}
                    {activeTool === 'text' && t('w9e.imageAnchor.tipText')}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('w9e.imageAnchor.selectImage')} />
              </div>
            )}
          </div>

          {/* 缩略图列 */}
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {filtered.length === 0 ? (
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('w9e.imageAnchor.noAnchors')} />
            ) : (
              filtered.map((a) => (
                <div
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`relative p-1.5 border-2 rounded cursor-pointer transition ${selectedId === a.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 bg-slate-200 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate flex items-center gap-1">
                        {a.keyImage && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                        {a.id}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {t('w9e.imageAnchor.annotationCount', { count: a.annotation.length, frame: a.frameNumber })}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {a.createdBy} · {t('w9e.imageAnchor.usageCount', { count: a.usageCount })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 标注工具面板 */}
        <div className="border-t border-slate-200 pt-3">
          <h5 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
            <Cog className="w-3 h-3" />{t('w9e.imageAnchor.toolsTitle')}
          </h5>
          <div className="flex items-center gap-1 p-1 bg-slate-50 rounded flex-wrap">
            {TOOLS_PANEL.map((tool) => (
              <Tooltip key={tool.key} title={tool.label}>
                <Button size="small" type="text" icon={<tool.icon className="w-3.5 h-3.5" />} onClick={() => setActiveTool(tool.key as 'select' | 'arrow' | 'circle' | 'line' | 'text')} />
              </Tooltip>
            ))}
          </div>
        </div>

        {/* 标注详情 */}
        {selected && selected.annotation.length > 0 && (
          <div className="border-t border-slate-200 pt-3">
            <h5 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
              <Layers className="w-3 h-3" />{t('w9e.imageAnchor.annotationsTitle', { count: selected.annotation.length })}
            </h5>
            <div className="grid grid-cols-2 gap-2">
              {selected.annotation.map((a: AnnotationItem, i: number) => {
                const Icon = ANNOTATION_ICONS[a.type] ?? Pin;
                const cat = guessCategory(i);
                const ver = guessVersion(selected.createdAt, i);
                return (
                  <div key={i} className="flex items-center gap-2 p-1.5 bg-slate-50 rounded text-xs">
                    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] }} title={CATEGORY_LABELS[cat]} />
                    <Icon className="w-3 h-3 flex-shrink-0" style={{ color: a.color }} />
                    <span className="font-semibold">{a.label}</span>
                    {a.measurement && <Tag color="blue">{a.measurement.value}{a.measurement.unit}</Tag>}
                    <Tag color="default" className="text-[10px]">{ver}</Tag>
                    <span className="text-slate-400 ml-auto">({a.coords[0]?.x}, {a.coords[0]?.y})</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DICOM SR 元数据 */}
        {selected && (
          <div className="border-t border-slate-200 pt-3">
            <h5 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
              <Info className="w-3 h-3" />{t('w9e.imageAnchor.srTitle')}
            </h5>
            <div className="text-xs font-mono bg-slate-50 p-2 rounded space-y-1">
              <div>{t('w9e.imageAnchor.templateId')}<span className="text-blue-600">{DICOM_SR_MOCK.templateId}</span></div>
              <div>{t('w9e.imageAnchor.observationContext')}<span className="text-blue-600">{DICOM_SR_MOCK.observationContext}</span></div>
              <div>{t('w9e.imageAnchor.measurementCount')}<span className="text-blue-600">{DICOM_SR_MOCK.measurementCount}</span></div>
            </div>
          </div>
        )}

        {/* DICOM 引用 */}
        {selected && (
          <div className="text-xs text-slate-500 font-mono bg-slate-50 p-2 rounded">
            <div>SOP Instance UID: <span className="text-blue-600">{selected.sopInstanceUID}</span></div>
            <div>{t('w9e.imageAnchor.studyUid')}<span className="text-blue-600">{selected.studyInstanceUID}</span></div>
            <div>{t('w9e.imageAnchor.seriesUid')}<span className="text-blue-600">{selected.seriesInstanceUID}</span></div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ImageAnchorComponent;
