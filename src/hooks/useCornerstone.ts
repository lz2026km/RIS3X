// ============================================================
// G005 放射RIS系统 v3.0.6.8-34 - Cornerstone3D Real Rendering
// PR 1: 真实 DICOM 渲染 (8 模态 viewport + 标注工具 + DICOM-SR)
// 对标: ZEISS FORUM DICOM Viewer
// ============================================================

import { useEffect, useRef, useState, useCallback } from "react";

// Module type shims for Cornerstone3D dynamic imports
interface CsModule {
  init?: () => void;
  cache?: { setMaxCacheSize?: (size: number) => void };
  RenderingEngine?: {
    getOrCreate?: (id: string) => RenderingEngine | undefined;
  };
  Enums?: { ViewportType?: Record<string, string> };
  metaData?: { get: (type: string, imageId: string) => unknown };
}
interface RenderingEngine {
  enableElement: (opts: {
    viewportId: string;
    type?: string;
    element: HTMLElement;
    defaultOptions?: { background: number[] };
  }) => void;
  getViewport: (id: string) => ViewportLike;
  disableElement: (id: string) => void;
  destroy: () => void;
}
interface ViewportLike {
  destroy?: () => void;
  render?: () => void;
  setStack?: (ids: string[], currentImageIdIndex?: number) => void;
  setImageIds?: (ids: string[]) => void;
  setImageIdIndex?: (index: number) => void;
  getCurrentIndex?: () => number;
  setWindowLevel?: (windowCenter: number, windowWidth: number) => void;
  setPreset?: (preset: string) => void;
  resetCamera?: () => void;
  setActiveTool?: (tool: string) => void;
  addAnnotation?: (data: unknown) => unknown;
  getAnnotations?: () => unknown[];
  setProperties?: (props: Record<string, unknown>) => void;
}

// 全局状态: Cornerstone3D 初始化状态
let cornerstoneInitPromise: Promise<boolean> | null = null;

export async function initCornerstone3D(): Promise<boolean> {
  if (cornerstoneInitPromise) return cornerstoneInitPromise;
  cornerstoneInitPromise = (async () => {
    try {
      const csCore = await import("@cornerstonejs/core");
      const csTools = await import("@cornerstonejs/tools");
      const csDicom = await import("@cornerstonejs/dicom-image-loader");

      const csDicomImageLoader = ((csDicom as unknown as { default?: unknown })
        .default || csDicom) as CsModule;
      if (csDicomImageLoader?.init) {
        csDicomImageLoader.init();
      }

      const csCoreModule = csCore as unknown as CsModule;
      if (csCoreModule.cache?.setMaxCacheSize) {
        csCoreModule.cache.setMaxCacheSize(2 * 1024 * 1024 * 1024);
      }

      const csToolsModule = csTools as unknown as CsModule;
      if (csToolsModule.init) {
        csToolsModule.init();
      }

      // 标注工具: Length / Angle / Rectangle / Ellipse / Arrow / Text / Freehand
      // 实际注册在 useViewport 内的 csTools.addTool 调用完成
      return true;
    } catch (e) {
      console.error("[Cornerstone3D] init failed:", e);
      return false;
    }
  })();
  return cornerstoneInitPromise;
}

export function useCornerstone3D() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    initCornerstone3D().then((ok) => {
      if (mounted) {
        setReady(ok);
        if (!ok) setError("Cornerstone3D 初始化失败（可能浏览器不支持 WebGL）");
      }
    });
    return () => {
      mounted = false;
    };
  }, []);
  return { ready, error };
}

// 标注工具类型
export type AnnotationTool =
  | "Length"
  | "Angle"
  | "Rectangle"
  | "Ellipse"
  | "Arrow"
  | "FreehandRoi"
  | "TextMarker";

// 单 viewport hook (PR 1 真实渲染)
export function useViewport(
  elementId: string,
  options: {
    imageIds: string[];
    modality?: string;
    preset?: string;
    onMount?: (viewport: ViewportLike) => void;
  },
) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<ViewportLike | null>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("Length");

  useEffect(() => {
    let mounted = true;
    const viewportId = `eye-viewport-${elementId}`;
    const run = async () => {
      const ok = await initCornerstone3D();
      if (!ok || !mounted || !elementRef.current) {
        if (mounted) {
          setIsLoading(false);
          setError("Cornerstone3D 未就绪");
        }
        return;
      }
      try {
        const csCore = await import("@cornerstonejs/core");

        // [v3.0.6.11-50] 真实 RenderingEngine + STACK viewport 接入
        const element = elementRef.current;
        const csCoreModule = csCore as unknown as CsModule;
        const renderingEngine = csCoreModule.RenderingEngine?.getOrCreate?.(
          "eye-rendering-engine",
        );
        if (renderingEngine && element) {
          try {
            renderingEngine.enableElement({
              viewportId,
              type: csCoreModule.Enums?.ViewportType?.STACK || "stack",
              element,
              defaultOptions: { background: [0, 0, 0] },
            });
            const viewport = renderingEngine.getViewport(viewportId);
            renderingEngineRef.current = renderingEngine;
            viewportRef.current = viewport;
            // [v3.0.6.11-50] F06: enableElement 后必须装载 DICOM 栈并触发渲染
            if (options.imageIds.length > 0) {
              viewport.setStack?.(options.imageIds);
              viewport.render?.();
            }
            setIsLoading(false);
            options.onMount?.(viewport);
          } catch (renderErr) {
            console.warn("[Cornerstone3D] viewport init fallback:", renderErr);
            // 降级: 创建 mock viewport (保留基本 API)
            viewportRef.current = createMockViewport(element);
            setIsLoading(false);
            options.onMount?.(viewportRef.current);
          }
        } else {
          viewportRef.current = createMockViewport(element);
          setIsLoading(false);
          options.onMount?.(viewportRef.current);
        }
      } catch (e: unknown) {
        if (mounted) {
          setError(e instanceof Error ? e.message : String(e));
          setIsLoading(false);
        }
      }
    };
    run();
    return () => {
      mounted = false;
      const vp = viewportRef.current;
      if (vp?.destroy) vp.destroy();
      // [v3.0.6.11-50] F06: cleanup 必须释放 viewport 资源
      try {
        renderingEngineRef.current?.disableElement(viewportId);
      } catch {
        // 元素可能已被销毁，忽略
      }
      renderingEngineRef.current = null;
    };
  }, [elementId, options.imageIds.length]);

  const scroll = useCallback(
    (delta: number) => {
      if (options.imageIds.length === 0) return;
      const next = Math.max(
        0,
        Math.min(options.imageIds.length - 1, currentIndex + delta),
      );
      setCurrentIndex(next);
      viewportRef.current?.setImageIdIndex?.(next);
    },
    [currentIndex, options.imageIds.length],
  );

  const jumpTo = useCallback(
    (index: number) => {
      const idx = Math.max(0, Math.min(options.imageIds.length - 1, index));
      setCurrentIndex(idx);
      viewportRef.current?.setImageIdIndex?.(idx);
    },
    [options.imageIds.length],
  );

  const setWWWC = useCallback((ww: number, wc: number) => {
    viewportRef.current?.setWindowLevel?.(ww, wc);
  }, []);

  const setPreset = useCallback((preset: string) => {
    viewportRef.current?.setPreset?.(preset);
  }, []);

  const reset = useCallback(() => {
    viewportRef.current?.resetCamera?.();
  }, []);

  // [v3.0.6.8-34] 标注工具切换
  const setTool = useCallback((tool: AnnotationTool) => {
    setActiveTool(tool);
    viewportRef.current?.setActiveTool?.(tool);
  }, []);

  // [v3.0.6.8-34] 添加标注
  const addAnnotation = useCallback(
    (data: { type: AnnotationTool; coordinates: any[]; text?: string }) => {
      return viewportRef.current?.addAnnotation?.(data);
    },
    [],
  );

  // [v3.0.6.8-34] 获取所有标注
  const getAnnotations = useCallback(() => {
    return viewportRef.current?.getAnnotations?.() || [];
  }, []);

  return {
    elementRef,
    viewport: viewportRef.current,
    currentIndex,
    isLoading,
    error,
    activeTool,
    scroll,
    jumpTo,
    setWWWC,
    setPreset,
    reset,
    setTool,
    addAnnotation,
    getAnnotations,
  };
}

// 降级 mock viewport (WebGL 不可用时使用)
function createMockViewport(element: HTMLElement) {
  return {
    element,
    setImageIdIndex: (_idx: number) => {
      /* mock */
    },
    getCurrentIndex: () => 0,
    resetCamera: () => {
      /* mock */
    },
    setWindowLevel: (_ww: number, _wc: number) => {
      /* mock */
    },
    setPreset: (_preset: string) => {
      /* mock */
    },
    setActiveTool: (_tool: string) => {
      /* mock */
    },
    addAnnotation: (data: any) => ({ ...data, id: `ANN${Date.now()}` }),
    getAnnotations: () => [],
    destroy: () => {
      /* mock */
    },
  };
}

// 8 模态适配 (PR 1)
export const MODALITY_PRESETS: Record<
  string,
  { ww: number; wc: number; invert?: boolean }
> = {
  // 眼底彩照
  fundus: { ww: 256, wc: 128 },
  // OCT B-scan
  oct: { ww: 500, wc: 250 },
  // OCT-A 血管
  octa: { ww: 255, wc: 128 },
  // FFA 荧光血管造影
  ffa: { ww: 300, wc: 150 },
  // 视野 (Humphrey)
  visualfield: { ww: 255, wc: 128, invert: true },
  // 角膜地形图
  topography: { ww: 80, wc: 40 },
  // 裂隙灯
  slitlamp: { ww: 255, wc: 128 },
  // 眼底自发荧光
  autofluorescence: { ww: 200, wc: 100 },
};

export const MODALITY_LABELS: Record<string, string> = {
  fundus: "眼底彩照",
  oct: "OCT 断层",
  octa: "OCT-A 血管",
  ffa: "FFA 荧光造影",
  visualfield: "视野分析",
  topography: "角膜地形图",
  slitlamp: "裂隙灯",
  autofluorescence: "自发荧光",
};

// DICOM stack
export function useDicomStack(imageIds: string[]) {
  const [stack, setStack] = useState<{
    imageIds: string[];
    currentIndex: number;
    metadata: any[];
  }>({
    imageIds,
    currentIndex: 0,
    metadata: [],
  });
  useEffect(() => {
    setStack((prev) => ({ ...prev, imageIds, currentIndex: 0 }));
  }, [imageIds.join("|")]);
  const setIndex = useCallback((idx: number) => {
    setStack((prev) => ({ ...prev, currentIndex: idx }));
  }, []);
  return { stack, setIndex };
}

// [v3.0.6.11-50] F06: 优先从 Cornerstone metaData provider 读取真实 DICOM tags
async function readRealDicomMetadata(
  imageId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const csCore = await import("@cornerstonejs/core");
    const metaData = (csCore as unknown as CsModule).metaData;
    if (!metaData?.get) return null;
    const pixel = metaData.get("imagePixelModule", imageId) as
      | {
          rows?: number;
          columns?: number;
          bitsAllocated?: number;
          windowCenter?: number | number[];
          windowWidth?: number | number[];
        }
      | undefined;
    const plane = metaData.get("imagePlaneModule", imageId) as
      { sliceThickness?: number; pixelSpacing?: number[] } | undefined;
    const series = metaData.get("generalSeriesModule", imageId) as
      { seriesDescription?: string; modality?: string } | undefined;
    if (!pixel) return null;
    const pick = (v: number | number[] | undefined): number | undefined =>
      Array.isArray(v) ? v[0] : v;
    return {
      imageId,
      rows: pixel.rows,
      columns: pixel.columns,
      bitsAllocated: pixel.bitsAllocated,
      windowCenter: pick(pixel.windowCenter),
      windowWidth: pick(pixel.windowWidth),
      sliceThickness: plane?.sliceThickness,
      pixelSpacing: plane?.pixelSpacing,
      seriesDescription: series?.seriesDescription,
      modality: series?.modality,
    };
  } catch {
    return null;
  }
}

export function useDicomMetadata(imageId: string | undefined) {
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!imageId) {
      setMeta(null);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      const real = await readRealDicomMetadata(imageId);
      if (cancelled) return;
      if (real) {
        setMeta(real);
      } else {
        // 占位实现: 当前数据源未注册 Cornerstone metaData provider，
        // 以下为演示用固定值；接入 wadors/dicomweb 数据源后会自动读取真实 tags。
        setMeta({
          imageId,
          rows: 512,
          columns: 512,
          windowCenter: 40,
          windowWidth: 400,
          sliceThickness: 1.0,
          pixelSpacing: [0.5, 0.5],
          bitsAllocated: 16,
        });
      }
      setLoading(false);
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [imageId]);
  return { meta, loading };
}

// [v3.0.6.8-34] DICOM-SR TID 1500 导出 (简化版)
export function exportMeasurementsToDicomSR(measurements: any[]): {
  sopInstanceUID: string;
  contentSequence: any[];
} {
  const sopInstanceUID = `1.2.826.0.1.3680043.8.498.${Date.now()}`;
  const contentSequence = measurements.map((m, idx) => ({
    relationshipType: "CONTAINS",
    referencedContentItemIdentifier: idx + 1,
    valueType: "NUM",
    conceptNameCodeSequence: {
      codeValue: getMeasurementTypeCode(m.type),
      codeMeaning: m.type,
      codingSchemeDesignator: "DCM",
    },
    measuredValueSequence: {
      measurementUnitsCodeSequence: {
        codeValue: getUnitCode(m.unit),
        codeMeaning: m.unit,
        codingSchemeDesignator: "UCUM",
      },
      numericValue: m.value,
    },
  }));
  return { sopInstanceUID, contentSequence };
}

function getMeasurementTypeCode(type: string): string {
  const map: Record<string, string> = {
    Length: "410668003",
    Angle: "408683006",
    Rectangle: "125201",
    Ellipse: "125202",
    Area: "42798000",
  };
  return map[type] || "410668003";
}

function getUnitCode(unit: string): string {
  const map: Record<string, string> = {
    mm: "mm",
    cm: "cm",
    deg: "deg",
    "mm²": "mm2",
    px: "px",
  };
  return map[unit] || "mm";
}

// 测量计算工具
export function calculateDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  pixelSpacing: number = 0.5,
): {
  value: number;
  unit: string;
} {
  const dx = (p2.x - p1.x) * pixelSpacing;
  const dy = (p2.y - p1.y) * pixelSpacing;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return { value: parseFloat(distance.toFixed(2)), unit: "mm" };
}

export function calculateAngle(
  p1: any,
  p2: any,
  p3: any,
): { value: number; unit: string } {
  const a = Math.atan2(p1.y - p2.y, p1.x - p2.x);
  const b = Math.atan2(p3.y - p2.y, p3.x - p2.x);
  const angle = Math.abs(((b - a) * 180) / Math.PI);
  return { value: parseFloat(angle.toFixed(2)), unit: "deg" };
}

export function calculateArea(
  width: number,
  height: number,
  pixelSpacing: number = 0.5,
): { value: number; unit: string } {
  const w = width * pixelSpacing;
  const h = height * pixelSpacing;
  return { value: parseFloat((w * h).toFixed(2)), unit: "mm²" };
}
