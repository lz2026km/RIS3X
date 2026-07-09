// ============================================================
// G005 放射RIS系统 v2.1.0 - 测量工具基类
// Phase R10 W1: 长度/角度/椭圆 ROI/箭头/窗宽窗位
// ============================================================

export interface DicomMeasurement {
  id: string;
  type: 'length' | 'angle' | 'ellipse' | 'arrow' | 'text' | 'rectangle' | 'cobb' | 'angle-cobb';
  points: { x: number; y: number }[];   // viewport 坐标
  value: number;                          // 计算结果
  unit: string;                            // 'mm' / '°' / 'mm²' / 'HU'
  label: string;
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  imageIndex?: number;
  createdAt: string;
  createdBy: string;
}

export type ToolType = 'windowlevel' | 'pan' | 'zoom' | 'length' | 'angle' | 'ellipse' | 'arrow' | 'text' | 'cobb' | 'stack-scroll';

// 工具元数据
export const TOOLS: Record<ToolType, {
  id: ToolType;
  name: string;
  icon: string;
  shortcut: string;
  group: 'navigation' | 'measurement' | 'annotation';
  description: string;
}> = {
  'windowlevel':     { id: 'windowlevel',     name: '窗宽窗位',     icon: 'Sun',     shortcut: 'W', group: 'navigation', description: '调节 WW/WL' },
  'pan':             { id: 'pan',             name: '平移',         icon: 'Move',    shortcut: 'P', group: 'navigation', description: '平移图像' },
  'zoom':            { id: 'zoom',            name: '缩放',         icon: 'ZoomIn',  shortcut: 'Z', group: 'navigation', description: '缩放图像' },
  'length':          { id: 'length',          name: '长度',         icon: 'Ruler',   shortcut: 'L', group: 'measurement', description: '测量两点间距离（mm）' },
  'angle':           { id: 'angle',           name: '角度',         icon: 'Triangle',shortcut: 'A', group: 'measurement', description: '测量三点间角度（°）' },
  'ellipse':         { id: 'ellipse',         name: '椭圆 ROI',     icon: 'Circle',  shortcut: 'R', group: 'measurement', description: '椭圆区域 ROI（mm² / HU）' },
  'arrow':           { id: 'arrow',           name: '箭头标注',     icon: 'ArrowRight',shortcut:'T', group: 'annotation', description: '添加箭头标注' },
  'text':            { id: 'text',            name: '文字标注',     icon: 'Type',    shortcut: 'X', group: 'annotation', description: '添加文字标注' },
  'cobb':            { id: 'cobb',            name: 'Cobb 角',      icon: 'Minus',   shortcut: 'B', group: 'measurement', description: '脊柱 Cobb 角' },
  'stack-scroll':    { id: 'stack-scroll',    name: '序列滚动',     icon: 'Layers',  shortcut: 'S', group: 'navigation', description: '滚轮切层' },
};

// 计算工具函数
export function calculateLength(p1: { x: number; y: number }, p2: { x: number; y: number }, pixelSpacing: [number, number]): number {
  const dxMm = (p2.x - p1.x) * pixelSpacing[0];
  const dyMm = (p2.y - p1.y) * pixelSpacing[1];
  return Math.sqrt(dxMm * dxMm + dyMm * dyMm);
}

export function calculateAngle(p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }): number {
  const v1x = p1.x - p2.x;
  const v1y = p1.y - p2.y;
  const v2x = p3.x - p2.x;
  const v2y = p3.y - p2.y;
  const dot = v1x * v2x + v1y * v2y;
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cos) * (180 / Math.PI);
}

export function calculateEllipseArea(center: { x: number; y: number }, radii: { rx: number; ry: number }, pixelSpacing: [number, number]): { area: number; mean: number; min: number; max: number } {
  const rxMm = radii.rx * pixelSpacing[0];
  const ryMm = radii.ry * pixelSpacing[1];
  const area = Math.PI * rxMm * ryMm;
  // Mean/Min/Max 在实际 Cornerstone 中通过 EllipticalROITool 获取
  return { area, mean: 0, min: 0, max: 0 };
}

export function calculateCobbAngle(p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }, p4: { x: number; y: number }): number {
  // Cobb 角：p1-p2 是上端椎上终板，p3-p4 是下端椎下终板
  // Cobb 角 = 两条线夹角（取锐角）
  const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
  const angle2 = Math.atan2(p4.y - p3.y, p4.x - p3.x) * (180 / Math.PI);
  let cobb = Math.abs(angle1 - angle2);
  if (cobb > 180) cobb = 360 - cobb;
  if (cobb > 90) cobb = 180 - cobb;
  return Math.round(cobb * 100) / 100;
}

// 默认医生名
const DEFAULT_USER = 'doctor@g005.local';
let measurementCounter = 0;

export function createMeasurement(type: DicomMeasurement['type'], points: { x: number; y: number }[], value: number, unit: string, label: string): DicomMeasurement {
  measurementCounter++;
  return {
    id: `m-${Date.now()}-${measurementCounter}`,
    type,
    points,
    value: Math.round(value * 100) / 100,
    unit,
    label,
    createdAt: new Date().toISOString(),
    createdBy: DEFAULT_USER,
  };
}
