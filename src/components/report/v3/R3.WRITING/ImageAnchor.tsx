/**
 * G005 放射RIS系统 v3.0.5.1 - 影像锚定
 * R3.WRITING 组 D:关键图像与影像引用
 * 10 升级点:标记 / 测量 / 引用 / 缩略图 / 关键标识
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Card, Space, Button, Tag, Tooltip, message, Modal, Empty, Switch, Statistic, Row, Col, Select } from 'antd';
import {
  Image as ImageIcon, Star, ArrowUpRight, Circle as CircleIcon, Type, Ruler,
  Eye, Pin, Trash2, Copy, Move, ZoomIn, ZoomOut, Maximize2, Hash, Layers,
  Square, ArrowDown, Pen, Box, Activity, Info, Play, Cog,
} from 'lucide-react';
import { IMAGE_ANCHORS_MOCK } from '@data/reportWritingMock';
import { getImageAnchors, pinImageAnchor, uploadImageToReport } from '@services/writing/writingService';
import type { ImageAnchor } from '@types/R3/R3.WRITING';

interface Props {
  reportId: string;
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  onInsertAnchor?: (anchor: ImageAnchor) => void;
  readOnly?: boolean;
}

type AnnotationCategory = 'finding' | 'lesion' | 'organ' | 'measurement' | 'critical' | 'reference' | 'comparison';

const CATEGORY_COLORS: Record<AnnotationCategory, string> = {
  finding: '#3b82f6',
  lesion: '#ef4444',
  organ: '#10b981',
  measurement: '#8b5cf6',
  critical: '#dc2626',
  reference: '#f59e0b',
  comparison: '#06b6d4',
};

const CATEGORY_LABELS: Record<AnnotationCategory, string> = {
  finding: '所见', lesion: '病灶', organ: '器官', measurement: '测量值',
  critical: '危急', reference: '参考', comparison: '比较',
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

const ANNOTATION_COLORS: Record<string, string> = {
  arrow: '#dc2626',
  circle: '#10b981',
  rect: '#3b82f6',
  text: '#f59e0b',
  point: '#7c3aed',
  line: '#0891b2',
};

const TOOLS_PANEL = [
  { key: 'Arrow', icon: ArrowUpRight, label: '箭头' },
  { key: 'Rectangle', icon: Square, label: '矩形' },
  { key: 'Ellipse', icon: CircleIcon, label: '椭圆' },
  { key: 'ArrowDown', icon: ArrowDown, label: '下箭头' },
  { key: 'Pen', icon: Pen, label: '画笔' },
  { key: 'Text', icon: Type, label: '文字' },
  { key: 'CobbAngle', icon: Cog, label: 'Cobb角' },
  { key: 'Length', icon: Ruler, label: '长度' },
  { key: 'Area', icon: Box, label: '面积' },
  { key: 'Volume', icon: Box, label: '体积' },
  { key: 'HU', icon: Activity, label: 'HU测量' },
];

const MOCK_CATEGORIES: AnnotationCategory[] = ['finding', 'lesion', 'organ', 'measurement', 'reference', 'critical', 'comparison'];

function guessCategory(index: number): AnnotationCategory {
  return MOCK_CATEGORIES[index % MOCK_CATEGORIES.length];
}

function guessVersion(createdAt: string, index: number): string {
  const d = new Date(createdAt);
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

  const filtered = useMemo(() => {
    if (!showOnlyKey) return anchors;
    return anchors.filter((a) => a.keyImage);
  }, [anchors, showOnlyKey]);

  const selected = useMemo(() => anchors.find((a) => a.id === selectedId) ?? null, [anchors, selectedId]);

  const handlePin = useCallback(async (id: string) => {
    const updated = await pinImageAnchor(id, 'u-001');
    if (updated) {
      setAnchors((arr) => arr.map((a) => a.id === id ? updated : a));
      message.success('已置顶');
    }
  }, []);

  const handleInsert = useCallback((anchor: ImageAnchor) => {
    onInsertAnchor?.(anchor);
    message.success('已插入到报告');
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
        const data = ev.target?.result as string;
        const res = await uploadImageToReport(reportId, { name: file.name, size: file.size, data });
        const newAnchor: ImageAnchor = {
          id: `ia-${Date.now()}`, reportId,
          studyInstanceUID: studyInstanceUID ?? '1.2.840.10008.5.1.4.1.1.2.1.1',
          seriesInstanceUID: seriesInstanceUID ?? '1.2.840.10008.5.1.4.1.1.2.1.1.1',
          sopInstanceUID: `1.2.840.10008.5.1.4.1.1.2.1.1.1.${Date.now()}`,
          frameNumber: 1, annotation: [],
          keyImage: false, thumbnail: data,
          status: 'active', createdBy: '陈医师', createdAt: new Date().toISOString(), usageCount: 0,
        };
        setAnchors((arr) => [...arr, newAnchor]);
        message.success(`已上传 ${file.name}`);
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
            <ImageIcon className="w-4 h-4" style={{ color: '#0891b2' }} />
            <span className="font-semibold">影像锚定</span>
            <Tag color="blue">{filtered.length} 个</Tag>
            <Tag color="amber" icon={<Star className="w-3 h-3" />}>关键 {anchors.filter((a) => a.keyImage).length}</Tag>
          </Space>
          <Space>
            <Tooltip title="仅显示关键图像"><Switch size="small" checked={showOnlyKey} onChange={setShowOnlyKey} /></Tooltip>
            <Button size="small" type="primary" icon={<ImageIcon className="w-3 h-3" />} onClick={handleUpload} disabled={readOnly}>上传</Button>
          </Space>
        </div>
      }
    >
      <div className="space-y-3">
        {/* 工具栏 */}
        <div className="flex items-center gap-1 p-1 bg-slate-50 rounded">
          <Tooltip title="选择"><Button size="small" type={activeTool === 'select' ? 'primary' : 'text'} icon={<Move className="w-3 h-3" />} onClick={() => setActiveTool('select')} /></Tooltip>
          <Tooltip title="箭头"><Button size="small" type={activeTool === 'arrow' ? 'primary' : 'text'} icon={<ArrowUpRight className="w-3 h-3" />} onClick={() => setActiveTool('arrow')} /></Tooltip>
          <Tooltip title="圆"><Button size="small" type={activeTool === 'circle' ? 'primary' : 'text'} icon={<CircleIcon className="w-3 h-3" />} onClick={() => setActiveTool('circle')} /></Tooltip>
          <Tooltip title="线/测距"><Button size="small" type={activeTool === 'line' ? 'primary' : 'text'} icon={<Ruler className="w-3 h-3" />} onClick={() => setActiveTool('line')} /></Tooltip>
          <Tooltip title="文字"><Button size="small" type={activeTool === 'text' ? 'primary' : 'text'} icon={<Type className="w-3 h-3" />} onClick={() => setActiveTool('text')} /></Tooltip>
          <div className="flex-1" />
          <Select
            size="small"
            value={frameMode}
            onChange={setFrameMode}
            style={{ width: 110 }}
            options={[
              { value: 'single', label: '单帧' },
              { value: 'cine', label: '多帧动态' },
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
          <div className="col-span-2 border border-slate-200 rounded bg-slate-900 relative overflow-hidden" style={{ minHeight: 360 }}>
            {selected ? (
              <>
                <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
                  <Tag color="blue">{selected.sopInstanceUID.slice(-12)}</Tag>
                  {selected.keyImage && <Tag color="amber" icon={<Star className="w-3 h-3 fill-amber-500" />}>关键图像</Tag>}
                  {selected.windowing && <Tag color="cyan">W:{selected.windowing.width}/C:{selected.windowing.center}</Tag>}
                  {frameMode === 'cine' && (
                    <Tag color="purple" icon={<Play className="w-3 h-3" />}>帧 {cineFrame}/60</Tag>
                  )}
                </div>
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                  <Button size="small" icon={<Pin className="w-3 h-3" />} onClick={() => handlePin(selected.id)} />
                  <Button size="small" icon={<Copy className="w-3 h-3" />} onClick={() => handleInsert(selected)} />
                  <Button size="small" icon={<Maximize2 className="w-3 h-3" />} />
                  {frameMode === 'cine' && (
                    <>
                      <Button size="small" icon={<Play className="w-3 h-3" />} onClick={() => message.info('播放动态(暂未实现)')} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                    </>
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-center text-slate-400" style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s' }}>
                  <div className="text-center">
                    <ImageIcon className="w-20 h-20 mx-auto mb-2 opacity-30" />
                    <div className="text-xs font-mono opacity-60">{selected.thumbnail || '/mock/ct-001.png'}</div>
                    <div className="text-xs opacity-60 mt-1">
                      {frameMode === 'cine' ? `帧 ${cineFrame}/60` : `Frame ${selected.frameNumber}`}
                    </div>
                  </div>
                </div>
                {/* 标注可视化 */}
                {selected.annotation.map((a, i) => {
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
                    {activeTool === 'arrow' && '点击图像放置箭头'}
                    {activeTool === 'circle' && '拖动绘制圆形 ROI'}
                    {activeTool === 'line' && '拖动测量距离'}
                    {activeTool === 'text' && '点击添加文字标注'}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <Empty description="请选择左侧图像" />
              </div>
            )}
          </div>

          {/* 缩略图列 */}
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {filtered.length === 0 ? (
              <Empty description="暂无锚定" />
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
                        {a.annotation.length} 标注 · Frame {a.frameNumber}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {a.createdBy} · {a.usageCount}次使用
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
            <Cog className="w-3 h-3" />标注工具
          </h5>
          <div className="flex items-center gap-1 p-1 bg-slate-50 rounded flex-wrap">
            {TOOLS_PANEL.map((tool) => (
              <Tooltip key={tool.key} title={tool.label}>
                <Button size="small" type="text" icon={<tool.icon className="w-3.5 h-3.5" />} onClick={() => setActiveTool(tool.key)} />
              </Tooltip>
            ))}
          </div>
        </div>

        {/* 标注详情 */}
        {selected && selected.annotation.length > 0 && (
          <div className="border-t border-slate-200 pt-3">
            <h5 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
              <Layers className="w-3 h-3" />标注 ({selected.annotation.length})
            </h5>
            <div className="grid grid-cols-2 gap-2">
              {selected.annotation.map((a, i) => {
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
              <Info className="w-3 h-3" />DICOM SR 元数据
            </h5>
            <div className="text-xs font-mono bg-slate-50 p-2 rounded space-y-1">
              <div>Template ID: <span className="text-blue-600">{DICOM_SR_MOCK.templateId}</span></div>
              <div>Observation Context: <span className="text-blue-600">{DICOM_SR_MOCK.observationContext}</span></div>
              <div>Number of Measurements: <span className="text-blue-600">{DICOM_SR_MOCK.measurementCount}</span></div>
            </div>
          </div>
        )}

        {/* DICOM 引用 */}
        {selected && (
          <div className="text-xs text-slate-500 font-mono bg-slate-50 p-2 rounded">
            <div>SOP Instance UID: <span className="text-blue-600">{selected.sopInstanceUID}</span></div>
            <div>Study UID: <span className="text-blue-600">{selected.studyInstanceUID}</span></div>
            <div>Series UID: <span className="text-blue-600">{selected.seriesInstanceUID}</span></div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ImageAnchorComponent;
